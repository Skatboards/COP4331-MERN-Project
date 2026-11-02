const scores = [
  { name: 'MossyBadger', time: '00:42' },
  { name: 'pixelpete', time: '00:51' },
  { name: 'you', time: '01:08' },
];

export default function ScoreCard() {
  return (
    <section className="scores-card">
      <div className="section-heading"><h2>Daily top scores</h2><span className="trophy" aria-hidden="true">✦</span></div>
      <ol className="score-list">
        {scores.map((score, index) => (
          <li key={score.name}>
            <span className={`rank rank-${index + 1}`}>{String(index + 1).padStart(2, '0')}</span>
            <span className="score-name">{score.name}</span>
            <time>{score.time}</time>
          </li>
        ))}
      </ol>
    </section>
  );
}
