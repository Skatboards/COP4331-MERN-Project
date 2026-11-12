const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  COLS, MINES, ROWS, generateBoard, isAvailableSeed, layoutOf, neighbors, seedDate, todayKey, todaySeed
} = require('../game/board');

const CELLS = ROWS * COLS;

// Boards the old in-browser generator produced; the backend must match them
const GOLDEN = {
  'daily-2026-11-02': {
    mines: [9, 13, 16, 21, 28, 39, 45, 49, 52, 59, 71, 72, 88, 91, 94, 112, 125, 128, 137, 138, 140, 145, 148, 160, 164, 168, 175, 180, 181, 182, 183, 191, 204, 215, 216, 230, 235, 247, 249, 255],
    start: 253,
    adjacentSum: 243
  },
  'daily-2026-01-05': {
    mines: [10, 11, 19, 25, 46, 49, 58, 71, 87, 88, 90, 99, 105, 107, 109, 110, 121, 126, 134, 136, 142, 144, 161, 163, 166, 170, 173, 191, 197, 199, 210, 212, 215, 217, 218, 225, 239, 245, 248, 250],
    start: 69,
    adjacentSum: 258
  },
  'a': {
    mines: [0, 10, 16, 22, 27, 32, 41, 62, 63, 84, 94, 101, 108, 109, 124, 131, 132, 134, 142, 145, 146, 148, 151, 155, 158, 164, 166, 169, 174, 181, 182, 184, 194, 203, 216, 225, 232, 234, 247, 252],
    start: 80,
    adjacentSum: 245
  }
};

describe('generateBoard', () => {
  test('matches the boards the old client-side generator made', () => {
    for (const [seed, expected] of Object.entries(GOLDEN)) {
      const board = generateBoard(seed);
      assert.deepEqual(board.mineIndices, expected.mines);
      assert.equal(board.start, expected.start);
      assert.equal(board.adjacent.reduce((sum, n) => sum + n, 0), expected.adjacentSum);
    }
  });

  test('same seed gives the same board, different seeds differ', () => {
    const a = generateBoard('daily-2026-11-02');
    assert.deepEqual(a.mineIndices, generateBoard('daily-2026-11-02').mineIndices);
    assert.notDeepEqual(a.mineIndices, generateBoard('daily-2026-11-03').mineIndices);
  });

  test('has the right mines and correct adjacency counts', () => {
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

  test('the starting cell is a safe blank, for many seeds', () => {
    for (let n = 0; n < 50; n++) {
      const b = generateBoard(`seed-${n}`);
      assert.equal(b.isMine[b.start], false);
      assert.equal(b.adjacent[b.start], 0);
    }
  });

  test('too many mines is rejected', () => {
    assert.throws(() => generateBoard('x', 4, 4, 10));
  });
});

describe('server date', () => {
  test('rolls over at midnight US Eastern by default', () => {
    assert.equal(todaySeed(new Date('2026-11-13T04:59:00Z')), 'daily-2026-11-12');
    assert.equal(todaySeed(new Date('2026-11-13T05:00:00Z')), 'daily-2026-11-13');
  });

  test('the time zone can be changed', () => {
    const before = process.env.BOARD_TIMEZONE;
    process.env.BOARD_TIMEZONE = 'UTC';
    try {
      assert.equal(todayKey(new Date('2026-11-13T00:30:00Z')), '2026-11-13');
    } finally {
      if (before === undefined) delete process.env.BOARD_TIMEZONE;
      else process.env.BOARD_TIMEZONE = before;
    }
  });

  test('only real dates are daily seeds', () => {
    assert.equal(seedDate('daily-2026-11-12'), '2026-11-12');
    assert.equal(seedDate('daily-2026-02-30'), null);
    assert.equal(seedDate('daily-1'), null);
    assert.equal(seedDate('anything'), null);
  });

  test('today and earlier are available, later days are not', () => {
    const now = new Date('2026-11-12T17:00:00Z');
    assert.equal(isAvailableSeed('daily-2026-11-12', now), true);
    assert.equal(isAvailableSeed('daily-2026-11-11', now), true);
    assert.equal(isAvailableSeed('daily-2026-11-13', now), false);
    assert.equal(isAvailableSeed('daily-2027-01-01', now), false);
    assert.equal(isAvailableSeed('daily-2026-02-30', now), false);
    assert.equal(isAvailableSeed('test-1', now), false);
  });
});

describe('layoutOf', () => {
  test('sends everything the client needs to draw the board', () => {
    const layout = layoutOf('daily-2026-11-02');
    const board = generateBoard('daily-2026-11-02');
    assert.equal(layout.seed, 'daily-2026-11-02');
    assert.equal(layout.date, '2026-11-02');
    assert.equal(layout.rows, ROWS);
    assert.equal(layout.cols, COLS);
    assert.equal(layout.mineCount, MINES);
    assert.deepEqual(layout.mines, board.mineIndices);
    assert.deepEqual(layout.adjacent, board.adjacent);
    assert.equal(layout.start, board.start);
  });
});
