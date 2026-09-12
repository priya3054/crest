import mongoose from 'mongoose';

const { Schema, model } = mongoose;

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

export const Transaction = model('Transaction', transactionSchema);
