import { NavLink } from 'react-router-dom';
import { Logo } from './Logo.jsx';
import { useStore } from '../store.jsx';
import { useAuth } from '../auth.jsx';
import { useUI } from '../ui.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/watchlist', label: 'Watchlist' },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/orders', label: 'Orders' },
  { to: '/wallet', label: 'Wallet' },
];

const initials = (name) =>
  name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export function Sidebar() {
  const { market } = useStore();
  const { user, logout } = useAuth();
  const { navOpen, closeNav } = useUI();
  const open = market?.open ?? true;

  return (
    <>
      {navOpen && <div className="nav-scrim" onClick={closeNav} />}
      <aside className={'sidebar' + (navOpen ? ' open' : '')}>
        <Logo />
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={closeNav} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
              <span className="nav-diamond" />
              {n.label}
            </NavLink>
          ))}
        </nav>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* user chip + logout */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 6px' }}>
            <div
              style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: 'var(--accent-soft)', color: 'var(--accent-text)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
              }}
            >
              {initials(user.name)}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
            </div>
            <button
              title="Log out"
              onClick={logout}
              style={{ background: 'none', border: 'none', color: 'var(--text-faint)', padding: 4, borderRadius: 6, fontSize: 14, lineHeight: 1 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--loss-soft)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-faint)')}
            >
              ⏻
            </button>
          </div>
        )}

        <div className="live-card" style={{ marginTop: 0 }}>
          <div className="live-row">
            <span className={'live-dot' + (open ? ' pulse' : ' closed')} />
            <span className={'live-label' + (open ? '' : ' closed')}>{open ? 'LIVE' : 'CLOSED'}</span>
          </div>
          <div className="live-caption">
            {open ? 'Simulated market feed. Virtual funds only.' : 'Market closed · trades 09:15–15:30 IST, Mon–Fri.'}
          </div>
        </div>
      </div>
    </aside>
    </>
  );
}
