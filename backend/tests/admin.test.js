const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  app,
  request,
  sentEmails,
  useTestDatabase,
  createLoggedInUser
} = require('./helpers');
const { User, Board, BoardAttempt } = require('../models');
const { promoteSiteAdmins, roleForEmail } = require('../lib/bootstrapAdmins');
const { recomputeUserStats } = require('../lib/stats');
const { setRole } = require('../scripts/set-role');

useTestDatabase();

function as(user) {
  return `Bearer ${user.token}`;
}

async function play(user, seed, result) {
  await request(app)
    .post(`/api/boards/${seed}/attempts`)
    .set('Authorization', as(user))
    .send(result)
    .expect(201);
}

describe('access to /api/admin', () => {
  test('needs a login', async () => {
    await request(app).get('/api/admin/users').expect(401);
  });

  test('refuses regular users on every route', async () => {
    const user = await createLoggedInUser();
    const other = await createLoggedInUser();
    const auth = as(user);
    const forbidden = { error: 'Not allowed', code: 'FORBIDDEN' };

    const responses = await Promise.all([
      request(app).get('/api/admin/users').set('Authorization', auth),
      request(app).get(`/api/admin/users/${other.id}`).set('Authorization', auth),
      request(app).post('/api/admin/users').set('Authorization', auth).send({}),
      request(app).patch(`/api/admin/users/${other.id}`).set('Authorization', auth).send({}),
      request(app).post(`/api/admin/users/${other.id}/password-reset`).set('Authorization', auth),
      request(app).delete(`/api/admin/users/${other.id}`).set('Authorization', auth)
    ]);
    for (const res of responses) {
      assert.equal(res.status, 403);
      assert.deepEqual(res.body, forbidden);
    }
  });

  test('reads the role from the database, so a demotion applies at once', async () => {
    const admin = await createLoggedInUser({ role: 'admin' });
    await request(app).get('/api/admin/users').set('Authorization', as(admin)).expect(200);

    await User.updateOne({ _id: admin.id }, { role: 'user' });
    await request(app).get('/api/admin/users').set('Authorization', as(admin)).expect(403);
  });

  test('refuses the token of a deleted account', async () => {
    const admin = await createLoggedInUser({ role: 'admin' });
    await User.deleteOne({ _id: admin.id });
    await request(app).get('/api/admin/users').set('Authorization', as(admin)).expect(401);
  });

  test('/api/users/me reports the role', async () => {
    const admin = await createLoggedInUser({ role: 'admin' });
    const res = await request(app).get('/api/users/me').set('Authorization', as(admin)).expect(200);
    assert.equal(res.body.user.role, 'admin');
  });
});

