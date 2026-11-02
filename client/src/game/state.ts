import { floodReveal, isWon, neighbors, openingReveal, type Board } from './minesweeper.ts';

export type GameStatus = 'playing' | 'won' | 'lost';

export interface GameState {
  seed: string;
  revealed: number[];
  flags: number[];
  clicks: number;
  status: GameStatus;
  explodedAt: number | null;
}

export function newGame(board: Board, seed: string): GameState {
  return {
    seed,
    revealed: [...openingReveal(board)],
    flags: [],
    clicks: 0,
    status: 'playing',
    explodedAt: null,
  };
}

export function revealCell(board: Board, state: GameState, index: number): GameState {
  if (state.status !== 'playing') return state;
  if (!Number.isInteger(index) || index < 0 || index >= board.rows * board.cols) return state;
  if (state.flags.includes(index)) return state;
  const revealed = new Set(state.revealed);
  if (revealed.has(index)) return state;

  const clicks = state.clicks + 1;
  if (board.isMine[index]) {
    return { ...state, clicks, status: 'lost', explodedAt: index };
  }
  floodReveal(board, index, revealed);
  return {
    ...state,
    revealed: [...revealed],
    clicks,
    status: isWon(board, revealed) ? 'won' : 'playing',
  };
}

export function chordCell(board: Board, state: GameState, index: number): GameState {
  if (state.status !== 'playing') return state;
  if (!Number.isInteger(index) || index < 0 || index >= board.rows * board.cols) return state;
  const revealed = new Set(state.revealed);
  if (!revealed.has(index) || board.adjacent[index] === 0) return state;

  const around = neighbors(index, board.rows, board.cols);
  const flagged = around.filter((n) => state.flags.includes(n)).length;
  if (flagged !== board.adjacent[index]) return { ...state, clicks: state.clicks + 1 };

  const targets = around.filter((n) => !revealed.has(n) && !state.flags.includes(n));
  if (targets.length === 0) return state;

  let explodedAt: number | null = null;
  for (const n of targets) {
    if (board.isMine[n]) explodedAt ??= n;
    else floodReveal(board, n, revealed);
  }
  const next = { ...state, revealed: [...revealed], clicks: state.clicks + 1 };
  if (explodedAt !== null) return { ...next, status: 'lost' as const, explodedAt };
  return { ...next, status: isWon(board, revealed) ? ('won' as const) : ('playing' as const) };
}

export function toggleFlag(state: GameState, index: number): GameState {
  if (state.status !== 'playing') return state;
  if (state.revealed.includes(index)) return state;
  const flags = state.flags.includes(index)
    ? state.flags.filter((f) => f !== index)
    : [...state.flags, index];
  return { ...state, flags };
}

export function parseSavedGame(raw: string | null, seed: string, cellCount: number): GameState | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<GameState> | null;
    const okIndexes = (a: unknown): a is number[] =>
      Array.isArray(a) && a.every((n) => Number.isInteger(n) && n >= 0 && n < cellCount);
    if (
      !v ||
      v.seed !== seed ||
      !okIndexes(v.revealed) ||
      !okIndexes(v.flags) ||
      !Number.isInteger(v.clicks) ||
      (v.clicks as number) < 0 ||
      (v.status !== 'playing' && v.status !== 'won' && v.status !== 'lost') ||
      !(v.explodedAt === null || (Number.isInteger(v.explodedAt) && okIndexes([v.explodedAt])))
    ) {
      return null;
    }
    return v as GameState;
  } catch {
    return null;
  }
}