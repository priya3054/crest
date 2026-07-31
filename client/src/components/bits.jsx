import { signedInr, pct } from '../format.js';
import { change, changePct, trendColor } from '../selectors.js';

// Coloured order-status pill.
export function StatusChip({ status }) {
  const cls = { executed: 'chip-executed', pending: 'chip-pending', cancelled: 'chip-cancelled' }[status];
  const label = { executed: 'Executed', pending: 'Pending', cancelled: 'Cancelled' }[status];
  return <span className={'chip ' + cls}>{label}</span>;
}

// BUY (green) / SELL (red) side label.
export function SideLabel({ side }) {
  return (
    <span style={{ color: side === 'buy' ? 'var(--gain)' : 'var(--loss)', fontWeight: 700 }}>
      {side.toUpperCase()}
    </span>
  );
}

// Coloured "+₹Δ (+x.xx%)" change text derived from a live stock.
export function ChangeText({ s, suffix = '' }) {
  return (
    <span className="mono" style={{ color: trendColor(s), fontWeight: 500 }}>
      {signedInr(change(s))} ({pct(changePct(s))})
      {suffix && <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--ui)' }}>{suffix}</span>}
    </span>
  );
}