describe('admins', () => {
  test('list only regular users, with search and paging', async () => {
    const admin = await createLoggedInUser({ role: 'admin' });
    await createLoggedInUser({ role: 'admin' });
    await createLoggedInUser({ role: 'siteadmin' });
    const ada = await createLoggedInUser({ username: 'ada_l', firstName: 'Ada' });
    await createLoggedInUser({ username: 'bob_b' });

    const res = await request(app).get('/api/admin/users').set('Authorization', as(admin)).expect(200);
    assert.deepEqual(res.body.users.map((u) => u.username), ['ada_l', 'bob_b']);
    assert.equal(res.body.total, 2);
    assert.equal(res.body.users[0].email, ada.email);
    assert.equal(res.body.users[0].role, 'user');
    assert.equal(res.body.users[0].manageable, true);
    assert.equal(res.body.users[0].hasPassword, true);
    assert.equal(res.body.users[0].passwordHash, undefined);

    const search = await request(app)
      .get('/api/admin/users?q=ADA')
      .set('Authorization', as(admin))
      .expect(200);
    assert.deepEqual(search.body.users.map((u) => u.username), ['ada_l']);

    const page2 = await request(app)
      .get('/api/admin/users?limit=1&page=2')
      .set('Authorization', as(admin))
      .expect(200);
    assert.deepEqual(page2.body.users.map((u) => u.username), ['bob_b']);
    assert.equal(page2.body.total, 2);

    await request(app).get('/api/admin/users?role=admin').set('Authorization', as(admin)).expect(403);
    await request(app).get('/api/admin/users?role=boss').set('Authorization', as(admin)).expect(400);
  });

  test('create a verified user who is emailed a link to set a password', async () => {
    const admin = await createLoggedInUser({ role: 'admin' });
    sentEmails.length = 0;

    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', as(admin))
      .send({ username: 'newbie', email: 'NewBie@Example.com', firstName: 'New' })
      .expect(201);
    assert.equal(res.body.user.username, 'newbie');
    assert.equal(res.body.user.email, 'newbie@example.com');
    assert.equal(res.body.user.role, 'user');
    assert.equal(res.body.user.emailVerified, true);
    assert.equal(res.body.user.hasPassword, false);

    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].to, 'newbie@example.com');
    assert.match(sentEmails[0].text, /reset-password\?token=/);
  });

  test('create a user with a password who can log in at once', async () => {
    const admin = await createLoggedInUser({ role: 'admin' });
    await request(app)
      .post('/api/admin/users')
      .set('Authorization', as(admin))
      .send({ username: 'withpass', email: 'withpass@example.com', password: 'long-enough-pw' })
      .expect(201);
    await request(app)
      .post('/api/auth/login')
      .send({ login: 'withpass', password: 'long-enough-pw' })
      .expect(200);
  });

  test('get validation and duplicate errors when creating', async () => {
    const admin = await createLoggedInUser({ role: 'admin' });
    const taken = await createLoggedInUser();
    const post = (body) =>
      request(app).post('/api/admin/users').set('Authorization', as(admin)).send(body);

    await post({ username: 'x', email: 'x@example.com' }).expect(400);
    await post({ username: 'okname', email: 'not-an-email' }).expect(400);
    await post({ username: 'okname', email: 'ok@example.com', password: 'short' }).expect(400);

    const dupName = await post({ username: taken.username, email: 'fresh@example.com' }).expect(409);
    assert.equal(dupName.body.error, 'Username is already in use');
    const dupEmail = await post({ username: 'freshname', email: taken.email }).expect(409);
    assert.equal(dupEmail.body.error, 'Email is already in use');
  });

  test('cannot create or promote to admin', async () => {
    const admin = await createLoggedInUser({ role: 'admin' });
    const user = await createLoggedInUser();
    await request(app)
      .post('/api/admin/users')
      .set('Authorization', as(admin))
      .send({ username: 'wannabe', email: 'wannabe@example.com', role: 'admin' })
      .expect(403);
    await request(app)
      .patch(`/api/admin/users/${user.id}`)
      .set('Authorization', as(admin))
      .send({ role: 'admin' })
      .expect(403);
    assert.equal((await User.findById(user.id)).role, 'user');
  });

  test('edit a user', async () => {
    const admin = await createLoggedInUser({ role: 'admin' });
    const user = await createLoggedInUser();
    const res = await request(app)
      .patch(`/api/admin/users/${user.id}`)
      .set('Authorization', as(admin))
      .send({ firstName: ' Grace ', username: 'grace_h', email: 'Grace@Example.com', emailVerified: false })
      .expect(200);
    assert.equal(res.body.user.firstName, 'Grace');
    assert.equal(res.body.user.username, 'grace_h');
    assert.equal(res.body.user.email, 'grace@example.com');
    assert.equal(res.body.user.emailVerified, false);
    assert.equal(res.body.user.lastName, 'Player');

    await request(app)
      .patch(`/api/admin/users/${user.id}`)
      .set('Authorization', as(admin))
      .send({ emailVerified: 'yes' })
      .expect(400);
  });

  test('get a 409 when an edit takes another account\'s username', async () => {
    const admin = await createLoggedInUser({ role: 'admin' });
    const user = await createLoggedInUser();
    const other = await createLoggedInUser();
    const res = await request(app)
      .patch(`/api/admin/users/${user.id}`)
      .set('Authorization', as(admin))
      .send({ username: other.username })
      .expect(409);
    assert.equal(res.body.error, 'Username is already in use');
  });

  test('cannot see, edit, reset, or delete admins and site admins', async () => {
    const admin = await createLoggedInUser({ role: 'admin' });
    for (const role of ['admin', 'siteadmin']) {
      const target = await createLoggedInUser({ role });
      const auth = as(admin);
      await request(app).get(`/api/admin/users/${target.id}`).set('Authorization', auth).expect(403);
      await request(app)
        .patch(`/api/admin/users/${target.id}`)
        .set('Authorization', auth)
        .send({ firstName: 'Hacked' })
        .expect(403);
      await request(app)
        .post(`/api/admin/users/${target.id}/password-reset`)
        .set('Authorization', auth)
        .expect(403);
      await request(app).delete(`/api/admin/users/${target.id}`).set('Authorization', auth).expect(403);
      assert.ok(await User.exists({ _id: target.id }));
    }
  });

  test('send a password reset email', async () => {
    const admin = await createLoggedInUser({ role: 'admin' });
    const user = await createLoggedInUser();
    sentEmails.length = 0;
    await request(app)
      .post(`/api/admin/users/${user.id}/password-reset`)
      .set('Authorization', as(admin))
      .expect(200);
    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].to, user.email);
  });

  test('get 404 for unknown or malformed ids', async () => {
    const admin = await createLoggedInUser({ role: 'admin' });
    await request(app)
      .get('/api/admin/users/64b000000000000000000000')
      .set('Authorization', as(admin))
      .expect(404);
    await request(app).get('/api/admin/users/not-an-id').set('Authorization', as(admin)).expect(404);
  });
});

