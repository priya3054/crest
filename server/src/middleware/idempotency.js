import { redis } from '../config/redis.js';

export async function idempotency(req, res, next) {
  const key = req.get('Idempotency-Key');
  if (!key) return next();

  const rkey = `idem:${req.userId}:${key}`;

  let claimed;
  try {
    claimed = await redis.set(rkey, JSON.stringify({ state: 'pending' }), 'EX', 3600, 'NX');
  } catch {
    return next();
  }

  if (!claimed) {
    const existing = JSON.parse((await redis.get(rkey)) || '{}');
    if (existing.state === 'pending') {
      return res.status(409).json({ error: 'Duplicate request already in progress.' });
    }
    return res.status(existing.status).json(existing.body);
  }

  let stored = false;
  const sendJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      stored = true;
      redis.set(rkey, JSON.stringify({ state: 'done', status: res.statusCode, body }), 'EX', 3600).catch(() => {});
    }
    return sendJson(body);
  };
  res.on('finish', () => {
    if (!stored) redis.del(rkey).catch(() => {});
  });
  next();
}
