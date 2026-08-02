import { redis } from '../config/redis.js';

// Distributed sliding-window rate limiter backed by a Redis sorted set.
// Each request adds a timestamped member; we drop members older than the window
// and count what's left. Because the state lives in Redis, the limit holds across
// every load-balanced gateway instance — not per-process.
//
//   windowSec – window length in seconds
//   max       – max requests allowed within the window
//   keyFn     – derives the bucket id from the request (per-IP, per-user, …)
export function rateLimit({ windowSec, max, keyFn, message }) {
  return async (req, res, next) => {
    let count;
    try {
      const key = `rl:${keyFn(req)}`;
      const now = Date.now();
      const windowStart = now - windowSec * 1000;

      const [, , cardinality] = await redis
        .multi()
        .zremrangebyscore(key, 0, windowStart) // evict old hits
        .zadd(key, now, `${now}-${Math.random()}`) // record this hit
        .zcard(key) // how many in the window now
        .pexpire(key, windowSec * 1000) // let the key self-clean
        .exec()
        .then((r) => [r[0][1], r[1][1], r[2][1]]);
      count = cardinality;
    } catch {
      // Fail open: never let a Redis hiccup take the API down.
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

// Brute-force protection on auth, keyed by client IP.
export const authLimiter = rateLimit({
  windowSec: 900,
  max: 20,
  keyFn: (req) => `auth:${req.ip}`,
  message: 'Too many attempts. Try again in a few minutes.',
});

// Order-spam protection, keyed by the signed-in user.
export const orderLimiter = rateLimit({
  windowSec: 60,
  max: 30,
  keyFn: (req) => `orders:${req.userId}`,
  message: 'You are placing orders too quickly — please slow down.',
});
