import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/store.jsx';
import { TopBar } from '../components/TopBar.jsx';
import { Sparkline } from '../components/Sparkline.jsx';
import { ChangeText } from '../components/bits.jsx';
import { inr } from '../lib/format.js';
import { trendColor, flashClass } from '../lib/selectors.js';

export function Watchlist() {
  const { stocks, watchlist, addWatch, removeWatch } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  const query = q.trim().toLowerCase();
  const watched = watchlist.map((s) => stocks[s]).filter(Boolean);
  const filtered = query
    ? watched.filter((s) => s.symbol.toLowerCase().includes(query) || s.name.toLowerCase().includes(query))
    : watched;

  // Non-watched stocks matching the query — surfaced as "add to watchlist" results.
  const results = query
    ? Object.values(stocks)
        .filter((s) => !watchlist.includes(s.symbol))
        .filter(
          (s) =>
            s.symbol.toLowerCase().includes(query) ||
            s.name.toLowerCase().includes(query) ||
            s.sector.toLowerCase().includes(query)
        )
        .slice(0, 5)
    : [];

  return (
    <>
      <TopBar title="Watchlist" />
      <div className="page">
        <input
          className="input"
          style={{ borderRadius: 11, padding: '13px 15px', marginBottom: 14 }}
          placeholder="Search stocks by name, symbol or sector…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        {results.length > 0 && (
          <div className="card" style={{ marginBottom: 14, padding: '16px 12px 8px 20px' }}>
            <div className="label" style={{ marginBottom: 4 }}>ADD TO WATCHLIST</div>
            {results.map((s) => (
              <div
                key={s.symbol}
                style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 14, padding: '10px 8px 10px 0' }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s.symbol}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{s.name} · {s.sector}</div>
                </div>
                <div className="mono" style={{ fontSize: 13 }}>{inr(s.price)}</div>
                <button
                  className="filter-chip active"
                  style={{ padding: '5px 12px' }}
                  onClick={() => addWatch(s.symbol)}
                >
                  + Add
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="card" style={{ padding: '10px 8px 10px 20px' }}>
          {filtered.length === 0 ? (
            <div className="empty">
              <div className="msg">{watched.length === 0 ? 'Your watchlist is empty' : 'No matches'}</div>
            </div>
          ) : (
            filtered.map((s) => (
              <div
                key={s.symbol}
                className={'row-link flashable ' + flashClass(s)}
                style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', alignItems: 'center', gap: 16, padding: '13px 12px', cursor: 'pointer' }}
                onClick={() => navigate('/stock/' + s.symbol)}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{s.symbol}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{s.name}</div>
                </div>
                <Sparkline data={s.hist} width={90} height={26} color={trendColor(s)} points={32} />
                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontSize: 13.5 }}>{inr(s.price)}</div>
                  <div style={{ fontSize: 11.5, marginTop: 2 }}>
                    <ChangeText s={s} />
                  </div>
                </div>
                <button
                  title="Remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeWatch(s.symbol);
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-faint)', fontSize: 15, padding: '4px 6px', borderRadius: 6 }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--loss)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-faint)')}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
