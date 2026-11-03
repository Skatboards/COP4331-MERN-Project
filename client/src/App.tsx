import { lazy, Suspense, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import SiteHeader from './components/SiteHeader';
import './App.css';

const HomePage = lazy(() => import('./pages/HomePage'));
const ArchivePage = lazy(() => import('./pages/ArchivePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const HelpDialog = lazy(() => import('./components/HelpDialog'));
const SignInDialog = lazy(() => import('./components/SignInDialog'));

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return localStorage.getItem('sweeple-theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [username, setUsername] = useState('Username');

  useEffect(() => {
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      theme === 'dark' ? '#171a14' : '#f7f7f4',
    );
    try {
      localStorage.setItem('sweeple-theme', theme);
    } catch {
      // The theme still works for this session when storage is unavailable.
    }
  }, [theme]);

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setUsername(String(formData.get('username') || 'Player'));
    setSignInOpen(false);
  }

  return (
    <div className="app-shell" data-theme={theme}>
      <SiteHeader
        username={username}
        theme={theme}
        onThemeToggle={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen((open) => !open)}
        onHelp={() => { setMenuOpen(false); setHelpOpen(true); }}
        onMenuClose={() => setMenuOpen(false)}
        onSignOut={() => { setMenuOpen(false); setSignInOpen(true); }}
      />
      <Suspense fallback={<main className="home-content" aria-busy="true" />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/archive" element={<ArchivePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Suspense fallback={null}>
        {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
        {signInOpen && <SignInDialog onClose={() => setSignInOpen(false)} onSignIn={signIn} />}
      </Suspense>
    </div>
  );
}
