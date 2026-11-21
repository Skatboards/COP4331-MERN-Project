import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getGameProgress, saveGameProgress, submitAttempt } from '../api/boards';
import type { FinalState, PlayMode } from '../api/types';
import { useAuth } from '../auth/useAuth';
import { efficiency, generateBoard, parClicks } from '../game/minesweeper.ts';
import { boardDifficulty } from '../game/difficulty.ts';
import { formatDuration, seedDate, todayKey } from '../game/dates.ts';
import {
  chordCell, newGame, parseSavedGame, revealCell, toggleFlag, type GameState,
} from '../game/state.ts';

export interface GameResult {
  clicks: number;
  status: 'won' | 'lost';
  efficiency: number;
  completionPercentage: number;
  timeMs: number | null;
}

export type UseMinesweeperOptions = {
  // How the player reached this board; sent with the finished game
  mode?: PlayMode;
  // Called once a signed-in player's finished game has been saved
  onRecorded?: () => void;
};

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

function forget(seed: string) {
  try {
    localStorage.removeItem(storageKey(seed));
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

// Saved play time plus the stretch running since `start` (null when paused)
function elapsedOf(state: GameState, start: number | null, at: number) {
  return Math.max(0, (state.elapsedMs ?? 0) + (start === null ? 0 : at - start));
}

function finalStateOf(game: GameState): FinalState {
  return { revealed: game.revealed, flags: game.flags, explodedAt: game.explodedAt };
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

export function useMinesweeper(seed: string, { mode = 'daily', onRecorded }: UseMinesweeperOptions = {}) {
  const { token, user, loading: authLoading } = useAuth();
  const board = useMemo(() => generateBoard(seed), [seed]);
  const par = useMemo(() => parClicks(board), [board]);
  const { minClicks, difficulty } = useMemo(() => boardDifficulty(board), [board]);
  const cellCount = board.rows * board.cols;
  const safeCells = cellCount - board.mineCount;
  const signedIn = Boolean(token && user);
  const [game, setGame] = useState<GameState>(() =>
    authLoading || signedIn ? newGame(board, seed) : loadGame(seed, cellCount, () => newGame(board, seed))
  );
  const activeIdentity = token && user ? `${user.id}:${seed}` : `guest:${seed}`;
  // Which player and board the loaded game belongs to; moves wait until the
  // current one has loaded
  const [loadedFor, setLoadedFor] = useState<string | null>(() => (!authLoading && !signedIn ? activeIdentity : null));
  const ready = !authLoading && loadedFor === activeIdentity;
  // Efficiency and time the server holds for a game finished earlier
  const [recorded, setRecorded] = useState<{ identity: string; result: GameResult } | null>(null);
  const [flagMode, setFlagMode] = useState(false);
  const saveQueue = useRef(Promise.resolve());
  const savedMilestone = useRef(0);
  const onRecordedRef = useRef(onRecorded);
  useEffect(() => { onRecordedRef.current = onRecorded; }, [onRecorded]);

  // The timer: elapsedMs on the game holds finished stretches of play, and
  // runStart marks when the current stretch began (null while paused).
  // It starts with the first click and pauses while the tab is hidden.
  const [runStart, setRunStart] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    if (!token || !user) {
      Promise.resolve().then(() => {
        if (!active) return;
        setRunStart(null);
        setGame(loadGame(seed, cellCount, () => newGame(board, seed)));
        setLoadedFor(activeIdentity);
      });
      return () => { active = false; };
    }
    savedMilestone.current = 0;
    getGameProgress(token, seed).then(({ game: saved, played }) => {
      if (!active) return;
      setRunStart(null);
      setLoadedFor(activeIdentity);
      if (played) {
        const final = played.finalState;
        setGame({
          seed,
          revealed: final?.revealed ?? Array.from({ length: cellCount }, (_, index) => index)
            .filter((index) => !board.isMine[index]),
          flags: final?.flags ?? [],
          clicks: played.clicks,
          status: played.status,
          explodedAt: final?.explodedAt ?? null,
          elapsedMs: played.timeMs ?? undefined,
        });
        setRecorded({
          identity: activeIdentity,
          result: {
            clicks: played.clicks,
            status: played.status,
            efficiency: played.efficiency,
            completionPercentage: played.status === 'won' ? 100 : played.completionPercentage,
            timeMs: played.timeMs,
          },
        });
        return;
      }
      const serverGame = parseSavedGame(saved ? JSON.stringify(saved) : null, seed, cellCount);
      const restored = serverGame ?? loadGame(seed, cellCount, () => newGame(board, seed));
      setGame(restored);
      const serverMilestone = serverGame ? reachedMilestone(serverGame, safeCells) : 0;
      savedMilestone.current = serverMilestone;
      const restoredMilestone = reachedMilestone(restored, safeCells);
      // A game finished before signing in (e.g. "Sign in to share") is
      // saved to the account now
      if (!serverGame && restored.status !== 'playing' && restored.clicks > 0) {
        const status = restored.status;
        saveQueue.current = saveQueue.current.then(() => submitAttempt(token, seed, {
          clicks: restored.clicks,
          status,
          efficiency: status === 'won' ? efficiency(par, restored.clicks) : 0,
          completionPercentage: Math.floor(clearPercentage(restored, safeCells)),
          timeMs: restored.elapsedMs,
          mode,
          finalState: finalStateOf(restored),
        })).then(() => {
          forget(seed);
          onRecordedRef.current?.();
        }).catch(() => undefined);
        return;
      }
      if (!serverGame && restored.status === 'playing' && restoredMilestone > savedMilestone.current) {
        savedMilestone.current = restoredMilestone;
        saveQueue.current = saveQueue.current.then(() => saveGameProgress(
          token,
          seed,
          restored,
          Math.floor(clearPercentage(restored, safeCells)),
        )).then(() => undefined).catch(() => undefined);
      }
    }).catch(() => {
      if (!active) return;
      setRunStart(null);
      setLoadedFor(activeIdentity);
      setGame(newGame(board, seed));
    });
    return () => { active = false; };
  }, [activeIdentity, authLoading, token, user, seed, board, cellCount, safeCells, par, mode]);

  const running = game.status === 'playing' && game.clicks > 0;

  // Ticks the clock each second; resumes a game in progress after a reload
  // and pauses while the tab is hidden
  useEffect(() => {
    if (!running) return;
    const tick = window.setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (runStart === null && document.visibilityState === 'visible') setRunStart(at);
    }, 1000);
    const onVisibility = () => {
      const at = Date.now();
      if (document.visibilityState === 'hidden') {
        if (runStart === null) return;
        setGame((current) => {
          const paused = { ...current, elapsedMs: Math.round(elapsedOf(current, runStart, at)) };
          if (!signedIn) persist(paused);
          return paused;
        });
        setRunStart(null);
      } else if (runStart === null) {
        setRunStart(at);
        setNow(at);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [running, runStart, signedIn]);

  const update = useCallback((moved: GameState) => {
    const at = Date.now();
    // Fold the current stretch into the saved time and start a new one
    const next = moved.clicks > 0 ? { ...moved, elapsedMs: Math.round(elapsedOf(moved, runStart, at)) } : moved;
    setRunStart(next.status === 'playing' && next.clicks > 0 ? at : null);
    setNow(at);
    setGame(next);
    if (authLoading) return;
    if (token && user) {
      if (next.status === 'playing') {
        const milestone = reachedMilestone(next, safeCells);
        if (milestone > savedMilestone.current) {
          savedMilestone.current = milestone;
          saveQueue.current = saveQueue.current.then(() => saveGameProgress(
            token,
            seed,
            next,
            Math.floor(clearPercentage(next, safeCells)),
          )).then(() => undefined).catch(() => undefined);
        }
      } else {
        const status = next.status === 'won' ? 'won' : 'lost';
        saveQueue.current = saveQueue.current.then(() => submitAttempt(token, seed, {
          clicks: next.clicks,
          status,
          efficiency: status === 'won' ? efficiency(par, next.clicks) : 0,
          completionPercentage: Math.floor(clearPercentage(next, safeCells)),
          timeMs: next.elapsedMs,
          mode,
          finalState: finalStateOf(next),
        })).then(() => { onRecordedRef.current?.(); }).catch(() => undefined);
      }
    } else persist(next);
  }, [authLoading, token, user, seed, par, safeCells, mode, runStart]);

  const reveal = useCallback(
    (index: number) => {
      if (!ready) return;
      const next = revealCell(board, game, index);
      if (next !== game) {
        update(next);
        if (next.clicks > game.clicks && next.status !== 'lost') playRevealSound();
      }
    },
    [board, game, update, ready]
  );

  const chord = useCallback(
    (index: number) => {
      if (!ready) return;
      const next = chordCell(board, game, index);
      if (next !== game) update(next);
    },
    [board, game, update, ready]
  );

  const flag = useCallback(
    (index: number) => {
      if (!ready) return;
      const next = toggleFlag(game, index);
      if (next !== game) update(next);
    },
    [game, update, ready]
  );

  // Guests may start a board over; a signed-in player's finished game is final
  const canRestart = !signedIn;
  const restart = useCallback(() => {
    if (signedIn) return;
    forget(seed);
    setRunStart(null);
    setGame(newGame(board, seed));
  }, [signedIn, seed, board]);

  const completionPercentage = Math.floor(clearPercentage(game, safeCells));
  const elapsedMs = Math.round(game.status === 'playing' ? elapsedOf(game, runStart, Math.max(now, runStart ?? 0)) : game.elapsedMs ?? 0);
  const recordedResult = recorded?.identity === activeIdentity ? recorded.result : null;

  const result = useMemo<GameResult | null>(() => {
    if (game.status === 'playing') return null;
    if (recordedResult) return recordedResult;
    return {
      clicks: game.clicks,
      status: game.status,
      efficiency: game.status === 'won' ? efficiency(par, game.clicks) : 0,
      completionPercentage: game.status === 'won' ? 100 : completionPercentage,
      timeMs: game.elapsedMs ?? null,
    };
  }, [game.status, game.clicks, game.elapsedMs, par, recordedResult, completionPercentage]);

  const date = seedDate(seed);

  return {
    seed,
    board,
    game,
    ready,
    completionPercentage,
    result,
    clicks: game.clicks,
    minesLeft: board.mineCount - game.flags.length,
    minClicks,
    difficulty,
    elapsedMs,
    timeLabel: formatDuration(elapsedMs),
    // A past day played after the fact (doesn't count toward a streak)
    playedLate: Boolean(date && date < todayKey()),
    flagMode,
    setFlagMode,
    reveal,
    chord,
    flag,
    canRestart,
    restart,
  };
}

export type MinesweeperGame = ReturnType<typeof useMinesweeper>;
