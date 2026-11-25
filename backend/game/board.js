const ROWS = 16;
const COLS = 16;
const MINES = 40;

const DAILY_SEED = /^daily-(\d{4})-(\d{2})-(\d{2})$/;

function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function neighbors(index, rows = ROWS, cols = COLS) {
  const r = Math.floor(index / cols);
  const c = index % cols;
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push(nr * cols + nc);
    }
  }
  return out;
}

function generateBoard(seed, rows = ROWS, cols = COLS, mineCount = MINES) {
  const total = rows * cols;
  if (mineCount >= total - 9) throw new Error('Too many mines for this board size');

  const rand = mulberry32(hashString(seed));

  const order = Array.from({ length: total }, (_, i) => i);
  for (let i = total - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const mineIndices = order.slice(0, mineCount).sort((a, b) => a - b);
  const isMine = new Array(total).fill(false);
  for (const i of mineIndices) isMine[i] = true;

  const adjacent = new Array(total).fill(0);
  for (let i = 0; i < total; i++) {
    if (isMine[i]) continue;
    adjacent[i] = neighbors(i, rows, cols).filter((n) => isMine[n]).length;
  }

  const zeros = [];
  let fallback = -1;
  for (let i = 0; i < total; i++) {
    if (isMine[i]) continue;
    if (adjacent[i] === 0) zeros.push(i);
    if (fallback === -1 || adjacent[i] < adjacent[fallback]) fallback = i;
  }
  const start = zeros.length ? zeros[Math.floor(rand() * zeros.length)] : fallback;

  return { rows, cols, mineCount, isMine, adjacent, mineIndices, start };
}

// Today's date on the server, in one time zone for everyone (default US Eastern)
function todayKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.BOARD_TIMEZONE || 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

function todaySeed(now) {
  return `daily-${todayKey(now)}`;
}

// "2026-11-12" for a real daily seed, otherwise null
function seedDate(seed) {
  const match = DAILY_SEED.exec(seed);
  if (!match) return null;
  const [, y, m, d] = match;
  const parsed = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  const real =
    parsed.getUTCFullYear() === Number(y) &&
    parsed.getUTCMonth() === Number(m) - 1 &&
    parsed.getUTCDate() === Number(d);
  return real ? `${y}-${m}-${d}` : null;
}

// Today and earlier days can be played or viewed; future days cannot
function isAvailableSeed(seed, now) {
  const date = seedDate(seed);
  return date !== null && date <= todayKey(now);
}

function layoutOf(seed) {
  const board = generateBoard(seed);
  return {
    seed,
    date: seedDate(seed),
    rows: board.rows,
    cols: board.cols,
    mineCount: board.mineCount,
    mines: board.mineIndices,
    adjacent: board.adjacent,
    start: board.start
  };
}

module.exports = {
  ROWS, COLS, MINES,
  generateBoard, neighbors, todayKey, todaySeed, seedDate, isAvailableSeed, layoutOf
};
