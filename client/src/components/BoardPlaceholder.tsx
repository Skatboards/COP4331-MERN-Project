const revealedCells = new Set([10, 11, 20, 31, 47, 48, 57, 70]);
const numberedCells = new Map([[10, '1'], [20, '2'], [31, '1'], [47, '1'], [57, '1']]);

export default function BoardPlaceholder() {
  const today = new Date();
  const date = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(today);

  return (
    <section className="board-card" aria-label="Today's Minesweeper board">
      <div className="board-topline">
        <h1>Today's board</h1>
        <span className="board-date">{date}</span>
      </div>
      <div className="board-placeholder">
        <div className="board-grid" aria-hidden="true">
          {Array.from({ length: 81 }, (_, index) => (
            <span className={`board-cell ${revealedCells.has(index) ? 'revealed' : ''}`} key={index}>
              {numberedCells.has(index) && <b>{numberedCells.get(index)}</b>}
            </span>
          ))}
        </div>
        <div className="board-note"><span className="note-icon">✳</span><strong>Game board coming soon</strong></div>
      </div>
    </section>
  );
}
