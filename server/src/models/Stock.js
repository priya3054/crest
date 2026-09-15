import mongoose from "mongoose";

const { Schema, model } = mongoose;

const stockSchema = new Schema({
  symbol: { 
    type: String, 
    required: true, 
    unique: true 
  },
  name: { 
    type: String, 
    required: true 
  },
  sector: { 
    type: String, 
    required: true 
  },
  anchor: { 
    type: Number, 
    required: true 
  }, // seed price the sim walks around
  volq: { 
    type: Number, 
    required: true 
  }, // base volume quantity (for OPEN/HIGH etc.)
});

export const Stock = model("Stock", stockSchema);
