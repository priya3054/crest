import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { useUI } from '../ui.jsx';
import { TopBar } from '../components/TopBar.jsx';
import { PriceChart } from '../components/PriceChart.jsx';
import { inr, signedInr, pct, grouped } from '../format.js';
import { change, changePct, isUp, trendColor, flashClass } from '../selectors.js';

const RANGES = ['1D', '1W', '1M', '1Y'];

// Stable pseudo-random in [0,1) from a string, so order-book depth doesn't flicker.
function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

export function StockDetail() {
  const { symbol } = useParams();
  const { stocks, holdings } = useStore();
  const { openOrder } = useUI();
  const navigate = useNavigate();
  const [range, setRange] = useState('1D');

  const s = stocks[symbol];
  if (!s) {
    return (
      <>
        <TopBar title="Stock" />
        <div className="page">
          <div className="empty"><div className="msg">Stock not found.</div></div>
        </div>
      </>
    );
  }

  const up = isUp(s);
  const color = trendColor(s);

  // Fake 5-level order book around the live price (±0.04% · level).
  const stepp = Math.max(0.05, s.price * 0.0004);
  const levels = (side) => {
    let mx = 1;
    const rows = [];
    for (let i = 1; i <= 5; i++) {
      const q = Math.round(60 + seeded(symbol + side + i) * 840);
      mx = Math.max(mx, q);
      rows.push({ p: side === 'b' ? s.price - stepp * i : s.price + stepp * i, q });
    }
    return rows.map((r) => ({ ...r, w: Math.round((r.q / mx) * 88) }));
  };
  const bids = levels('b');
  const asks = levels('a');

  const pos = holdings.find((h) => h.symbol === symbol);
  const posVal = pos ? pos.qty * s.price : 0;
  const posInv = pos ? pos.qty * pos.avg : 0;
  const posPnl = posVal - posInv;

  const Stat = ({ label, value }) => (
    <div>
      <div className="label" style={{ fontSize: 10 }}>{label}</div>
      <div className="mono" style={{ fontSize: 12.5, marginTop: 5 }}>{value}</div>
    </div>
  );

  return (
    <>
      <TopBar title={s.name} />
      <div className="page">
        <button className="back-link" style={{ background: 'none', border: 'none', padding: 0, marginBottom: 18 }} onClick={() => navigate(-1)}>
          ‹ Back
        </button>

        {/* header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22, fontWeight: 700 }}>{s.symbol}</span>
              <span className="chip chip-sector">{s.sector}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{s.name}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ textAlign: 'right' }}>
              <div className={'mono flashable ' + flashClass(s)} style={{ fontSize: 30, fontWeight: 600, padding: '2px 6px', borderRadius: 8, display: 'inline-block' }}>
                {inr(s.price)}
              </div>
              <div className="mono" style={{ fontSize: 13, marginTop: 2, color }}>
                {signedInr(change(s))} ({pct(changePct(s))}) <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--ui)' }}>today</span>
              </div>
            </div>
            <button className="btn btn-primary" style={{ padding: '10px 22px' }} onClick={() => openOrder(symbol, 'buy')}>Buy</button>
            <button className="btn btn-sell" style={{ padding: '10px 22px' }} onClick={() => openOrder(symbol, 'sell')}>Sell</button>
          </div>
        </div>

        {/* grid */}
        <div className="grid-detail">
          {/* price chart */}
          <div className="card">
            <div className="card-head" style={{ marginBottom: 14 }}>
              <div className="card-title">Price</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {RANGES.map((r) => (
                  <button key={r} className={'type-chip' + (range === r ? ' active' : '')} onClick={() => setRange(r)}>{r}</button>
                ))}
              </div>
            </div>
            <PriceChart data={s.hist} color={color} height={250} range={range} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
              <Stat label="OPEN" value={inr(s.hist[0])} />
              <Stat label="HIGH" value={inr(Math.max(...s.hist))} />
              <Stat label="LOW" value={inr(Math.min(...s.hist))} />
              <Stat label="PREV CLOSE" value={inr(s.prevClose)} />
              <Stat label="VOLUME" value={grouped(s.volq * 997 + Math.round(s.price * 7))} />
            </div>
          </div>

          {/* right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* order book */}
            <div className="card">
              <div className="card-head" style={{ marginBottom: 12 }}>
                <div className="card-title">Order book</div>
                <span className="faint" style={{ fontSize: 11.5 }}>Top 5 levels</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="table-head" style={{ display: 'flex', justifyContent: 'space-between' }}><span>QTY</span><span>BID</span></div>
                <div className="table-head" style={{ display: 'flex', justifyContent: 'space-between' }}><span>ASK</span><span>QTY</span></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 6 }}>
                <div>
                  {bids.map((r, i) => (
                    <div key={i} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', padding: '5px 6px', fontSize: 11.5 }}>
                      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: r.w + '%', background: 'rgba(47,201,140,0.09)', borderRadius: 4 }} />
                      <span className="mono" style={{ color: 'var(--text-muted)', position: 'relative' }}>{grouped(r.q)}</span>
                      <span className="mono" style={{ color: 'var(--gain)', position: 'relative' }}>{inr(r.p)}</span>
                    </div>
                  ))}
                </div>
                <div>
                  {asks.map((r, i) => (
                    <div key={i} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', padding: '5px 6px', fontSize: 11.5 }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: r.w + '%', background: 'rgba(242,84,91,0.09)', borderRadius: 4 }} />
                      <span className="mono" style={{ color: 'var(--loss)', position: 'relative' }}>{inr(r.p)}</span>
                      <span className="mono" style={{ color: 'var(--text-muted)', position: 'relative' }}>{grouped(r.q)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--text-faint)', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                Spread <span className="mono">{inr(stepp * 2)}</span>
              </div>
            </div>

            {/* position */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 14 }}>Your position</div>
              {pos ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 12px' }}>
                    <div><div className="label" style={{ fontSize: 10 }}>QTY</div><div className="mono" style={{ marginTop: 5 }}>{pos.qty}</div></div>
                    <div><div className="label" style={{ fontSize: 10 }}>AVG PRICE</div><div className="mono" style={{ marginTop: 5 }}>{inr(pos.avg)}</div></div>
                    <div><div className="label" style={{ fontSize: 10 }}>INVESTED</div><div className="mono" style={{ marginTop: 5 }}>{inr(posInv)}</div></div>
                    <div><div className="label" style={{ fontSize: 10 }}>CURRENT</div><div className="mono" style={{ marginTop: 5 }}>{inr(posVal)}</div></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
                    <span className="label" style={{ fontSize: 10 }}>P&L</span>
                    <span className="mono" style={{ color: posPnl >= 0 ? 'var(--gain)' : 'var(--loss)', fontWeight: 600 }}>
                      {signedInr(posPnl)} {posInv > 0 && `(${pct((posPnl / posInv) * 100)})`}
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '6px 0' }}>You don't hold {symbol} yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
