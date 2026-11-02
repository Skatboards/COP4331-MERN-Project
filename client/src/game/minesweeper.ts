export const ROWS = 16;
export const COLS = 16;
export const MINES = 40;

export interface Board {
  rows: number;
  cols: number;
  mineCount: number;
  isMine: boolean[];
  adjacent: number[];
  mineIndices: number[];
  start: number;
}

export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dailySeed(date: Date): string {
  return `daily-${dateKey(date)}`;
}

function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function neighbors(index: number, rows = ROWS, cols = COLS): number[] {
  const r = Math.floor(index / cols);
  const c = index % cols;
  const out: number[] = [];
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

export function generateBoard(seed: string, rows = ROWS, cols = COLS, mineCount = MINES): Board {
  const total = rows * cols;
  if (mineCount >= total - 9) throw new Error('Too many mines for this board size');

  const rand = mulberry32(hashString(seed));

  const order = Array.from({ length: total }, (_, i) => i);
  for (let i = total - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const mineIndices = order.slice(0, mineCount).sort((a, b) => a - b);
  const isMine: boolean[] = new Array<boolean>(total).fill(false);
  for (const i of mineIndices) isMine[i] = true;

  const adjacent: number[] = new Array<number>(total).fill(0);
  for (let i = 0; i < total; i++) {
    if (isMine[i]) continue;
    adjacent[i] = neighbors(i, rows, cols).filter((n) => isMine[n]).length;
  }

  const zeros: number[] = [];
  let fallback = -1;
  for (let i = 0; i < total; i++) {
    if (isMine[i]) continue;
    if (adjacent[i] === 0) zeros.push(i);
    if (fallback === -1 || adjacent[i] < adjacent[fallback]) fallback = i;
  }
  const start = zeros.length ? zeros[Math.floor(rand() * zeros.length)] : fallback;

  return { rows, cols, mineCount, isMine, adjacent, mineIndices, start };
}

export function floodReveal(board: Board, index: number, revealed: Set<number>): Set<number> {
  const stack = [index];
  while (stack.length) {
    const i = stack.pop() as number;
    if (revealed.has(i) || board.isMine[i]) continue;
    revealed.add(i);
    if (board.adjacent[i] === 0) {
      for (const n of neighbors(i, board.rows, board.cols)) {
        if (!revealed.has(n)) stack.push(n);
      }
    }
  }
  return revealed;
}

export function openingReveal(board: Board): Set<number> {
  return floodReveal(board, board.start, new Set<number>());
}

export function isWon(board: Board, revealed: Set<number>): boolean {
  return revealed.size === board.rows * board.cols - board.mineCount;
}

export function optimalClicks(board: Board): number {
  const total = board.rows * board.cols;
  const revealed = openingReveal(board);
  let clicks = 0;

  for (let i = 0; i < total; i++) {
    if (!board.isMine[i] && board.adjacent[i] === 0 && !revealed.has(i)) {
      floodReveal(board, i, revealed);
      clicks++;
    }
  }
  for (let i = 0; i < total; i++) {
    if (!board.isMine[i] && !revealed.has(i)) clicks++;
  }
  return clicks;
}

export function efficiency(optimal: number, clicks: number): number {
  if (clicks <= 0) return 0;
  if (optimal <= 0) return 100;
  return Math.min(100, Math.round((optimal / clicks) * 10000) / 100);
}