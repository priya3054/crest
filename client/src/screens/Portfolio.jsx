import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { useUI } from '../ui.jsx';
import { TopBar } from '../components/TopBar.jsx';
import { inr, signedInr, pct } from '../format.js';
import { portfolio, flashClass } from '../selectors.js';

const SORTS = [
  { key: 'value', label: 'By value' },
  { key: 'gainers', label: 'Gainers' },
  { key: 'losers', label: 'Losers' },
];

const COLS = 'minmax(150px,1.6fr) .5fr .9fr .9fr 1fr 1.3fr';

export function Portfolio() {
  const { stocks, holdings } = useStore();
  const { openOrder } = useUI();
  const navigate = useNavigate();
  const [sort, setSort] = useState('value');

  const pf = portfolio(holdings, stocks);
  const rows = [...pf.rows].sort((a, b) => {
    if (sort === 'value') return b.val - a.val;
    if (sort === 'gainers') return b.pp - a.pp;
    return a.pp - b.pp;
  });

  const StatBlock = ({ label, value, sub, color }) => (
    <div>
      <div className="label">{label}</div>
      <div className="mono" style={{ fontSize: 21, fontWeight: 600, marginTop: 8, color }}>{value}</div>
      {sub && <div className="mono" style={{ fontSize: 12.5, marginTop: 4, color }}>{sub}</div>}
    </div>
  );

  return (
    <>
      <TopBar title="Portfolio" />
      <div className="page">
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="grid-summary">
            <StatBlock label="INVESTED" value={inr(pf.invested)} />
            <StatBlock label="CURRENT VALUE" value={inr(pf.curVal)} />
            <StatBlock
              label="TOTAL P&L"
              value={signedInr(pf.totalPnl)}
              sub={`(${pct(pf.totalPct)})`}
              color={pf.totalPnl >= 0 ? 'var(--gain)' : 'var(--loss)'}
            />
            <StatBlock
              label="TODAY'S P&L"
              value={signedInr(pf.dayPnl)}
              sub={`(${pct(pf.dayPct)})`}
              color={pf.dayPnl >= 0 ? 'var(--gain)' : 'var(--loss)'}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {SORTS.map((s) => (
            <button key={s.key} className={'filter-chip' + (sort === s.key ? ' active' : '')} onClick={() => setSort(s.key)}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="card" style={{ padding: '4px 20px 8px' }}>
          {rows.length === 0 ? (
            <div className="empty">
              <div className="msg">No holdings yet</div>
              <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => openOrder()}>
                Place an order
              </button>
            </div>
          ) : (
            <div className="table-scroll">
             <div className="table-min">
              <div className="table-head" style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '14px 0 10px' }}>
                <div>STOCK</div>
                <div style={{ textAlign: 'right' }}>QTY</div>
                <div style={{ textAlign: 'right' }}>AVG PRICE</div>
                <div style={{ textAlign: 'right' }}>LTP</div>
                <div style={{ textAlign: 'right' }}>VALUE</div>
                <div style={{ textAlign: 'right' }}>P&L</div>
              </div>
              {rows.map((r) => (
                <div
                  key={r.symbol}
                  className={'row-link flashable ' + flashClass(r)}
                  style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, alignItems: 'center', padding: '13px 8px', margin: '0 -8px', cursor: 'pointer' }}
                  onClick={() => navigate('/stock/' + r.symbol)}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.symbol}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{r.name}</div>
                  </div>
                  <div className="mono" style={{ textAlign: 'right', fontSize: 13 }}>{r.qty}</div>
                  <div className="mono" style={{ textAlign: 'right', fontSize: 13 }}>{inr(r.avg)}</div>
                  <div className="mono" style={{ textAlign: 'right', fontSize: 13 }}>{inr(r.ltp)}</div>
                  <div className="mono" style={{ textAlign: 'right', fontSize: 13 }}>{inr(r.val)}</div>
                  <div className="mono" style={{ textAlign: 'right', fontSize: 13, color: r.pnl >= 0 ? 'var(--gain)' : 'var(--loss)' }}>
                    {signedInr(r.pnl)}
                    <div style={{ fontSize: 11.5 }}>({pct(r.pp)})</div>
                  </div>
                </div>
              ))}
             </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
