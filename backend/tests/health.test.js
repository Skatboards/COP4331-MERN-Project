const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app, request } = require('./helpers');

test('GET /api/health reports ok', async () => {
  const res = await request(app).get('/api/health').expect(200);
  assert.deepEqual(res.body, { status: 'ok' });
});

test('GET /api/ping says Hello World', async () => {
  const res = await request(app).get('/api/ping').expect(200);
  assert.deepEqual(res.body, { message: 'Hello World' });
});

test('unknown API routes return a JSON 404', async () => {
  const res = await request(app).get('/api/nope').expect(404);
  assert.equal(res.body.error, 'Not found');
});

test('a malformed JSON body returns 400', async () => {
  await request(app)
    .post('/api/auth/login')
    .set('Content-Type', 'application/json')
    .send('{"login":')
    .expect(400);
});
