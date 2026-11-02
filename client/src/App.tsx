import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ArchivePage from './pages/ArchivePage';
import HomePage from './pages/HomePage';
import SettingsPage from './pages/SettingsPage';
import HelpDialog from './components/HelpDialog';
import SignInDialog from './components/SignInDialog';
import SiteHeader from './components/SiteHeader';
import './App.css';

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [username, setUsername] = useState('Username');

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setUsername(String(formData.get('username') || 'Player'));
    setSignInOpen(false);
  }

  return (
    <div className="app-shell">
      <SiteHeader
        username={username}
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen((open) => !open)}
        onHelp={() => { setMenuOpen(false); setHelpOpen(true); }}
        onMenuClose={() => setMenuOpen(false)}
        onSignOut={() => { setMenuOpen(false); setSignInOpen(true); }}
      />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/archive" element={<ArchivePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
      {signInOpen && <SignInDialog onClose={() => setSignInOpen(false)} onSignIn={signIn} />}
    </div>
  );
}
