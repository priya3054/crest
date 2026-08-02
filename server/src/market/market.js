const VOLATILITY = Number(process.env.VOLATILITY) || 1.2;
export const TICK_MS = Number(process.env.TICK_MS) || 1400;

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

// One price step (producer only): re-price every stock with a slight upward bias
// and extend its history window. Returns the lightweight snapshot to publish.
export function applyTick() {
  const vol = VOLATILITY * 0.0016;
  for (const s of market.values()) {
    const d = (Math.random() - 0.494) * vol * s.vf * s.price;
    const np = Math.max(1, s.price + d);
    s.price = round2(np);
    s.hist = s.hist.concat(s.price).slice(-HISTORY);
    s.flash = d > 0 ? 1 : -1;
  }
  return snapshot();
}

// The dynamic fields that travel over the tick stream (name/sector are static).
export const snapshot = () =>
  [...market.values()].map((s) => ({
    symbol: s.symbol,
    price: s.price,
    prevClose: s.prevClose,
    hist: s.hist,
    flash: s.flash,
  }));

// Apply an incoming snapshot from the tick stream (gateway-only mode).
export function setSnapshot(stocks = []) {
  for (const p of stocks) {
    const s = market.get(p.symbol);
    if (s) {
      s.price = p.price;
      s.prevClose = p.prevClose;
      s.hist = p.hist;
      s.flash = p.flash;
    }
  }
}
