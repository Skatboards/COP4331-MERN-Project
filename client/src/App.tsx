import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import './App.css';

type Page = 'game' | 'archive' | 'settings';

const today = new Date();
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const longDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
const archiveDates = Array.from({ length: 6 }, (_, index) => {
  const date = new Date(today);
  date.setDate(date.getDate() - index - 1);
  return {
    day: index === 0 ? 'Yesterday' : new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date),
    date: dateFormatter.format(date),
    result: ['Solved in 2:18', 'Solved in 3:04', 'Not completed', 'Solved in 1:52', 'Solved in 2:41', 'Not played'][index],
  };
});

const scores = [
  { name: 'MossyBadger', time: '00:42' },
  { name: 'pixelpete', time: '00:51' },
  { name: 'you', time: '01:08' },
];

function Header({
  username,
  menuOpen,
  onMenuToggle,
  onHelp,
  onNavigate,
  onSignOut,
}: {
  username: string;
  menuOpen: boolean;
  onMenuToggle: () => void;
  onHelp: () => void;
  onNavigate: (page: Page) => void;
  onSignOut: () => void;
}) {
  return (
    <header className="topbar">
      <button className="wordmark" onClick={() => onNavigate('game')} aria-label="Sweeple home">Sweeple<span>.</span></button>
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
              <button role="menuitem" onClick={() => onNavigate('archive')}>Archive <span>↗</span></button>
              <button role="menuitem" onClick={() => onNavigate('settings')}>Settings <span>⚙</span></button>
              <div className="menu-divider" />
              <button role="menuitem" onClick={onSignOut}>Sign out <span>⇥</span></button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function BoardPlaceholder() {
  return (
    <section className="board-card" aria-label="Today's Minesweeper board">
      <div className="board-topline">
        <div><h1>Today's board</h1></div>
        <span className="board-date">{longDateFormatter.format(today)}</span>
      </div>
      <div className="board-placeholder">
        <div className="board-grid" aria-hidden="true">
          {Array.from({ length: 81 }, (_, i) => <span className={`board-cell ${[10, 11, 20, 31, 47, 48, 57, 70].includes(i) ? 'revealed' : ''}`} key={i}>{[10, 20, 31, 47, 57].includes(i) ? <b>{i === 20 ? '2' : '1'}</b> : ''}</span>)}
        </div>
        <div className="board-note"><span className="note-icon">✳</span><strong>Game board coming soon</strong></div>
      </div>
    </section>
  );
}

function ScoreCard() {
  return (
    <section className="scores-card">
      <div className="section-heading"><h2>Daily top scores</h2><span className="trophy" aria-hidden="true">✦</span></div>
      <ol className="score-list">
        {scores.map((score, index) => <li key={score.name}><span className={`rank rank-${index + 1}`}>{String(index + 1).padStart(2, '0')}</span><span className="score-name">{score.name}</span><time>{score.time}</time></li>)}
      </ol>
    </section>
  );
}

function ArchivePage({ onBack }: { onBack: () => void }) {
  return (
    <main className="subpage">
      <button className="back-link" onClick={onBack}>← Back to today's board</button>
      <div className="page-heading"><div><span className="eyebrow">PAST PUZZLES</span><h1>Board archive</h1><p>Revisit the daily challenges and see how you did.</p></div><span className="archive-count">6 DAYS</span></div>
      <div className="archive-grid">
        {archiveDates.map((item, index) => <article className="archive-card" key={item.date} aria-label={`${item.day}, ${item.date}: ${item.result}`}>
          <div className="archive-card-top"><span className="calendar-icon">▦</span><span className="archive-arrow">↗</span></div>
          <span className="archive-day">{item.day}</span><strong>{item.date}</strong><span className={`archive-result ${item.result === 'Not completed' ? 'result-muted' : ''}`}>{item.result}</span>
          <div className="mini-board" aria-hidden="true">{Array.from({ length: 25 }, (_, cell) => <i className={cell % (index + 3) === 0 ? 'mini-open' : ''} key={cell} />)}</div>
        </article>)}
      </div>
    </main>
  );
}

function SettingsPage({ onBack }: { onBack: () => void }) {
  const [sound, setSound] = useState(true);
  const [contrast, setContrast] = useState(false);
  return (
    <main className="subpage settings-page">
      <button className="back-link" onClick={onBack}>← Back to today's board</button>
      <div className="page-heading"><div><h1>Settings</h1></div></div>
      <section className="settings-card">
        <div className="settings-row"><div><strong>Sound effects</strong><p>Play a sound when you reveal a tile.</p></div><button className={`toggle ${sound ? 'on' : ''}`} role="switch" aria-checked={sound} onClick={() => setSound(!sound)}><span /></button></div>
        <div className="settings-row"><div><strong>High contrast</strong><p>Increase contrast on board tiles and text.</p></div><button className={`toggle ${contrast ? 'on' : ''}`} role="switch" aria-checked={contrast} onClick={() => setContrast(!contrast)}><span /></button></div>
      </section>
    </main>
  );
}

function Overlay({ title, children, onClose, className = '' }: { title: string; children: ReactNode; onClose: () => void; className?: string }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);
  return <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className={`dialog ${className}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button className="dialog-close" onClick={onClose} aria-label="Close">×</button><span className="eyebrow">SWEEPLE</span><h2 id="dialog-title">{title}</h2>{children}</section></div>;
}

function App() {
  const [page, setPage] = useState<Page>('game');
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [username, setUsername] = useState('Username');

  function navigate(nextPage: Page) { setPage(nextPage); setMenuOpen(false); }
  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setUsername(String(formData.get('username') || 'Player'));
    setSignInOpen(false);
  }

  return (
    <div className="app-shell">
      <Header username={username} menuOpen={menuOpen} onMenuToggle={() => setMenuOpen(!menuOpen)} onHelp={() => { setMenuOpen(false); setHelpOpen(true); }} onNavigate={navigate} onSignOut={() => { setMenuOpen(false); setSignInOpen(true); }} />
      {page === 'game' ? <main className="home-content"><BoardPlaceholder /><ScoreCard /></main> : page === 'archive' ? <ArchivePage onBack={() => navigate('game')} /> : <SettingsPage onBack={() => navigate('game')} />}
      {helpOpen && <Overlay title="How to play" onClose={() => setHelpOpen(false)} className="help-dialog"><p className="dialog-intro">Clear the board without finding a mine. Use the numbers to figure out what's hiding nearby.</p><div className="howto-list"><div><span>01</span><p><strong>Reveal a tile</strong>Each number tells you how many mines touch that tile.</p></div><div><span>02</span><p><strong>Mark the mines</strong>Flag the tiles you think are hiding a mine.</p></div><div><span>03</span><p><strong>Clear the board</strong>Finish the daily puzzle in as few clicks as you can.</p></div></div><button className="primary-button full-button" onClick={() => setHelpOpen(false)}>Got it</button></Overlay>}
      {signInOpen && <Overlay title="Welcome back" onClose={() => setSignInOpen(false)} className="sign-in-dialog"><p className="dialog-intro">Sign in to keep your Sweeple streak going.</p><form className="sign-in-form" onSubmit={signIn}><label>Email or username<input name="username" required autoComplete="username" placeholder="Your username" /></label><label>Password<input name="password" required type="password" autoComplete="current-password" placeholder="Your password" /></label><button className="primary-button full-button" type="submit">Sign in</button></form><p className="demo-note">Preview mode: any username and password will continue.</p></Overlay>}
    </div>
  );
}

export default App;
