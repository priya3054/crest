import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Account, Transaction } from '../models/index.js';
import { nextId } from '../utils/ids.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const STARTER_CASH = 100000; // every new account starts with ₹1,00,000 virtual funds

export const hashPassword = (plain) => bcrypt.hash(plain, 10);
export const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

export const signToken = (user) =>
  jwt.sign({ sub: String(user._id), email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });

export const verifyToken = (token) => jwt.verify(token, JWT_SECRET);

// Give a brand-new user their starting wallet: an Account with starter cash and a
// matching "Starter credit" transaction, plus a small default watchlist. Empty
// holdings/orders — they build their own portfolio by trading.
export async function provisionUserAccount(userId) {
  await Account.create({
    userId,
    cash: STARTER_CASH,
    watchlist: ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK'],
  });
  const txnId = await nextId('txnId', 'TXN');
  await Transaction.create({
    userId,
    txnId,
    ts: new Date(),
    type: 'Starter credit',
    via: 'Crest',
    amount: STARTER_CASH,
    dir: 1,
    status: 'completed',
  });
}
