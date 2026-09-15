import { redis } from '../config/redis.js';

// Idempotency keys make "place order" safe to retry: a client sends a unique
// Idempotency-Key; the first request runs and its response is cached, and any
// repeat with the same key returns that same response instead of placing a second
// order. A Redis SET NX claim also rejects a duplicate that arrives while the
// first is still in flight. Keyed per user so keys can't collide across accounts.
export async function idempotency(req, res, next) {
  const key = req.get('Idempotency-Key');
  if (!key) return next(); // opt-in; no key means normal processing

  const rkey = `idem:${req.userId}:${key}`;

  let claimed;
  try {
    // Claim the key atomically. If it already exists, this returns null.
    claimed = await redis.set(rkey, JSON.stringify({ state: 'pending' }), 'EX', 3600, 'NX');
  } catch {
    return next(); // Redis down → fail open
  }

  if (!claimed) {
    const existing = JSON.parse((await redis.get(rkey)) || '{}');
    if (existing.state === 'pending') {
      return res.status(409).json({ error: 'Duplicate request already in progress.' });
    }
    return res.status(existing.status).json(existing.body); // replay the stored result
  }

  // We own the key — capture the response so repeats can replay it.
  let stored = false;
  const sendJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      stored = true;
      redis.set(rkey, JSON.stringify({ state: 'done', status: res.statusCode, body }), 'EX', 3600).catch(() => {});
    }
    return sendJson(body);
  };
  // Safety net: if the handler throws (or sends any non-2xx) we never stored a
  // result, so release the claim on response-finish. Otherwise a crashed request
  // would leave the key `pending` for its full 1-hour TTL and the client's honest
  // retry would keep getting "Duplicate request already in progress".
  res.on('finish', () => {
    if (!stored) redis.del(rkey).catch(() => {});
  });
  next();
}
