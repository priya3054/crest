import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { Account } from '../src/models/Account.js';
import { Holding } from '../src/models/Holding.js';
import { applyTrade } from '../src/services/trade.js';

// Integration test: proves applyTrade's atomic guarded update actually prevents
// overspending under concurrency. Needs a Mongo instance; CI provides one as a
// service container (see .github/workflows/ci.yml). Locally it uses MONGO_URI or
// a default test DB, and skips cleanly if it can't connect.
const URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/crest_test';
let connected = false;

beforeAll(async () => {
  try {
    await mongoose.connect(URI, { serverSelectionTimeoutMS: 3000 });
    // Build indexes before the concurrent burst. The unique (userId, symbol)
    // index is what turns a racing create into a duplicate-key error (which
    // applyTrade retries as an update) instead of a duplicate document. In the
    // real server these are built at boot; in a fresh test DB we force it here.
    await Promise.all([Account.init(), Holding.init()]);
    connected = true;
  } catch {
    connected = false;
    console.warn(`[test] no Mongo at ${URI} — skipping concurrency test`);
  }
});

afterAll(async () => {
  if (connected) await mongoose.disconnect();
});

describe('applyTrade concurrency', () => {
  it('40 parallel buys never overspend the wallet', async () => {
    if (!connected) return; // skip when no DB is available

    const userId = new mongoose.Types.ObjectId();
    const START = 10000; // enough for exactly 10 buys
    const PRICE = 1000;
    const QTY = 1;
    const AFFORDABLE = START / PRICE; // 10

    await Account.deleteMany({ userId });
    await Holding.deleteMany({ userId, symbol: 'TEST' });
    await Account.create({ userId, cash: START });

    // Fire 40 buys at once; only 10 can possibly be afforded.
    const results = await Promise.all(
      Array.from({ length: 40 }, () => applyTrade(userId, 'TEST', 'buy', QTY, PRICE))
    );

    const filled = results.filter((r) => r.ok).length;
    const account = await Account.findOne({ userId });
    const holding = await Holding.findOne({ userId, symbol: 'TEST' });

    expect(account.cash).toBeGreaterThanOrEqual(0);   // never overspent
    expect(filled).toBe(AFFORDABLE);                  // exactly 10 succeeded
    expect(holding.qty).toBe(filled);                 // shares match fills
    expect(account.cash).toBe(START - filled * PRICE); // conservation of money

    await Account.deleteMany({ userId });
    await Holding.deleteMany({ userId, symbol: 'TEST' });
  });
});