describe('deleting a user', () => {
  test('removes their games and recomputes the stats of boards they played', async () => {
    const admin = await createLoggedInUser({ role: 'admin' });
    const keep = await createLoggedInUser();
    const gone = await createLoggedInUser();
    await play(keep, 'daily-2026-11-01', { clicks: 10, status: 'won', efficiency: 80 });
    await play(gone, 'daily-2026-11-01', { clicks: 30, status: 'lost' });
    await play(gone, 'daily-2026-11-02', { clicks: 20, status: 'won', efficiency: 50 });

    await request(app)
      .delete(`/api/admin/users/${gone.id}`)
      .set('Authorization', as(admin))
      .expect(200);

    assert.equal(await User.exists({ _id: gone.id }), null);
    assert.equal(await BoardAttempt.countDocuments({ userId: gone.id }), 0);

    const shared = await Board.findOne({ seed: 'daily-2026-11-01' });
    assert.equal(shared.totalAttempts, 1);
    assert.equal(shared.totalCompletions, 1);
    assert.equal(shared.globalCompletionPercentage, 100);
    assert.equal(shared.averageClicks, 10);
    assert.equal(shared.averageEfficiency, 80);

    const solo = await Board.findOne({ seed: 'daily-2026-11-02' });
    assert.equal(solo.totalAttempts, 0);
    assert.equal(solo.totalCompletions, 0);
    assert.equal(solo.globalCompletionPercentage, 0);
    assert.equal(solo.averageClicks, 0);
    assert.equal(solo.averageEfficiency, 0);
  });

  test('is not allowed on yourself', async () => {
    const siteAdmin = await createLoggedInUser({ role: 'siteadmin' });
    await request(app)
      .delete(`/api/admin/users/${siteAdmin.id}`)
      .set('Authorization', as(siteAdmin))
      .expect(403);
    await request(app)
      .patch(`/api/admin/users/${siteAdmin.id}`)
      .set('Authorization', as(siteAdmin))
      .send({ role: 'user' })
      .expect(403);
    assert.ok(await User.exists({ _id: siteAdmin.id }));
  });
});

