import { createContext } from 'react';
import type { RegistrationInput } from '../api/auth';
import type { CurrentUser } from '../api/types';

export type AuthContextValue = {
  token: string | null;
  user: CurrentUser | null;
  loading: boolean;
  sessionError: string;
  login: (loginName: string, password: string) => Promise<void>;
  register: (input: RegistrationInput) => Promise<string>;
  resendVerification: (email: string) => Promise<string>;
  requestPasswordReset: (email: string) => Promise<string>;
  resetPassword: (token: string, password: string) => Promise<string>;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
