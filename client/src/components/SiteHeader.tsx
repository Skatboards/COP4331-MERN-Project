import { Link } from 'react-router-dom';

type SiteHeaderProps = {
  username: string;
  isAuthenticated: boolean;
  // Admins and site admins get a link to the dashboard
  showAdmin?: boolean;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onHelp: () => void;
  onMenuClose: () => void;
  onAccountAction: () => void;
};

export default function SiteHeader({ username, isAuthenticated, showAdmin = false, theme, onThemeToggle, menuOpen, onMenuToggle, onHelp, onMenuClose, onAccountAction }: SiteHeaderProps) {
  return (
    <header className="topbar">
      <Link className="wordmark" to="/" aria-label="Sweeple home" onClick={onMenuClose}>Sweeple<span>.</span></Link>
      <div className="header-actions">
        <button
          className="theme-toggle"
          type="button"
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          aria-pressed={theme === 'dark'}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          onClick={onThemeToggle}
        >
          <span aria-hidden="true">{theme === 'light' ? '☾' : '☀'}</span>
        </button>
        <button className="help-button" onClick={onHelp} aria-label="How to play" title="How to play">?</button>
        <div className="account-wrap">
          <button className="account-button" aria-expanded={isAuthenticated ? menuOpen : undefined} onClick={isAuthenticated ? onMenuToggle : onAccountAction}>
            <span className="avatar" aria-hidden="true">{username.charAt(0).toUpperCase()}</span>
            <span className="account-name">{username}</span>
            <span className="chevron" aria-hidden="true">⌄</span>
          </button>
          {menuOpen && (
            <div className="account-menu" role="menu">
              <Link role="menuitem" to="/archive" onClick={onMenuClose}>Archive <span>↗</span></Link>
              <Link role="menuitem" to="/settings" onClick={onMenuClose}>Settings <span>⚙</span></Link>
              {showAdmin && <Link role="menuitem" to="/admin" onClick={onMenuClose}>Admin <span>⛭</span></Link>}
              <div className="menu-divider" />
              <button role="menuitem" onClick={onAccountAction}>{isAuthenticated ? 'Sign out' : 'Sign in'} <span>{isAuthenticated ? '⇥' : '↗'}</span></button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
