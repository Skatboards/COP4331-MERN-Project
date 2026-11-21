import { apiRequest } from './client';
import type { ArchiveStats, Attempt, CurrentUser, Player } from './types';

export function getCurrentUser(token: string) {
  return apiRequest<{ user: CurrentUser }>('/users/me', { token });
}

export function getMyAttempts(token: string, limit = 100) {
  return apiRequest<{ attempts: Attempt[]; stats: ArchiveStats }>(`/users/me/attempts?limit=${limit}`, { token });
}

export function getLeaderboard(sort: 'boardsCompleted' | 'efficiency' | 'totalClicks' = 'boardsCompleted', limit = 10) {
  const query = new URLSearchParams({ sort, limit: String(limit) });
  return apiRequest<{ sort: string; users: Player[] }>(`/users/leaderboard?${query}`);
}

export function searchUsers(query: string, limit = 20) {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return apiRequest<{ users: Player[] }>(`/users/search?${params}`);
}
