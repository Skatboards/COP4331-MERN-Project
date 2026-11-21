import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyAttempts } from '../api/users';
import type { ArchiveStats, Attempt } from '../api/types';
import { useAuth } from '../auth/useAuth';
import { useBoardStats } from '../hooks/useBoardStats';
import BoardPreview from '../components/BoardPreview';
import DifficultyBadge from '../components/DifficultyBadge';
import Icon from '../components/Icon';
import ScoreCard from '../components/ScoreCard';
import StatTile from '../components/StatTile';
import WeekStrip from '../components/WeekStrip';
import { attemptsByDate, daysFrom, firstPlayableDay, lastSevenDays, missedDays } from '../game/calendar.ts';
import { boardDifficulty } from '../game/difficulty.ts';
import { generateBoard } from '../game/minesweeper.ts';
import { addDays, formatDate, randomPastDate, seedForDate, todayKey, todaySeed } from '../game/dates.ts';
import { solvedByLabel } from '../game/share.ts';

const NUDGE_KEY = 'sweeple.dismissedNudge';

function readDismissed(): string | null {
  try { return sessionStorage.getItem(NUDGE_KEY); } catch { return null; }
}

// Home for signed-in players
export default function DashboardPage() {
  const { token, user } = useAuth();
  const today = todayKey();
  const seed = todaySeed();
  const { minClicks, difficulty } = useMemo(() => boardDifficulty(generateBoard(seed)), [seed]);
  const boardStats = useBoardStats(seed);
  const [data, setData] = useState<{ attempts: Attempt[]; stats: ArchiveStats } | null>(null);
  const [error, setError] = useState('');
  const [randomDate, setRandomDate] = useState(() => randomPastDate());
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    if (!token) return;
    let active = true;
    getMyAttempts(token, { from: lastSevenDays(today), to: today, limit: 20 })
      .then((result) => { if (active) setData(result); })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Could not load your stats.');
      });
    return () => { active = false; };
  }, [token, today]);

  const week = useMemo(() => daysFrom(
    lastSevenDays(today), 7, attemptsByDate(data?.attempts ?? []), today, firstPlayableDay(user?.createdAt),
  ), [data, today, user?.createdAt]);
  const todayGame = week.at(-1);
  const playedToday = todayGame?.status === 'won' || todayGame?.status === 'lost';
  // The most recent missed day this week
  const nudge = data ? missedDays(week).at(-1) : undefined;
  const stats = data?.stats;
  const streak = stats?.currentStreak ?? 0;

  function dismissNudge(date: string) {
    setDismissed(date);
    try { sessionStorage.setItem(NUDGE_KEY, date); } catch { /* Only hides it for now */ }
  }

  const streakLine = !stats ? '' : streak === 0
    ? playedToday ? 'Win tomorrow’s board to start a streak.' : 'Clear today’s board to start a streak.'
    : todayGame?.status === 'won' ? `${streak}-day streak. See you tomorrow!`
      : `${streak}-day streak. Clear today’s board to make it ${streak + 1}.`;

  return (
    <main className="dashboard">
      <section className="dashboard-hero" aria-labelledby="welcome-title">
        <div>
          <span className="eyebrow">{formatDate(today, 'weekdayLong').toUpperCase()}</span>
          <h1 id="welcome-title">Welcome back, {user?.firstName || user?.username}</h1>
          {streakLine && <p className="streak-line"><Icon name="flame" />{streakLine}</p>}
        </div>
        <div className="stat-grid stat-grid-4" aria-label="Your highlights">
          <StatTile label="Best efficiency" value={stats?.bestEfficiency ? `${stats.bestEfficiency}%` : '–'} />
          <StatTile label="Efficiency rank" value={stats?.efficiencyRank ? `#${stats.efficiencyRank}` : '–'} hint={stats?.efficiencyRank ? `of ${stats.playersRanked}` : 'Win a board to rank'} />
          <StatTile label="Boards won" value={stats?.gamesWon ?? '–'} />
          <StatTile label="Win rate" value={stats ? `${stats.winRate}%` : '–'} />
        </div>
      </section>
      {error && <p className="auth-notice" role="alert">{error}</p>}

      <div className="dashboard-grid">
        <div className="dashboard-main">
          <section className="board-card today-card" aria-labelledby="today-title">
            <Link className="today-preview" to="/play" tabIndex={-1} aria-hidden="true"><BoardPreview seed={seed} /></Link>
            <div className="today-copy">
              <span className="eyebrow">DAILY PUZZLE</span>
              <h2 id="today-title">Today’s board</h2>
              <DifficultyBadge difficulty={difficulty} minClicks={minClicks} />
              <p className="solved-by">Solved by <strong>{solvedByLabel(boardStats)}</strong> {boardStats?.totalCompletions === 1 ? 'player' : 'players'} today.</p>
              {playedToday && todayGame?.attempt ? (
                <p className="today-result">
                  {todayGame.status === 'won' ? `You won in ${todayGame.attempt.clicks} clicks · ${todayGame.attempt.efficiency}% efficiency` : `You cleared ${todayGame.attempt.completionPercentage}% before a mine.`}
                </p>
              ) : null}
              <Link className="primary-button icon-button" to="/play">
                {playedToday ? 'See your board' : todayGame?.status === 'progress' ? 'Resume today’s puzzle' : 'Play today’s puzzle'} <Icon name="arrowRight" />
              </Link>
            </div>
          </section>

          <section className="scores-card" aria-labelledby="week-title">
            <div className="section-heading">
              <h2 id="week-title">This week</h2>
              <Link className="text-button" to="/archive">Full archive →</Link>
            </div>
            {data ? <WeekStrip days={week} /> : <p className="api-state" role="status">Loading…</p>}
            {nudge && dismissed !== nudge.date && (
              <div className="nudge" role="note">
                <p>Hey, you missed {nudge.date === addDays(today, -1) ? 'yesterday' : formatDate(nudge.date, 'weekdayLong').split(',')[0]}. Play it now to keep your archive complete.</p>
                <div>
                  <Link className="secondary-button" to={`/archive/${seedForDate(nudge.date)}`}>Play {formatDate(nudge.date, 'short')}</Link>
                  <button className="text-button" type="button" onClick={() => dismissNudge(nudge.date)}>Not now</button>
                </div>
              </div>
            )}
          </section>

          {randomDate && (
            <section className="scores-card random-card" aria-labelledby="random-title">
              <div>
                <h2 id="random-title">Want more? Play a random board</h2>
                <p>Picked from the archive: {formatDate(randomDate)}. Solo, at your own pace.</p>
              </div>
              <div className="random-actions">
                <button className="secondary-button icon-button" type="button" onClick={() => setRandomDate(randomPastDate([randomDate]))}><Icon name="shuffle" />Shuffle</button>
                <Link className="primary-button" to={`/random/${seedForDate(randomDate)}`}>Play it</Link>
              </div>
            </section>
          )}
        </div>

        <div className="dashboard-side">
          <section className="scores-card" aria-labelledby="your-stats">
            <div className="section-heading"><h2 id="your-stats">Your stats</h2></div>
            <dl className="stat-list">
              <div><dt>Games played</dt><dd>{stats?.gamesPlayed ?? '–'}</dd></div>
              <div><dt>Games won</dt><dd>{stats?.gamesWon ?? '–'}</dd></div>
              <div><dt>Average efficiency</dt><dd>{stats ? `${stats.averageEfficiency.toFixed(1)}%` : '–'}</dd></div>
              <div><dt>Longest streak</dt><dd>{stats ? `${stats.longestStreak} ${stats.longestStreak === 1 ? 'day' : 'days'}` : '–'}</dd></div>
              <div><dt>Total clicks</dt><dd>{stats ? stats.totalClicks.toLocaleString('en-US') : '–'}</dd></div>
            </dl>
          </section>
          <ScoreCard title="Leaderboard" tabs />
        </div>
      </div>
    </main>
  );
}
