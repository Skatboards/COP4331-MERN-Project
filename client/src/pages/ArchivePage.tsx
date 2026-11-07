import { useEffect, useState } from 'react';
import { getMyAttempts } from '../api/users';
import { ApiError } from '../api/client';
import type { Attempt } from '../api/types';
import { useAuth } from '../auth/useAuth';

type ArchivePageProps = { onSignIn: () => void };

function attemptDate(attempt: Attempt) {
  const seedDate = attempt.seed?.match(/^daily-(\d{4}-\d{2}-\d{2})$/)?.[1];
  const date = seedDate ? new Date(`${seedDate}T00:00:00Z`)
    : attempt.completedAt ? new Date(attempt.completedAt) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function attemptStatus(attempt: Attempt) {
  if (attempt.status === 'won') return 'Won';
  if (attempt.status === 'lost') return 'Lost';
  return 'In progress';
}

function attemptDescription(attempt: Attempt) {
  const efficiency = attempt.status === 'won' ? ` · ${attempt.efficiency}% efficiency` : '';
  return `${attemptStatus(attempt)} · ${attempt.completionPercentage}% complete · ${attempt.clicks} clicks${efficiency}`;
}

export default function ArchivePage({ onSignIn }: ArchivePageProps) {
  const { token, user, logout } = useAuth();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  function retry() {
    setLoading(true);
    setError('');
    setReload((value) => value + 1);
  }

  useEffect(() => {
    if (!token) return;

    let active = true;
    getMyAttempts(token)
      .then(({ attempts: userAttempts }) => { if (active) setAttempts(userAttempts); })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (requestError instanceof ApiError && requestError.status === 401) {
          logout();
          onSignIn();
          return;
        }
        setError(requestError instanceof Error ? requestError.message : 'Could not load your archive.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, reload, logout, onSignIn]);

  return (
    <main className="subpage">
      <div className="page-heading">
        <div><span className="eyebrow">PAST PUZZLES</span><h1>Board archive</h1></div>
        {user && <span className="archive-count">{attempts.length} GAMES</span>}
      </div>
      {!user ? <section className="empty-state"><p>Sign in to see your completed boards.</p><button className="primary-button" onClick={onSignIn}>Sign in</button></section>
        : loading ? <p className="api-state" role="status">Loading your games…</p>
          : error ? <div className="empty-state api-error-state" role="alert"><p>{error}</p><button className="text-button" onClick={retry}>Try again</button></div>
            : attempts.length === 0 ? <p className="api-state">You haven’t played any boards yet.</p>
              : <div className="archive-grid">
                {attempts.map((attempt, index) => {
                  const date = attemptDate(attempt);
                  return (
                    <article className="archive-card" key={attempt.id} aria-label={`${date}: ${attemptDescription(attempt)}`}>
                      <div className="archive-card-top"><span className="calendar-icon">▦</span><span className="archive-arrow">↗</span></div>
                      <span className="archive-day">{index === 0 ? 'Most recent' : attempt.status.replace('_', ' ')}</span>
                      <strong>{date}</strong>
                      <span className={`archive-result ${attempt.status === 'lost' ? 'result-muted' : ''}`}>
                        {attemptStatus(attempt)} · <span className={attempt.completionPercentage === 100 ? 'completion-gold' : undefined}>
                          {attempt.completionPercentage}% complete
                        </span>
                      </span>
                      <span className="archive-clicks">
                        {attempt.clicks} clicks{attempt.status === 'won' ? ` · ${attempt.efficiency}% efficiency` : ''}
                      </span>
                      <div className="mini-board" aria-hidden="true">
                        {Array.from({ length: 25 }, (_, cell) => <i className={cell % (index + 3) === 0 ? 'mini-open' : ''} key={cell} />)}
                      </div>
                    </article>
                  );
                })}
              </div>}
    </main>
  );
}