describe('site admins', () => {
  test('see every account; site admins are read-only', async () => {
    const siteAdmin = await createLoggedInUser({ username: 'boss', role: 'siteadmin' });
    await createLoggedInUser({ username: 'cadmin', role: 'admin' });
    await createLoggedInUser({ username: 'dsite', role: 'siteadmin' });
    await createLoggedInUser({ username: 'euser' });

    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', as(siteAdmin))
      .expect(200);
    assert.deepEqual(
      res.body.users.map((u) => [u.username, u.role, u.manageable]),
      [
        ['boss', 'siteadmin', false],
        ['cadmin', 'admin', true],
        ['dsite', 'siteadmin', false],
        ['euser', 'user', true]
      ]
    );

    const admins = await request(app)
      .get('/api/admin/users?role=admin')
      .set('Authorization', as(siteAdmin))
      .expect(200);
    assert.deepEqual(admins.body.users.map((u) => u.username), ['cadmin']);

    const staff = await request(app)
      .get('/api/admin/users?role=admin,siteadmin')
      .set('Authorization', as(siteAdmin))
      .expect(200);
    assert.deepEqual(staff.body.users.map((u) => u.username), ['boss', 'cadmin', 'dsite']);
  });

  test('promote a user to admin and demote them again', async () => {
    const siteAdmin = await createLoggedInUser({ role: 'siteadmin' });
    const user = await createLoggedInUser();
    const patch = (role) =>
      request(app)
        .patch(`/api/admin/users/${user.id}`)
        .set('Authorization', as(siteAdmin))
        .send({ role });

    assert.equal((await patch('admin').expect(200)).body.user.role, 'admin');
    await request(app).get('/api/admin/users').set('Authorization', as(user)).expect(200);

    assert.equal((await patch('user').expect(200)).body.user.role, 'user');
    await request(app).get('/api/admin/users').set('Authorization', as(user)).expect(403);
  });

  test('create admins', async () => {
    const siteAdmin = await createLoggedInUser({ role: 'siteadmin' });
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', as(siteAdmin))
      .send({ username: 'helper', email: 'helper@example.com', role: 'admin' })
      .expect(201);
    assert.equal(res.body.user.role, 'admin');
  });

  test('cannot grant siteadmin or manage other site admins', async () => {
    const siteAdmin = await createLoggedInUser({ role: 'siteadmin' });
    const other = await createLoggedInUser({ role: 'siteadmin' });
    const user = await createLoggedInUser();
    const auth = as(siteAdmin);

    await request(app)
      .post('/api/admin/users')
      .set('Authorization', auth)
      .send({ username: 'peer', email: 'peer@example.com', role: 'siteadmin' })
      .expect(403);
    await request(app)
      .patch(`/api/admin/users/${user.id}`)
      .set('Authorization', auth)
      .send({ role: 'siteadmin' })
      .expect(403);

    await request(app).get(`/api/admin/users/${other.id}`).set('Authorization', auth).expect(200);
    await request(app)
      .patch(`/api/admin/users/${other.id}`)
      .set('Authorization', auth)
      .send({ role: 'user' })
      .expect(403);
    await request(app).delete(`/api/admin/users/${other.id}`).set('Authorization', auth).expect(403);
    assert.equal((await User.findById(other.id)).role, 'siteadmin');
  });
});

describe('SITE_ADMIN_EMAILS', () => {
  afterEach(() => {
    delete process.env.SITE_ADMIN_EMAILS;
  });

  test('promotes only verified matching accounts on startup', async () => {
    const listed = await createLoggedInUser({ email: 'owner@example.com' });
    const unlisted = await createLoggedInUser();
    await User.create({ username: 'unverified', email: 'second@example.com' });
    process.env.SITE_ADMIN_EMAILS = ' Owner@Example.com , second@example.com';

    assert.equal(await promoteSiteAdmins(), 1);
    assert.equal((await User.findById(listed.id)).role, 'siteadmin');
    assert.equal((await User.findById(unlisted.id)).role, 'user');
    assert.equal((await User.findOne({ username: 'unverified' })).role, 'user');
  });

  test('gives new accounts with a listed email the siteadmin role', async () => {
    process.env.SITE_ADMIN_EMAILS = 'owner@example.com';
    assert.equal(roleForEmail('OWNER@example.com'), 'siteadmin');
    assert.equal(roleForEmail('someone@example.com'), 'user');

    const owner = await createLoggedInUser({ email: 'owner@example.com' });
    const res = await request(app).get('/api/users/me').set('Authorization', as(owner)).expect(200);
    assert.equal(res.body.user.role, 'siteadmin');
  });

  test('does nothing when unset', async () => {
    await createLoggedInUser();
    assert.equal(await promoteSiteAdmins(), 0);
  });
});

describe('scripts/set-role.js', () => {
  test('sets a role by username or email', async () => {
    const user = await createLoggedInUser();
    assert.equal((await setRole(user.username, 'siteadmin')).role, 'siteadmin');
    assert.equal((await setRole(user.email.toUpperCase(), 'user')).role, 'user');
  });

  test('rejects an unknown role or user', async () => {
    const user = await createLoggedInUser();
    await assert.rejects(setRole(user.username, 'owner'), /Role must be one of/);
    await assert.rejects(setRole('nobody', 'admin'), /No user/);
  });
});

describe('recomputeUserStats', () => {
  test('rebuilds totals from finished games', async () => {
    const user = await createLoggedInUser();
    await play(user, 'daily-a', { clicks: 10, status: 'won', efficiency: 90 });
    await play(user, 'daily-b', { clicks: 5, status: 'lost' });
    await play(user, 'daily-c', { clicks: 20, status: 'won', efficiency: 60 });
    await User.updateOne({ _id: user.id }, { totalClicks: 0, boardsCompleted: 0, efficiency: 0 });

    await recomputeUserStats(user.id);
    const stored = await User.findById(user.id);
    assert.equal(stored.totalClicks, 35);
    assert.equal(stored.boardsCompleted, 2);
    assert.equal(stored.efficiency, 75);
  });
});
