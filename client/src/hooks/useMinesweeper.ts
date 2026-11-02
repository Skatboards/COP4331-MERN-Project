import { useCallback, useMemo, useState } from 'react';
import { efficiency, generateBoard, parClicks } from '../game/minesweeper.ts';
import {
  chordCell, newGame, parseSavedGame, revealCell, toggleFlag, type GameState,
} from '../game/state.ts';

export interface GameResult {
  clicks: number;
  status: 'won' | 'lost';
  efficiency: number;
}

const storageKey = (seed: string) => `sweeple.game.${seed}`;

function loadGame(seed: string, cells: number, fresh: () => GameState): GameState {
  try {
    return parseSavedGame(localStorage.getItem(storageKey(seed)), seed, cells) ?? fresh();
  } catch {
    return fresh();
  }
}

function persist(game: GameState) {
  try {
    localStorage.setItem(storageKey(game.seed), JSON.stringify(game));
  } catch {
    return;
  }
}

export function useMinesweeper(seed: string) {
  const board = useMemo(() => generateBoard(seed), [seed]);
  const par = useMemo(() => parClicks(board), [board]);
  const [game, setGame] = useState<GameState>(() =>
    loadGame(seed, board.rows * board.cols, () => newGame(board, seed))
  );
  const [flagMode, setFlagMode] = useState(false);

  const result = useMemo<GameResult | null>(
    () =>
      game.status === 'playing'
        ? null
        : {
            clicks: game.clicks,
            status: game.status,
            efficiency: game.status === 'won' ? efficiency(par, game.clicks) : 0,
          },
    [game.status, game.clicks, par]
  );

  const update = useCallback((next: GameState) => {
    setGame(next);
    persist(next);
  }, []);

  const reveal = useCallback(
    (index: number) => {
      const next = revealCell(board, game, index);
      if (next !== game) update(next);
    },
    [board, game, update]
  );

  const chord = useCallback(
    (index: number) => {
      const next = chordCell(board, game, index);
      if (next !== game) update(next);
    },
    [board, game, update]
  );

  const flag = useCallback(
    (index: number) => {
      const next = toggleFlag(game, index);
      if (next !== game) update(next);
    },
    [game, update]
  );

  return {
    board,
    game,
    result,
    clicks: game.clicks,
    minesLeft: board.mineCount - game.flags.length,
    flagMode,
    setFlagMode,
    reveal,
    chord,
    flag,
  };
}