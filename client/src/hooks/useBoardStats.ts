import { useEffect, useState } from 'react';
import { getBoard } from '../api/boards';
import type { Board } from '../api/types';

// A board's global stats ("Solved by", averages). Change reloadKey to fetch
// again, e.g. after the player's own game is recorded.
export function useBoardStats(seed: string, reloadKey: unknown = 0) {
  const [board, setBoard] = useState<Board | null>(null);
  useEffect(() => {
    let active = true;
    getBoard(seed)
      .then(({ board: stats }) => { if (active) setBoard(stats); })
      .catch(() => { if (active) setBoard(null); });
    return () => { active = false; };
  }, [seed, reloadKey]);
  return board?.seed === seed ? board : null;
}
