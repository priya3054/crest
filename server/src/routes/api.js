import { Router } from 'express';
import { Account, Holding, Order, Transaction } from '../models/index.js';
import { getMarket, getStock, marketStatus } from '../market/market.js';
import { applyTrade } from '../services/trade.js';
import { requireAuth } from '../middleware/auth.js';
import { nextId } from '../utils/ids.js';

const router = Router();
const round2 = (n) => Math.round(n * 100) / 100;

// Everything below requires a signed-in user; req.userId is set by requireAuth.
router.use(requireAuth);

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
  ts: new Date(o.ts).getTime(),
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
  ts: new Date(t.ts).getTime(),
  type: t.type,
  via: t.via,
  amount: t.amount,
  dir: t.dir,
  status: t.status,
});

// ---- GET /api/state : full snapshot for the signed-in user ----
router.get('/state', async (req, res) => {
  const [account, holdings, orders, txns] = await Promise.all([
    Account.findOne({ userId: req.userId }),
    Holding.find({ userId: req.userId }).lean(),
    Order.find({ userId: req.userId }).sort({ ts: -1 }).lean(),
    Transaction.find({ userId: req.userId }).sort({ ts: -1 }).lean(),
  ]);
  res.json({
    cash: account?.cash ?? 0,
    watchlist: account?.watchlist ?? [],
    stocks: getMarket().map(serStock),
    holdings: holdings.map((h) => ({ symbol: h.symbol, qty: h.qty, avg: h.avg })),
    orders: orders.map(serOrder),
    txns: txns.map(serTxn),
    market: marketStatus(),
  });
});

// ---- GET /api/prices : lightweight live feed the client polls (~1.4s) ----
// Prices are shared market data, identical for everyone. Includes the live
// open/closed flag so the client can flip the LIVE badge mid-session.
router.get('/prices', (_req, res) => {
  res.json({
    open: marketStatus().open,
    stocks: getMarket().map((s) => ({
      symbol: s.symbol,
      price: s.price,
      prevClose: s.prevClose,
      hist: s.hist,
      flash: s.flash,
    })),
  });
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

  const account = await Account.findOne({ userId: req.userId });
  if (side === 'buy' && qty * px > account.cash)
    return res.status(400).json({ error: 'Insufficient balance — add funds to place this order.' });
  const hold = await Holding.findOne({ userId: req.userId, symbol });
  if (side === 'sell' && (!hold || hold.qty < qty))
    return res.status(400).json({ error: `Insufficient holdings — you hold ${hold ? hold.qty : 0} shares of ${symbol}.` });

  const executed = type === 'market';
  const orderId = await nextId(Order, 'orderId', 'ORD', 1047);
  const doc = {
    userId: req.userId,
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
    const r = await applyTrade(req.userId, symbol, side, qty, px);
    if (!r.ok) return res.status(400).json({ error: `${r.error}.` });
  }
  await Order.create(doc);

  res.json({ ok: true, order: serOrder(doc), executed });
});

// ---- POST /api/orders/:id/cancel : cancel a pending order (owned by the user) ----
router.post('/orders/:id/cancel', async (req, res) => {
  const o = await Order.findOne({ orderId: req.params.id, userId: req.userId });
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

  const account = await Account.findOne({ userId: req.userId });
  if (mode === 'withdraw' && amt > account.cash)
    return res.status(400).json({ error: 'Amount exceeds your wallet balance.' });

  const dir = mode === 'add' ? 1 : -1;
  account.cash = round2(account.cash + dir * amt);
  await account.save();

  const txnId = await nextId(Transaction, 'txnId', 'TXN', 3021);
  const txn = await Transaction.create({
    userId: req.userId,
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
  const account = await Account.findOne({ userId: req.userId });
  if (!account.watchlist.includes(symbol)) {
    account.watchlist.push(symbol);
    await account.save();
  }
  res.json({ ok: true, watchlist: account.watchlist });
});

router.delete('/watchlist/:symbol', async (req, res) => {
  const account = await Account.findOne({ userId: req.userId });
  account.watchlist = account.watchlist.filter((s) => s !== req.params.symbol);
  await account.save();
  res.json({ ok: true, watchlist: account.watchlist });
});

export default router;
