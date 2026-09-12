import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// A position a user holds. qty = shares, avg = weighted average buy price.
// Unique per (userId, symbol) — each user has at most one holding per stock.
const holdingSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  symbol: { type: String, required: true },
  qty: { type: Number, required: true },
  avg: { type: Number, required: true },
});
holdingSchema.index({ userId: 1, symbol: 1 }, { unique: true });

export const Holding = model('Holding', holdingSchema);
