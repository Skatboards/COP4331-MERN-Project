import { optimalClicks, type Board } from './minesweeper.ts';

// The fewest clicks that can clear a board after the free starting opening
// (its 3BV minus the opening). optimalClicks already computes this.
export const minClicksNeeded = optimalClicks;

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

// Splits a year of generated boards into roughly equal thirds
// (min clicks ranged 32–101, median 63). Retune if the board size changes.
export const MEDIUM_FROM = 58;
export const HARD_FROM = 68;

export function difficultyFor(minClicks: number): Difficulty {
  if (minClicks >= HARD_FROM) return 'Hard';
  if (minClicks >= MEDIUM_FROM) return 'Medium';
  return 'Easy';
}

export function boardDifficulty(board: Board): { minClicks: number; difficulty: Difficulty } {
  const minClicks = minClicksNeeded(board);
  return { minClicks, difficulty: difficultyFor(minClicks) };
}
