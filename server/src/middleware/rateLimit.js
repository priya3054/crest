import { redis } from '../config/redis.js';

export function rateLimit({ windowSec, max, keyFn, message, failClosed = false }) {
  return async (req, res, next) => {
    let count;
    try {
      const key = `rl:${keyFn(req)}`;
      const now = Date.now();
      const windowStart = now - windowSec * 1000;

      const [, , cardinality] = await redis
        .multi()
        .zremrangebyscore(key, 0, windowStart)
        .zadd(key, now, `${now}-${Math.random()}`)
        .zcard(key)
        .pexpire(key, windowSec * 1000)
        .exec()
        .then((r) => [r[0][1], r[1][1], r[2][1]]);
      count = cardinality;
    } catch {
      if (failClosed) {
        return res.status(503).json({ error: 'Service temporarily unavailable — try again shortly.' });
      }
      return next();
    }

    res.set('X-RateLimit-Limit', String(max));
    res.set('X-RateLimit-Remaining', String(Math.max(0, max - count)));
    if (count > max) {
      res.set('Retry-After', String(windowSec));
      return res.status(429).json({ error: message || 'Too many requests — please slow down.' });
    }
    next();
  };
}

export const authLimiter = rateLimit({
  windowSec: 900,
  max: 20,
  keyFn: (req) => `auth:${req.ip}`,
  message: 'Too many attempts. Try again in a few minutes.',
  failClosed: true,
});

export const orderLimiter = rateLimit({
  windowSec: 60,
  max: 30,
  keyFn: (req) => `orders:${req.userId}`,
  message: 'You are placing orders too quickly — please slow down.',
});
