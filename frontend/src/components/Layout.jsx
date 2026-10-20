import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Settings,
  LogOut,
  Moon,
  Sun,
  Download,
  WifiOff,
  ArrowUpRight as External,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { usePwa } from '../context/PwaContext.jsx';
import { useOnline } from '../hooks/useOnline.js';
import { useToast } from './Toast.jsx';
import { Brand } from './Brand.jsx';
import { initials } from '../utils/format.js';
const links = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/cash-in', label: 'Cash in', icon: ArrowDownLeft },
  { to: '/cash-out', label: 'Cash out', icon: ArrowUpRight },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/settings', label: 'Settings', icon: Settings },
];
export function Layout() {
  const { user, logout } = useAuth(),
    { toggle, resolved } = useTheme(),
    pwa = usePwa(),
    online = useOnline(),
    notify = useToast(),
    location = useLocation();
  const [leaving, setLeaving] = useState(false);
  const signOut = async () => {
    setLeaving(true);
    try {
      await logout();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setLeaving(false);
    }
  };
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <NavLink to="/" className="brand-link" aria-label="Cashbook overview">
          <Brand />
        </NavLink>
        <div className="workspace-label">PERSONAL WORKSPACE</div>
        <nav aria-label="Main navigation">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              end={end}
              to={to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{label}</span>
              {to === '/' && <span className="nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon">
              <ShieldCheck size={21} />
            </span>
            <h3>Your cash. Your space.</h3>
            <p>A little clarity goes a long way.</p>
            <NavLink to="/settings">
              Make it yours <External size={14} />
            </NavLink>
          </div>
          <button className="sidebar-profile" disabled={leaving} onClick={signOut} title="Sign out">
            <span className="avatar">{initials(user.name)}</span>
            <span className="profile-copy">
              <strong>{user.name}</strong>
              <small>{leaving ? 'Signing out…' : 'Personal account'}</small>
            </span>
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="desktop-breadcrumb">
            Workspace <span>/</span>{' '}
            <strong>{links.find((l) => l.to === location.pathname)?.label || 'Overview'}</strong>
          </div>
          <div className="mobile-brand">
            <Brand small />
          </div>
          <div className="top-actions">
            <span className="private-label">
              <span className="status-dot" /> Private ledger
            </span>
            {pwa.canInstall && (
              <button className="install-top" onClick={() => pwa.install()}>
                <Download size={16} />
                <span>Install app</span>
              </button>
            )}
            <button
              className="icon-button"
              onClick={toggle}
              aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}
            >
              {resolved === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <NavLink to="/settings" className="avatar top-avatar" aria-label="Account settings">
              {initials(user.name)}
            </NavLink>
          </div>
        </header>
        {!online && (
          <div className="offline-banner" role="status">
            <WifiOff size={17} /> You’re offline. Reconnect to load or save cash entries.
          </div>
        )}
        {pwa.update && (
          <div className="update-banner">
            A new version of Cashbook is ready.
            <button onClick={pwa.applyUpdate}>Refresh app</button>
          </div>
        )}
        <main id="main" className="main-content" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>Cashbook · A clearer view of your money.</span>
          <span>
            {user.currency} · {user.timezone.replaceAll('_', ' ')}
          </span>
        </footer>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            to={to}
            end={end}
            key={to}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <Icon size={21} />
            <span>
              {label === 'Transactions' ? 'History' : label === 'Overview' ? 'Home' : label}
            </span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
