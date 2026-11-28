import { apiRequest } from './client';
import type { Board as GameBoard } from '../game/minesweeper';
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
