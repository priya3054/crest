import { Account } from '../models/Account.js';
import { Holding } from '../models/Holding.js';
import { round2 } from '../utils/money.js';

// KNOWN LIMITATION: a trade touches two documents (Account cash + Holding qty)
// and they are NOT wrapped in a single transaction. Each write is individually
// atomic and guarded ($gte), so money/shares can never go negative — but if the
// process dies BETWEEN the two writes, the halves can diverge (cash debited with
// no shares booked, or shares removed with no cash credited). The clean fix is a
// Mongo multi-document transaction via a session, which requires a replica set;
// the demo docker-compose runs standalone Mongo, which can't start sessions.
export async function applyTrade(userId, symbol, side, qty, price) {
  const cost = round2(qty * price);

  if (side === 'buy') {
  
    const account = await Account.findOneAndUpdate(
      { userId, cash: { $gte: cost } },
      { $inc: { cash: -cost } },
      { new: true }
    );
    if (!account) return { ok: false, error: 'Insufficient balance' };

    // Credit the holding with optimistic concurrency control. A plain
    // findOne + save is a read-modify-write race: two concurrent buys both read
    // the same qty and one save() clobbers the other, silently losing shares the
    // user already paid for. Instead we compare-and-swap — the update only
    // matches if qty is still what we read; if a racing buy moved it, the update
    // matches nothing and we retry with fresh values. A brand-new holding is
    // inserted, and the unique (userId, symbol) index turns a create race into a
    // duplicate-key error, which we handle by retrying as an update.
    for (let attempt = 0; ; attempt++) {
      const h = await Holding.findOne({ userId, symbol });
      if (h) {
        const newQty = h.qty + qty;
        const newAvg = round2((h.avg * h.qty + cost) / newQty);
        const updated = await Holding.findOneAndUpdate(
          { userId, symbol, qty: h.qty }, // guard: only if qty is unchanged
          { $set: { qty: newQty, avg: newAvg } }
        );
        if (updated) break;
      } else {
        try {
          await Holding.create({ userId, symbol, qty, avg: round2(price) });
          break;
        } catch (e) {
          if (e.code !== 11000) throw e; // 11000 = duplicate key → created by a racing buy, retry as update
        }
      }
      if (attempt >= 50) throw new Error('holding update failed after repeated contention');
    }
    return { ok: true, cash: account.cash };
  }

  const holding = await Holding.findOneAndUpdate(
    { userId, symbol, qty: { $gte: qty } },
    { $inc: { qty: -qty } },
    { new: true }
  );
  if (!holding) return { ok: false, error: 'Insufficient holdings' };

  const account = await Account.findOneAndUpdate({ userId }, { $inc: { cash: cost } }, { new: true });
  
  if (holding.qty === 0) await Holding.deleteOne({ userId, symbol, qty: 0 });
  return { ok: true, cash: account.cash };
}
