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

export function parClicks(board: Board): number {
  const total = board.rows * board.cols;
  const need = total - board.mineCount;
  let revealed = openingReveal(board);
  let clicks = 0;

  while (revealed.size < need) {
    let best = revealed;
    let bestGain = 0;

    for (const c of revealed) {
      if (board.adjacent[c] === 0) continue;
      const t = new Set(revealed);
      for (const n of neighbors(c, board.rows, board.cols)) {
        if (!t.has(n) && !board.isMine[n]) floodReveal(board, n, t);
      }
      if (t.size - revealed.size > bestGain) {
        bestGain = t.size - revealed.size;
        best = t;
      }
    }

    for (let i = 0; i < total; i++) {
      if (board.isMine[i] || revealed.has(i)) continue;
      const t = floodReveal(board, i, new Set(revealed));
      if (t.size - revealed.size > bestGain) {
        bestGain = t.size - revealed.size;
        best = t;
      }
    }

    revealed = best;
    clicks++;
  }
  return clicks;
}

export function efficiency(optimal: number, clicks: number): number {
  if (clicks <= 0) return 0;
  if (optimal <= 0) return 100;
  return Math.min(100, Math.round((optimal / clicks) * 10000) / 100);
}