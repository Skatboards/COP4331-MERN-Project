//TEMPORARY DO NOT MERGE INTO MAIN

import Board from './components/Minesweeper/Board.tsx';
import { useMinesweeper } from './hooks/useMinesweeper.ts';
import { dailySeed } from './game/minesweeper.ts';

const seed = dailySeed(new Date());

export default function App() {
  const m = useMinesweeper(seed);

  const reset = () => {
    try {
      localStorage.removeItem(`sweeple.game.${seed}`);
    } catch {
      //ignore
    }
    location.reload();
  };

  return (
    <div style={{ padding: 16, textAlign: 'center' }}>
      <p>Mines left: {m.minesLeft} | Clicks: {m.clicks}</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 8 }}>
        <button onClick={() => m.setFlagMode((v) => !v)}>Flag mode: {m.flagMode ? 'on' : 'off'}</button>
        <button onClick={reset}>Reset (testing only)</button>
      </div>

      <Board
        board={m.board}
        game={m.game}
        flagMode={m.flagMode}
        onReveal={m.reveal}
        onFlag={m.flag}
        onChord={m.chord}
      />

      <p>Seed: {seed}</p>
      {m.result && <pre>{JSON.stringify(m.result)}</pre>}
    </div>
  );
}