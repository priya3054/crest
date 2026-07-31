import { useNavigate } from 'react-router-dom';
import { useStore } from '../store.jsx';
import { useUI } from '../ui.jsx';
import { inr } from '../format.js';

export function TopBar({ title }) {
  const { cash } = useStore();
  const { openOrder } = useUI();
  const navigate = useNavigate();

  return (
    <header className="topbar">
      <div className="topbar-title">{title}</div>
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
