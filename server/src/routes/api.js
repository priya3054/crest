import { Router } from 'express';
import { Account } from '../models/Account.js';
import { Holding } from '../models/Holding.js';
import { Order } from '../models/Order.js';
import { Transaction } from '../models/Transaction.js';
import { getMarket, getStock, marketStatus, isMarketOpen } from '../market/market.js';
import { applyTrade } from '../services/trade.js';
import { requireAuth } from '../middleware/auth.js';
import { orderLimiter } from '../middleware/rateLimit.js';
import { idempotency } from '../middleware/idempotency.js';
import { nextId } from '../utils/ids.js';
import { round2 } from '../utils/money.js';

const router = Router();

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

// ---- POST /api/orders : place a market or limit order ----
router.post('/orders', orderLimiter, idempotency, async (req, res) => {
  if (!isMarketOpen())
    return res.status(409).json({ error: 'Market is closed. NSE trades 09:15–15:30 IST, Mon–Fri.' });

  const { symbol, side, type, qty: rawQty, limit } = req.body || {};
  const s = getStock(symbol);
  if (!s) return res.status(400).json({ error: 'Unknown stock.' });
  if (side !== 'buy' && side !== 'sell') return res.status(400).json({ error: 'Invalid side.' });
  if (type !== 'market' && type !== 'limit') return res.status(400).json({ error: 'Invalid order type.' });

  const qty = Math.floor(Number(rawQty) || 0);
  if (qty < 1) return res.status(400).json({ error: 'Enter a valid quantity.' });

  const px = type === 'limit' ? Number(limit) || 0 : s.price;
  if (type === 'limit' && px <= 0) return res.status(400).json({ error: 'Enter a limit price.' });
  // Sanity band: reject limit prices more than 20% off the last traded price. A
  // wild limit (e.g. buy at ₹1) would never fill and would sit in the producer's
  // scan loop indefinitely; this also catches fat-finger inputs.
  if (type === 'limit') {
    const band = 0.2;
    if (px < s.price * (1 - band) || px > s.price * (1 + band))
      return res.status(400).json({ error: `Limit price must be within 20% of the current price (₹${round2(s.price)}).` });
  }

  const account = await Account.findOne({ userId: req.userId });
  if (!account) return res.status(400).json({ error: 'Account not found.' });
  if (side === 'buy' && qty * px > account.cash)
    return res.status(400).json({ error: 'Insufficient balance — add funds to place this order.' });
  const hold = await Holding.findOne({ userId: req.userId, symbol });
  if (side === 'sell' && (!hold || hold.qty < qty))
    return res.status(400).json({ error: `Insufficient holdings — you hold ${hold ? hold.qty : 0} shares of ${symbol}.` });

  // Write-ahead: persist the order as `pending` BEFORE any money moves. If the
  // fill (or the process) dies mid-trade, we still have an audit record of the
  // intent instead of cash changing with no order to explain it.
  const orderId = await nextId('orderId', 'ORD');
  const order = await Order.create({
    userId: req.userId,
    orderId,
    ts: new Date(),
    symbol,
    side,
    type,
    qty,
    price: round2(px),
    limit: type === 'limit' ? round2(px) : undefined,
    status: 'pending',
  });

  // Market orders fill immediately; limit orders stay pending for the producer
  // to fill when the price crosses (see market/producer.js).
  const executed = type === 'market';
  if (executed) {
    const r = await applyTrade(req.userId, symbol, side, qty, px);
    if (!r.ok) {
      order.status = 'rejected';
      order.rejectReason = r.error;
      await order.save().catch(() => {});
      return res.status(400).json({ error: `${r.error}.` });
    }
    // The trade already moved money. Never let a failure to *record* the executed
    // status become a 5xx — that would release the idempotency key and let a retry
    // fill a second time. Return success regardless; the status write is secondary.
    order.status = 'executed';
    await order.save().catch((e) => console.error('[orders] status write failed after fill', e));
  }

  res.json({ ok: true, order: serOrder(order), executed });
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

  const dir = mode === 'add' ? 1 : -1;
  // Atomic, concurrency-safe move — the same guarded-update pattern as applyTrade.
  // The `$gte` filter means a withdrawal only succeeds if the balance still covers
  // it at write time, so two concurrent withdrawals can never both pass. Reading
  // the balance and then writing it back (findOne + save) would be a race.
  const filter = mode === 'withdraw'
    ? { userId: req.userId, cash: { $gte: amt } }
    : { userId: req.userId };
  const account = await Account.findOneAndUpdate(
    filter,
    { $inc: { cash: dir * amt } },
    { new: true }
  );
  if (!account)
    return res.status(400).json({ error: 'Amount exceeds your wallet balance.' });

  const txnId = await nextId('txnId', 'TXN');
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
  if (!account) return res.status(400).json({ error: 'Account not found.' });
  if (!account.watchlist.includes(symbol)) {
    account.watchlist.push(symbol);
    await account.save();
  }
  res.json({ ok: true, watchlist: account.watchlist });
});

router.delete('/watchlist/:symbol', async (req, res) => {
  const account = await Account.findOne({ userId: req.userId });
  if (!account) return res.status(400).json({ error: 'Account not found.' });
  account.watchlist = account.watchlist.filter((s) => s !== req.params.symbol);
  await account.save();
  res.json({ ok: true, watchlist: account.watchlist });
});

export default router;
