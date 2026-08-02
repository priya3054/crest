import { Order } from './models/index.js';
import { applyTrade } from './trade.js';

const TICK_MS = Number(process.env.TICK_MS) || 1400;
const VOLATILITY = Number(process.env.VOLATILITY) || 1.2;

// Market-hours mode: 'auto' follows real NSE hours, 'always' keeps it open 24/7
// (handy for demos), 'closed' forces it shut.
const MARKET_HOURS = (process.env.MARKET_HOURS || 'auto').toLowerCase();
const OPEN_MIN = 9 * 60 + 15; // 09:15 IST
const CLOSE_MIN = 15 * 60 + 30; // 15:30 IST

const round2 = (n) => Math.round(n * 100) / 100;

// Current time expressed in IST (UTC+5:30), independent of the server's timezone.
function istNow() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + 5.5 * 3600000);
}

// Is the market open right now? NSE trades Mon–Fri, 09:15–15:30 IST.
export function isMarketOpen() {
  if (MARKET_HOURS === 'always') return true;
  if (MARKET_HOURS === 'closed') return false;
  const ist = istNow();
  const day = ist.getDay(); // 0 Sun … 6 Sat
  if (day === 0 || day === 6) return false;
  const mins = ist.getHours() * 60 + ist.getMinutes();
  return mins >= OPEN_MIN && mins <= CLOSE_MIN;
}

// Live market state lives in memory: symbol -> {price, prevClose, hist[], ...}.
// Prices are simulated and ephemeral, so we deliberately do NOT persist them to
// Mongo every tick. Mongo stays the source of truth for money/positions/orders;
// this module is the source of truth for prices. Restarting regenerates prices
// (like reloading the design prototype) while cash/holdings/orders persist.
const market = new Map();
let timer = null;

// Retain a deep history so the detail chart's 1D/1W/1M/1Y ranges show genuinely
// different windows (not just cosmetic chips). Sparklines still read the last ~32.
const HISTORY = 240;

// Build a gently-wandering history around each stock's anchor price so
// charts/sparklines look alive from tick 0.
export function hydrateMarket(stockDefs) {
  market.clear();
  for (const d of stockDefs) {
    const hist = [];
    let p = d.anchor * (0.994 + 0.012 * Math.random());
    for (let k = 0; k < HISTORY; k++) {
      p = Math.max(1, p * (1 + (Math.random() - 0.5) * 0.005));
      hist.push(round2(p));
    }
    market.set(d.symbol, {
      symbol: d.symbol,
      name: d.name,
      sector: d.sector,
      price: hist[hist.length - 1],
      prevClose: hist[0],
      hist,
      volq: d.volq,
      vf: 0.8 + Math.random() * 1.2, // per-stock volatility factor
      flash: 0, // 1 = ticked up, -1 = ticked down, 0 = unchanged
    });
  }
}

export const getMarket = () => [...market.values()];
export const getStock = (sym) => market.get(sym);
export const marketStatus = () => ({ open: isMarketOpen(), tickMs: TICK_MS });

// One simulation step: re-price every stock with a slight upward bias, extend its
// history window, then check whether any pending limit order should now fill.
async function tick() {
  const vol = VOLATILITY * 0.0016;
  for (const s of market.values()) {
    const d = (Math.random() - 0.494) * vol * s.vf * s.price;
    const np = Math.max(1, s.price + d);
    s.price = round2(np);
    s.hist = s.hist.concat(s.price).slice(-HISTORY);
    s.flash = d > 0 ? 1 : -1;
  }
  await processLimitOrders();
}

// Auto-fill pending limit orders when price crosses the limit:
//   buy fills when price <= limit, sell fills when price >= limit.
// A fill that can't be afforded / covered stays pending and is re-checked next tick.
async function processLimitOrders() {
  const pending = await Order.find({ status: 'pending', type: 'limit' });
  for (const o of pending) {
    const s = market.get(o.symbol);
    if (!s) continue;
    const crosses = o.side === 'buy' ? s.price <= o.limit : s.price >= o.limit;
    if (!crosses) continue;
    const res = await applyTrade(o.userId, o.symbol, o.side, o.qty, o.limit);
    if (res.ok) {
      o.status = 'executed';
      o.price = o.limit;
      await o.save();
    }
  }
}

export function startSim() {
  if (timer) return;
  const loop = async () => {
    if (isMarketOpen()) {
      try {
        await tick();
      } catch (e) {
        console.error('[sim] tick error:', e.message);
      }
    }
    timer = setTimeout(loop, TICK_MS);
  };
  timer = setTimeout(loop, TICK_MS);
  console.log(`[sim] started — tick ${TICK_MS}ms, volatility ${VOLATILITY}, market-hours '${MARKET_HOURS}'`);
}
