import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// Atomic sequence counters (one doc per sequence, e.g. _id: 'orderId').
// findOneAndUpdate($inc) is atomic, so IDs never collide even under concurrency —
// unlike scanning for the current max.
const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, required: true, default: 0 },
});

export const Counter = model('Counter', counterSchema);
