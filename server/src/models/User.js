import mongoose from "mongoose";

const { Schema, model } = mongoose;

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  name: { 
    type: String, 
    required: true, 
    trim: true 
  },
  passwordHash: { 
    type: String, 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
});

export const User = model("User", userSchema);
