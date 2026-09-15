import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const holdingSchema = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  symbol: { 
    type: String, 
    required: true 
  },
  qty: { 
    type: Number, 
    required: true 
  },
  avg: { 
    type: Number, 
    required: true 
  },
});
holdingSchema.index({ userId: 1, symbol: 1 }, { unique: true });

export const Holding = model('Holding', holdingSchema);
