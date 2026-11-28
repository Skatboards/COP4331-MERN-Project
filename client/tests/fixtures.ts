import { neighbors, ROWS, COLS, MINES, type Board } from '../src/game/minesweeper.ts';

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
