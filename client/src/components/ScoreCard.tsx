import { useEffect, useState } from 'react';
import { getLeaderboard } from '../api/users';
import type { Player } from '../api/types';

export default function ScoreCard() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  function retry() {
    setLoading(true);
    setError('');
    setReload((value) => value + 1);
  }

  useEffect(() => {
    let active = true;
    getLeaderboard('boardsCompleted', 10)
      .then(({ users }) => { if (active) setPlayers(users); })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Could not load the leaderboard.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  return (
    <section className="scores-card" aria-labelledby="leaderboard-title">
      <div className="section-heading"><h2 id="leaderboard-title">Player leaderboard</h2><span className="trophy" aria-hidden="true">✦</span></div>
      {loading ? <p className="api-state" role="status">Loading leaderboard…</p>
          : error ? <div className="api-state api-error-state" role="alert"><span>{error}</span><button className="text-button" onClick={retry}>Try again</button></div>
          : players.length === 0 ? <p className="api-state">No leaderboard results yet.</p>
            : <ol className="score-list">
              {players.map((player, index) => (
                <li key={player._id}>
                  <span className={`rank rank-${index + 1}`}>{String(index + 1).padStart(2, '0')}</span>
                  <span className="score-name">{player.username}</span>
                  <span className="score-value">{player.boardsCompleted} boards</span>
                </li>
              ))}
            </ol>}
    </section>
  );
}
