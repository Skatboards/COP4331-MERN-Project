import { useState, type ReactNode } from 'react';
import Board from './Minesweeper/Board';
import DifficultyBadge from './DifficultyBadge';
import ShareDialog from './ShareDialog';
import Icon from './Icon';
import type { Board as BoardStats } from '../api/types';
import type { MinesweeperGame } from '../hooks/useMinesweeper';
import { useAuth } from '../auth/useAuth';
import { useSignInPrompt } from '../auth/signInPrompt';
import { boardTitle } from '../game/dates.ts';
import { solvedByLabel } from '../game/share.ts';

type GameViewProps = {
  game: MinesweeperGame;
  eyebrow: string;
  title: string;
  // Shown on the right of the heading, e.g. the date
  aside?: ReactNode;
  stats: BoardStats | null;
  // Extra buttons after the game ends (e.g. "Next random board")
  actions?: ReactNode;
  // Line shown under the result instead of the default
  lostMessage?: string;
};

// One playable board: heading, difficulty, toolbar with the timer, the
// board itself, the result and a Share button
export default function GameView({ game, eyebrow, title, aside, stats, actions, lostMessage }: GameViewProps) {
  const { user } = useAuth();
  const openSignIn = useSignInPrompt();
  const [shareOpen, setShareOpen] = useState(false);
  const { result } = game;

  function share() {
    if (user) setShareOpen(true);
    else openSignIn('share', () => setShareOpen(true));
  }

  return (
    <section className="board-card" aria-label={`Minesweeper board: ${title}`}>
      <div className="board-topline">
        <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1></div>
        {aside && <span className="board-date">{aside}</span>}
      </div>
      <div className="board-meta">
        <DifficultyBadge difficulty={game.difficulty} minClicks={game.minClicks} />
        <span className="solved-by">Solved by <strong>{solvedByLabel(stats)}</strong> {stats?.totalCompletions === 1 ? 'player' : 'players'}</span>
      </div>
      <div className="game-toolbar" aria-live="polite">
        <span>Mines left: <strong>{game.minesLeft}</strong></span>
        <span>Clicks: <strong>{game.clicks}</strong></span>
        <span>Time: <strong>{game.timeLabel}</strong></span>
        <span>Cleared: <strong className={game.completionPercentage === 100 ? 'completion-gold' : undefined}>{game.completionPercentage}%</strong></span>
        <button type="button" className={`text-button ${game.flagMode ? 'flag-mode-active' : ''}`} aria-pressed={game.flagMode} onClick={() => game.setFlagMode((value) => !value)}>Flag mode: {game.flagMode ? 'on' : 'off'}</button>
      </div>
      <div className="minesweeper-wrap" aria-busy={!game.ready}>
        <Board board={game.board} game={game.game} flagMode={game.flagMode} onReveal={game.reveal} onFlag={game.flag} onChord={game.chord} />
      </div>
      {result && (
        <div className="game-end">
          <p className="game-result" role="status">
            {result.status === 'won'
              ? `Board cleared in ${result.clicks} clicks · ${game.timeLabel} · ${result.efficiency}% efficiency`
              : lostMessage ?? `Game over at ${result.completionPercentage}% cleared.`}
          </p>
          <div className="game-end-actions">
            <button className="primary-button icon-button" type="button" onClick={share}><Icon name="share" />Share</button>
            {game.canRestart && result.status === 'lost' && (
              <button className="secondary-button icon-button" type="button" onClick={game.restart}><Icon name="restart" />Try again</button>
            )}
            {actions}
          </div>
          {game.playedLate && user && <p className="game-note">Played after its day: it counts on the leaderboard but not toward your streak.</p>}
        </div>
      )}
      {shareOpen && result && (
        <ShareDialog
          seed={game.seed}
          onClose={() => setShareOpen(false)}
          result={{
            dateLabel: boardTitle(game.seed),
            status: result.status,
            completion: result.completionPercentage,
            clicks: result.clicks,
            timeMs: result.timeMs,
            efficiency: result.efficiency,
            difficulty: game.difficulty,
          }}
        />
      )}
    </section>
  );
}
