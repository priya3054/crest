import mongoose from "mongoose";

const { Schema, model } = mongoose;

const orderSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  orderId: {
    type: String,
    required: true,
    unique: true,
  }, // ORD-1042 (globally unique)
  ts: {
    type: Date,
    required: true,
    default: Date.now,
  },
  symbol: {
    type: String,
    required: true,
  },
  side: {
    type: String,
    enum: ["buy", "sell"],
    required: true,
  },
  type: {
    type: String,
    enum: ["market", "limit"],
    required: true,
  },
  qty: {
    type: Number,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  }, 
  limit: {
    type: Number,
  }, // only for limit orders
  status: {
    type: String,
    enum: ["pending", "executed", "cancelled", "rejected"],
    required: true,
  },
  rejectReason: {
    type: String,
  }, // why a fill failed, e.g. "Insufficient balance"
});

orderSchema.index({ userId: 1, ts: -1 });
// The producer scans pending limit orders every tick. Without this index that
// query is a full collection scan (every order, every user); with it, Mongo
// walks only the pending-limit slice.
orderSchema.index({ status: 1, type: 1, symbol: 1 });

export const Order = model("Order", orderSchema);
