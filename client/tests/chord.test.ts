import test from 'node:test';
import assert from 'node:assert/strict';
import { generateBoard, neighbors, ROWS, COLS } from '../src/game/minesweeper.ts';
import { chordCell, newGame, revealCell, type GameState } from '../src/game/state.ts';

const CELLS = ROWS * COLS;
const B = generateBoard('chord');

function withNumber(): { s: GameState; i: number } {
  const s = newGame(B, 'chord');
  const i = s.revealed.find((r) => B.adjacent[r] > 0) as number;
  return { s, i };
}
const hiddenAround = (s: GameState, i: number) => neighbors(i).filter((n) => !s.revealed.includes(n));
const mineAround = (i: number) => neighbors(i).filter((n) => B.isMine[n]);

test('wrong flag count costs a click and changes nothing else', () => {
  const { s, i } = withNumber();
  const next = chordCell(B, s, i);
  assert.notEqual(next, s);
  assert.equal(next.clicks, s.clicks + 1);
  assert.deepEqual(next.revealed, s.revealed);
  assert.equal(next.status, 'playing');
});

test('blank, hidden, and finished cells are free no-ops', () => {
  const s = newGame(B, 'chord');
  const blank = s.revealed.find((r) => B.adjacent[r] === 0) as number;
  assert.equal(chordCell(B, s, blank), s);
  const hidden = [...Array(CELLS).keys()].find((n) => !s.revealed.includes(n)) as number;
  assert.equal(chordCell(B, s, hidden), s);
  const lost = revealCell(B, s, B.mineIndices[0]);
  const { i } = withNumber();
  assert.equal(chordCell(B, lost, i), lost);
});

test('correct flags open the rest for one click', () => {
  const { s, i } = withNumber();
  const flagged = { ...s, flags: mineAround(i) };
  const before = hiddenAround(flagged, i).filter((n) => !flagged.flags.includes(n));
  const next = chordCell(B, flagged, i);
  assert.equal(next.clicks, 1);
  for (const n of before) assert.ok(next.revealed.includes(n));
});

test('a wrong flag loses, with the lowest-index mine as explodedAt', () => {
  const { s, i } = withNumber();
  const mines = mineAround(i);
  const safe = hiddenAround(s, i).find((n) => !B.isMine[n]);
  if (safe === undefined) return;
  const flags = [...mines.slice(1), safe];
  const next = chordCell(B, { ...s, flags }, i);
  assert.equal(next.status, 'lost');
  assert.equal(next.explodedAt, mines[0]);
  assert.equal(next.clicks, 1);
});

test('chording with correct flags can win a whole board', () => {
  for (const seed of ['a', 'b', 'c', 'daily-2026-11-02']) {
    const b = generateBoard(seed);
    let s = newGame(b, seed);
    s = { ...s, flags: [...b.mineIndices] };
    let progress = true;
    while (s.status === 'playing' && progress) {
      progress = false;
      for (const r of [...s.revealed]) {
        const n = chordCell(b, s, r);
        if (n !== s) {
          if (n.revealed.length !== s.revealed.length) progress = true;
          s = n;
        }
      }
      if (!progress) {
        const h = [...Array(CELLS).keys()].find((n) => !b.isMine[n] && !s.revealed.includes(n));
        if (h !== undefined) {
          s = revealCell(b, s, h);
          progress = true;
        }
      }
    }
    assert.equal(s.status, 'won');
  }
});