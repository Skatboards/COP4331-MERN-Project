import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError } from '../api/client';
import * as authApi from '../api/auth';
import { getCurrentUser } from '../api/users';
import type { CurrentUser } from '../api/types';

const TOKEN_KEY = 'sweeple-token';
const USER_KEY = 'sweeple-user';

function readToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function readUser(): CurrentUser | null {
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

type AuthContextValue = {
  token: string | null;
  user: CurrentUser | null;
  loading: boolean;
  sessionError: string;
  login: (loginName: string, password: string) => Promise<void>;
  register: (input: authApi.RegistrationInput) => Promise<string>;
  resendVerification: (email: string) => Promise<string>;
  requestPasswordReset: (email: string) => Promise<string>;
  resetPassword: (token: string, password: string) => Promise<string>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(readToken);
  const [user, setUser] = useState<CurrentUser | null>(readUser);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');

  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
