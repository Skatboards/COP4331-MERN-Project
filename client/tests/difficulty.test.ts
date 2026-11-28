import test from 'node:test';
import assert from 'node:assert/strict';
import { optimalClicks } from '../src/game/minesweeper.ts';
import { HARD_FROM, MEDIUM_FROM, boardDifficulty, difficultyFor, minClicksNeeded } from '../src/game/difficulty.ts';
import { generateBoard } from './fixtures.ts';

test('minClicksNeeded is the existing optimal-click count', () => {
  const board = generateBoard('daily-2026-11-12');
  assert.equal(minClicksNeeded(board), optimalClicks(board));
});

test('difficulty bands follow the cutoffs', () => {
  assert.equal(difficultyFor(MEDIUM_FROM - 1), 'Easy');
  assert.equal(difficultyFor(MEDIUM_FROM), 'Medium');
  assert.equal(difficultyFor(HARD_FROM - 1), 'Medium');
  assert.equal(difficultyFor(HARD_FROM), 'Hard');
});

test('the same seed always gets the same difficulty', () => {
  const a = boardDifficulty(generateBoard('daily-2026-11-12'));
  const b = boardDifficulty(generateBoard('daily-2026-11-12'));
  assert.deepEqual(a, b);
  assert.ok(a.minClicks > 0);
});

test('a year of boards lands in all three bands', () => {
  const counts = { Easy: 0, Medium: 0, Hard: 0 };
  for (let day = 0; day < 365; day++) {
    const date = new Date(Date.UTC(2026, 0, 1) + day * 86400000).toISOString().slice(0, 10);
    counts[boardDifficulty(generateBoard(`daily-${date}`)).difficulty] += 1;
  }
  for (const count of Object.values(counts)) assert.ok(count > 60, JSON.stringify(counts));
});
