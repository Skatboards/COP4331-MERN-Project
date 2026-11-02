// Shared setup for the API tests. Require this before anything from the app.
process.env.NODE_ENV = 'test';

const { before, after, beforeEach } = require('node:test');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server-core');
const app = require('../server');
const { setSender } = require('../lib/email');
const { User, Board, BoardAttempt } = require('../models');

// Same MongoDB version as compose.yaml
const MONGO_VERSION = '7.0.45';

// Emails the app tried to send during the current test
const sentEmails = [];
setSender(async (message) => {
  sentEmails.push(message);
});

let mongod;

// Starts a private in-memory MongoDB for this test file and empties it
// before every test
function useTestDatabase() {
  before(async () => {
    mongod = await MongoMemoryServer.create({ binary: { version: MONGO_VERSION } });
    await mongoose.connect(mongod.getUri());
    await Promise.all([User.init(), Board.init(), BoardAttempt.init()]);
  });

  beforeEach(async () => {
    sentEmails.length = 0;
    await Promise.all([User.deleteMany(), Board.deleteMany(), BoardAttempt.deleteMany()]);
  });

  after(async () => {
    await mongoose.disconnect();
    await mongod?.stop();
  });
}

// Pulls the token out of the link in the last email sent
function tokenFromLastEmail() {
  const match = sentEmails.at(-1)?.text.match(/token=([0-9a-f]+)/);
  return match?.[1];
}

let userCount = 0;

// Registers and verifies a user through the API; returns the login token
async function createLoggedInUser(overrides = {}) {
  userCount += 1;
  const details = {
    firstName: 'Test',
    lastName: 'Player',
    username: `player${userCount}`,
    email: `player${userCount}@example.com`,
    password: 'correct-horse-battery',
    ...overrides
  };

  await request(app).post('/api/auth/register').send(details).expect(201);
  await request(app)
    .post('/api/auth/verify-email')
    .send({ token: tokenFromLastEmail() })
    .expect(200);
  const res = await request(app)
    .post('/api/auth/login')
    .send({ login: details.username, password: details.password })
    .expect(200);

  return { ...details, token: res.body.token, id: res.body.user.id };
}

module.exports = {
  app,
  request,
  sentEmails,
  useTestDatabase,
  tokenFromLastEmail,
  createLoggedInUser
};
