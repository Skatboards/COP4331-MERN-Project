interface CellProps {
  index: number;
  row: number;
  col: number;
  revealed: boolean;
  adjacent: number;
  flagged: boolean;
  showMine: boolean;
  exploded: boolean;
  won: boolean;
  wrongFlag: boolean;
  finished: boolean;
  focusable: boolean;
  onActivate: (index: number) => void;
  onFlag: (index: number) => void;
  onFocusCell: (index: number) => void;
}

export default function Cell(p: CellProps) {
  const where = `Row ${p.row + 1}, column ${p.col + 1}`;
  let cls = 'ms-cell';
  let glyph = '';
  let label = `${where}, hidden`;

  if (p.revealed) {
    cls += ' ms-open';
    if (p.adjacent > 0) {
      cls += ` ms-n${p.adjacent}`;
      glyph = String(p.adjacent);
    }
    label = `${where}, ${p.adjacent} adjacent ${p.adjacent === 1 ? 'mine' : 'mines'}`;
  } else if (p.showMine) {
    cls += p.exploded ? ' ms-mine ms-boom' : ' ms-mine';
    glyph = p.won ? '⚑' : '✹';
    label = `${where}, mine`;
  } else if (p.wrongFlag) {
    cls += ' ms-wrong';
    glyph = '✕';
    label = `${where}, incorrect flag`;
  } else if (p.flagged) {
    cls += ' ms-flag';
    glyph = '⚑';
    label = `${where}, flagged`;
  }

  return (
    <button
      type="button"
      className={cls}
      data-index={p.index}
      aria-label={label}
      tabIndex={p.focusable ? 0 : -1}
      disabled={p.revealed || p.finished}
      onClick={() => p.onActivate(p.index)}
      onContextMenu={(e) => {
        e.preventDefault();
        p.onFlag(p.index);
      }}
      onFocus={() => p.onFocusCell(p.index)}
    >
      {glyph}
    </button>
  );
}