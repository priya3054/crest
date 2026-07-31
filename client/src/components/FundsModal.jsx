import { useState } from 'react';
import { useStore } from '../store.jsx';
import { inr, inr0 } from '../format.js';

const QUICK = [5000, 10000, 25000];

export function FundsModal({ mode, onClose }) {
  const { cash, wallet } = useStore();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [stage, setStage] = useState('form'); // form | processing | done
  const [result, setResult] = useState(null); // { amt, balance }

  const isAdd = mode === 'add';
  const amt = Math.floor(Number(amount) || 0);

  const proceed = () => {
    setError('');
    if (amt < 100) return setError('Enter an amount of at least ₹100.');
    if (!isAdd && amt > cash) return setError('Amount exceeds your wallet balance.');

    setStage('processing');
    // Simulated Razorpay round-trip.
    setTimeout(async () => {
      try {
        const r = await wallet({ mode, amount: amt });
        setResult({ amt, balance: r.cash });
        setStage('done');
      } catch (e) {
        setError(e.message);
        setStage('form');
      }
    }, 1200);
  };

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        {stage === 'processing' ? (
          <div style={{ textAlign: 'center', padding: '24px 8px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><div className="spinner" /></div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Contacting Razorpay…</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6 }}>Securely processing your request.</div>
          </div>
        ) : stage === 'done' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <div className="status-circle ok">✓</div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              {inr0(result.amt)} {isAdd ? 'added to wallet' : 'withdrawn'}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6 }}>
              New balance: <span className="mono" style={{ color: 'var(--text-primary)' }}>{inr(result.balance)}</span>
            </div>
            <button className="btn btn-primary btn-block" style={{ marginTop: 20 }} onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{isAdd ? 'Add funds' : 'Withdraw funds'}</div>
              <button className="modal-close" onClick={onClose}>✕</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 16 }}>
              Wallet balance: <span className="mono" style={{ color: 'var(--text-secondary)' }}>{inr(cash)}</span>
            </div>

            <div className="label" style={{ marginBottom: 7 }}>AMOUNT (₹)</div>
            <input
              className="input mono"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="0"
              style={{ marginBottom: 12 }}
            />

            <div style={{ display: 'flex', gap: 8, marginBottom: error ? 12 : 18 }}>
              {QUICK.map((v) => (
                <button
                  key={v}
                  className="filter-chip"
                  onClick={() => setAmount(String((Math.floor(Number(amount) || 0)) + v))}
                >
                  +{inr0(v)}
                </button>
              ))}
            </div>

            {error && <div className="error-panel" style={{ marginBottom: 16 }}>{error}</div>}

            <button className="btn btn-primary btn-block" onClick={proceed}>
              {isAdd ? 'Proceed to Razorpay' : 'Withdraw via Razorpay'}
            </button>
            <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--text-faint)', marginTop: 12 }}>
              Secured by Razorpay · simulated sandbox
            </div>
          </>
        )}
      </div>
    </div>
  );
}
