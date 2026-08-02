import { Order } from '../models/index.js';
import { applyTrade } from '../services/trade.js';
import { applyTick, snapshot, isMarketOpen, marketStatus, TICK_MS } from './market.js';
import { pub, redis, CHANNEL_TICKS, KEY_SNAPSHOT } from '../config/redis.js';

let timer = null;

// Auto-fill pending limit orders when price crosses the limit:
//   buy fills when price <= limit, sell fills when price >= limit.
async function processLimitOrders(getPrice) {
  const pending = await Order.find({ status: 'pending', type: 'limit' });
  for (const o of pending) {
    const price = getPrice(o.symbol);
    if (price == null) continue;
    const crosses = o.side === 'buy' ? price <= o.limit : price >= o.limit;
    if (!crosses) continue;
    const res = await applyTrade(o.userId, o.symbol, o.side, o.qty, o.limit);
    if (res.ok) {
      o.status = 'executed';
      o.price = o.limit;
      await o.save();
    }
  }
}

// Publish the current market to the Redis tick channel AND cache it, so gateways
// can push it to their clients and new connections get an instant snapshot.
async function publish() {
  const stocks = snapshot();
  const priceOf = (sym) => stocks.find((s) => s.symbol === sym)?.price ?? null;
  const payload = JSON.stringify({ open: marketStatus().open, stocks });
  await redis.set(KEY_SNAPSHOT, payload);
  await pub.publish(CHANNEL_TICKS, payload);
  return priceOf;
}

// The single source of truth for prices. Only ONE producer runs, even when many
// gateways are load-balanced — that's what keeps every client on the same feed.
export function startProducer() {
  if (timer) return;
  const loop = async () => {
    try {
      if (isMarketOpen()) applyTick(); // re-price only during market hours
      const priceOf = await publish(); // always publish (carries the open flag)
      if (isMarketOpen()) await processLimitOrders(priceOf);
    } catch (e) {
      console.error('[producer] tick error:', e.message);
    }
    timer = setTimeout(loop, TICK_MS);
  };
  timer = setTimeout(loop, TICK_MS);
  console.log(`[producer] started — ticking every ${TICK_MS}ms, publishing to Redis`);
}
