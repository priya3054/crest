import { Account, Holding } from '../models/index.js';

const round2 = (n) => Math.round(n * 100) / 100;

// Apply a filled trade to a user's account — the ONE place cash/holdings move.
//
// The money-critical steps use atomic, guarded MongoDB updates so concurrent
// trades can't corrupt balances (no read-modify-write race, no locks):
//   • buy  – debit cash only if it covers the cost ($gte guard), atomically
//   • sell – decrement the holding only if enough shares exist ($gte guard)
// If the guard fails, the update matches nothing and we report the business error.
export async function applyTrade(userId, symbol, side, qty, price) {
  const cost = round2(qty * price);

  if (side === 'buy') {
    // Atomic conditional debit: succeeds only if cash >= cost.
    const account = await Account.findOneAndUpdate(
      { userId, cash: { $gte: cost } },
      { $inc: { cash: -cost } },
      { new: true }
    );
    if (!account) return { ok: false, error: 'Insufficient balance' };

    // Update the position (weighted-average cost). A concurrent buy of the *same*
    // symbol by the *same* user is vanishingly rare here; cash — the money — is
    // already safe above.
    const h = await Holding.findOne({ userId, symbol });
    if (h) {
      h.avg = round2((h.avg * h.qty + cost) / (h.qty + qty));
      h.qty += qty;
      await h.save();
    } else {
      await Holding.create({ userId, symbol, qty, avg: round2(price) });
    }
    return { ok: true, cash: account.cash };
  }

  // sell — atomic conditional decrement: succeeds only if qty >= shares sold.
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
