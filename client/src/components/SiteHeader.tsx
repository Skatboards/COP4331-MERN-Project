import { Link } from 'react-router-dom';

type SiteHeaderProps = {
  username: string;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onHelp: () => void;
  onMenuClose: () => void;
  onSignOut: () => void;
};

export default function SiteHeader({ username, menuOpen, onMenuToggle, onHelp, onMenuClose, onSignOut }: SiteHeaderProps) {
  return (
    <header className="topbar">
      <Link className="wordmark" to="/" aria-label="Sweeple home" onClick={onMenuClose}>Sweeple<span>.</span></Link>
      <div className="header-actions">
        <button className="help-button" onClick={onHelp} aria-label="How to play" title="How to play">?</button>
        <div className="account-wrap">
          <button className="account-button" aria-expanded={menuOpen} onClick={onMenuToggle}>
            <span className="avatar" aria-hidden="true">{username.charAt(0).toUpperCase()}</span>
            <span className="account-name">{username}</span>
            <span className="chevron" aria-hidden="true">⌄</span>
          </button>
          {menuOpen && (
            <div className="account-menu" role="menu">
              <Link role="menuitem" to="/archive" onClick={onMenuClose}>Archive <span>↗</span></Link>
              <Link role="menuitem" to="/settings" onClick={onMenuClose}>Settings <span>⚙</span></Link>
              <div className="menu-divider" />
              <button role="menuitem" onClick={onSignOut}>Sign out <span>⇥</span></button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
