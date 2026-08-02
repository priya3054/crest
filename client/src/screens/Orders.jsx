import { useState } from 'react';
import { useStore } from '../context/store.jsx';
import { useUI } from '../context/ui.jsx';
import { TopBar } from '../components/TopBar.jsx';
import { StatusChip, SideLabel } from '../components/bits.jsx';
import { inr, fdate } from '../lib/format.js';

const FILTERS = ['all', 'pending', 'executed', 'cancelled'];
const LABEL = { all: 'All', pending: 'Pending', executed: 'Executed', cancelled: 'Cancelled' };
const COLS = '110px minmax(130px,1.5fr) .55fr .7fr .5fr .95fr .95fr .7fr';

export function Orders() {
  const { orders, cancelOrder } = useStore();
  const { openOrder } = useUI();
  const [filter, setFilter] = useState('all');

  const rows = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  return (
    <>
      <TopBar title="Orders" />
      <div className="page">
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {FILTERS.map((f) => (
            <button key={f} className={'filter-chip' + (filter === f ? ' active' : '')} onClick={() => setFilter(f)}>
              {LABEL[f]}
            </button>
          ))}
        </div>

        <div className="card" style={{ padding: '4px 20px 8px', overflowX: 'auto' }}>
          {rows.length === 0 ? (
            <div className="empty">
              <div className="msg">No orders here</div>
              <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => openOrder()}>
                Place an order
              </button>
            </div>
          ) : (
            <div style={{ minWidth: 720 }}>
              <div className="table-head" style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, padding: '14px 0 10px' }}>
                <div>DATE</div>
                <div>STOCK</div>
                <div>SIDE</div>
                <div>TYPE</div>
                <div style={{ textAlign: 'right' }}>QTY</div>
                <div style={{ textAlign: 'right' }}>PRICE</div>
                <div>STATUS</div>
                <div />
              </div>
              {rows.map((o) => (
                <div
                  key={o.id}
                  style={{ display: 'grid', gridTemplateColumns: COLS, gap: 12, alignItems: 'center', padding: '13px 0', borderTop: '1px solid var(--border-subtle)' }}
                >
                  <div className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fdate(o.ts)}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{o.symbol}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>{o.id}</div>
                  </div>
                  <div style={{ fontSize: 12.5 }}><SideLabel side={o.side} /></div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{o.type === 'market' ? 'Market' : 'Limit'}</div>
                  <div className="mono" style={{ textAlign: 'right', fontSize: 13 }}>{o.qty}</div>
                  <div className="mono" style={{ textAlign: 'right', fontSize: 13 }}>{inr(o.price)}</div>
                  <div><StatusChip status={o.status} /></div>
                  <div style={{ textAlign: 'right' }}>
                    {o.status === 'pending' && (
                      <button
                        className="btn btn-sell"
                        style={{ padding: '5px 12px', fontSize: 12 }}
                        onClick={() => cancelOrder(o.id)}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
