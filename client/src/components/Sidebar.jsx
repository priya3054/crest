import { NavLink } from 'react-router-dom';
import { Logo } from './Logo.jsx';
import { useStore } from '../store.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/watchlist', label: 'Watchlist' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/orders', label: 'Orders' },
  { to: '/wallet', label: 'Wallet' },
];

export function Sidebar() {
  const { market } = useStore();
  const open = market?.open ?? true;

  return (
    <aside className="sidebar">
      <Logo />
      <nav className="nav">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
            <span className="nav-diamond" />
            {n.label}
          </NavLink>
        ))}
      </nav>

      <div className="live-card">
        <div className="live-row">
          <span className={'live-dot' + (open ? ' pulse' : ' closed')} />
          <span className={'live-label' + (open ? '' : ' closed')}>{open ? 'LIVE' : 'CLOSED'}</span>
        </div>
        <div className="live-caption">Simulated market feed. Virtual funds only.</div>
      </div>
    </aside>
  );
}
