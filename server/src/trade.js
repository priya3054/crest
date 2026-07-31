import { Account, Holding } from './models/index.js';

const round2 = (n) => Math.round(n * 100) / 100;

// Apply a filled trade to the account: adjust cash and the holding.
// This is the ONE place cash/holdings change on a trade — the order route and the
// limit-order auto-fill in the sim both call it, so the rules can never diverge.
// Returns { ok } or { ok:false, error }. Never throws on business errors.
export async function applyTrade(symbol, side, qty, price) {
  const account = await Account.findOne();
  const cost = round2(qty * price);
  const h = await Holding.findOne({ symbol });

  if (side === 'buy') {
    if (cost > account.cash) return { ok: false, error: 'Insufficient balance' };
    account.cash = round2(account.cash - cost);
    if (h) {
      // weighted-average buy price
      h.avg = round2((h.avg * h.qty + cost) / (h.qty + qty));
      h.qty += qty;
      await h.save();
    } else {
      await Holding.create({ symbol, qty, avg: round2(price) });
    }
  } else {
    if (!h || h.qty < qty) return { ok: false, error: 'Insufficient holdings' };
    account.cash = round2(account.cash + cost);
    if (h.qty === qty) await Holding.deleteOne({ symbol });
    else {
      h.qty -= qty;
      await h.save();
    }
  }

  await account.save();
  return { ok: true, cash: account.cash };
}
