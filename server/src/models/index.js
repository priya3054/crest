import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// Single-account paper-trading app (no auth in the design). The Account holds the
// virtual cash balance and the user's watchlist. There is exactly one document.
const accountSchema = new Schema({
  cash: { type: Number, required: true, default: 0 },
  watchlist: { type: [String], default: [] },
});

// Base definition for each tradable stock. Live price/history are simulated in
// memory (see market.js); Mongo only stores the stable metadata + anchor price.
const stockSchema = new Schema({
  symbol: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  sector: { type: String, required: true },
  anchor: { type: Number, required: true }, // seed price the sim walks around
  volq: { type: Number, required: true }, // base volume quantity (for OPEN/HIGH etc.)
});

// A position the user holds. qty = shares, avg = weighted average buy price.
const holdingSchema = new Schema({
  symbol: { type: String, required: true, unique: true },
  qty: { type: Number, required: true },
  avg: { type: Number, required: true },
});

const orderSchema = new Schema({
  orderId: { type: String, required: true, unique: true }, // ORD-1042
  ts: { type: Date, required: true, default: Date.now },
  symbol: { type: String, required: true },
  side: { type: String, enum: ['buy', 'sell'], required: true },
  type: { type: String, enum: ['market', 'limit'], required: true },
  qty: { type: Number, required: true },
  price: { type: Number, required: true }, // fill/anchor price
  limit: { type: Number }, // only for limit orders
  status: { type: String, enum: ['pending', 'executed', 'cancelled'], required: true },
});

const transactionSchema = new Schema({
  txnId: { type: String, required: true, unique: true }, // TXN-3021
  ts: { type: Date, required: true, default: Date.now },
  type: { type: String, required: true }, // "Added funds" | "Withdrawal" | "Starter credit"
  via: { type: String, required: true }, // "Razorpay" | "Crest"
  amount: { type: Number, required: true },
  dir: { type: Number, required: true }, // +1 credit, -1 debit
  status: { type: String, required: true, default: 'completed' },
});

export const Account = model('Account', accountSchema);
export const Stock = model('Stock', stockSchema);
export const Holding = model('Holding', holdingSchema);
export const Order = model('Order', orderSchema);
export const Transaction = model('Transaction', transactionSchema);
