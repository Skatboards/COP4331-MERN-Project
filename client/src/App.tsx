import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import SiteHeader from './components/SiteHeader';
import { useAuth } from './auth/useAuth';
import './App.css';

const HomePage = lazy(() => import('./pages/HomePage'));
const ArchivePage = lazy(() => import('./pages/ArchivePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const PasswordResetPage = lazy(() => import('./pages/PasswordResetPage'));
const PlayPage = lazy(() => import('./pages/PlayPage'));
const HelpDialog = lazy(() => import('./components/HelpDialog'));
const SignInDialog = lazy(() => import('./components/SignInDialog'));

function hasAuthNotice(searchParams: URLSearchParams) {
  const verified = searchParams.get('verified');
  const reset = searchParams.get('passwordReset');
  return verified === '1' || verified === '0' || reset === '1';
}

function getAuthNotice(searchParams: URLSearchParams) {
  const verified = searchParams.get('verified');
  const reset = searchParams.get('passwordReset');
  if (reset === '1') return 'Your password has been reset. Sign in with your new password.';
  return verified === '1'
    ? 'Email verified. You can now sign in.'
    : 'That verification link is invalid or has expired.';
}

export default function App() {
  const { user, login, register, resendVerification, requestPasswordReset, logout, sessionError } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlAuthNotice = hasAuthNotice(searchParams);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return localStorage.getItem('sweeple-theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const [highContrast, setHighContrast] = useState(() => {
    try { return localStorage.getItem('sweeple-high-contrast') === 'true'; } catch { return false; }
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(urlAuthNotice);
  const verificationNotice = urlAuthNotice ? getAuthNotice(searchParams) : '';

  useEffect(() => {
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content', theme === 'dark' ? '#171a14' : '#f7f7f4',
    );
    try {
      localStorage.setItem('sweeple-theme', theme);
    } catch {
      // The theme still works for this session when storage is unavailable.
    }
  }, [theme]);

  const openSignIn = useCallback(() => {
    setMenuOpen(false);
    setSignInOpen(true);
  }, []);

  function accountAction() {
    setMenuOpen(false);
    if (user) {
      logout();
      setSignInOpen(false);
      navigate('/', { replace: true });
    } else {
      setSignInOpen(true);
    }
  }

  function closeSignIn() {
    setSignInOpen(false);
    const cleanParams = new URLSearchParams(searchParams);
    cleanParams.delete('verified');
    cleanParams.delete('passwordReset');
    setSearchParams(cleanParams, { replace: true });
  }

  return (
    <div className="app-shell" data-theme={theme} data-high-contrast={highContrast}>
      <SiteHeader
        username={user?.username ?? 'Sign in'}
        isAuthenticated={Boolean(user)}
        theme={theme}
        onThemeToggle={() => setTheme((current) => current === 'light' ? 'dark' : 'light')}
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen((open) => !open)}
        onHelp={() => { setMenuOpen(false); setHelpOpen(true); }}
        onMenuClose={() => setMenuOpen(false)}
        onAccountAction={accountAction}
      />
      {sessionError && <p className="session-banner" role="status">{sessionError}</p>}
      <Suspense fallback={<main className="home-content" aria-busy="true" />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/play" element={<PlayPage />} />
          <Route path="/archive" element={<ArchivePage onSignIn={openSignIn} />} />
          <Route path="/settings" element={<SettingsPage onSignIn={openSignIn} highContrast={highContrast} onHighContrastChange={setHighContrast} />} />
          <Route path="/reset-password" element={<PasswordResetPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Suspense fallback={null}>
        {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
        {signInOpen && (
          <SignInDialog
            onClose={closeSignIn}
            onLogin={login}
            onRegister={register}
            onResendVerification={resendVerification}
            onRequestPasswordReset={requestPasswordReset}
            verificationNotice={verificationNotice}
          />
        )}
      </Suspense>
    </div>
  );
}
