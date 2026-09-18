import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { User } from './models/User.js';
import { Account } from './models/Account.js';
import { Stock } from './models/Stock.js';
import { Holding } from './models/Holding.js';
import { Order } from './models/Order.js';
import { Transaction } from './models/Transaction.js';
import { Counter } from './models/Counter.js';
import { hashPassword } from './services/auth.js';

const STOCK_DEFS = [
  ['RELIANCE', 'Reliance Industries', 'Energy', 2984.5, 842],
  ['TCS', 'Tata Consultancy', 'IT Services', 4102.3, 311],
  ['HDFCBANK', 'HDFC Bank', 'Banking', 1687.9, 655],
  ['INFY', 'Infosys', 'IT Services', 1834.6, 528],
  ['ICICIBANK', 'ICICI Bank', 'Banking', 1215.4, 731],
  ['BHARTIARTL', 'Bharti Airtel', 'Telecom', 1542.8, 289],
  ['SBIN', 'State Bank of India', 'Banking', 843.2, 918],
  ['TATAMOTORS', 'Tata Motors', 'Automobile', 1094.7, 776],
  ['ITC', 'ITC Limited', 'FMCG', 462.35, 1204],
  ['LT', 'Larsen & Toubro', 'Infrastructure', 3648.1, 196],
  ['WIPRO', 'Wipro', 'IT Services', 528.6, 644],
  ['ADANIENT', 'Adani Enterprises', 'Conglomerate', 3172.4, 371],
];

const DEMO = { name: 'Demo Trader', email: 'demo@crest.app', password: 'demo123' };
const H = 3600e3;
const D = 24 * H;

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    console.error('[seed] refusing to run with NODE_ENV=production — this drops the database.');
    process.exit(1);
  }

  await connectDB(process.env.MONGO_URI);

  await mongoose.connection.dropDatabase();

  await Stock.insertMany(
    STOCK_DEFS.map(([symbol, name, sector, anchor, volq]) => ({ symbol, name, sector, anchor, volq }))
  );

  const demo = await User.create({
    name: DEMO.name,
    email: DEMO.email,
    passwordHash: await hashPassword(DEMO.password),
  });
  const userId = demo._id;

  await Account.create({
    userId,
    cash: 35025.4,
    watchlist: ['RELIANCE', 'TCS', 'TATAMOTORS', 'INFY', 'HDFCBANK', 'ITC'],
  });

  await Holding.insertMany([
    { userId, symbol: 'RELIANCE', qty: 5, avg: 2870.25 },
    { userId, symbol: 'INFY', qty: 12, avg: 1912.4 },
    { userId, symbol: 'TATAMOTORS', qty: 18, avg: 986.1 },
    { userId, symbol: 'ITC', qty: 60, avg: 448.75 },
  ]);

  const now = Date.now();
  await Order.insertMany([
    { userId, orderId: 'ORD-1047', ts: new Date(now - 2 * H), symbol: 'TCS', side: 'buy', type: 'limit', qty: 3, price: 4050, limit: 4050, status: 'pending' },
    { userId, orderId: 'ORD-1046', ts: new Date(now - 5 * H), symbol: 'ITC', side: 'buy', type: 'market', qty: 60, price: 448.75, status: 'executed' },
    { userId, orderId: 'ORD-1045', ts: new Date(now - 27 * H), symbol: 'RELIANCE', side: 'sell', type: 'limit', qty: 2, price: 3050, limit: 3050, status: 'cancelled' },
    { userId, orderId: 'ORD-1044', ts: new Date(now - 30 * H), symbol: 'INFY', side: 'buy', type: 'market', qty: 12, price: 1912.4, status: 'executed' },
    { userId, orderId: 'ORD-1043', ts: new Date(now - 2 * D), symbol: 'TATAMOTORS', side: 'buy', type: 'limit', qty: 18, price: 986.1, limit: 986.1, status: 'executed' },
    { userId, orderId: 'ORD-1042', ts: new Date(now - 3 * D), symbol: 'RELIANCE', side: 'buy', type: 'market', qty: 5, price: 2870.25, status: 'executed' },
  ]);

  await Transaction.insertMany([
    { userId, txnId: 'TXN-3021', ts: new Date(now - 4 * H), type: 'Added funds', via: 'Razorpay', amount: 25000, dir: 1, status: 'completed' },
    { userId, txnId: 'TXN-3014', ts: new Date(now - 2 * D), type: 'Withdrawal', via: 'Razorpay', amount: 8000, dir: -1, status: 'completed' },
    { userId, txnId: 'TXN-3002', ts: new Date(now - 6 * D), type: 'Starter credit', via: 'Crest', amount: 100000, dir: 1, status: 'completed' },
  ]);

  await Counter.insertMany([
    { _id: 'orderId', seq: 1047 },
    { _id: 'txnId', seq: 3021 },
  ]);

  console.log('[seed] done — 12 stocks + demo user (demo@crest.app / demo123)');
  console.log('[seed] demo portfolio: 4 holdings, 6 orders, 3 transactions, cash ₹35,025.40');
  await mongoose.disconnect();
}

seed().catch((e) => {
  console.error('[seed] failed:', e);
  process.exit(1);
});
