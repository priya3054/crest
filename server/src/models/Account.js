import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// One Account per user: virtual cash balance + watchlist.
const accountSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  cash: { type: Number, required: true, default: 0 },
  watchlist: { type: [String], default: [] },
});

export const Account = model('Account', accountSchema);
