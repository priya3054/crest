import { round2 } from '../utils/money.js';

const VOLATILITY = Number(process.env.VOLATILITY) || 1.2;
export const TICK_MS = Number(process.env.TICK_MS) || 1400;
// How hard prices are pulled back toward their anchor each tick. Without this the
// tiny per-tick noise compounds into runaway drift; with it, prices wander around
// the anchor instead. (See applyTick.)
const REVERSION = Number(process.env.REVERSION) || 0.0015;

// Market-hours mode: 'auto' follows real NSE hours, 'always' keeps it open 24/7
// (handy for demos), 'closed' forces it shut.
const MARKET_HOURS = (process.env.MARKET_HOURS || 'auto').toLowerCase();
const OPEN_MIN = 9 * 60 + 15; // 09:15 IST
const CLOSE_MIN = 15 * 60 + 30; // 15:30 IST

// NSE trading holidays (IST calendar dates, YYYY-MM-DD). Configurable via
// MARKET_HOLIDAYS (comma-separated); defaults to a small illustrative set.
const NSE_HOLIDAYS = new Set(
  (process.env.MARKET_HOLIDAYS ||
    '2026-01-26,2026-03-06,2026-08-15,2026-10-02')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);

// Tracks the IST date of the current session so we can roll prevClose once a day.
let lastSessionDate = null;

// IST is permanently UTC+5:30 (India has no daylight saving). So instead of
// undoing the server's timezone, we shift the raw timestamp forward by 5:30 and
// read it with getUTC* methods — those ignore the machine's timezone entirely.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istParts(d = new Date()) {
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return {
    day: ist.getUTCDay(),                                  // 0 Sun … 6 Sat, in IST
    minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes(), // minutes since IST midnight
  };
}

// The IST calendar date as YYYY-MM-DD — used to key sessions and match holidays.
function istDateKey(d = new Date()) {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

// Is the market open right now? NSE trades Mon–Fri, 09:15–15:30 IST, minus holidays.
export function isMarketOpen(now = new Date()) {
  if (MARKET_HOURS === 'always') return true;
  if (MARKET_HOURS === 'closed') return false;
  const { day, minutes } = istParts(now);
  if (day === 0 || day === 6) return false;
  if (NSE_HOLIDAYS.has(istDateKey(now))) return false;
  return minutes >= OPEN_MIN && minutes < CLOSE_MIN;
}

// In-memory view of live prices. In a single process (ROLE=all) the producer
// mutates this directly; in a split deployment each gateway keeps its own copy
// fresh from the Redis tick stream (setSnapshot). Static fields (name/sector/volq)
// come from Mongo at boot; only price/prevClose/hist/flash change per tick.
const market = new Map();

const HISTORY = 240; // deep history so the chart's 1D/1W/1M/1Y ranges differ

// Build a gently-wandering history around each stock's anchor price.
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
      anchor: d.anchor, // fair-value the sim mean-reverts toward
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

// Roll prevClose to the previous session's close at the start of each new IST
// trading day, so "day change %" is measured from the session open — not from
// whenever the server happened to boot (which never reset before).
function maybeRollover() {
  const today = istDateKey();
  if (lastSessionDate !== null && today !== lastSessionDate) {
    for (const s of market.values()) s.prevClose = s.price;
  }
  lastSessionDate = today;
}

export function applyTick() {
  maybeRollover();
  const vol = VOLATILITY * 0.0016;
  for (const s of market.values()) {
    // Symmetric random noise (mean 0). The old (random - 0.494) had a hidden
    // upward bias of +0.006 per tick, which compounded to roughly +29% per
    // trading day. Mean reversion then pulls the price gently back toward its
    // anchor, so it wanders inside a band instead of drifting off.
    const noise = (Math.random() - 0.5) * vol * s.vf * s.price;
    const reversion = REVERSION * (s.anchor - s.price);
    const np = Math.max(1, s.price + noise + reversion);
    const newPrice = round2(np);
    s.flash = newPrice > s.price ? 1 : newPrice < s.price ? -1 : 0; // 0 now reachable (tiny move rounds flat)
    s.price = newPrice;
    s.hist.push(s.price);
    if (s.hist.length > HISTORY) s.hist.shift(); // mutate in place — no per-tick array realloc
  }
  return snapshot();
}

// FULL snapshot (includes the 240-point history). Used for the cached snapshot new
// clients get on connect and for gateway boot sync — NOT for every tick.
export const snapshot = () =>
  [...market.values()].map((s) => ({
    symbol: s.symbol,
    price: s.price,
    prevClose: s.prevClose,
    hist: s.hist,
    flash: s.flash,
  }));

// SLIM per-tick payload: only what changes each tick. Dropping the history array
// is the difference between ~23 KB and ~0.4 KB per tick, per client — clients
// (and gateway-only instances) append the new price to the history they already have.
export const tickSnapshot = () =>
  [...market.values()].map((s) => ({
    symbol: s.symbol,
    price: s.price,
    prevClose: s.prevClose,
    flash: s.flash,
  }));

// Apply an incoming snapshot from the tick stream (gateway-only mode). Handles
// both shapes: a FULL snapshot (has hist → replace) and a SLIM tick (no hist →
// append the new price to our own history, same as the browser does).
export function setSnapshot(stocks = []) {
  for (const p of stocks) {
    const s = market.get(p.symbol);
    if (!s) continue;
    s.price = p.price;
    if (p.prevClose !== undefined) s.prevClose = p.prevClose;
    s.flash = p.flash;
    if (Array.isArray(p.hist)) {
      s.hist = p.hist;
    } else {
      s.hist.push(p.price);
      if (s.hist.length > HISTORY) s.hist.shift();
    }
  }
}
