import { useEffect, useState } from 'react';
import { getLeaderboard, type LeaderboardSort } from '../api/users';
import { getBoardAttempts } from '../api/boards';
import type { BoardAttempt, Player } from '../api/types';
import { useAuth } from '../auth/useAuth';
import { useSignInPrompt } from '../auth/signInPrompt';
import { formatDuration } from '../game/dates.ts';

type ScoreCardProps = {
  // Show one board's best games (clicks · time) instead of the all-time
  // player leaderboard
  seed?: string;
  title?: string;
  // All-time board only: Boards / Efficiency tabs
  tabs?: boolean;
  limit?: number;
  // Change to fetch again, e.g. after the player's own game is recorded
  reloadKey?: unknown;
  className?: string;
};

type Row = { key: string; name: string; value: string; detail?: string; mine: boolean };

const PLAYER_TABS: { sort: LeaderboardSort; label: string }[] = [
  { sort: 'boardsCompleted', label: 'Boards' },
  { sort: 'efficiency', label: 'Efficiency' },
];

function playerRows(players: Player[], sort: LeaderboardSort, me: string | undefined): Row[] {
  return players.map((player) => ({
    key: player._id,
    name: player.username,
    value: sort === 'efficiency' ? `${player.efficiency.toFixed(1)}%` : `${player.boardsCompleted} ${player.boardsCompleted === 1 ? 'board' : 'boards'}`,
    mine: player.username === me,
  }));
}

function attemptRows(attempts: BoardAttempt[], me: string | undefined): Row[] {
  return attempts.map((attempt, index) => ({
    key: `${attempt.username ?? 'deleted'}-${index}`,
    name: attempt.username ?? 'Deleted player',
    value: attempt.status === 'won' ? `${attempt.clicks} clicks` : `${attempt.completionPercentage}% cleared`,
    detail: attempt.timeMs !== null ? formatDuration(attempt.timeMs) : undefined,
    mine: attempt.username === me,
  }));
}

export default function ScoreCard({ seed, title, tabs = false, limit = 10, reloadKey = 0, className = '' }: ScoreCardProps) {
  const { user } = useAuth();
  const openSignIn = useSignInPrompt();
  const [sort, setSort] = useState<LeaderboardSort>('boardsCompleted');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const me = user?.username;

  function retry() {
    setLoading(true);
    setError('');
    setReload((value) => value + 1);
  }

  useEffect(() => {
    let active = true;
    const request = seed
      ? getBoardAttempts(seed, limit).then(({ attempts }) => attemptRows(attempts, me))
      : getLeaderboard(sort, limit).then(({ users }) => playerRows(users, sort, me));
    request
      .then((next) => { if (active) { setRows(next); setError(''); } })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Could not load the leaderboard.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [seed, sort, limit, me, reload, reloadKey]);

  const heading = title ?? (seed ? 'Leaderboard for this board' : 'Player leaderboard');
  const headingId = `leaderboard-title-${seed ?? 'all'}`;

  return (
    <section className={`scores-card ${className}`} aria-labelledby={headingId}>
      <div className="section-heading">
        <h2 id={headingId}>{heading}</h2>
        {seed ? <span className="score-columns">clicks · time</span> : <span className="trophy" aria-hidden="true">✦</span>}
      </div>
      {tabs && !seed && (
        <div className="segmented" role="group" aria-label="Rank by">
          {PLAYER_TABS.map((tab) => (
            <button key={tab.sort} type="button" aria-pressed={sort === tab.sort} onClick={() => { if (tab.sort !== sort) { setLoading(true); setSort(tab.sort); } }}>
              {tab.label}
            </button>
          ))}
        </div>
      )}
      {loading ? <p className="api-state" role="status">Loading leaderboard…</p>
        : error ? <div className="api-state api-error-state" role="alert"><span>{error}</span><button className="text-button" onClick={retry}>Try again</button></div>
          : rows.length === 0 ? <p className="api-state">{seed ? 'Nobody has finished this board yet.' : 'No leaderboard results yet.'}</p>
            : <ol className="score-list">
              {rows.map((row, index) => (
                <li key={row.key} className={row.mine ? 'score-mine' : undefined}>
                  <span className={`rank rank-${index + 1}`}>{String(index + 1).padStart(2, '0')}</span>
                  <span className="score-name">{row.name}{row.mine && <span className="visually-hidden"> (you)</span>}</span>
                  <span className="score-value">{row.value}</span>
                  {seed && <span className="score-time">{row.detail ?? '–'}</span>}
                </li>
              ))}
            </ol>}
      {!user && (
        <p className="score-signin">
          <button className="text-button" type="button" onClick={() => openSignIn('leaderboard')}>Sign in</button> to see your own rank.
        </p>
      )}
    </section>
  );
}
