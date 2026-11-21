import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ScoreCard from '../components/ScoreCard';
import BoardPreview from '../components/BoardPreview';
import DifficultyBadge from '../components/DifficultyBadge';
import Icon, { type IconName } from '../components/Icon';
import { useBoardStats } from '../hooks/useBoardStats';
import { useSignInPrompt } from '../auth/signInPrompt';
import { boardDifficulty } from '../game/difficulty.ts';
import { generateBoard } from '../game/minesweeper.ts';
import { formatDate, todayKey, todaySeed } from '../game/dates.ts';
import { solvedByLabel } from '../game/share.ts';

const rules = [
  { title: 'Starting', copy: 'The board automatically reveals today\'s starting area.' },
  { title: 'Progressing', copy: 'Each number shows how many tiles in the 8 surrounding areas contain mines.' },
  { title: 'Flagging', copy: 'Flag tiles you believe contain mines.' },
  { title: 'Chording', copy: 'Click on numbers to reveal their adjacent tiles when the flags match the number.' },
  { title: 'Winning', copy: 'Reveal every safe tile to win.' },
];

const perks: { icon: IconName; title: string; copy: string }[] = [
  { icon: 'flame', title: 'Build a streak', copy: 'Clear a board every day and watch your streak grow. Miss one and you can still catch up from the archive.' },
  { icon: 'chart', title: 'Track your efficiency', copy: 'See your win rate, best score and where you rank against every other sweeper.' },
  { icon: 'shuffle', title: 'Play past boards', copy: 'Pull up any day since launch, or try a random one.' },
];

// Home for signed-out visitors
export default function LandingPage() {
  const openSignIn = useSignInPrompt();
  const navigate = useNavigate();
  const seed = todaySeed();
  const { minClicks, difficulty } = useMemo(() => boardDifficulty(generateBoard(seed)), [seed]);
  const stats = useBoardStats(seed);

  return (
    <main className="landing-page">
      <section className="landing-hero-card" aria-labelledby="hero-title">
        <div className="landing-hero-copy">
          <span className="eyebrow">DAILY MINESWEEPER · {formatDate(todayKey(), 'weekdayLong').toUpperCase()}</span>
          <h1 id="hero-title">One board a day.<br />The same board for everyone.</h1>
          <p className="landing-lede">Clear today’s 16 × 16 field in as few clicks as you can, then see how you stack up.</p>
          <DifficultyBadge difficulty={difficulty} minClicks={minClicks} />
          <p className="solved-by">Solved by <strong>{solvedByLabel(stats)}</strong> {stats?.totalCompletions === 1 ? 'player' : 'players'} today.</p>
          <div className="landing-cta">
            <Link className="primary-button icon-button" to="/play">Play today’s puzzle <Icon name="arrowRight" /></Link>
            <button className="secondary-button icon-button" type="button" onClick={() => openSignIn('share', () => navigate('/play'))}><Icon name="share" />Share</button>
            <button className="landing-login-button" type="button" onClick={() => openSignIn()}>Sign in</button>
          </div>
        </div>
        <Link className="landing-preview-link" to="/play" aria-label="Play today’s puzzle">
          <BoardPreview seed={seed} />
        </Link>
      </section>

      <section className="perk-grid" aria-label="Why sign in">
        {perks.map((perk) => (
          <article className="perk-card" key={perk.title}>
            <span className="perk-icon"><Icon name={perk.icon} size={20} /></span>
            <h2>{perk.title}</h2>
            <p>{perk.copy}</p>
          </article>
        ))}
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
