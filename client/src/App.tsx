import './App.css';
import PlayPage from './pages/PlayPage.tsx';

export default function App() {
  if (window.location.pathname === '/play') {
    return <PlayPage />;
  }

  return (
    <div>
      <h2>Minesweeper demo</h2>
      <button type="button" onClick={() => window.location.assign('/play')}>
        Play
      </button>
    </div>
  );
}