import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import Board from '../components/Minesweeper/Board';
import GameView from '../components/GameView';
import ScoreCard from '../components/ScoreCard';
import DifficultyBadge from '../components/DifficultyBadge';
import CompareBars from '../components/CompareBars';
import StatTile from '../components/StatTile';
import ShareDialog from '../components/ShareDialog';
import Icon from '../components/Icon';
import { getBoardAttempts } from '../api/boards';
import { getMyAttempt } from '../api/users';
import type { Board as BoardStats, BoardAttempt, MyBoardAttempt } from '../api/types';
import { useAuth } from '../auth/useAuth';
import { useMinesweeper } from '../hooks/useMinesweeper';
import { useBoardStats } from '../hooks/useBoardStats';
import { generateBoard } from '../game/minesweeper.ts';
import { boardDifficulty } from '../game/difficulty.ts';
import {
  LAUNCH_DATE, addDays, boardTitle, formatDate, formatDuration, isFutureDate, seedDate, seedForDate, todayKey,
} from '../game/dates.ts';
import { solvedByLabel } from '../game/share.ts';
import type { GameState } from '../game/state.ts';

const validSeed = (seed: string | undefined): seed is string =>
  Boolean(seed && /^[A-Za-z0-9_-]{1,64}$/.test(seed));

const noAction = () => {};

function DayNav({ date }: { date: string }) {
  const previous = addDays(date, -1);
  const next = addDays(date, 1);
  return (
    <nav className="day-nav" aria-label="Other days">
      <Link to="/archive">← Back to archive</Link>
      <span>
        {previous >= LAUNCH_DATE && <Link to={`/archive/${seedForDate(previous)}`}>‹ {formatDate(previous, 'short')}</Link>}
        {next <= todayKey() && <Link to={next === todayKey() ? '/play' : `/archive/${seedForDate(next)}`}>{formatDate(next, 'short')} ›</Link>}
      </span>
    </nav>
  );
}

function OnTheDay({ stats }: { stats: BoardStats | null }) {
  return (
    <section className="scores-card" aria-labelledby="on-the-day">
      <div className="section-heading"><h2 id="on-the-day">On the day</h2></div>
      <div className="stat-grid stat-grid-compact">
        <StatTile label="Solved by" value={solvedByLabel(stats)} />
        <StatTile label="Completion rate" value={stats ? `${Math.round(stats.globalCompletionPercentage)}%` : '–'} />
        <StatTile label="Average clicks" value={stats ? Math.round(stats.averageClicks) : '–'} />
        <StatTile label="Average efficiency" value={stats ? `${stats.averageEfficiency.toFixed(1)}%` : '–'} />
      </div>
    </section>
  );
}

// Playing a past board (or a shared board for guests)
function PlayPast({ seed, onRecorded }: { seed: string; onRecorded: () => void }) {
  const [recorded, setRecorded] = useState(0);
  const handleRecorded = useCallback(() => {
    setRecorded((value) => value + 1);
    onRecorded();
  }, [onRecorded]);
  const game = useMinesweeper(seed, { mode: 'archive', onRecorded: handleRecorded });
  const stats = useBoardStats(seed, recorded);
  const date = seedDate(seed);
  return (
    <GameView
      game={game}
      eyebrow={`PAST PUZZLE${date ? ` · ${formatDate(date, 'weekday').toUpperCase()}` : ''}`}
      title={boardTitle(seed)}
      stats={stats}
    />
  );
}

type ViewMode = 'final' | 'solution';

