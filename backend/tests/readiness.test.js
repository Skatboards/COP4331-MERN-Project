const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { app, request, useTestDatabase } = require('./helpers');

useTestDatabase();

test('GET /api/health/ready caches a successful database check', async (t) => {
  const database = mongoose.connection.db;
  const admin = database.admin();
  const command = admin.command.bind(admin);
  let pingCount = 0;

  t.mock.method(database, 'admin', () => ({
    command: (...args) => {
      pingCount += 1;
      return command(...args);
    }
  }));

  const first = await request(app).get('/api/health/ready').expect(200);
  const second = await request(app).get('/api/health/ready').expect(200);

  assert.deepEqual(first.body, { status: 'ok' });
  assert.deepEqual(second.body, { status: 'ok' });
  assert.equal(pingCount, 1);
});
