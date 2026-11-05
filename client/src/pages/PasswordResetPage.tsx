import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

export default function PasswordResetPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const token = searchParams.get('token') ?? '';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get('password') ?? '');
    if (password !== String(formData.get('confirmPassword') ?? '')) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await resetPassword(token, password);
      navigate('/?passwordReset=1', { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not reset your password. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="subpage reset-page">
      <section className="settings-card reset-card">
        <h1>Choose a new password</h1>
        {!token ? <p className="auth-error" role="alert">This password reset link is missing its token or is invalid.</p> : (
          <form className="sign-in-form" onSubmit={submit}>
            <label>New password<input name="password" required type="password" minLength={8} autoComplete="new-password" /></label>
            <label>Confirm new password<input name="confirmPassword" required type="password" minLength={8} autoComplete="new-password" /></label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="primary-button full-button" type="submit" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
          </form>
        )}
        <Link className="back-link reset-back-link" to="/">Back to Sweeple</Link>
      </section>
    </main>
  );
}
