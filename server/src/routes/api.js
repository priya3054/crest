import { Router } from 'express';
import { Account, Holding, Order, Transaction } from '../models/index.js';
import { getMarket, getStock, marketStatus } from '../market.js';
import { applyTrade } from '../trade.js';

const router = Router();
const round2 = (n) => Math.round(n * 100) / 100;

// ---- serializers: turn DB/market docs into the flat shapes the client renders ----
const serStock = (s) => ({
  symbol: s.symbol,
  name: s.name,
  sector: s.sector,
  price: s.price,
  prevClose: s.prevClose,
  hist: s.hist,
  flash: s.flash,
  volq: s.volq,
});
const serOrder = (o) => ({
  id: o.orderId,
  ts: o.ts.getTime(),
  symbol: o.symbol,
  side: o.side,
  type: o.type,
  qty: o.qty,
  price: o.price,
  limit: o.limit,
  status: o.status,
});
const serTxn = (t) => ({
  id: t.txnId,
  ts: t.ts.getTime(),
  type: t.type,
  via: t.via,
  amount: t.amount,
  dir: t.dir,
  status: t.status,
});

async function nextId(Model, field, prefix, floor) {
  const docs = await Model.find({}, field);
  const max = docs.reduce((m, d) => {
    const n = parseInt(String(d[field]).split('-')[1], 10);
    return Number.isNaN(n) ? m : Math.max(m, n);
  }, floor);
  return `${prefix}-${max + 1}`;
}

// ---- GET /api/state : full snapshot to hydrate the app on load ----
router.get('/state', async (_req, res) => {
  const [account, holdings, orders, txns] = await Promise.all([
    Account.findOne(),
    Holding.find().lean(),
    Order.find().sort({ ts: -1 }).lean(),
    Transaction.find().sort({ ts: -1 }).lean(),
  ]);
  res.json({
    cash: account?.cash ?? 0,
    watchlist: account?.watchlist ?? [],
    stocks: getMarket().map(serStock),
    holdings: holdings.map((h) => ({ symbol: h.symbol, qty: h.qty, avg: h.avg })),
    orders: orders.map((o) => serOrder({ ...o, orderId: o.orderId, ts: o.ts })),
    txns: txns.map((t) => serTxn({ ...t, txnId: t.txnId, ts: t.ts })),
    market: marketStatus(),
  });
});

// ---- GET /api/prices : lightweight live feed the client polls (~1.4s) ----
router.get('/prices', (_req, res) => {
  res.json(
    getMarket().map((s) => ({
      symbol: s.symbol,
      price: s.price,
      prevClose: s.prevClose,
      hist: s.hist,
      flash: s.flash,
    }))
  );
});

// ---- POST /api/orders : place a market or limit order ----
router.post('/orders', async (req, res) => {
  const { symbol, side, type, qty: rawQty, limit } = req.body || {};
  const s = getStock(symbol);
  if (!s) return res.status(400).json({ error: 'Unknown stock.' });
  if (side !== 'buy' && side !== 'sell') return res.status(400).json({ error: 'Invalid side.' });
  if (type !== 'market' && type !== 'limit') return res.status(400).json({ error: 'Invalid order type.' });

  const qty = Math.floor(Number(rawQty) || 0);
  if (qty < 1) return res.status(400).json({ error: 'Enter a valid quantity.' });

  const px = type === 'limit' ? Number(limit) || 0 : s.price;
  if (type === 'limit' && px <= 0) return res.status(400).json({ error: 'Enter a limit price.' });

  const account = await Account.findOne();
  if (side === 'buy' && qty * px > account.cash)
    return res.status(400).json({ error: 'Insufficient balance — add funds to place this order.' });
  const hold = await Holding.findOne({ symbol });
  if (side === 'sell' && (!hold || hold.qty < qty))
    return res.status(400).json({ error: `Insufficient holdings — you hold ${hold ? hold.qty : 0} shares of ${symbol}.` });

  const executed = type === 'market';
  const orderId = await nextId(Order, 'orderId', 'ORD', 1047);
  const doc = {
    orderId,
    ts: new Date(),
    symbol,
    side,
    type,
    qty,
    price: round2(px),
    limit: type === 'limit' ? round2(px) : undefined,
    status: executed ? 'executed' : 'pending',
  };

  if (executed) {
    const r = await applyTrade(symbol, side, qty, px);
    if (!r.ok) return res.status(400).json({ error: `${r.error}.` });
  }
  await Order.create(doc);

  res.json({ ok: true, order: serOrder({ ...doc, ts: doc.ts }), executed });
});

// ---- POST /api/orders/:id/cancel : cancel a pending order ----
router.post('/orders/:id/cancel', async (req, res) => {
  const o = await Order.findOne({ orderId: req.params.id });
  if (!o) return res.status(404).json({ error: 'Order not found.' });
  if (o.status !== 'pending') return res.status(400).json({ error: 'Only pending orders can be cancelled.' });
  o.status = 'cancelled';
  await o.save();
  res.json({ ok: true });
});

// ---- POST /api/wallet : add / withdraw virtual funds (simulated Razorpay) ----
router.post('/wallet', async (req, res) => {
  const { mode, amount: rawAmount } = req.body || {};
  if (mode !== 'add' && mode !== 'withdraw') return res.status(400).json({ error: 'Invalid mode.' });
  const amt = Math.floor(Number(rawAmount) || 0);
  if (amt < 100) return res.status(400).json({ error: 'Enter an amount of at least ₹100.' });

  const account = await Account.findOne();
  if (mode === 'withdraw' && amt > account.cash)
    return res.status(400).json({ error: 'Amount exceeds your wallet balance.' });

  const dir = mode === 'add' ? 1 : -1;
  account.cash = round2(account.cash + dir * amt);
  await account.save();

  const txnId = await nextId(Transaction, 'txnId', 'TXN', 3021);
  const txn = await Transaction.create({
    txnId,
    ts: new Date(),
    type: mode === 'add' ? 'Added funds' : 'Withdrawal',
    via: 'Razorpay',
    amount: amt,
    dir,
    status: 'completed',
  });

  res.json({ ok: true, cash: account.cash, txn: serTxn(txn) });
});

// ---- Watchlist add / remove ----
router.post('/watchlist', async (req, res) => {
  const { symbol } = req.body || {};
  if (!getStock(symbol)) return res.status(400).json({ error: 'Unknown stock.' });
  const account = await Account.findOne();
  if (!account.watchlist.includes(symbol)) {
    account.watchlist.push(symbol);
    await account.save();
  }
  res.json({ ok: true, watchlist: account.watchlist });
});

router.delete('/watchlist/:symbol', async (req, res) => {
  const account = await Account.findOne();
  account.watchlist = account.watchlist.filter((s) => s !== req.params.symbol);
  await account.save();
  res.json({ ok: true, watchlist: account.watchlist });
});

export default router;
