import { Server } from 'socket.io';
import { verifyToken } from '../services/auth.js';
import { sub, redis, CHANNEL_TICKS, KEY_SNAPSHOT } from '../config/redis.js';
import { setSnapshot } from './market.js';

let io = null;

// The realtime gateway: authenticates sockets, subscribes to the Redis tick
// stream, and fans each tick out to the clients connected to THIS instance.
// Because every instance subscribes to the same channel, load-balanced gateways
// all deliver the identical feed produced by the single price producer.
export function initRealtime(httpServer, { isProducer }) {
  io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_ORIGIN || true },
    path: '/socket.io',
  });

  // Same JWT the REST API uses — no unauthenticated sockets.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    try {
      const payload = verifyToken(token);
      socket.userId = payload.sub;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    // Send the cached snapshot immediately so the client paints without waiting
    // for the next tick (a cache read, not a recompute).
    try {
      const cached = await redis.get(KEY_SNAPSHOT);
      if (cached) socket.emit('tick', JSON.parse(cached));
    } catch {
      /* ignore */
    }
  });

  sub.subscribe(CHANNEL_TICKS).then(() => console.log('[realtime] subscribed to ticks'));
  sub.on('message', (channel, message) => {
    if (channel !== CHANNEL_TICKS) return;
    const payload = JSON.parse(message);
    if (!isProducer) setSnapshot(payload.stocks); // gateway-only: keep REST reads fresh
    io.emit('tick', payload);
  });

  console.log('[realtime] socket.io gateway ready');
}
