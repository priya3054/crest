import { verifyToken } from '../services/auth.js';

// Gate protected routes: require a valid "Authorization: Bearer <token>" header
// and stash the user's id on req.userId for downstream handlers.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated.' });
  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    req.user = { id: payload.sub, email: payload.email, name: payload.name };
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}
