import { apiRequest } from './client';
import type { CurrentUser } from './types';

export type LoginResponse = { token: string; user: CurrentUser };
export type RegistrationInput = {
  username: string;
  email: string;
  password: string;
};
export type MessageResponse = { message: string };
export type Provider = { id: string; name: string };

// The ways to sign in that the server has turned on
export function getProviders() {
  return apiRequest<{ providers: Provider[] }>('/auth/providers');
}

export function login(loginName: string, password: string) {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { login: loginName, password },
  });
}

export function register(input: RegistrationInput) {
  return apiRequest<{ message: string; user: CurrentUser }>('/auth/register', {
    method: 'POST',
    body: input,
  });
}

export function resendVerification(email: string) {
  return apiRequest<MessageResponse>('/auth/resend-verification', {
    method: 'POST',
    body: { email },
  });
}

export function requestPasswordReset(email: string) {
  return apiRequest<MessageResponse>('/auth/forgot-password', {
    method: 'POST',
    body: { email },
  });
}

export function resetPassword(token: string, password: string) {
  return apiRequest<MessageResponse>('/auth/reset-password', {
    method: 'POST',
    body: { token, password },
  });
}
