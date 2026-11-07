import { apiRequest } from './client';
import type { Attempt, Board, BoardAttempt } from './types';
import type { GameState } from '../game/state';

export function getBoards(limit = 10) {
  return apiRequest<{ boards: Board[] }>(`/boards?limit=${limit}`);
}

export function getBoard(seed: string) {
  return apiRequest<{ board: Board }>(`/boards/${encodeURIComponent(seed)}`);
}

export function getBoardAttempts(seed: string, limit = 10) {
  return apiRequest<{ seed: string; attempts: BoardAttempt[] }>(
    `/boards/${encodeURIComponent(seed)}/attempts?limit=${limit}`,
  );
}

export function submitAttempt(
  token: string,
  seed: string,
  result: { clicks: number; status: 'won' | 'lost'; efficiency?: number },
) {
  return apiRequest<{ attempt: Attempt; board: Board }>(
    `/boards/${encodeURIComponent(seed)}/attempts`,
    { method: 'POST', body: result, token },
  );
}

export function getGameProgress(token: string, seed: string) {
  return apiRequest<{ game: GameState | null }>(
    `/boards/${encodeURIComponent(seed)}/progress`, { token },
  );
}

export function saveGameProgress(token: string, seed: string, game: GameState) {
  return apiRequest<{ saved: boolean }>(
    `/boards/${encodeURIComponent(seed)}/progress`, { method: 'POST', body: { game }, token },
  );
}
