import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import GameView from '../components/GameView';
import ScoreCard from '../components/ScoreCard';
import StatTile from '../components/StatTile';
import Icon from '../components/Icon';
import { getMyAttempts } from '../api/users';
import { useAuth } from '../auth/useAuth';
import { useMinesweeper } from '../hooks/useMinesweeper';
import { useBoardStats } from '../hooks/useBoardStats';
import { formatDate, isPlayableDate, randomPastDate, seedDate, seedForDate, todayKey } from '../game/dates.ts';
import { solvedByLabel } from '../game/share.ts';

// /random: picks a past day (skipping ones the player has finished) and
// opens it at /random/:seed
function PickRandom() {
  const { token, loading } = useAuth();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    let active = true;
    const pick = (played: string[]) => {
      if (!active) return;
      const date = randomPastDate(played);
      setTarget(date ? `/random/${seedForDate(date)}` : '/play');
    };
    if (!token) {
      Promise.resolve().then(() => pick([]));
    } else {
      getMyAttempts(token, { limit: 100 })
        .then(({ attempts }) => pick(attempts
          .filter((attempt) => attempt.status !== 'in_progress')
          .map((attempt) => seedDate(attempt.seed))
          .filter((date): date is string => Boolean(date))))
        .catch(() => pick([]));
    }
    return () => { active = false; };
  }, [token, loading]);

  if (target) return <Navigate to={target} replace />;
  return <main className="home-content"><p className="api-state" role="status">Picking a board…</p></main>;
}

function RandomGame({ seed, date }: { seed: string; date: string }) {
  const navigate = useNavigate();
  const [recorded, setRecorded] = useState(0);
  const onRecorded = useCallback(() => setRecorded((value) => value + 1), []);
  const game = useMinesweeper(seed, { mode: 'random', onRecorded });
  const stats = useBoardStats(seed, recorded);
  const another = (
    <button className="secondary-button icon-button" type="button" onClick={() => navigate('/random')}>
      <Icon name="shuffle" />Next random board
    </button>
  );

  return (
    <main className="subpage random-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">RANDOM BOARD FROM THE ARCHIVE</span>
          <h1>{formatDate(date, 'weekdayLong')}</h1>
        </div>
        <div className="heading-actions">
          {game.canRestart && game.clicks > 0 && (
            <button className="text-button icon-button" type="button" onClick={game.restart}><Icon name="restart" />Restart</button>
          )}
          <button className="secondary-button icon-button" type="button" onClick={() => navigate('/random')}>
            <Icon name="shuffle" />Another random board
          </button>
        </div>
      </div>
      <div className="play-layout">
        <GameView
          game={game}
          eyebrow={`PLAYED SOLO · ${formatDate(date).toUpperCase()}`}
          title="Random board"
          stats={stats}
          actions={another}
        />
        <div className="side-column">
          <ScoreCard seed={seed} title={`Leaderboard for ${formatDate(date, 'short')}`} reloadKey={recorded} />
          <section className="scores-card" aria-labelledby="random-day-title">
            <div className="section-heading"><h2 id="random-day-title">On the day</h2></div>
            <div className="stat-grid stat-grid-compact">
              <StatTile label="Solved by" value={solvedByLabel(stats)} />
              <StatTile label="Completion rate" value={stats ? `${Math.round(stats.globalCompletionPercentage)}%` : '–'} />
              <StatTile label="Average clicks" value={stats ? Math.round(stats.averageClicks) : '–'} />
              <StatTile label="Average efficiency" value={stats ? `${stats.averageEfficiency.toFixed(1)}%` : '–'} />
            </div>
          </section>
          <p className="game-note">Random boards are past days, so they count on that day’s leaderboard but not toward your streak. <Link to="/archive">Open the archive</Link></p>
        </div>
      </div>
    </main>
  );
}

export default function RandomBoardPage() {
  const { seed } = useParams();
  if (!seed) return <PickRandom />;
  const date = seedDate(seed);
  // Today's board and locked or pre-launch days aren't random boards
  if (!date || !isPlayableDate(date) || date === todayKey()) return <Navigate to="/random" replace />;
  return <RandomGame key={seed} seed={seed} date={date} />;
}
