import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError } from '../api/client';
import * as authApi from '../api/auth';
import { getCurrentUser } from '../api/users';
import type { CurrentUser } from '../api/types';
import { AuthContext } from './AuthContext';

const TOKEN_KEY = 'sweeple-token';
const USER_KEY = 'sweeple-user';

// After GitHub or Google, the server sends the browser to /#token=...
// Read once when the app loads, and removed from the address bar.
function takeTokenFromUrl(): string | null {
  const match = window.location.hash.match(/^#token=([^&]+)$/);
  if (!match) return null;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return decodeURIComponent(match[1]);
}

const tokenFromUrl = takeTokenFromUrl();

function readToken(): string | null {
  if (tokenFromUrl) return tokenFromUrl;

  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function readUser(): CurrentUser | null {
  // A new sign-in replaces whoever was saved; the token effect loads the user
  if (tokenFromUrl) return null;
  try {
    if (!localStorage.getItem(TOKEN_KEY)) return null;
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) as CurrentUser : null;
  } catch {
    return null;
  }
}

function saveSession(token: string, user: CurrentUser) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Keep the session in memory when browser storage is unavailable.
  }
}

function clearStoredSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // The in-memory session is still cleared.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(readToken);
  const [user, setUser] = useState<CurrentUser | null>(readUser);
  const [loading, setLoading] = useState(() => Boolean(readToken()));
  const [sessionError, setSessionError] = useState('');

  useEffect(() => {
    if (!token) return;

    let active = true;
    getCurrentUser(token)
      .then(({ user: currentUser }) => {
        if (!active) return;
        setUser(currentUser);
        setSessionError('');
        saveSession(token, currentUser);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
          clearStoredSession();
          setToken(null);
          setUser(null);
        } else {
          setSessionError(error instanceof Error ? error.message : 'Could not restore your session.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [token]);

  async function login(loginName: string, password: string) {
    const result = await authApi.login(loginName, password);
    saveSession(result.token, result.user);
    setToken(result.token);
    setUser(result.user);
    setLoading(false);
    setSessionError('');
  }

  async function register(input: authApi.RegistrationInput) {
    const result = await authApi.register(input);
    return result.message;
  }

  async function resendVerification(email: string) {
    const result = await authApi.resendVerification(email);
    return result.message;
  }

  async function requestPasswordReset(email: string) {
    const result = await authApi.requestPasswordReset(email);
    return result.message;
  }

  async function resetPassword(resetToken: string, password: string) {
    const result = await authApi.resetPassword(resetToken, password);
    return result.message;
  }

  const logout = useCallback(() => {
    clearStoredSession();
    setToken(null);
    setUser(null);
    setLoading(false);
    setSessionError('');
  }, []);

  return (
    <AuthContext.Provider value={{
      token, user, loading, sessionError, login, register,
      resendVerification, requestPasswordReset, resetPassword, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
