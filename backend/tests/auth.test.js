const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  app,
  request,
  sentEmails,
  useTestDatabase,
  tokenFromLastEmail,
  createLoggedInUser
} = require('./helpers');
const { User } = require('../models');

useTestDatabase();

const newUser = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  username: 'ada',
  email: 'Ada@Example.com',
  password: 'analytical-engine'
};

describe('POST /api/auth/register', () => {
  test('creates an unverified user and emails a verification link', async () => {
    const res = await request(app).post('/api/auth/register').send(newUser).expect(201);

    assert.equal(res.body.user.username, 'ada');
    assert.equal(res.body.user.email, 'ada@example.com');
    assert.equal(res.body.user.emailVerified, false);
    assert.equal(res.body.user.passwordHash, undefined);

    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].to, 'ada@example.com');
    assert.match(sentEmails[0].text, /\/api\/auth\/verify-email\?token=[0-9a-f]{64}/);

    const stored = await User.findOne({ username: 'ada' }).select('+passwordHash');
    assert.notEqual(stored.passwordHash, newUser.password);
  });

  test('rejects a duplicate username or email', async () => {
    await request(app).post('/api/auth/register').send(newUser).expect(201);
    await request(app)
      .post('/api/auth/register')
      .send({ ...newUser, email: 'other@example.com' })
      .expect(409);
    await request(app)
      .post('/api/auth/register')
      .send({ ...newUser, username: 'other' })
      .expect(409);
  });

  test('rejects a bad username, email, or short password', async () => {
    await request(app).post('/api/auth/register').send({ ...newUser, username: 'a!' }).expect(400);
    await request(app).post('/api/auth/register').send({ ...newUser, email: 'nope' }).expect(400);
    await request(app).post('/api/auth/register').send({ ...newUser, password: 'short' }).expect(400);
  });
});

describe('POST /api/auth/verify-email', () => {
  test('verifies the address with the emailed token, once', async () => {
    await request(app).post('/api/auth/register').send(newUser).expect(201);
    const token = tokenFromLastEmail();

    await request(app).post('/api/auth/verify-email').send({ token }).expect(200);
    assert.equal((await User.findOne({ username: 'ada' })).emailVerified, true);

    await request(app).post('/api/auth/verify-email').send({ token }).expect(400);
  });

  test('rejects an unknown token', async () => {
    await request(app).post('/api/auth/verify-email').send({ token: 'abc' }).expect(400);
  });
});

describe('GET /api/auth/verify-email', () => {
  test('verifies from the email link and redirects to the site', async () => {
    await request(app).post('/api/auth/register').send(newUser).expect(201);

    const res = await request(app)
      .get(`/api/auth/verify-email?token=${tokenFromLastEmail()}`)
      .expect(302);
    assert.match(res.headers.location, /\?verified=1$/);
    assert.equal((await User.findOne({ username: 'ada' })).emailVerified, true);
  });

  test('redirects with verified=0 for a bad token', async () => {
    const res = await request(app).get('/api/auth/verify-email?token=bad').expect(302);
    assert.match(res.headers.location, /\?verified=0$/);
  });
});

describe('POST /api/auth/resend-verification', () => {
  test('emails a new link that works, and the old one stops working', async () => {
    await request(app).post('/api/auth/register').send(newUser).expect(201);
    const oldToken = tokenFromLastEmail();

    await request(app)
      .post('/api/auth/resend-verification')
      .send({ email: 'ada@example.com' })
      .expect(200);
    assert.equal(sentEmails.length, 2);

    await request(app).post('/api/auth/verify-email').send({ token: oldToken }).expect(400);
    await request(app)
      .post('/api/auth/verify-email')
      .send({ token: tokenFromLastEmail() })
      .expect(200);
  });

  test('gives the same answer for an unknown email and sends nothing', async () => {
    const res = await request(app)
      .post('/api/auth/resend-verification')
      .send({ email: 'nobody@example.com' })
      .expect(200);
    assert.match(res.body.message, /If that email belongs to an account/);
    assert.equal(sentEmails.length, 0);
  });
});

describe('POST /api/auth/login', () => {
  test('logs in a verified user by username or email', async () => {
    const user = await createLoggedInUser();
    assert.ok(user.token);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ login: user.email.toUpperCase(), password: user.password })
      .expect(200);
    assert.equal(res.body.user.username, user.username);
  });

  test('refuses an unverified user', async () => {
    await request(app).post('/api/auth/register').send(newUser).expect(201);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ login: 'ada', password: newUser.password })
      .expect(403);
    assert.equal(res.body.code, 'EMAIL_NOT_VERIFIED');
  });

  test('refuses a wrong password or unknown user the same way', async () => {
    const user = await createLoggedInUser();
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ login: user.username, password: 'wrong-password' })
      .expect(401);
    const unknownUser = await request(app)
      .post('/api/auth/login')
      .send({ login: 'ghost', password: 'wrong-password' })
      .expect(401);
    assert.deepEqual(wrongPassword.body, unknownUser.body);
  });

  test('requires a login and password', async () => {
    await request(app).post('/api/auth/login').send({}).expect(400);
  });
});

describe('POST /api/auth/forgot-password', () => {
  test('emails a reset link to a registered address', async () => {
    const user = await createLoggedInUser();
    sentEmails.length = 0;

    await request(app).post('/api/auth/forgot-password').send({ email: user.email }).expect(200);
    assert.equal(sentEmails.length, 1);
    assert.match(sentEmails[0].text, /\/reset-password\?token=[0-9a-f]{64}/);
  });

  test('gives the same answer for an unknown email and sends nothing', async () => {
    await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@example.com' })
      .expect(200);
    assert.equal(sentEmails.length, 0);
  });
});

describe('POST /api/auth/reset-password', () => {
  test('sets a new password with the emailed token, once', async () => {
    const user = await createLoggedInUser();
    await request(app).post('/api/auth/forgot-password').send({ email: user.email }).expect(200);
    const token = tokenFromLastEmail();

    await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'brand-new-password' })
      .expect(200);

    await request(app)
      .post('/api/auth/login')
      .send({ login: user.username, password: user.password })
      .expect(401);
    await request(app)
      .post('/api/auth/login')
      .send({ login: user.username, password: 'brand-new-password' })
      .expect(200);

    await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'another-password' })
      .expect(400);
  });

  test('rejects an unknown token or a short password', async () => {
    await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'abc', password: 'brand-new-password' })
      .expect(400);
    await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'abc', password: 'short' })
      .expect(400);
  });
});