// A finished game: the board as left or the full solution, and how the
// game compares with everyone else's
function PlayedBoard({ seed, attempt }: { seed: string; attempt: MyBoardAttempt }) {
  const { user } = useAuth();
  const board = useMemo(() => generateBoard(seed), [seed]);
  const { minClicks, difficulty } = useMemo(() => boardDifficulty(board), [board]);
  const stats = useBoardStats(seed);
  const [view, setView] = useState<ViewMode>(attempt.finalState ? 'final' : 'solution');
  const [shareOpen, setShareOpen] = useState(false);
  const [ranked, setRanked] = useState<BoardAttempt[] | null>(null);
  const date = seedDate(seed);

  useEffect(() => {
    let active = true;
    getBoardAttempts(seed, 50, 'result')
      .then(({ attempts }) => { if (active) setRanked(attempts); })
      .catch(() => { if (active) setRanked([]); });
    return () => { active = false; };
  }, [seed]);

  const shown = useMemo<GameState>(() => {
    if (view === 'final' && attempt.finalState) {
      return {
        seed,
        revealed: attempt.finalState.revealed,
        flags: attempt.finalState.flags,
        explodedAt: attempt.finalState.explodedAt,
        clicks: attempt.clicks,
        status: attempt.status === 'won' ? 'won' : 'lost',
      };
    }
    return {
      seed,
      revealed: Array.from({ length: board.rows * board.cols }, (_, index) => index).filter((index) => !board.isMine[index]),
      flags: [],
      clicks: 0,
      status: 'lost',
      explodedAt: null,
    };
  }, [view, attempt, board, seed]);

  const place = ranked ? ranked.findIndex((row) => row.username === user?.username) + 1 : 0;
  const won = attempt.status === 'won';

  return (
    <>
      <section className="board-card" aria-label={`Board for ${boardTitle(seed)}`}>
        <div className="board-topline">
          <div><span className="eyebrow">PAST PUZZLE{date ? ` · ${formatDate(date, 'weekday').toUpperCase()}` : ''}</span><h1>{boardTitle(seed)}</h1></div>
          <button className="primary-button icon-button" type="button" onClick={() => setShareOpen(true)}><Icon name="share" />Share</button>
        </div>
        <div className="board-meta">
          <DifficultyBadge difficulty={difficulty} minClicks={minClicks} />
          <span className={`badge ${won ? 'result-won' : 'result-lost'}`}>
            {won ? `Won · ${attempt.efficiency}%` : `Lost · ${attempt.completionPercentage}% cleared`}
          </span>
          <span className="solved-by">Solved by <strong>{solvedByLabel(stats)}</strong></span>
        </div>
        <div className="board-view-toggle">
          <div className="segmented" role="group" aria-label="Board view">
            <button type="button" aria-pressed={view === 'final'} disabled={!attempt.finalState} onClick={() => setView('final')}>Your final board</button>
            <button type="button" aria-pressed={view === 'solution'} onClick={() => setView('solution')}>Solution</button>
          </div>
          <span className="board-date">
            {attempt.clicks} clicks{attempt.timeMs !== null ? ` · ${formatDuration(attempt.timeMs)}` : ''}
            {!attempt.onTime && attempt.mode !== 'daily' ? ' · played late' : ''}
          </span>
        </div>
        <div className="minesweeper-wrap">
          <Board board={board} game={shown} flagMode={false} onReveal={noAction} onFlag={noAction} onChord={noAction} />
        </div>
        {!attempt.finalState && <p className="game-note">This game was saved before final boards were kept, so only the solution is shown.</p>}
      </section>

      <div className="two-column">
        <section className="scores-card" aria-labelledby="vs-title">
          <div className="section-heading">
            <h2 id="vs-title">You vs everyone</h2>
            {place > 0 && <span className="badge badge-quiet">#{place} of {stats?.totalAttempts ?? ranked?.length}</span>}
          </div>
          <CompareBars rows={[
            { label: 'Clicks (fewer is better)', you: attempt.clicks, average: stats?.averageClicks ?? 0, format: (value) => String(Math.round(value)) },
            { label: 'Efficiency', you: attempt.efficiency, average: stats?.averageEfficiency ?? 0, max: 100, format: (value) => `${Math.round(value)}%` },
            { label: 'Board cleared', you: attempt.completionPercentage, average: stats?.globalCompletionPercentage ?? 0, max: 100, format: (value) => `${Math.round(value)}%` },
          ]} />
          <p className="game-note">The “Board cleared” average is the share of players who cleared the whole board.</p>
        </section>
        <OnTheDay stats={stats} />
      </div>
      <ScoreCard seed={seed} title="Top players this day" limit={10} />

      {shareOpen && (
        <ShareDialog
          seed={seed}
          onClose={() => setShareOpen(false)}
          result={{
            dateLabel: boardTitle(seed),
            status: won ? 'won' : 'lost',
            completion: attempt.completionPercentage,
            clicks: attempt.clicks,
            timeMs: attempt.timeMs,
            efficiency: attempt.efficiency,
            difficulty,
          }}
        />
      )}
    </>
  );
}

export default function ArchiveBoardPage() {
  const { seed: routeSeed } = useParams();
  const { token, user, loading: authLoading } = useAuth();
  const isValid = validSeed(routeSeed);
  const seed = isValid ? routeSeed : 'invalid-seed';
  const date = seedDate(seed);
  const [mine, setMine] = useState<{ key: string; attempt: MyBoardAttempt | null } | null>(null);
  const [reload, setReload] = useState(0);
  const [startedFor, setStartedFor] = useState<string | null>(null);
  const requestKey = `${token}:${seed}:${reload}`;
  const refresh = useCallback(() => setReload((value) => value + 1), []);

  useEffect(() => {
    if (!token || !isValid) return;
    let active = true;
    getMyAttempt(token, seed)
      .then(({ attempt }) => { if (active) setMine({ key: requestKey, attempt }); })
      .catch(() => { if (active) setMine({ key: requestKey, attempt: null }); });
    return () => { active = false; };
  }, [token, seed, isValid, requestKey]);

  if (!isValid || !date) {
    return (
      <main className="subpage">
        <section className="empty-state archive-board-error">
          <p>This archive board could not be found.</p>
          <Link className="text-button" to="/archive">Back to archive</Link>
        </section>
      </main>
    );
  }
  if (date === todayKey()) return <Navigate to="/play" replace />;

  if (isFutureDate(date) || date < LAUNCH_DATE) {
    return (
      <main className="subpage archive-board-page">
        <DayNav date={date} />
        <section className="empty-state locked-state">
          <Icon name="lock" size={22} />
          <p>{date < LAUNCH_DATE
            ? `${formatDate(date)} is from before Sweeple launched, so there’s no board for it.`
            : `${formatDate(date)} is locked until its day. Come back then!`}</p>
        </section>
      </main>
    );
  }

  const loadedMine = mine?.key === requestKey ? mine : null;
  const finished = loadedMine?.attempt && loadedMine.attempt.status !== 'in_progress' ? loadedMine.attempt : null;
  const inProgress = loadedMine?.attempt?.status === 'in_progress';

  return (
    <main className="subpage archive-board-page">
      <DayNav date={date} />
      {authLoading || (user && !loadedMine) ? (
        <p className="api-state" role="status">Loading this board…</p>
      ) : !user ? (
        <>
          <p className="auth-notice guest-note">You’re playing as a guest. Sign in to save this game to your archive.</p>
          <PlayPast seed={seed} onRecorded={refresh} />
        </>
      ) : finished ? (
        <PlayedBoard seed={seed} attempt={finished} />
      ) : inProgress || startedFor === seed ? (
        <PlayPast seed={seed} onRecorded={refresh} />
      ) : (
        <section className="board-card missed-intro" aria-labelledby="missed-day-title">
          <span className="eyebrow">PAST PUZZLE · {formatDate(date, 'weekday').toUpperCase()}</span>
          <h1 id="missed-day-title">Hey, you missed this day</h1>
          <p>No spoilers. Play it first, then come back to compare with everyone else. Catch-ups count on the leaderboard but not toward your streak.</p>
          <button className="primary-button" type="button" onClick={() => setStartedFor(seed)}>Play {formatDate(date)}</button>
        </section>
      )}
    </main>
  );
}
