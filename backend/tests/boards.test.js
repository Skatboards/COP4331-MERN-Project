const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, useTestDatabase, createLoggedInUser } = require('./helpers');
const { Board } = require('../models');

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

  test('returns 404 for an unknown board and 400 for a bad seed', async () => {
    await request(app).get('/api/boards/daily-nope').expect(404);
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

  test('requires login', async () => {
    await request(app)
      .post('/api/boards/daily-1/attempts')
      .send({ clicks: 1, status: 'lost' })
      .expect(401);
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

  test('returns 404 for an unknown board', async () => {
    await request(app).get('/api/boards/daily-nope/attempts').expect(404);
  });
});
