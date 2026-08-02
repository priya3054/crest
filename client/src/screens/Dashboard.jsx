import { useNavigate } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { useUI } from '../ui.jsx';
import { TopBar } from '../components/TopBar.jsx';
import { Sparkline } from '../components/Sparkline.jsx';
import { StatusChip, SideLabel, ChangeText } from '../components/bits.jsx';
import { inr, signedInr, pct, fdate } from '../format.js';
import { portfolio, trendColor, isUp, flashClass } from '../selectors.js';

export function Dashboard() {
  const { cash, stocks, holdings, orders, watchlist } = useStore();
  const { openFunds } = useUI();
  const navigate = useNavigate();

  const pf = portfolio(holdings, stocks);
  const watch = watchlist.map((sym) => stocks[sym]).filter(Boolean).slice(0, 6);
  const recent = orders.slice(0, 4);

  return (
    <>
      <TopBar title="Dashboard" />
      <div className="page">
        {/* stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 14 }}>
          <div className="card">
            <div className="label">WALLET BALANCE</div>
            <div className="stat-value">{inr(cash)}</div>
            <button
              onClick={() => openFunds('add')}
              className="link"
              style={{ background: 'none', border: 'none', padding: 0, marginTop: 12, display: 'block' }}
            >
              + Add funds
            </button>
          </div>

          <div className="card">
            <div className="label">PORTFOLIO VALUE</div>
            <div className="stat-value">{inr(pf.curVal)}</div>
            <div style={{ marginTop: 10, fontSize: 12.5 }}>
              <span className="mono" style={{ color: pf.dayPnl >= 0 ? 'var(--gain)' : 'var(--loss)', fontWeight: 500 }}>
                {signedInr(pf.dayPnl)} ({pct(pf.dayPct)})
              </span>
              <span style={{ color: 'var(--text-faint)' }}> today</span>
            </div>
          </div>

          <div className="card">
            <div className="label">UNREALIZED P&amp;L</div>
            <div className="stat-value" style={{ color: pf.totalPnl >= 0 ? 'var(--gain)' : 'var(--loss)' }}>
              {signedInr(pf.totalPnl)}
            </div>
            <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text-faint)' }}>
              Invested <span className="mono">{inr(pf.invested)}</span>
            </div>
          </div>
        </div>

        {/* two-column grid */}
        <div className="grid-main" style={{ marginTop: 14 }}>
          {/* watchlist */}
          <div className="card" style={{ padding: '18px 8px 10px 20px' }}>
            <div className="card-head" style={{ paddingRight: 12 }}>
              <div className="card-title">Watchlist</div>
              <button className="link" style={{ background: 'none', border: 'none' }} onClick={() => navigate('/watchlist')}>
                View all
              </button>
            </div>
            <div style={{ marginTop: 6 }}>
              {watch.map((s) => (
                <div
                  key={s.symbol}
                  className={'row-link flashable ' + flashClass(s)}
                  onClick={() => navigate('/stock/' + s.symbol)}
                  style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 14, padding: '11px 12px', cursor: 'pointer' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{s.symbol}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.name}
                    </div>
                  </div>
                  <Sparkline data={s.hist} width={76} height={24} color={trendColor(s)} points={32} />
                  <div style={{ textAlign: 'right' }}>
                    <div className="mono" style={{ fontSize: 13 }}>{inr(s.price)}</div>
                    <div style={{ fontSize: 11.5, marginTop: 2 }}>
                      <ChangeText s={s} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* recent orders */}
          <div className="card" style={{ padding: '18px 12px 10px 20px' }}>
            <div className="card-head" style={{ paddingRight: 8 }}>
              <div className="card-title">Recent orders</div>
              <button className="link" style={{ background: 'none', border: 'none' }} onClick={() => navigate('/orders')}>
                View all
              </button>
            </div>
            <div style={{ marginTop: 6 }}>
              {recent.map((o) => (
                <div
                  key={o.id}
                  style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 10, padding: '11px 8px', borderTop: '1px solid var(--border-subtle)' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{o.symbol}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                      <SideLabel side={o.side} /> · {o.type === 'market' ? 'Market' : 'Limit'} · {fdate(o.ts)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <span className="mono" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                      {o.qty} × {inr(o.price)}
                    </span>
                    <StatusChip status={o.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
