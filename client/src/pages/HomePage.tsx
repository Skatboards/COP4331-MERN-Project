import { useCallback, useState } from 'react';
import { useMinesweeper } from '../hooks/useMinesweeper';
import { useBoardStats } from '../hooks/useBoardStats';
import { formatDate, todayKey, todaySeed } from '../game/dates.ts';
import GameView from '../components/GameView';
import ScoreCard from '../components/ScoreCard';

// Today's board (/play)
export default function HomePage() {
  const [seed] = useState(() => todaySeed());
  const [recorded, setRecorded] = useState(0);
  const onRecorded = useCallback(() => setRecorded((value) => value + 1), []);
  const game = useMinesweeper(seed, { mode: 'daily', onRecorded });
  const stats = useBoardStats(seed, recorded);
  return (
    <main className="home-content play-layout">
      <GameView
        game={game}
        eyebrow="DAILY PUZZLE"
        title="Today's board"
        aside={formatDate(todayKey())}
        stats={stats}
        lostMessage="Game over. Come back tomorrow for a new board, or try a random one."
      />
      <ScoreCard seed={seed} title="Today's leaderboard" reloadKey={recorded} />
    </main>
  );
}
