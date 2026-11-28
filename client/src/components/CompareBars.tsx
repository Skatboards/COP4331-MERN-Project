type CompareRow = {
  label: string;
  you: number;
  average: number;
  // How to print a value, e.g. (v) => `${v}%`
  format?: (value: number) => string;
  // The bar's full width; defaults to the larger value
  max?: number;
};

type CompareBarsProps = { rows: CompareRow[] };

// "You vs everyone": paired bars for the player and the board average
export default function CompareBars({ rows }: CompareBarsProps) {
  return (
    <div className="compare-bars">
      {rows.map((row) => {
        const format = row.format ?? ((value: number) => String(Math.round(value * 10) / 10));
        const max = row.max ?? Math.max(row.you, row.average, 1);
        return (
          <div className="compare-row" key={row.label}>
            <span className="compare-label">{row.label}</span>
            <div className="compare-line">
              <span>You</span>
              <span className="compare-track"><i className="compare-you" style={{ width: `${Math.min(100, (row.you / max) * 100)}%` }} /></span>
              <strong>{format(row.you)}</strong>
            </div>
            <div className="compare-line">
              <span>Average</span>
              <span className="compare-track"><i style={{ width: `${Math.min(100, (row.average / max) * 100)}%` }} /></span>
              <strong>{format(row.average)}</strong>
            </div>
          </div>
        );
      })}
    </div>
  );
}
