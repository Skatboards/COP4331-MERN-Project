import './App.css';
import LoginPage from './pages/LoginPage.tsx';
import PlayPage from './pages/PlayPage.tsx';

export default function App() {
  if (window.location.pathname === '/play') {
    return <PlayPage />;
  }

  return <LoginPage />;
}