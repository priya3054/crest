import Redis from 'ioredis';

const URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

export const redis = new Redis(URL);
export const pub = new Redis(URL);
export const sub = new Redis(URL);

for (const [name, client] of [['redis', redis], ['pub', pub], ['sub', sub]]) {
  client.on('error', (e) => console.error(`[redis:${name}]`, e.message));
}

export const CHANNEL_TICKS = 'market:ticks';
export const KEY_SNAPSHOT = 'market:snapshot';
