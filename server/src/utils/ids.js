import { Counter } from '../models/index.js';

// Atomically allocate the next id in a named sequence, e.g. nextId('orderId','ORD')
// -> "ORD-1048". findOneAndUpdate($inc) is a single atomic op, so two concurrent
// requests can never receive the same number (the old max-scan approach could).
export async function nextId(name, prefix) {
  const counter = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `${prefix}-${counter.seq}`;
}
