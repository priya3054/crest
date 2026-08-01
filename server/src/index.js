import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './db.js';
import { Stock } from './models/index.js';
import { hydrateMarket, startSim } from './market.js';
import apiRouter from './routes/api.js';
import authRouter from './routes/auth.js';

const PORT = process.env.PORT || 4000;

async function main() {
  await connectDB(process.env.MONGO_URI);

  // Load stock definitions from Mongo and spin up the in-memory price simulation.
  const defs = await Stock.find().lean();
  if (defs.length === 0) {
    console.warn('[boot] no stocks found — run `npm run seed` first.');
  }
  hydrateMarket(defs);
  startSim();

  const app = express();
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);
  app.use('/api', apiRouter);

  app.listen(PORT, () => console.log(`[server] listening on http://localhost:${PORT}`));
}

main().catch((e) => {
  console.error('[boot] failed:', e);
  process.exit(1);
});
