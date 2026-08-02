import Redis from 'ioredis';

const URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// ioredis needs dedicated connections: a subscriber connection can't issue normal
// commands, so we keep three — commands, publisher, subscriber.
export const redis = new Redis(URL); // GET/SET, rate-limit counters, etc.
export const pub = new Redis(URL); // publishes price ticks
export const sub = new Redis(URL); // subscribes to price ticks

for (const [name, client] of [['redis', redis], ['pub', pub], ['sub', sub]]) {
  client.on('error', (e) => console.error(`[redis:${name}]`, e.message));
}

// Pub/Sub channel for price ticks + the cache key holding the latest snapshot.
export const CHANNEL_TICKS = 'market:ticks';
export const KEY_SNAPSHOT = 'market:snapshot';
