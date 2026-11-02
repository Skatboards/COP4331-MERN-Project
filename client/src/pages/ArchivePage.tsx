const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const archiveResults = ['Solved in 2:18', 'Solved in 3:04', 'Not completed', 'Solved in 1:52', 'Solved in 2:41', 'Not played'];
const today = new Date();
const archiveDates = Array.from({ length: 6 }, (_, index) => {
  const date = new Date(today);
  date.setDate(date.getDate() - index - 1);
  return {
    day: index === 0 ? 'Yesterday' : new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date),
    date: dateFormatter.format(date),
    result: archiveResults[index],
  };
});

export default function ArchivePage() {
  return (
    <main className="subpage">
      <div className="page-heading">
        <div><span className="eyebrow">PAST PUZZLES</span><h1>Board archive</h1><p>Revisit the daily challenges and see how you did.</p></div>
        <span className="archive-count">6 DAYS</span>
      </div>
      <div className="archive-grid">
        {archiveDates.map((item, index) => (
          <article className="archive-card" key={item.date} aria-label={`${item.day}, ${item.date}: ${item.result}`}>
            <div className="archive-card-top"><span className="calendar-icon">▦</span><span className="archive-arrow">↗</span></div>
            <span className="archive-day">{item.day}</span>
            <strong>{item.date}</strong>
            <span className={`archive-result ${item.result === 'Not completed' ? 'result-muted' : ''}`}>{item.result}</span>
            <div className="mini-board" aria-hidden="true">
              {Array.from({ length: 25 }, (_, cell) => <i className={cell % (index + 3) === 0 ? 'mini-open' : ''} key={cell} />)}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
