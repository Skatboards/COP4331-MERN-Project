import { apiRequest } from './client';
import type { Attempt, Board, BoardAttempt } from './types';
import type { Board as GameBoard } from '../game/minesweeper';
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
  result: { clicks: number; status: 'won' | 'lost'; efficiency?: number; completionPercentage: number },
) {
  return apiRequest<{ attempt: Attempt; board: Board }>(
    `/boards/${encodeURIComponent(seed)}/attempts`,
    { method: 'POST', body: result, token },
  );
}

export function getGameProgress(token: string, seed: string) {
  return apiRequest<{ game: GameState | null; played: { status: 'won' | 'lost'; clicks: number } | null }>(
    `/boards/${encodeURIComponent(seed)}/progress`, { token },
  );
}

export function saveGameProgress(token: string, seed: string, game: GameState, completionPercentage: number) {
  return apiRequest<{ saved: boolean }>(
    `/boards/${encodeURIComponent(seed)}/progress`, { method: 'POST', body: { game, completionPercentage }, token },
  );
}

type BoardLayout = {
  seed: string;
  date: string;
  rows: number;
  cols: number;
  mineCount: number;
  mines: number[];
  adjacent: number[];
  start: number;
};

export type LoadedBoard = { seed: string; date: string; board: GameBoard };

function toLoadedBoard(layout: BoardLayout): LoadedBoard {
  const isMine = new Array<boolean>(layout.rows * layout.cols).fill(false);
  for (const cell of layout.mines) isMine[cell] = true;
  return {
    seed: layout.seed,
    date: layout.date,
    board: {
      rows: layout.rows,
      cols: layout.cols,
      mineCount: layout.mineCount,
      isMine,
      adjacent: layout.adjacent,
      mineIndices: layout.mines,
      start: layout.start,
    },
  };
}

export async function getTodayBoard() {
  return toLoadedBoard(await apiRequest<BoardLayout>('/boards/today'));
}

export async function getBoardLayout(seed: string) {
  return toLoadedBoard(await apiRequest<BoardLayout>(`/boards/${encodeURIComponent(seed)}/layout`));
}
