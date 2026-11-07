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

function clearPercentage(game: GameState, safeCellCount: number) {
  return safeCellCount === 0 ? 100 : (new Set(game.revealed).size / safeCellCount) * 100;
}

function reachedMilestone(game: GameState, safeCellCount: number) {
  return Math.floor(clearPercentage(game, safeCellCount) / 10) * 10;
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
    authLoading || (token && user) ? newGame(board, seed) : loadGame(seed, board.rows * board.cols, () => newGame(board, seed))
  );
  const [flagMode, setFlagMode] = useState(false);
  const saveQueue = useRef(Promise.resolve());
  const savedMilestone = useRef(0);
  const activeIdentity = token && user ? `${user.id}:${seed}` : `guest:${seed}`;

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    if (!token || !user) {
      setGame(loadGame(seed, board.rows * board.cols, () => newGame(board, seed)));
      return () => { active = false; };
    }
    savedMilestone.current = 0;
    setGame(newGame(board, seed));
    getGameProgress(token, seed).then(({ game: saved, played }) => {
      if (!active) return;
      if (played) {
        setGame({
          seed,
          revealed: Array.from(
            { length: board.rows * board.cols },
            (_, index) => index,
          ).filter((index) => !board.isMine[index]),
          flags: [],
          clicks: played.clicks,
          status: played.status,
          explodedAt: null,
        });
        return;
      }
      const serverGame = parseSavedGame(saved ? JSON.stringify(saved) : null, seed, board.rows * board.cols);
      const restored = serverGame ?? loadGame(seed, board.rows * board.cols, () => newGame(board, seed));
      setGame(restored);
      const serverMilestone = serverGame
        ? reachedMilestone(serverGame, board.rows * board.cols - board.mineCount)
        : 0;
      savedMilestone.current = serverMilestone;
      const restoredMilestone = reachedMilestone(restored, board.rows * board.cols - board.mineCount);
      if (!serverGame && restored.status === 'playing' && restoredMilestone > savedMilestone.current) {
        savedMilestone.current = restoredMilestone;
        saveQueue.current = saveQueue.current.then(() => saveGameProgress(
          token,
          seed,
          restored,
          Math.floor(clearPercentage(restored, board.rows * board.cols - board.mineCount)),
        )).then(() => undefined).catch(() => undefined);
      }
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
        const milestone = reachedMilestone(next, board.rows * board.cols - board.mineCount);
        if (milestone > savedMilestone.current) {
          savedMilestone.current = milestone;
          saveQueue.current = saveQueue.current.then(() => saveGameProgress(
            token,
            seed,
            next,
            Math.floor(clearPercentage(next, board.rows * board.cols - board.mineCount)),
          )).then(() => undefined).catch(() => undefined);
        }
      } else {
        saveQueue.current = saveQueue.current.then(() => submitAttempt(token, seed, {
          clicks: next.clicks,
          status: next.status,
          efficiency: next.status === 'won' ? efficiency(par, next.clicks) : 0,
          completionPercentage: Math.floor(clearPercentage(next, board.rows * board.cols - board.mineCount)),
        })).then(() => undefined).catch(() => undefined);
      }
    } else persist(next);
  }, [authLoading, token, user, seed, par, board]);

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
    completionPercentage: Math.floor(clearPercentage(game, board.rows * board.cols - board.mineCount)),
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
