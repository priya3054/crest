import { Order } from '../models/Order.js';
import { applyTrade } from '../services/trade.js';
import { applyTick, snapshot, tickSnapshot, isMarketOpen, marketStatus, TICK_MS } from './market.js';
import { pub, redis, CHANNEL_TICKS, KEY_SNAPSHOT } from '../config/redis.js';

let timer = null;

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
      o.status = 'rejected';
      o.rejectReason = res.error;
    }
    await o.save();
  }
}

async function publish() {
  const full = snapshot();
  const slim = tickSnapshot();
  const priceOf = (sym) => slim.find((s) => s.symbol === sym)?.price ?? null;
  const { open, reason } = marketStatus();
  await redis.set(KEY_SNAPSHOT, JSON.stringify({ open, reason, stocks: full }));
  await pub.publish(CHANNEL_TICKS, JSON.stringify({ open, reason, stocks: slim }));
  return priceOf;
}

export function startProducer() {
  if (timer) return;
  const loop = async () => {
    try {
      if (isMarketOpen()) applyTick();
      const priceOf = await publish();
      if (isMarketOpen()) await processLimitOrders(priceOf);
    } catch (e) {
      console.error('[producer] tick error:', e.message);
    }
    timer = setTimeout(loop, TICK_MS);
  };
  timer = setTimeout(loop, TICK_MS);
  console.log(`[producer] started — ticking every ${TICK_MS}ms, publishing to Redis`);
}

export function stopProducer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
