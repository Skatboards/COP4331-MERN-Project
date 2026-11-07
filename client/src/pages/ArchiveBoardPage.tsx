import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import Board from '../components/Minesweeper/Board';
import { generateBoard } from '../game/minesweeper';
import type { GameState } from '../game/state';

const validSeed = (seed: string | undefined): seed is string =>
  Boolean(seed && /^[A-Za-z0-9_-]{1,64}$/.test(seed));

function boardTitle(seed: string) {
  const date = seed.match(/^daily-(\d{4}-\d{2}-\d{2})$/)?.[1];
  if (!date) return seed;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return seed;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(parsed);
}

const noAction = () => {};

export default function ArchiveBoardPage() {
  const { seed: routeSeed } = useParams();
  const isValid = validSeed(routeSeed);
  const seed = isValid ? routeSeed : 'invalid-seed';
  const board = useMemo(() => generateBoard(seed), [seed]);
  const game = useMemo<GameState>(() => ({
    seed,
    revealed: Array.from({ length: board.rows * board.cols }, (_, index) => index)
      .filter((index) => !board.isMine[index]),
    flags: [],
    clicks: 0,
    status: 'lost',
    explodedAt: null,
  }), [board, seed]);

  if (!isValid) {
    return (
      <main className="subpage">
        <section className="empty-state archive-board-error">
          <p>This archive board could not be found.</p>
          <Link className="text-button" to="/archive">Back to archive</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="subpage archive-board-page">
      <p className="archive-board-back"><Link to="/archive">← Back to archive</Link></p>
      <section className="board-card" aria-label={`Historical Minesweeper board for ${boardTitle(seed)}`}>
        <div className="board-topline">
          <div><span className="eyebrow">PAST PUZZLE</span><h1>{boardTitle(seed)}</h1></div>
          <span className="board-date">READ ONLY</span>
        </div>
        <div className="game-toolbar">
          <span>Mines: <strong>{board.mineCount}</strong></span>
          <span>Full board revealed</span>
        </div>
        <div className="minesweeper-wrap">
          <Board
            board={board}
            game={game}
            flagMode={false}
            onReveal={noAction}
            onFlag={noAction}
            onChord={noAction}
          />
        </div>
      </section>
    </main>
  );
}
