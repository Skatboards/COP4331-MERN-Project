const { describe, test, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, useTestDatabase, createLoggedInUser } = require('./helpers');
const { User } = require('../models');

useTestDatabase();

process.env.GITHUB_CLIENT_ID = 'github-client';
process.env.GITHUB_CLIENT_SECRET = 'github-secret';
process.env.GOOGLE_CLIENT_ID = 'google-client';
process.env.GOOGLE_CLIENT_SECRET = 'google-secret';

// What the fake GitHub and Google return for the current test
let github;
let google;
let tokenRequests;

beforeEach(() => {
  github = {
    user: { id: 101, login: 'octo-cat', name: 'Octo Cat' },
    emails: [{ email: 'Octo@Example.com', primary: true, verified: true }]
  };
  google = {
    sub: 'g-202',
    email: 'grace@example.com',
    email_verified: true,
    given_name: 'Grace',
    family_name: 'Hopper'
  };
  tokenRequests = [];
});

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Stands in for the providers' servers; supertest itself does not use fetch
mock.method(globalThis, 'fetch', async (url, options = {}) => {
  const target = String(url);
  if (target === 'https://github.com/login/oauth/access_token') {
    tokenRequests.push(new URLSearchParams(options.body));
    return json({ access_token: 'github-access' });
  }
  if (target === 'https://oauth2.googleapis.com/token') {
    tokenRequests.push(new URLSearchParams(options.body));
    return json({ access_token: 'google-access' });
  }
  if (target === 'https://api.github.com/user') return json(github.user);
  if (target === 'https://api.github.com/user/emails') return json(github.emails);
  if (target === 'https://openidconnect.googleapis.com/v1/userinfo') return json(google);
  return json({ error: 'unexpected request' }, 500);
});

// Starts a sign-in and follows it back to the callback, as the browser would
async function signIn(provider, { query } = {}) {
  const start = await request(app).get(`/api/auth/${provider}`).expect(302);
  const cookie = start.headers['set-cookie'][0].split(';')[0];
  const state = new URL(start.headers.location).searchParams.get('state');

  const params = new URLSearchParams(query || { code: 'the-code', state });
  const res = await request(app)
    .get(`/api/auth/${provider}/callback?${params}`)
    .set('Cookie', cookie)
    .expect(302);
  return res.headers.location;
}

