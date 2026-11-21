import { apiRequest } from './client';
import type { Attempt, Board, BoardAttempt, FinishedGame, PlayedGame } from './types';
import type { GameState } from '../game/state';

export function getBoards(limit = 10) {
  return apiRequest<{ boards: Board[] }>(`/boards?limit=${limit}`);
}

// Boards nobody has finished yet come back with zeroed stats
export function getBoard(seed: string) {
  return apiRequest<{ board: Board }>(`/boards/${encodeURIComponent(seed)}`);
}

// 'result': won first, then fewest clicks, then fastest.
// 'efficiency': won first, then efficiency, then clicks.
export function getBoardAttempts(seed: string, limit = 10, sort: 'result' | 'efficiency' = 'result') {
  const query = new URLSearchParams({ limit: String(limit), sort });
  return apiRequest<{ seed: string; attempts: BoardAttempt[] }>(
    `/boards/${encodeURIComponent(seed)}/attempts?${query}`,
  );
}

export function submitAttempt(token: string, seed: string, result: FinishedGame) {
  return apiRequest<{ attempt: Attempt; board: Board }>(
    `/boards/${encodeURIComponent(seed)}/attempts`,
    { method: 'POST', body: result, token },
  );
}

export function getGameProgress(token: string, seed: string) {
  return apiRequest<{ game: GameState | null; played: PlayedGame | null }>(
    `/boards/${encodeURIComponent(seed)}/progress`, { token },
  );
}

export function saveGameProgress(token: string, seed: string, game: GameState, completionPercentage: number) {
  return apiRequest<{ saved: boolean }>(
    `/boards/${encodeURIComponent(seed)}/progress`, { method: 'POST', body: { game, completionPercentage }, token },
  );
}
