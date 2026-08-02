// Derived values computed from live stocks + holdings. Pure functions, no state.

export const change = (s) => s.price - s.prevClose;
export const changePct = (s) => ((s.price - s.prevClose) / s.prevClose) * 100;
export const isUp = (s) => s.price >= s.prevClose;
export const trendColor = (s) => (isUp(s) ? 'var(--gain)' : 'var(--loss)');

export const flashClass = (s) =>
  s && s.flash > 0 ? 'flash-up' : s && s.flash < 0 ? 'flash-down' : '';

// Aggregate portfolio math for the holdings screen + dashboard cards.
export function portfolio(holdings, stocks) {
  let invested = 0;
  let curVal = 0;
  let dayPnl = 0;
  let prevVal = 0;

  const rows = holdings.map((h) => {
    const s = stocks[h.symbol] || { price: 0, prevClose: 0 };
    const inv = h.qty * h.avg;
    const val = h.qty * s.price;
    const pnl = val - inv;
    const pp = inv ? (pnl / inv) * 100 : 0;
    invested += inv;
    curVal += val;
    prevVal += s.prevClose * h.qty;
    dayPnl += (s.price - s.prevClose) * h.qty;
    return { ...h, name: s.name, ltp: s.price, inv, val, pnl, pp, flash: s.flash || 0 };
  });

  const totalPnl = curVal - invested;
  const totalPct = invested ? (totalPnl / invested) * 100 : 0;
  const dayPct = prevVal ? (dayPnl / prevVal) * 100 : 0;
  return { rows, invested, curVal, totalPnl, totalPct, dayPnl, dayPct };
}
