import { useCallback, useEffect, useState } from 'react';
import { getTodayBoard, type LoadedBoard } from '../api/boards';
import { useMinesweeper } from '../hooks/useMinesweeper';
import { useBoardStats } from '../hooks/useBoardStats';
import { formatDate } from '../game/dates.ts';
import GameView from '../components/GameView';
import ScoreCard from '../components/ScoreCard';

function DailyBoard({ today }: { today: LoadedBoard }) {
  const { seed, date, board } = today;
  const [recorded, setRecorded] = useState(0);
  const onRecorded = useCallback(() => setRecorded((value) => value + 1), []);
  const game = useMinesweeper(seed, board, { mode: 'daily', onRecorded });
  const stats = useBoardStats(seed, recorded);

  return (
    <>
      <GameView
        game={game}
        eyebrow="DAILY PUZZLE"
        title="Today's board"
        aside={formatDate(date)}
        stats={stats}
        lostMessage="Game over. Come back tomorrow for a new board, or try a random one."
      />
      <ScoreCard seed={seed} title="Today's leaderboard" reloadKey={recorded} />
    </>
  );
}

// Today's board (/play)
export default function HomePage() {
  const [today, setToday] = useState<LoadedBoard | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    getTodayBoard()
      .then((loaded) => {
        if (active) {
          setToday(loaded);
          setError('');
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : 'Could not load today\'s board.');
        }
      });
    return () => { active = false; };
  }, [attempt]);

  function retry() {
    setError('');
    setAttempt((value) => value + 1);
  }

  return (
    <main className="home-content play-layout">
      {today ? <DailyBoard key={today.seed} today={today} />
        : error ? (
          <section className="board-card empty-state api-error-state" role="alert">
            <p>{error}</p>
            <button type="button" className="text-button" onClick={retry}>Try again</button>
          </section>
        ) : (
          <section className="board-card">
            <p className="api-state" role="status">Loading today's board…</p>
          </section>
        )}
    </main>
  );
}
