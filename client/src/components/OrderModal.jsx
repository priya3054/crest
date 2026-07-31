import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { inr } from '../format.js';

export function OrderModal({ initial, onClose }) {
  const { stocks, cash, holdings, placeOrder } = useStore();
  const navigate = useNavigate();

  const symbols = Object.keys(stocks);
  const [symbol, setSymbol] = useState(initial.symbol || symbols[0]);
  const [side, setSide] = useState(initial.side || 'buy');
  const [type, setType] = useState('market');
  const [qty, setQty] = useState('');
  const [limit, setLimit] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // filled receipt on success

  const s = stocks[symbol];
  const nQty = Math.floor(Number(qty) || 0);
  const px = type === 'limit' ? Number(limit) || 0 : s?.price || 0;
  const est = nQty * px;
  const hold = holdings.find((h) => h.symbol === symbol);

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      const r = await placeOrder({ symbol, side, type, qty: nQty, limit: type === 'limit' ? Number(limit) : undefined });
      setDone({ ...r.order, executed: r.executed });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmLabel = `${side === 'buy' ? 'Buy' : 'Sell'}${nQty >= 1 ? ` ${nQty} ×` : ''} ${symbol}`;

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 424 }} onClick={(e) => e.stopPropagation()}>
        {done ? (
          <SuccessView done={done} onClose={onClose} onViewOrders={() => { onClose(); navigate('/orders'); }} />
        ) : (
          <>
            {/* header: stock select + live price + close */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <select className="select" style={{ flex: 1 }} value={symbol} onChange={(e) => setSymbol(e.target.value)}>
                {symbols.map((sym) => (
                  <option key={sym} value={sym}>{sym} — {stocks[sym].name}</option>
                ))}
              </select>
              <div style={{ textAlign: 'right' }}>
                <div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{inr(s.price)}</div>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--gain)' }}>LIVE</div>
              </div>
              <button className="modal-close" onClick={onClose}>✕</button>
            </div>

            {/* buy / sell */}
            <div className="seg" style={{ marginBottom: 12 }}>
              <button className={'seg-btn' + (side === 'buy' ? ' buy-active' : '')} onClick={() => setSide('buy')}>BUY</button>
              <button className={'seg-btn' + (side === 'sell' ? ' sell-active' : '')} onClick={() => setSide('sell')}>SELL</button>
            </div>

            {/* market / limit */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              <button className={'type-chip' + (type === 'market' ? ' active' : '')} onClick={() => setType('market')}>Market</button>
              <button className={'type-chip' + (type === 'limit' ? ' active' : '')} onClick={() => setType('limit')}>Limit</button>
            </div>

            {/* quantity */}
            <div className="label" style={{ marginBottom: 7 }}>QUANTITY</div>
            <input
              className="input mono"
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="0"
              style={{ marginBottom: type === 'limit' ? 12 : 16 }}
            />

            {type === 'limit' && (
              <>
                <div className="label" style={{ marginBottom: 7 }}>LIMIT PRICE (₹)</div>
                <input
                  className="input mono"
                  inputMode="decimal"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value.replace(/[^0-9.]/g, ''))}
                  placeholder="0.00"
                  style={{ marginBottom: 16 }}
                />
              </>
            )}

            {/* est total */}
            <div className="inset-well" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: error ? 12 : 16 }}>
              <div>
                <div className="label" style={{ fontSize: 10 }}>EST. TOTAL</div>
                <div className="mono" style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{inr(est)}</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {side === 'buy' ? <>Available <span className="mono">{inr(cash)}</span></> : <>You hold <span className="mono">{hold ? hold.qty : 0}</span> shares</>}
              </div>
            </div>

            {error && <div className="error-panel" style={{ marginBottom: 16 }}>{error}</div>}

            <button
              className={'btn btn-block ' + (side === 'buy' ? 'btn-primary' : '')}
              style={side === 'sell' ? { background: 'var(--loss)', color: '#fff' } : undefined}
              disabled={busy}
              onClick={submit}
            >
              {busy ? 'Placing…' : confirmLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SuccessView({ done, onClose, onViewOrders }) {
  const executed = done.executed;
  const rows = [
    ['Order ID', done.id],
    ['Stock', done.symbol],
    ['Side / type', `${done.side === 'buy' ? 'Buy' : 'Sell'} · ${done.type === 'market' ? 'Market' : 'Limit'}`],
    ['Quantity', String(done.qty)],
    ['Price', inr(done.price)],
    ['Total', inr(done.qty * done.price)],
  ];
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
        <div className={'status-circle ' + (executed ? 'ok' : 'pend')}>{executed ? '✓' : '◷'}</div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{executed ? 'Order executed' : 'Order placed'}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6 }}>
        {executed ? 'Your market order was filled instantly.' : `Pending until price crosses ${inr(done.limit ?? done.price)}.`}
      </div>

      <div className="inset-well" style={{ marginTop: 18, textAlign: 'left' }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12.5 }}>
            <span style={{ color: 'var(--text-muted)' }}>{k}</span>
            <span className="mono" style={{ color: 'var(--text-primary)' }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
        <button className="btn btn-outline" style={{ flex: 1 }} onClick={onViewOrders}>View orders</button>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
