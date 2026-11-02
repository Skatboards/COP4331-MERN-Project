import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLS, MINES, ROWS, dailySeed, efficiency, generateBoard, neighbors, openingReveal, optimalClicks, parClicks,
} from '../src/game/minesweeper.ts';
import { newGame, parseSavedGame, revealCell, toggleFlag } from '../src/game/state.ts';

const CELLS = ROWS * COLS;

test('dailySeed matches the API format', () => {
  assert.equal(dailySeed(new Date(2026, 10, 2)), 'daily-2026-11-02');
  assert.equal(dailySeed(new Date(2026, 0, 5)), 'daily-2026-01-05');
});

test('same seed gives the same board, different seeds differ', () => {
  const a = generateBoard('daily-2026-11-02');
  assert.deepEqual(a.mineIndices, generateBoard('daily-2026-11-02').mineIndices);
  assert.notDeepEqual(a.mineIndices, generateBoard('daily-2026-11-03').mineIndices);
});

test('board has the right mines and correct adjacency counts', () => {
  const b = generateBoard('adj');
  assert.equal(b.mineIndices.length, MINES);
  assert.equal(b.isMine.filter(Boolean).length, MINES);
  for (let i = 0; i < CELLS; i++) {
    if (!b.isMine[i]) assert.equal(b.adjacent[i], neighbors(i).filter((n) => b.isMine[n]).length);
  }
});

test('neighbors handles corners and edges', () => {
  assert.equal(neighbors(0).length, 3);
  assert.equal(neighbors(1).length, 5);
  assert.equal(neighbors(COLS + 1).length, 8);
});

test('opening is safe and opens a region, for many seeds', () => {
  for (let n = 0; n < 50; n++) {
    const b = generateBoard(`seed-${n}`);
    assert.equal(b.isMine[b.start], false);
    const open = openingReveal(b);
    assert.ok(open.size > 1);
    for (const i of open) assert.equal(b.isMine[i], false);
  }
});

test('too many mines is rejected', () => {
  assert.throws(() => generateBoard('x', 4, 4, 10));
});

test('revealing: counts clicks, ignores no-ops, loses on a mine', () => {
  const b = generateBoard('play');
  let s = newGame(b, 'play');
  assert.equal(s.clicks, 0);

  assert.equal(revealCell(b, s, s.revealed[0]), s);
  const hidden = [...Array(CELLS).keys()].find((i) => !s.revealed.includes(i) && !b.isMine[i]) as number;
  const next = revealCell(b, s, hidden);
  assert.equal(next.clicks, 1);
  assert.ok(next.revealed.includes(hidden));

  s = toggleFlag(next, b.mineIndices[0]);
  assert.equal(revealCell(b, s, b.mineIndices[0]), s);
  s = toggleFlag(s, b.mineIndices[0]);
  const boom = revealCell(b, s, b.mineIndices[0]);
  assert.equal(boom.status, 'lost');
  assert.equal(boom.explodedAt, b.mineIndices[0]);
  assert.equal(revealCell(b, boom, hidden), boom);
});

test('a perfect game wins in exactly optimalClicks clicks (100% efficiency)', () => {
  for (const seed of ['a', 'b', 'c', 'daily-2026-11-02']) {
    const b = generateBoard(seed);
    const optimal = optimalClicks(b);
    let s = newGame(b, seed);
    const order = [...Array(CELLS).keys()].filter((i) => !b.isMine[i]).sort((x, y) => b.adjacent[x] - b.adjacent[y]);
    for (const i of order) s = revealCell(b, s, i);
    assert.equal(s.status, 'won');
    assert.equal(s.clicks, optimal);
    assert.equal(efficiency(optimal, s.clicks), 100);
  }
});

test('efficiency is a 0-100 number', () => {
  assert.equal(efficiency(50, 100), 50);
  assert.equal(efficiency(50, 40), 100);
  assert.equal(efficiency(10, 0), 0);
  assert.equal(efficiency(30, 70), 42.86);
});

test('parseSavedGame rejects bad or stale data', () => {
  const b = generateBoard('p');
  const good = JSON.stringify(newGame(b, 'p'));
  assert.ok(parseSavedGame(good, 'p', CELLS));
  assert.equal(parseSavedGame(good, 'other-seed', CELLS), null);
  assert.equal(parseSavedGame('{not json', 'p', CELLS), null);
  assert.equal(parseSavedGame(JSON.stringify({ ...newGame(b, 'p'), revealed: [9999] }), 'p', CELLS), null);
  assert.equal(parseSavedGame(null, 'p', CELLS), null);
});

test('par with chording is at most the no-chord baseline', () => {
  for (const seed of ['a', 'b', 'c', 'daily-2026-11-02']) {
    const b = generateBoard(seed);
    assert.ok(parClicks(b) <= optimalClicks(b));
  }
});