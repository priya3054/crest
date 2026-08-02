import { useNavigate } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { useUI } from '../ui.jsx';
import { inr } from '../format.js';

export function TopBar({ title }) {
  const { cash } = useStore();
  const { openOrder, toggleNav } = useUI();
  const navigate = useNavigate();

  return (
    <header className="topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <button className="hamburger" onClick={toggleNav} aria-label="Menu">☰</button>
        <div className="topbar-title">{title}</div>
      </div>
      <div className="topbar-right">
        <button className="wallet-pill" onClick={() => navigate('/wallet')}>
          <span className="label">WALLET</span>
          <span className="bal mono">{inr(cash)}</span>
        </button>
        <button className="btn btn-primary" onClick={() => openOrder()}>
          Place order
        </button>
      </div>
    </header>
  );
}
