import { useMinesweeper } from '../hooks/useMinesweeper';
import { dailySeed } from '../game/minesweeper';
import Board from '../components/Minesweeper/Board';
import ScoreCard from '../components/ScoreCard';

export default function HomePage() {
  const seed = dailySeed(new Date());
  const game = useMinesweeper(seed);
  return (
    <main className="home-content">
      <section className="board-card" aria-label="Today's Minesweeper board">
        <div className="board-topline">
          <div><span className="eyebrow">DAILY PUZZLE</span><h1>Today's board</h1></div>
          <span className="board-date">{new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())}</span>
        </div>
        <div className="game-toolbar" aria-live="polite">
          <span>Mines left: <strong>{game.minesLeft}</strong></span>
          <span>Clicks: <strong>{game.clicks}</strong></span>
          <button type="button" className={`text-button ${game.flagMode ? 'flag-mode-active' : ''}`} aria-pressed={game.flagMode} onClick={() => game.setFlagMode((value) => !value)}>Flag mode: {game.flagMode ? 'on' : 'off'}</button>
        </div>
        <div className="minesweeper-wrap">
          <Board board={game.board} game={game.game} flagMode={game.flagMode} onReveal={game.reveal} onFlag={game.flag} onChord={game.chord} />
        </div>
        {game.result && <p className="game-result" role="status">{game.result.status === 'won' ? `Board cleared in ${game.result.clicks} clicks · ${game.result.efficiency}% efficiency` : 'Game over. Come back tomorrow for a new board.'}</p>}
      </section>
      <ScoreCard />
    </main>
  );
}
