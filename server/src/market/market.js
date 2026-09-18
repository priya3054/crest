import { round2 } from '../utils/money.js';

const VOLATILITY = Number(process.env.VOLATILITY) || 1.2;
export const TICK_MS = Number(process.env.TICK_MS) || 1400;

const REVERSION = Number(process.env.REVERSION) || 0.0015;

const MARKET_HOURS = (process.env.MARKET_HOURS || 'auto').toLowerCase();
const OPEN_MIN = 9 * 60 + 15; // 09:15 IST
const CLOSE_MIN = 15 * 60 + 30; // 15:30 IST

const NSE_HOLIDAYS = new Set(
  (process.env.MARKET_HOLIDAYS ||
    '2026-01-26,2026-03-06,2026-08-15,2026-10-02')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);

let lastSessionDate = null;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function istParts(d = new Date()) {
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return {
    day: ist.getUTCDay(),
    minutes: ist.getUTCHours() * 60 + ist.getUTCMinutes(),
  };
}

function istDateKey(d = new Date()) {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function isMarketOpen(now = new Date()) {
  if (MARKET_HOURS === 'always') return true;
  if (MARKET_HOURS === 'closed') return false;
  const { day, minutes } = istParts(now);
  if (day === 0 || day === 6) return false;
  if (NSE_HOLIDAYS.has(istDateKey(now))) return false;
  return minutes >= OPEN_MIN && minutes < CLOSE_MIN;
}

const market = new Map();

const HISTORY = 240;

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
      anchor: d.anchor,
      price: hist[hist.length - 1],
      prevClose: hist[0],
      hist,
      volq: d.volq,
      vf: 0.8 + Math.random() * 1.2,
      flash: 0, // 1 = ticked up, -1 = ticked down, 0 = unchanged
    });
  }
}

export const getMarket = () => [...market.values()];
export const getStock = (sym) => market.get(sym);
export const marketStatus = () => ({ open: isMarketOpen(), tickMs: TICK_MS });

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
    const noise = (Math.random() - 0.5) * vol * s.vf * s.price;
    const reversion = REVERSION * (s.anchor - s.price);
    const np = Math.max(1, s.price + noise + reversion);
    const newPrice = round2(np);
    s.flash = newPrice > s.price ? 1 : newPrice < s.price ? -1 : 0; // 0 now reachable (tiny move rounds flat)
    s.price = newPrice;
    s.hist.push(s.price);
    if (s.hist.length > HISTORY) s.hist.shift();
  }
  return snapshot();
}

export const snapshot = () =>
  [...market.values()].map((s) => ({
    symbol: s.symbol,
    price: s.price,
    prevClose: s.prevClose,
    hist: s.hist,
    flash: s.flash,
  }));


export const tickSnapshot = () =>
  [...market.values()].map((s) => ({
    symbol: s.symbol,
    price: s.price,
    prevClose: s.prevClose,
    flash: s.flash,
  }));


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
