import { useStore } from '../store.jsx';
import { useUI } from '../ui.jsx';
import { TopBar } from '../components/TopBar.jsx';
import { StatusChip } from '../components/bits.jsx';
import { inr, inr0, fdate } from '../format.js';

export function Wallet() {
  const { cash, txns } = useStore();
  const { openFunds } = useUI();

  return (
    <>
      <TopBar title="Wallet" />
      <div className="page">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
          {/* balance card */}
          <div className="card">
            <div className="label">WALLET BALANCE</div>
            <div className="mono" style={{ fontSize: 30, fontWeight: 600, marginTop: 10 }}>{inr(cash)}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 5 }}>Virtual funds · settled instantly</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button className="btn btn-primary" onClick={() => openFunds('add')}>Add funds</button>
              <button className="btn btn-outline" onClick={() => openFunds('withdraw')}>Withdraw</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 16, lineHeight: 1.5 }}>
              Payments are simulated via a Razorpay sandbox — no real money moves.
            </div>
          </div>

          {/* transactions */}
          <div className="card" style={{ padding: '18px 20px 8px' }}>
            <div className="card-title" style={{ marginBottom: 10 }}>Transactions</div>
            <div className="table-head" style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr auto', gap: 12, padding: '0 0 8px' }}>
              <div>DATE</div>
              <div>TYPE</div>
              <div style={{ textAlign: 'right' }}>AMOUNT</div>
            </div>
            {txns.map((t) => (
              <div
                key={t.id}
                style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr auto', gap: 12, alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--border-subtle)' }}
              >
                <div className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fdate(t.ts)}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{t.type}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>via {t.via}</div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <span className="mono" style={{ fontSize: 13, color: t.dir > 0 ? 'var(--gain)' : 'var(--text-primary)' }}>
                    {t.dir > 0 ? '+' : '-'}{inr0(t.amount)}
                  </span>
                  <StatusChip status={t.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
