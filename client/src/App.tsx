import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import SiteHeader from './components/SiteHeader';
import RequireRole from './components/RequireRole';
import { useAuth } from './auth/useAuth';
import { hasRole } from './auth/roles';
import { SignInPromptContext, type SignInReason } from './auth/signInPrompt';
import './App.css';

const HomePage = lazy(() => import('./pages/HomePage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const ArchivePage = lazy(() => import('./pages/ArchivePage'));
const ArchiveBoardPage = lazy(() => import('./pages/ArchiveBoardPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const PasswordResetPage = lazy(() => import('./pages/PasswordResetPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const HelpDialog = lazy(() => import('./components/HelpDialog'));
const SignInDialog = lazy(() => import('./components/SignInDialog'));
const DevComponentsPage = import.meta.env.DEV
  ? lazy(() => import('./pages/dev/DevComponentsPage'))
  : null;
const DevColorsPage = import.meta.env.DEV
  ? lazy(() => import('./pages/dev/DevColorsPage'))
  : null;

const OAUTH_ERRORS: Record<string, string> = {
  cancelled: 'Sign-in was cancelled.',
  state: 'That sign-in link expired. Try again.',
  provider: 'Could not reach the sign-in provider. Try again.',
  email: 'That account has no verified email address, so it cannot be used to sign in.',
  failed: 'Sign-in failed. Try again.',
};

function hasAuthNotice(searchParams: URLSearchParams) {
  const verified = searchParams.get('verified');
  const reset = searchParams.get('passwordReset');
  return verified === '1' || verified === '0' || reset === '1' || searchParams.has('oauthError');
}

function getAuthNotice(searchParams: URLSearchParams) {
  const verified = searchParams.get('verified');
  const reset = searchParams.get('passwordReset');
  const oauthError = searchParams.get('oauthError');
  if (reset === '1') return 'Your password has been reset. Sign in with your new password.';
  if (oauthError !== null) return OAUTH_ERRORS[oauthError] ?? 'Sign-in failed. Try again.';
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
  const [signInReason, setSignInReason] = useState<SignInReason | undefined>();
  // What to do once the player signs in from the prompt (e.g. open Share)
  const afterSignIn = useRef<(() => void) | null>(null);
  const signedInFromPrompt = useRef(false);
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

  const openSignIn = useCallback((reason?: SignInReason, then?: () => void) => {
    setMenuOpen(false);
    setSignInReason(reason);
    afterSignIn.current = then ?? null;
    signedInFromPrompt.current = false;
    setSignInOpen(true);
  }, []);

  // Run the follow-up once the signed-in user has arrived
  useEffect(() => {
    if (!user || !afterSignIn.current) return;
    const then = afterSignIn.current;
    afterSignIn.current = null;
    then();
  }, [user]);

  const loginFromPrompt = useCallback(async (loginName: string, password: string) => {
    await login(loginName, password);
    signedInFromPrompt.current = true;
  }, [login]);

  function accountAction() {
    setMenuOpen(false);
    if (user) {
      logout();
      setSignInOpen(false);
      navigate('/', { replace: true });
    } else {
      openSignIn();
    }
  }

  function closeSignIn() {
    setSignInOpen(false);
    // Closed without signing in: drop the follow-up
    if (!signedInFromPrompt.current) afterSignIn.current = null;
    const cleanParams = new URLSearchParams(searchParams);
    cleanParams.delete('verified');
    cleanParams.delete('passwordReset');
    cleanParams.delete('oauthError');
    setSearchParams(cleanParams, { replace: true });
  }

  return (
    <SignInPromptContext.Provider value={openSignIn}>
    <div className="app-shell" data-theme={theme} data-high-contrast={highContrast}>
      <SiteHeader
        username={user?.username ?? 'Sign in'}
        isAuthenticated={Boolean(user)}
        showAdmin={hasRole(user, 'admin')}
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
          <Route path="/" element={<LandingPage onSignIn={openSignIn} isAuthenticated={Boolean(user)} />} />
          <Route path="/play" element={<HomePage />} />
          <Route path="/archive" element={<ArchivePage onSignIn={openSignIn} />} />
          <Route path="/archive/:seed" element={<ArchiveBoardPage />} />
          <Route path="/settings" element={<SettingsPage onSignIn={() => openSignIn()} highContrast={highContrast} onHighContrastChange={setHighContrast} />} />
          <Route path="/reset-password" element={<PasswordResetPage />} />
          <Route path="/admin" element={<RequireRole min="admin"><AdminPage /></RequireRole>} />
          {import.meta.env.DEV && DevComponentsPage && DevColorsPage && (
            <>
              <Route path="/dev/components" element={<DevComponentsPage />} />
              <Route path="/dev/colors" element={<DevColorsPage />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <Suspense fallback={null}>
        {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
        {signInOpen && (
          <SignInDialog
            onClose={closeSignIn}
            onLogin={loginFromPrompt}
            onRegister={register}
            onResendVerification={resendVerification}
            onRequestPasswordReset={requestPasswordReset}
            verificationNotice={verificationNotice}
            reason={signInReason}
          />
        )}
      </Suspense>
    </div>
    </SignInPromptContext.Provider>
  );
}
