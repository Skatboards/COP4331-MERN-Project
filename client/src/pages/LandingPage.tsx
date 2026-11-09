import { Link } from 'react-router-dom';
import ScoreCard from '../components/ScoreCard';

type LandingPageProps = { onSignIn: () => void; isAuthenticated: boolean };

const rules = [
  { title: 'Starting', copy: 'The board automatically reveals today\'s starting area.' },
  { title: 'Progressing', copy: 'Each number shows how many tiles in the 8 surrounding areas contain mines.' },
  { title: 'Flagging', copy: 'Flag tiles you believe contain mines.' },
  { title: 'Chording', copy: 'Click on numbers to reveal their adjacent tiles when the flags match the number.' },
  { title: 'Winning', copy: 'Reveal every safe tile to win.' },
];

const previewTiles = Array.from({ length: 25 }, () => '');

export default function LandingPage({ onSignIn, isAuthenticated }: LandingPageProps) {
  return (
    <main className="landing-page">
      <section className="landing-hero">
        <div className="landing-actions">
          <Link className="landing-board-link" to="/play" aria-label="Play today’s puzzle">
            <span className="landing-preview-board" aria-hidden="true">
              {previewTiles.map((value, index) => (
                <span key={index} className="landing-preview-tile">{value}</span>
              ))}
            </span>
            <span className="landing-board-label">Play today’s puzzle <span aria-hidden="true">→</span></span>
          </Link>
          {!isAuthenticated && <button className="landing-login-button" type="button" onClick={onSignIn}>Sign in</button>}
        </div>
      </section>

      <section className="rules-section" aria-labelledby="rules-title">
        <div className="rules-heading">
          <h2 id="rules-title">How to play</h2>
        </div>
        <div className="rules-grid">
          {rules.map((rule, index) => (
            <article className="rule-card" key={rule.title}>
              <span className="rule-number">{String(index + 1).padStart(2, '0')}</span>
              <h3>{rule.title}</h3>
              <p>{rule.copy}</p>
            </article>
          ))}
        </div>
        <a className="landing-help-link" href="https://minesweeper.online/help/gameplay" target="_blank" rel="noreferrer">
          More detailed Minesweeper help <span aria-hidden="true">↗</span>
        </a>
      </section>
      <ScoreCard />
    </main>
  );
}
