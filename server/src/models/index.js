import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// A registered user. passwordHash is a bcrypt hash — we never store raw passwords.
const userSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// One Account per user: virtual cash balance + watchlist.
const accountSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  cash: { type: Number, required: true, default: 0 },
  watchlist: { type: [String], default: [] },
});

// Base definition for each tradable stock. Live price/history are simulated in
// memory (see market.js); Mongo only stores the stable metadata + anchor price.
// Stocks are shared market data — NOT per user.
const stockSchema = new Schema({
  symbol: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  sector: { type: String, required: true },
  anchor: { type: Number, required: true }, // seed price the sim walks around
  volq: { type: Number, required: true }, // base volume quantity (for OPEN/HIGH etc.)
});

// A position a user holds. qty = shares, avg = weighted average buy price.
// Unique per (userId, symbol) — each user has at most one holding per stock.
const holdingSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  symbol: { type: String, required: true },
  qty: { type: Number, required: true },
  avg: { type: Number, required: true },
});
holdingSchema.index({ userId: 1, symbol: 1 }, { unique: true });

const orderSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  orderId: { type: String, required: true, unique: true }, // ORD-1042 (globally unique)
  ts: { type: Date, required: true, default: Date.now },
  symbol: { type: String, required: true },
  side: { type: String, enum: ['buy', 'sell'], required: true },
  type: { type: String, enum: ['market', 'limit'], required: true },
  qty: { type: Number, required: true },
  price: { type: Number, required: true }, // fill/anchor price
  limit: { type: Number }, // only for limit orders
  status: { type: String, enum: ['pending', 'executed', 'cancelled'], required: true },
});
orderSchema.index({ userId: 1, ts: -1 });

const transactionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  txnId: { type: String, required: true, unique: true }, // TXN-3021 (globally unique)
  ts: { type: Date, required: true, default: Date.now },
  type: { type: String, required: true }, // "Added funds" | "Withdrawal" | "Starter credit"
  via: { type: String, required: true }, // "Razorpay" | "Crest"
  amount: { type: Number, required: true },
  dir: { type: Number, required: true }, // +1 credit, -1 debit
  status: { type: String, required: true, default: 'completed' },
});
transactionSchema.index({ userId: 1, ts: -1 });

export const User = model('User', userSchema);
export const Account = model('Account', accountSchema);
export const Stock = model('Stock', stockSchema);
export const Holding = model('Holding', holdingSchema);
export const Order = model('Order', orderSchema);
export const Transaction = model('Transaction', transactionSchema);
