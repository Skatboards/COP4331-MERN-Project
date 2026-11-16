import { apiRequest } from './client';
import type { AdminUser, AdminUserInput, Role } from './types';

export type AdminUserList = {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
};

export function listUsers(token: string, options: { q?: string; roles?: Role[]; page?: number; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (options.q) params.set('q', options.q);
  if (options.roles?.length) params.set('role', options.roles.join(','));
  if (options.page) params.set('page', String(options.page));
  if (options.limit) params.set('limit', String(options.limit));
  const query = params.toString();
  return apiRequest<AdminUserList>(`/admin/users${query ? `?${query}` : ''}`, { token });
}

export function getUser(token: string, id: string) {
  return apiRequest<{ user: AdminUser }>(`/admin/users/${encodeURIComponent(id)}`, { token });
}

// Without a password, the new user is emailed a link to set one
export function createUser(token: string, input: AdminUserInput) {
  return apiRequest<{ user: AdminUser }>('/admin/users', { method: 'POST', body: input, token });
}

export function updateUser(token: string, id: string, changes: Partial<Omit<AdminUserInput, 'password'>>) {
  return apiRequest<{ user: AdminUser }>(`/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: changes,
    token,
  });
}

export function deleteUser(token: string, id: string) {
  return apiRequest<{ message: string }>(`/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE', token });
}

export function sendPasswordReset(token: string, id: string) {
  return apiRequest<{ message: string }>(`/admin/users/${encodeURIComponent(id)}/password-reset`, {
    method: 'POST',
    token,
  });
}
