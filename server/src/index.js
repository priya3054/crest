import 'dotenv/config';
import http from 'http';
import os from 'os';
import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import { redis, pub, sub, KEY_SNAPSHOT } from './config/redis.js';
import { Stock } from './models/Stock.js';
import { Account } from './models/Account.js';
import { Holding } from './models/Holding.js';
import { Order } from './models/Order.js';
import { hydrateMarket, setSnapshot } from './market/market.js';
import { startProducer, stopProducer } from './market/producer.js';
import { initRealtime } from './market/realtime.js';
import apiRouter from './routes/api.js';
import authRouter from './routes/auth.js';

const PORT = process.env.PORT || 4000;

const ROLE = (process.env.ROLE || 'all').toLowerCase();
const isProducer = ROLE === 'all' || ROLE === 'producer';
const isGateway = ROLE === 'all' || ROLE === 'gateway';

// Fail fast with a clear message if required config is missing, instead of a
// cryptic driver error three steps later.
function checkEnv() {
  const required = ['MONGO_URI'];
  if (process.env.NODE_ENV === 'production') required.push('JWT_SECRET', 'REDIS_URL');
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`[boot] missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }
}

async function main() {
  checkEnv();
  await connectDB(process.env.MONGO_URI);

  // Build indexes before serving traffic. Trade concurrency safety depends on the
  // unique (userId, symbol) index on Holding, and the limit-order scan depends on
  // the Order index — so we wait for them rather than letting Mongoose build them
  // lazily in the background (which leaves a startup window where they're absent).
  await Promise.all([Account.init(), Holding.init(), Order.init()]);

  const defs = await Stock.find().lean();
  if (defs.length === 0) console.warn('[boot] no stocks found — run `npm run seed` first.');
  hydrateMarket(defs);

  // Gateway-only instances have no local producer, so sync prices from the cached
  // snapshot at boot; the tick stream keeps them fresh thereafter.
  if (isGateway && !isProducer) {
    try {
      const cached = await redis.get(KEY_SNAPSHOT);
      if (cached) setSnapshot(JSON.parse(cached).stocks);
    } catch (e) {
      console.warn('[boot] snapshot sync skipped:', e.message);
    }
  }

  const app = express();
  app.set('trust proxy', 1);
  // CORS: locked to CLIENT_ORIGIN when set; falls back to reflecting the origin for
  // local dev. Set CLIENT_ORIGIN in production so we don't accept any origin.
  if (process.env.NODE_ENV === 'production' && !process.env.CLIENT_ORIGIN) {
    console.warn('[boot] CLIENT_ORIGIN not set in production — CORS will reflect any origin.');
  }
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
  app.use(express.json());
  // Baseline security headers (helmet-equivalent, no dependency). To use helmet
  // instead: `npm i helmet` and replace this block with `app.use(helmet())`.
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff'); // don't let browsers MIME-sniff responses
    res.set('X-Frame-Options', 'DENY'); // no embedding in iframes (clickjacking)
    res.set('Referrer-Policy', 'no-referrer'); // don't leak URLs to other sites
    res.set('X-Served-By', os.hostname());
    next();
  });
  // Real health check: report unhealthy (503) if Mongo isn't connected, so a load
  // balancer stops routing traffic to a broken instance instead of being told
  // everything is fine. readyState 1 === connected.
  app.get('/health', (_req, res) => {
    const dbOk = mongoose.connection.readyState === 1;
    const redisOk = redis.status === 'ready';
    const ok = dbOk && redisOk;
    res.status(ok ? 200 : 503).json({ ok, db: dbOk, redis: redisOk, role: ROLE, host: os.hostname() });
  });
  if (isGateway) {
    app.use('/api/auth', authRouter);
    app.use('/api', apiRouter);
  }

  // Final error handler: Express 5 forwards async throws here. Without it the
  // default handler returns an HTML error page, which the JSON client can't read
  // (every error collapses to a generic "Request failed"). Keep it last.
  app.use((err, _req, res, _next) => {
    console.error('[api]', err);
    res.status(500).json({ error: 'Something went wrong.' });
  });

  const server = http.createServer(app);
  if (isGateway) initRealtime(server, { isProducer });
  if (isProducer) startProducer();

  server.listen(PORT, () => console.log(`[server] role=${ROLE} listening on http://localhost:${PORT}`));

  // Graceful shutdown: on SIGTERM (e.g. `docker compose down`) stop accepting
  // connections, halt the tick loop, and close DB/Redis so we don't get killed
  // mid-write with dangling timers and sockets.
  const shutdown = async (signal) => {
    console.log(`[server] ${signal} received — shutting down`);
    server.close();
    try {
      if (isProducer) stopProducer();
      await mongoose.disconnect();
      redis.disconnect();
      pub.disconnect();
      sub.disconnect();
    } catch (e) {
      console.error('[shutdown]', e.message);
    }
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((e) => {
  console.error('[boot] failed:', e);
  process.exit(1);
});
