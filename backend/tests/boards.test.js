const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, useTestDatabase, createLoggedInUser } = require('./helpers');
const { Board, BoardAttempt } = require('../models');
const { todaySeed } = require('../lib/seeds');

// YYYY-MM-DD for a day relative to now (UTC)
function day(offset = 0) {
  return new Date(Date.now() + offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

useTestDatabase();

function play(user, seed, game) {
  return request(app)
    .post(`/api/boards/${seed}/attempts`)
    .set('Authorization', `Bearer ${user.token}`)
    .send(game);
}

describe('GET /api/boards', () => {
  test('lists boards, newest first', async () => {
    await Board.create({ seed: 'daily-old', createdAt: new Date('2026-01-01') });
    await Board.create({ seed: 'daily-new', createdAt: new Date('2026-02-01') });

    const res = await request(app).get('/api/boards').expect(200);
    assert.deepEqual(res.body.boards.map((b) => b.seed), ['daily-new', 'daily-old']);
  });
});

describe('GET /api/boards/:seed', () => {
  test("returns a board's stats", async () => {
    await Board.create({ seed: 'daily-1', totalAttempts: 4, totalCompletions: 3 });
    const res = await request(app).get('/api/boards/daily-1').expect(200);
    assert.equal(res.body.board.totalAttempts, 4);
    assert.equal(res.body.board.totalCompletions, 3);
  });

  test('returns zeroed stats for a board nobody has played, and 400 for a bad seed', async () => {
    const res = await request(app).get('/api/boards/daily-nope').expect(200);
    assert.equal(res.body.board.seed, 'daily-nope');
    assert.equal(res.body.board.totalCompletions, 0);
    await request(app).get('/api/boards/bad%20seed!').expect(400);
  });
});

describe('POST /api/boards/:seed/attempts', () => {
  test('records games and updates board and user stats', async () => {
    const alice = await createLoggedInUser();
    const bob = await createLoggedInUser();
    const carol = await createLoggedInUser();

    const first = await play(alice, 'daily-1', { clicks: 10, status: 'won', efficiency: 80 }).expect(201);
    assert.equal(first.body.attempt.completed, true);
    assert.equal(first.body.board.totalAttempts, 1);

    await play(bob, 'daily-1', { clicks: 20, status: 'won', efficiency: 90 }).expect(201);
    const last = await play(carol, 'daily-1', { clicks: 30, status: 'lost', efficiency: 99 }).expect(201);

    assert.equal(last.body.attempt.efficiency, 0);
    assert.deepEqual(
      {
        totalAttempts: last.body.board.totalAttempts,
        totalCompletions: last.body.board.totalCompletions,
        globalCompletionPercentage: last.body.board.globalCompletionPercentage,
        averageClicks: last.body.board.averageClicks,
        averageEfficiency: last.body.board.averageEfficiency
      },
      {
        totalAttempts: 3,
        totalCompletions: 2,
        globalCompletionPercentage: 66.67,
        averageClicks: 20,
        averageEfficiency: 85
      }
    );

    await play(alice, 'daily-2', { clicks: 5, status: 'won', efficiency: 100 }).expect(201);
    const me = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${alice.token}`)
      .expect(200);
    assert.equal(me.body.user.totalClicks, 15);
    assert.equal(me.body.user.boardsCompleted, 2);
    assert.equal(me.body.user.efficiency, 90);
  });

  test('allows only one game per user per board', async () => {
    const user = await createLoggedInUser();
    await play(user, 'daily-1', { clicks: 10, status: 'lost' }).expect(201);
    await play(user, 'daily-1', { clicks: 8, status: 'won', efficiency: 90 }).expect(409);

    const board = await Board.findOne({ seed: 'daily-1' });
    assert.equal(board.totalAttempts, 1);
  });

  test('rejects bad game data', async () => {
    const user = await createLoggedInUser();
    await play(user, 'daily-1', { clicks: -1, status: 'lost' }).expect(400);
    await play(user, 'daily-1', { clicks: 1.5, status: 'lost' }).expect(400);
    await play(user, 'daily-1', { clicks: 5, status: 'in_progress' }).expect(400);
    await play(user, 'daily-1', { clicks: 5, status: 'won' }).expect(400);
    await play(user, 'daily-1', { clicks: 5, status: 'won', efficiency: 101 }).expect(400);
  });

  test('stores the time, mode and final board, and marks on-time games', async () => {
    const user = await createLoggedInUser();
    const finalState = { revealed: [1, 2, 3], flags: [4], explodedAt: null };
    const today = await play(user, `daily-${day()}`, {
      clicks: 12, status: 'won', efficiency: 90, timeMs: 61000, finalState
    }).expect(201);
    assert.equal(today.body.attempt.timeMs, 61000);
    assert.equal(today.body.attempt.onTime, true);
    assert.equal(today.body.attempt.mode, 'daily');

    const late = await play(user, `daily-${day(-5)}`, {
      clicks: 20, status: 'lost', mode: 'archive', completionPercentage: 40
    }).expect(201);
    assert.equal(late.body.attempt.onTime, false);
    assert.equal(late.body.attempt.mode, 'archive');

    const saved = await BoardAttempt.findById(today.body.attempt.id);
    assert.deepEqual(saved.finalState, finalState);
  });

  test('rejects locked and pre-launch boards', async () => {
    const user = await createLoggedInUser();
    const locked = await play(user, `daily-${day(3)}`, { clicks: 1, status: 'lost' }).expect(403);
    assert.equal(locked.body.code, 'BOARD_LOCKED');
    // One day ahead is allowed for players east of UTC
    await play(user, `daily-${day(1)}`, { clicks: 1, status: 'lost' }).expect(201);
    const early = await play(user, 'daily-2020-01-01', { clicks: 1, status: 'lost' }).expect(403);
    assert.equal(early.body.code, 'BEFORE_LAUNCH');
  });

  test('rejects a bad time, mode or final board', async () => {
    const user = await createLoggedInUser();
    await play(user, 'daily-1', { clicks: 5, status: 'lost', timeMs: -1 }).expect(400);
    await play(user, 'daily-1', { clicks: 5, status: 'lost', timeMs: 1.5 }).expect(400);
    await play(user, 'daily-1', { clicks: 5, status: 'lost', mode: 'bot' }).expect(400);
    await play(user, 'daily-1', { clicks: 5, status: 'lost', finalState: { revealed: 'all' } }).expect(400);
  });

  test('requires login', async () => {
    await request(app)
      .post('/api/boards/daily-1/attempts')
      .send({ clicks: 1, status: 'lost' })
      .expect(401);
  });
});

describe('GET /api/boards/today', () => {
  test("returns the board for the server's date", async () => {
    const res = await request(app).get('/api/boards/today').expect(200);
    assert.equal(res.body.seed, todaySeed());
    assert.equal(res.body.date, todaySeed().slice('daily-'.length));
    assert.equal(res.body.rows, 16);
    assert.equal(res.body.cols, 16);
    assert.equal(res.body.mineCount, 40);
    assert.equal(res.body.mines.length, 40);
    assert.equal(res.body.adjacent.length, 256);
    assert.equal(res.body.mines.includes(res.body.start), false);
  });

  test('needs no login and gives everyone the same board', async () => {
    const a = await request(app).get('/api/boards/today').expect(200);
    const b = await request(app).get('/api/boards/today').expect(200);
    assert.deepEqual(a.body, b.body);
  });
});

describe('GET /api/boards/:seed/layout', () => {
  test("returns today's board and earlier boards", async () => {
    const today = await request(app).get(`/api/boards/${todaySeed()}/layout`).expect(200);
    const todayDirect = await request(app).get('/api/boards/today').expect(200);
    assert.deepEqual(today.body, todayDirect.body);

    const past = await request(app).get('/api/boards/daily-2026-11-02/layout').expect(200);
    assert.equal(past.body.seed, 'daily-2026-11-02');
    assert.equal(past.body.date, '2026-11-02');
    assert.equal(past.body.mines.length, 40);
  });

  test('refuses future days, unknown seeds and bad dates', async () => {
    const future = todaySeed(new Date(Date.now() + 48 * 60 * 60 * 1000));
    await request(app).get(`/api/boards/${future}/layout`).expect(404);
    await request(app).get('/api/boards/daily-2099-01-01/layout').expect(404);
    await request(app).get('/api/boards/daily-2026-02-30/layout').expect(404);
    await request(app).get('/api/boards/test-1/layout').expect(404);
    await request(app).get('/api/boards/bad%20seed!/layout').expect(400);
  });
});

describe('GET /api/boards/:seed/attempts', () => {
  test('lists the best finished games on a board', async () => {
    const slow = await createLoggedInUser();
    const fast = await createLoggedInUser();
    const loser = await createLoggedInUser();
    await play(slow, 'daily-1', { clicks: 20, status: 'won', efficiency: 70 }).expect(201);
    await play(loser, 'daily-1', { clicks: 3, status: 'lost' }).expect(201);
    await play(fast, 'daily-1', { clicks: 10, status: 'won', efficiency: 95 }).expect(201);

    const res = await request(app).get('/api/boards/daily-1/attempts').expect(200);
    assert.deepEqual(
      res.body.attempts.map((a) => a.username),
      [fast.username, slow.username, loser.username]
    );
  });

  test('breaks ties on clicks by time, and can sort by efficiency', async () => {
    const quick = await createLoggedInUser();
    const slow = await createLoggedInUser();
    const efficient = await createLoggedInUser();
    await play(slow, 'daily-1', { clicks: 10, status: 'won', efficiency: 80, timeMs: 90000 }).expect(201);
    await play(quick, 'daily-1', { clicks: 10, status: 'won', efficiency: 80, timeMs: 30000 }).expect(201);
    await play(efficient, 'daily-1', { clicks: 12, status: 'won', efficiency: 99 }).expect(201);

    const byResult = await request(app).get('/api/boards/daily-1/attempts').expect(200);
    assert.deepEqual(byResult.body.attempts.map((a) => a.username), [quick.username, slow.username, efficient.username]);
    assert.equal(byResult.body.attempts[0].timeMs, 30000);

    const byEfficiency = await request(app).get('/api/boards/daily-1/attempts?sort=efficiency').expect(200);
    assert.equal(byEfficiency.body.attempts[0].username, efficient.username);
    await request(app).get('/api/boards/daily-1/attempts?sort=bot').expect(400);
  });

  test('returns an empty list for a board nobody has played', async () => {
    const res = await request(app).get('/api/boards/daily-nope/attempts').expect(200);
    assert.deepEqual(res.body.attempts, []);
  });
});
