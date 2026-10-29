const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, useTestDatabase, createLoggedInUser } = require('./helpers');
const { User } = require('../models');

useTestDatabase();

describe('GET /api/users/me', () => {
  test('returns the logged-in user', async () => {
    const user = await createLoggedInUser();
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);
    assert.equal(res.body.user.username, user.username);
    assert.equal(res.body.user.email, user.email);
  });

  test('requires a valid login token', async () => {
    await request(app).get('/api/users/me').expect(401);
    await request(app).get('/api/users/me').set('Authorization', 'Bearer not-a-jwt').expect(401);
  });
});

describe('GET /api/users/me/attempts', () => {
  test("lists the user's games, newest first", async () => {
    const user = await createLoggedInUser();
    const auth = `Bearer ${user.token}`;
    await request(app)
      .post('/api/boards/daily-1/attempts')
      .set('Authorization', auth)
      .send({ clicks: 10, status: 'lost' })
      .expect(201);
    await request(app)
      .post('/api/boards/daily-2/attempts')
      .set('Authorization', auth)
      .send({ clicks: 12, status: 'won', efficiency: 90 })
      .expect(201);

    const res = await request(app)
      .get('/api/users/me/attempts')
      .set('Authorization', auth)
      .expect(200);
    assert.deepEqual(
      res.body.attempts.map((a) => [a.seed, a.status]),
      [
        ['daily-2', 'won'],
        ['daily-1', 'lost']
      ]
    );
  });

  test('requires login', async () => {
    await request(app).get('/api/users/me/attempts').expect(401);
  });
});

describe('GET /api/users/search', () => {
  test('finds players by part of a username or name, without emails', async () => {
    await createLoggedInUser({ username: 'minesweeper', firstName: 'Grace' });
    await createLoggedInUser({ username: 'someone_else', firstName: 'Linus' });

    const byUsername = await request(app).get('/api/users/search?q=SWEEP').expect(200);
    assert.deepEqual(byUsername.body.users.map((u) => u.username), ['minesweeper']);
    assert.equal(byUsername.body.users[0].email, undefined);

    const byName = await request(app).get('/api/users/search?q=linus').expect(200);
    assert.deepEqual(byName.body.users.map((u) => u.username), ['someone_else']);
  });

  test('treats regex characters as plain text', async () => {
    await createLoggedInUser();
    const res = await request(app).get('/api/users/search?q=.*').expect(200);
    assert.deepEqual(res.body.users, []);
  });

  test('requires search text', async () => {
    await request(app).get('/api/users/search').expect(400);
  });
});

describe('GET /api/users/leaderboard', () => {
  test('ranks players by the chosen stat', async () => {
    const a = await createLoggedInUser();
    const b = await createLoggedInUser();
    await User.updateOne({ username: a.username }, { boardsCompleted: 3, efficiency: 50 });
    await User.updateOne({ username: b.username }, { boardsCompleted: 1, efficiency: 95 });

    const byBoards = await request(app).get('/api/users/leaderboard').expect(200);
    assert.deepEqual(byBoards.body.users.map((u) => u.username), [a.username, b.username]);

    const byEfficiency = await request(app)
      .get('/api/users/leaderboard?sort=efficiency&limit=1')
      .expect(200);
    assert.deepEqual(byEfficiency.body.users.map((u) => u.username), [b.username]);
    assert.equal(byEfficiency.body.users[0].email, undefined);
  });

  test('rejects an unknown sort', async () => {
    await request(app).get('/api/users/leaderboard?sort=email').expect(400);
  });
});
