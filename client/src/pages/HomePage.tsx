import BoardPlaceholder from '../components/BoardPlaceholder';
import ScoreCard from '../components/ScoreCard';

export default function HomePage() {
  return (
    <main className="home-content">
      <BoardPlaceholder />
      <ScoreCard />
    </main>
  );
}