function tokenFrom(location) {
  return new URL(location).hash.match(/^#token=(.+)$/)?.[1];
}

describe('GET /api/auth/providers', () => {
  test('lists email and password plus each configured provider', async () => {
    const res = await request(app).get('/api/auth/providers').expect(200);
    assert.deepEqual(
      res.body.providers.map((p) => p.id),
      ['password', 'github', 'google']
    );
  });

  test('leaves out a provider without credentials', async () => {
    const secret = process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_CLIENT_SECRET;
    try {
      const res = await request(app).get('/api/auth/providers').expect(200);
      assert.deepEqual(res.body.providers.map((p) => p.id), ['password', 'github']);
      await request(app).get('/api/auth/google').expect(404);
    } finally {
      process.env.GOOGLE_CLIENT_SECRET = secret;
    }
  });
});

describe('GET /api/auth/:provider', () => {
  test('redirects to the provider with state and a PKCE challenge', async () => {
    const res = await request(app).get('/api/auth/github').expect(302);
    const url = new URL(res.headers.location);

    assert.equal(url.origin + url.pathname, 'https://github.com/login/oauth/authorize');
    assert.equal(url.searchParams.get('client_id'), 'github-client');
    assert.equal(
      url.searchParams.get('redirect_uri'),
      'http://localhost:5173/api/auth/github/callback'
    );
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(url.searchParams.get('state'));
    assert.match(res.headers['set-cookie'][0], /^oauth_login=.+HttpOnly; SameSite=Lax/);
  });

  test('returns 404 for an unknown provider', async () => {
    await request(app).get('/api/auth/myspace').expect(404);
  });
});

describe('GET /api/auth/:provider/callback', () => {
  test('creates a verified user from GitHub and returns a working login token', async () => {
    const location = await signIn('github');
    const token = tokenFrom(location);
    assert.ok(token, location);

    const me = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    assert.equal(me.body.user.username, 'octo_cat');
    assert.equal(me.body.user.email, 'octo@example.com');
    assert.equal(me.body.user.firstName, 'Octo');
    assert.equal(me.body.user.emailVerified, true);
    assert.deepEqual(me.body.user.providers, ['github']);

    // The PKCE verifier sent to GitHub matches what the code was issued for
    assert.equal(tokenRequests[0].get('code'), 'the-code');
    assert.ok(tokenRequests[0].get('code_verifier'));
  });

  test('signs a returning user in by provider id, even if their email changed', async () => {
    await signIn('google');
    google.email = 'new-address@example.com';
    const token = tokenFrom(await signIn('google'));

    const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    assert.equal(me.body.user.email, 'grace@example.com');
    assert.equal(await User.countDocuments(), 1);
  });

  test('links to an existing account with the same verified email', async () => {
    const existing = await createLoggedInUser({ email: 'grace@example.com' });
    const token = tokenFrom(await signIn('google'));

    const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    assert.equal(me.body.user.id, existing.id);
    assert.deepEqual(me.body.user.providers, ['google']);

    // The password still works too
    await request(app)
      .post('/api/auth/login')
      .send({ login: existing.username, password: existing.password })
      .expect(200);
  });

  test('drops the password of an unverified account it links to', async () => {
    // Someone registers the address first but can't open the email
    await request(app)
      .post('/api/auth/register')
      .send({ username: 'squatter', email: 'grace@example.com', password: 'attacker-password' })
      .expect(201);

    const token = tokenFrom(await signIn('google'));
    const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    assert.equal(me.body.user.username, 'squatter');
    assert.equal(me.body.user.emailVerified, true);

    await request(app)
      .post('/api/auth/login')
      .send({ login: 'squatter', password: 'attacker-password' })
      .expect(401);
  });

  test('links both providers to one user', async () => {
    github.emails = [{ email: 'grace@example.com', primary: true, verified: true }];
    await signIn('google');
    const token = tokenFrom(await signIn('github'));

    const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    assert.deepEqual(me.body.user.providers, ['google', 'github']);
    assert.equal(await User.countDocuments(), 1);
  });

  test('picks another username when the suggested one is taken', async () => {
    await createLoggedInUser({ username: 'octo_cat' });
    const token = tokenFrom(await signIn('github'));

    const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
    assert.match(me.body.user.username, /^octo_cat_\d{4}$/);
  });

  test('picks another username when someone takes it at the same moment', async () => {
    await createLoggedInUser({ username: 'octo_cat' });
    // The first check misses the user, as if they were created right after it
    const exists = mock.method(User, 'exists');
    exists.mock.mockImplementationOnce(async () => null);
    try {
      const token = tokenFrom(await signIn('github'));
      const me = await request(app).get('/api/users/me').set('Authorization', `Bearer ${token}`);
      assert.match(me.body.user.username, /^octo_cat_\d{4}$/);
    } finally {
      exists.mock.restore();
    }
  });

  test('refuses an account without a verified email', async () => {
    github.emails = [{ email: 'octo@example.com', primary: true, verified: false }];
    const location = await signIn('github');

    assert.equal(location, 'http://localhost:5173/?oauthError=email');
    assert.equal(await User.countDocuments(), 0);
  });

  test('rejects a state that does not match the cookie', async () => {
    const location = await signIn('github', { query: { code: 'the-code', state: 'forged' } });
    assert.equal(location, 'http://localhost:5173/?oauthError=state');
    assert.equal(tokenRequests.length, 0);
  });

  test('gives every provider request a timeout', async () => {
    fetch.mock.resetCalls();
    await signIn('github');

    assert.equal(fetch.mock.callCount(), 3);
    for (const call of fetch.mock.calls) {
      assert.ok(call.arguments[1].signal instanceof AbortSignal);
    }
  });

  test('reports a provider that cannot be reached', async () => {
    fetch.mock.mockImplementationOnce(async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    });
    const location = await signIn('github');
    assert.equal(location, 'http://localhost:5173/?oauthError=provider');
  });

  test('reports a cancelled sign-in', async () => {
    const location = await signIn('google', { query: { error: 'access_denied' } });
    assert.equal(location, 'http://localhost:5173/?oauthError=cancelled');
  });

  test('a user without a password cannot log in with one', async () => {
    await signIn('github');
    await request(app)
      .post('/api/auth/login')
      .send({ login: 'octo_cat', password: 'anything-at-all' })
      .expect(401);
  });
});
