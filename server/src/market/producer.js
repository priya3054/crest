import { Order } from '../models/Order.js';
import { applyTrade } from '../services/trade.js';
import { applyTick, snapshot, tickSnapshot, isMarketOpen, marketStatus, TICK_MS } from './market.js';
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
    } else {
      // The price crossed but the fill failed (e.g. funds spent elsewhere, or
      // the shares were already sold). Reject it once instead of leaving it
      // `pending` — otherwise this same order retries and fails every tick,
      // forever, hammering the DB.
      o.status = 'rejected';
      o.rejectReason = res.error;
    }
    await o.save();
  }
}

// Publish the current market to the Redis tick channel AND cache it, so gateways
// can push it to their clients and new connections get an instant snapshot.
async function publish() {
  const full = snapshot(); // with history — cached for new connections
  const slim = tickSnapshot(); // price/flash only — broadcast every tick
  const priceOf = (sym) => slim.find((s) => s.symbol === sym)?.price ?? null;
  const { open, reason } = marketStatus();
  // Cache the FULL snapshot so a new client can paint the chart immediately, but
  // publish only the SLIM payload to the per-tick channel (~98% smaller).
  await redis.set(KEY_SNAPSHOT, JSON.stringify({ open, reason, stocks: full }));
  await pub.publish(CHANNEL_TICKS, JSON.stringify({ open, reason, stocks: slim }));
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

// Stop the tick loop so a graceful shutdown doesn't leave a dangling timer.
export function stopProducer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
