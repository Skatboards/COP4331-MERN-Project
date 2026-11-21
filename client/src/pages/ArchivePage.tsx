import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyAttempts } from '../api/users';
import { ApiError } from '../api/client';
import type { ArchiveStats, Attempt } from '../api/types';
import { useAuth } from '../auth/useAuth';
import { useSignInPrompt } from '../auth/signInPrompt';
import ArchiveCalendar, { type CalendarFilter } from '../components/ArchiveCalendar';
import Icon from '../components/Icon';
import StatTile from '../components/StatTile';
import { attemptsByDate, daysFrom, firstPlayableDay, missedDays, monthRange, shiftMonth } from '../game/calendar.ts';
import { LAUNCH_DATE, formatDate, seedForDate, todayKey } from '../game/dates.ts';

const FILTERS: { value: CalendarFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'missed', label: 'Missed' },
];

function monthTitle(month: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-01T00:00:00Z`));
}

export default function ArchivePage() {
  const { token, user, loading: authLoading, logout } = useAuth();
  const openSignIn = useSignInPrompt();
  const today = todayKey();
  const thisMonth = today.slice(0, 7);
  const launchMonth = LAUNCH_DATE.slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [filter, setFilter] = useState<CalendarFilter>('all');
  const [data, setData] = useState<{ key: string; attempts: Attempt[]; stats: ArchiveStats } | null>(null);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const range = monthRange(month);
  const requestKey = `${token}:${month}:${reload}`;

  // Signed-out visitors are asked to sign in straight away
  useEffect(() => {
    if (!authLoading && !user) openSignIn('archive');
  }, [authLoading, user, openSignIn]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    getMyAttempts(token, { from: range.first, to: range.last, limit: 100 })
      .then(({ attempts, stats }) => {
        if (!active) return;
        setError('');
        setData({ key: requestKey, attempts, stats });
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 401) {
          logout();
          openSignIn('archive');
          return;
        }
        setError(requestError instanceof Error ? requestError.message : 'Could not load your archive.');
      });
    return () => { active = false; };
  }, [token, range.first, range.last, requestKey, logout, openSignIn]);

  const loaded = data?.key === requestKey ? data : null;
  const days = useMemo(() => {
    if (!loaded) return [];
    return daysFrom(range.first, range.length, attemptsByDate(loaded.attempts), today, firstPlayableDay(user?.createdAt));
  }, [loaded, range.first, range.length, today, user?.createdAt]);
  const missed = missedDays(days);
  const monthStats = useMemo(() => {
    const played = days.filter((day) => day.attempt).length;
    const won = days.filter((day) => day.status === 'won');
    const best = won.reduce((top, day) => Math.max(top, day.attempt?.efficiency ?? 0), 0);
    return { played, won: won.length, best };
  }, [days]);

  if (!user) {
    return (
      <main className="subpage">
        <div className="page-heading"><div><span className="eyebrow">PAST PUZZLES</span><h1>Board archive</h1></div></div>
        <section className="empty-state">
          <p>Sign in to see your calendar, catch up on missed days and replay past boards.</p>
          <button className="primary-button" type="button" onClick={() => openSignIn('archive')}>Sign in</button>
        </section>
      </main>
    );
  }

  return (
    <main className="subpage archive-page">
      <div className="page-heading">
        <div><span className="eyebrow">PAST PUZZLES</span><h1>Board archive</h1></div>
        <Link className="secondary-button icon-button" to="/random"><Icon name="shuffle" />Random board</Link>
      </div>

      {missed.length > 0 && (
        <section className="missed-banner" aria-labelledby="missed-title">
          <div>
            <h2 id="missed-title">Hey, you missed {missed.length} {missed.length === 1 ? 'day' : 'days'} in {monthTitle(month).split(' ')[0]}</h2>
            <p>They’re still here. Catch up whenever you like (catch-ups don’t count toward your streak).</p>
          </div>
          <div className="missed-actions">
            {missed.slice(0, 4).map((day) => (
              <Link key={day.date} className="secondary-button" to={`/archive/${seedForDate(day.date)}`}>Play {formatDate(day.date, 'short')}</Link>
            ))}
          </div>
        </section>
      )}

      <section className="stat-grid" aria-label="Month stats">
        <StatTile label="Played this month" value={loaded ? monthStats.played : '–'} />
        <StatTile label="Won" value={loaded ? monthStats.won : '–'} />
        <StatTile label="Missed" value={loaded ? missed.length : '–'} />
        <StatTile label="Best efficiency" value={loaded && monthStats.won ? `${monthStats.best}%` : '–'} />
        <StatTile label="Longest streak" value={loaded ? `${loaded.stats.longestStreak} ${loaded.stats.longestStreak === 1 ? 'day' : 'days'}` : '–'} />
      </section>

      <section className="board-card calendar-card" aria-labelledby="month-title">
        <div className="calendar-toolbar">
          <div className="month-nav">
            <button className="icon-only-button" type="button" aria-label="Previous month" disabled={month <= launchMonth} onClick={() => setMonth(shiftMonth(month, -1))}>
              <Icon name="chevronLeft" size={18} />
            </button>
            <h2 id="month-title">{monthTitle(month)}</h2>
            <button className="icon-only-button" type="button" aria-label="Next month" disabled={month >= thisMonth} onClick={() => setMonth(shiftMonth(month, 1))}>
              <Icon name="chevronRight" size={18} />
            </button>
          </div>
          <div className="segmented" role="group" aria-label="Show days">
            {FILTERS.map((option) => (
              <button key={option.value} type="button" aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>{option.label}</button>
            ))}
          </div>
        </div>
        {error ? (
          <div className="empty-state api-error-state" role="alert"><p>{error}</p><button className="text-button" onClick={() => setReload((value) => value + 1)}>Try again</button></div>
        ) : !loaded ? (
          <p className="api-state" role="status">Loading your games…</p>
        ) : (
          <ArchiveCalendar days={days} offset={range.offset} filter={filter} />
        )}
      </section>
    </main>
  );
}
