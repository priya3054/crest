import mongoose from 'mongoose';

// Connect once at startup. We keep this tiny on purpose: everything else in the
// app assumes the connection is already live.
export async function connectDB(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log('[db] connected to', uri);
  return mongoose.connection;
}
