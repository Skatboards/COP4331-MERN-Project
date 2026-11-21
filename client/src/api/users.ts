import { apiRequest } from './client';
import type { ArchiveStats, Attempt, CurrentUser, MyBoardAttempt, Player } from './types';

export function getCurrentUser(token: string) {
  return apiRequest<{ user: CurrentUser }>('/users/me', { token });
}

// from and to are YYYY-MM-DD board dates (inclusive); both optional
export function getMyAttempts(token: string, options: { limit?: number; from?: string; to?: string } = {}) {
  const query = new URLSearchParams({ limit: String(options.limit ?? 100) });
  if (options.from) query.set('from', options.from);
  if (options.to) query.set('to', options.to);
  return apiRequest<{ attempts: Attempt[]; stats: ArchiveStats }>(`/users/me/attempts?${query}`, { token });
}

// The signed-in player's game on one board, or null if they haven't played it
export function getMyAttempt(token: string, seed: string) {
  return apiRequest<{ attempt: MyBoardAttempt | null }>(`/users/me/attempts/${encodeURIComponent(seed)}`, { token });
}

export type LeaderboardSort = 'boardsCompleted' | 'efficiency' | 'totalClicks';

export function getLeaderboard(sort: LeaderboardSort = 'boardsCompleted', limit = 10) {
  const query = new URLSearchParams({ sort, limit: String(limit) });
  return apiRequest<{ sort: string; users: Player[] }>(`/users/leaderboard?${query}`);
}

export function searchUsers(query: string, limit = 20) {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return apiRequest<{ users: Player[] }>(`/users/search?${params}`);
}
