import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getGameProgress, saveGameProgress, submitAttempt } from '../api/boards';
import { useAuth } from '../auth/useAuth';
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

function playRevealSound() {
  try {
    if (localStorage.getItem('sweeple-sound') === 'false') return;
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 520;
    gain.gain.setValueAtTime(0.035, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.07);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.07);
    oscillator.onended = () => { void context.close(); };
  } catch {
    // Sound is optional; gameplay remains available when audio is blocked.
  }
}

export function useMinesweeper(seed: string) {
  const { token, user, loading: authLoading } = useAuth();
  const board = useMemo(() => generateBoard(seed), [seed]);
  const par = useMemo(() => parClicks(board), [board]);
  const [game, setGame] = useState<GameState>(() =>
    token && user ? newGame(board, seed) : loadGame(seed, board.rows * board.cols, () => newGame(board, seed))
  );
  const [flagMode, setFlagMode] = useState(false);
  const saveQueue = useRef(Promise.resolve());
  const activeIdentity = token && user ? `${user.id}:${seed}` : `guest:${seed}`;

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    if (!token || !user) {
      setGame(loadGame(seed, board.rows * board.cols, () => newGame(board, seed)));
      return () => { active = false; };
    }
    setGame(newGame(board, seed));
    getGameProgress(token, seed).then(({ game: saved }) => {
      if (!active) return;
      setGame(parseSavedGame(saved ? JSON.stringify(saved) : null, seed, board.rows * board.cols) ?? newGame(board, seed));
    }).catch(() => {
      if (active) setGame(newGame(board, seed));
    });
    return () => { active = false; };
  }, [activeIdentity, authLoading, token, user, seed, board]);

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
    if (authLoading) return;
    if (token && user) {
      if (next.status === 'playing') {
        saveQueue.current = saveQueue.current.then(() => saveGameProgress(token, seed, next)).then(() => undefined).catch(() => undefined);
      } else {
        saveQueue.current = saveQueue.current.then(() => submitAttempt(token, seed, {
          clicks: next.clicks,
          status: next.status,
          efficiency: next.status === 'won' ? efficiency(par, next.clicks) : 0,
        })).then(() => undefined).catch(() => undefined);
      }
    } else persist(next);
  }, [authLoading, token, user, seed, par]);

  const reveal = useCallback(
    (index: number) => {
      const next = revealCell(board, game, index);
      if (next !== game) {
        update(next);
        if (next.clicks > game.clicks && next.status !== 'lost') playRevealSound();
      }
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
