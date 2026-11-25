import { useEffect, useState } from 'react';
import { getTodayBoard, type LoadedBoard } from '../api/boards';
import { useMinesweeper } from '../hooks/useMinesweeper';
import type { Board as BoardData } from '../game/minesweeper';
import Board from '../components/Minesweeper/Board';
import ScoreCard from '../components/ScoreCard';

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

function DailyBoard({ seed, board }: { seed: string; board: BoardData }) {
  const game = useMinesweeper(seed, board);
  return (
    <>
      <div className="game-toolbar" aria-live="polite">
        <span>Mines left: <strong>{game.minesLeft}</strong></span>
        <span>Clicks: <strong>{game.clicks}</strong></span>
        <span>Cleared: <strong className={game.completionPercentage === 100 ? 'completion-gold' : undefined}>{game.completionPercentage}%</strong></span>
        <button type="button" className={`text-button ${game.flagMode ? 'flag-mode-active' : ''}`} aria-pressed={game.flagMode} onClick={() => game.setFlagMode((value) => !value)}>Flag mode: {game.flagMode ? 'on' : 'off'}</button>
      </div>
      <div className="minesweeper-wrap">
        <Board board={game.board} game={game.game} flagMode={game.flagMode} onReveal={game.reveal} onFlag={game.flag} onChord={game.chord} />
      </div>
      {game.result && <p className="game-result" role="status">{game.result.status === 'won' ? `Board cleared in ${game.result.clicks} clicks · ${game.result.efficiency}% efficiency` : 'Game over. Come back tomorrow for a new board.'}</p>}
    </>
  );
}

export default function HomePage() {
  const [today, setToday] = useState<LoadedBoard | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    getTodayBoard()
      .then((loaded) => { if (active) setToday(loaded); })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Could not load today\'s board.');
      });
    return () => { active = false; };
  }, [attempt]);

  function retry() {
    setError('');
    setAttempt((value) => value + 1);
  }

  return (
    <main className="home-content">
      <section className="board-card" aria-label="Today's Minesweeper board">
        <div className="board-topline">
          <div><span className="eyebrow">DAILY PUZZLE</span><h1>Today's board</h1></div>
          <span className="board-date">{today ? formatDate(today.date) : ''}</span>
        </div>
        {today ? <DailyBoard key={today.seed} seed={today.seed} board={today.board} />
          : error ? (
            <div className="empty-state api-error-state" role="alert">
              <p>{error}</p>
              <button type="button" className="text-button" onClick={retry}>Try again</button>
            </div>
          ) : <p className="api-state" role="status">Loading today's board…</p>}
      </section>
      <ScoreCard />
    </main>
  );
}
