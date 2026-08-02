import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import { redis, KEY_SNAPSHOT } from './config/redis.js';
import { Stock } from './models/index.js';
import { hydrateMarket, setSnapshot } from './market/market.js';
import { startProducer } from './market/producer.js';
import { initRealtime } from './market/realtime.js';
import apiRouter from './routes/api.js';
import authRouter from './routes/auth.js';

const PORT = process.env.PORT || 4000;

// ROLE lets one codebase run as the whole app (dev) or split for scaling:
//   all      – producer + gateway in one process (default, single-instance dev)
//   producer – only the price simulation (one of these, ever)
//   gateway  – only the API + WebSocket tier (run many behind a load balancer)
const ROLE = (process.env.ROLE || 'all').toLowerCase();
const isProducer = ROLE === 'all' || ROLE === 'producer';
const isGateway = ROLE === 'all' || ROLE === 'gateway';

async function main() {
  await connectDB(process.env.MONGO_URI);

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
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ ok: true, role: ROLE }));
  if (isGateway) {
    app.use('/api/auth', authRouter);
    app.use('/api', apiRouter);
  }

  const server = http.createServer(app);
  if (isGateway) initRealtime(server, { isProducer });
  if (isProducer) startProducer();

  server.listen(PORT, () => console.log(`[server] role=${ROLE} listening on http://localhost:${PORT}`));
}

main().catch((e) => {
  console.error('[boot] failed:', e);
  process.exit(1);
});
