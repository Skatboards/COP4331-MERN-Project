import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '../api/client';
import { getProviders } from '../api/auth';
import type { Provider, RegistrationInput } from '../api/auth';
import Modal from './Modal';

type DialogMode = 'login' | 'register' | 'forgot-password' | 'check-email';

type SignInDialogProps = {
  onClose: () => void;
  onLogin: (loginName: string, password: string) => Promise<void>;
  onRegister: (input: RegistrationInput) => Promise<string>;
  onResendVerification: (email: string) => Promise<string>;
  onRequestPasswordReset: (email: string) => Promise<string>;
  verificationNotice?: string;
};

export default function SignInDialog({
  onClose,
  onLogin,
  onRegister,
  onResendVerification,
  onRequestPasswordReset,
  verificationNotice = '',
}: SignInDialogProps) {
  const [mode, setMode] = useState<DialogMode>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(verificationNotice);
  const [loginName, setLoginName] = useState('');
  const [unverifiedLogin, setUnverifiedLogin] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [providers, setProviders] = useState<Provider[]>([]);

  useEffect(() => {
    let active = true;
    getProviders()
      .then(({ providers: list }) => { if (active) setProviders(list.filter((p) => p.id !== 'password')); })
      .catch(() => { /* Email and password still work */ });
    return () => { active = false; };
  }, []);

  // Plain links: the server redirects to GitHub or Google and back
  const providerButtons = providers.length > 0 && (
    <>
      <div className="provider-buttons">
        {providers.map((p) => (
          <a key={p.id} className="provider-button full-button" href={`/api/auth/${p.id}`}>Continue with {p.name}</a>
        ))}
      </div>
      <p className="auth-divider">or with email</p>
    </>
  );

  function switchMode(nextMode: DialogMode) {
    setMode(nextMode);
    setBusy(false);
    setError('');
    setNotice('');
    setUnverifiedLogin('');
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const login = String(data.get('login') ?? '').trim();
    const password = String(data.get('password') ?? '');
    setLoginName(login);
    setBusy(true);
    setError('');
    setNotice('');
    setUnverifiedLogin('');
    setResendEmail('');
    try {
      await onLogin(login, password);
      onClose();
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedLogin(login);
        setResendEmail(login.includes('@') ? login : '');
      }
      setError(requestError instanceof Error ? requestError.message : 'Login failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password') ?? '');
    if (password !== String(data.get('confirmPassword') ?? '')) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const message = await onRegister({
        username: String(data.get('username') ?? '').trim(),
        email: String(data.get('email') ?? '').trim(),
        password,
      });
      setNotice(message);
      setMode('check-email');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not create your account. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    if (!resendEmail.trim()) {
      setError('Enter the email address for your account.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      setNotice(await onResendVerification(resendEmail.trim()));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not send the email. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function submitPasswordResetRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      setNotice(await onRequestPasswordReset(String(data.get('email') ?? '').trim()));
      setMode('check-email');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not send the email. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const title = mode === 'register' ? 'Create your account'
    : mode === 'forgot-password' ? 'Reset your password'
      : mode === 'check-email' ? 'Check your email' : 'Welcome back';

  return (
    <Modal title={title} onClose={onClose} className="sign-in-dialog">
      {mode === 'login' && (
        <>
          {verificationNotice && <p className="auth-notice" role="status">{verificationNotice}</p>}
          {providerButtons}
          <form className="sign-in-form" onSubmit={submitLogin}>
            <label>Email or username<input name="login" required autoComplete="username" placeholder="Your email or username" value={loginName} onChange={(event) => setLoginName(event.target.value)} /></label>
            <label>Password<input name="password" required type="password" autoComplete="current-password" /></label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            {unverifiedLogin && (
              <div className="verification-resend">
                {!unverifiedLogin.includes('@') && <label>Account email<input type="email" value={resendEmail} onChange={(event) => setResendEmail(event.target.value)} placeholder="you@example.com" /></label>}
                {notice && <p className="auth-notice" role="status">{notice}</p>}
                <button className="text-button" type="button" disabled={busy} onClick={resendVerification}>Resend verification email</button>
              </div>
            )}
            <button className="primary-button full-button" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
          <div className="auth-options"><button className="text-button" type="button" onClick={() => switchMode('forgot-password')}>Forgot password?</button><span>New to Sweeple? <button className="text-button" type="button" onClick={() => switchMode('register')}>Create account</button></span></div>
        </>
      )}

      {mode === 'register' && (
        <>
          <p className="dialog-intro">Create an account to save your results.</p>
          {providerButtons}
          <form className="sign-in-form" onSubmit={submitRegistration}>
            <label>Username<input name="username" required minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" autoComplete="username" /></label>
            <label>Email<input name="email" required type="email" autoComplete="email" /></label>
            <label>Password<input name="password" required type="password" minLength={8} autoComplete="new-password" /></label>
            <label>Confirm password<input name="confirmPassword" required type="password" minLength={8} autoComplete="new-password" /></label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="primary-button full-button" type="submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
          </form>
          <p className="auth-options">Already registered? <button className="text-button" type="button" onClick={() => switchMode('login')}>Sign in</button></p>
        </>
      )}

      {mode === 'forgot-password' && (
        <>
          <p className="dialog-intro">Enter your account email and we’ll send a password reset link if it matches an account.</p>
          <form className="sign-in-form" onSubmit={submitPasswordResetRequest}>
            <label>Email<input name="email" required type="email" autoComplete="email" /></label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="primary-button full-button" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
          </form>
          <p className="auth-options"><button className="text-button" type="button" onClick={() => switchMode('login')}>Back to sign in</button></p>
        </>
      )}

      {mode === 'check-email' && (
        <>
          <p className="dialog-intro auth-notice" role="status">{notice}</p>
          <button className="primary-button full-button" type="button" onClick={() => switchMode('login')}>Back to sign in</button>
        </>
      )}
    </Modal>
  );
}
