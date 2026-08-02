import { Router } from 'express';
import { User } from '../models/index.js';
import { hashPassword, verifyPassword, signToken, provisionUserAccount } from '../services/auth.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const publicUser = (u) => ({ id: String(u._id), email: u.email, name: u.name });

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Enter your name.' });
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email.' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash: await hashPassword(password),
  });
  await provisionUserAccount(user._id);

  res.json({ token: signToken(user), user: publicUser(user) });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Enter your email and password.' });

  const user = await User.findOne({ email: String(email).toLowerCase() });
  if (!user || !(await verifyPassword(password, user.passwordHash)))
    return res.status(401).json({ error: 'Incorrect email or password.' });

  res.json({ token: signToken(user), user: publicUser(user) });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ error: 'Account not found.' });
  res.json({ user: publicUser(user) });
});

export default router;
