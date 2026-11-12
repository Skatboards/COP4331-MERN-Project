require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// --- App ------------------------------------------------------------------
const app = express();
const MONGODB_HEALTH_TIMEOUT_MS = 2000;
const READINESS_CACHE_TTL_MS = 5000;
let cachedReadiness;
let readinessCheck;

// Allow the React frontend, which runs at a different address, to call this API
app.use(cors());
// Turn JSON request bodies into a JavaScript object at req.body
app.use(express.json());

// GET /api/health - Health check (used by Docker Compose and CI)
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Verify that MongoDB answers promptly so this endpoint can be used as a
// readiness check without letting a stalled database hold the request open.
async function pingMongoDB() {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    throw new Error('MongoDB is not connected');
  }

  let timeout;
  try {
    await Promise.race([
      mongoose.connection.db.admin().command({ ping: 1 }),
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('MongoDB health check timed out')),
          MONGODB_HEALTH_TIMEOUT_MS
        );
      })
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

// Cache readiness briefly and share an in-flight ping so bursts of health
// checks result in at most one database command per cache window.
function getReadiness() {
  if (cachedReadiness?.expiresAt > Date.now()) {
    return Promise.resolve(cachedReadiness.response);
  }

  if (!readinessCheck) {
    readinessCheck = pingMongoDB()
      .then(() => ({ statusCode: 200, body: { status: 'ok' } }))
      .catch(() => ({ statusCode: 503, body: { status: 'unavailable' } }))
      .then((response) => {
        cachedReadiness = {
          response,
          expiresAt: Date.now() + READINESS_CACHE_TTL_MS
        };
        return response;
      })
      .finally(() => {
        readinessCheck = undefined;
      });
  }

  return readinessCheck;
}

// GET /api/health/ready - Generic dependency readiness for public monitoring
app.get('/api/health/ready', async (req, res) => {
  const readiness = await getReadiness();
  res.status(readiness.statusCode).json(readiness.body);
});

// GET /api/ping - Hello World check
app.get('/api/ping', (req, res) => {
  res.status(200).json({ message: 'Hello World' });
});

app.use('/api/auth', require('./routes/auth'));
// After routes/auth, so its fixed paths win over /api/auth/:provider
app.use('/api/auth', require('./routes/oauth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/boards', require('./routes/boards'));
app.use('/api/admin', require('./routes/admin'));

// Unknown /api routes get a JSON 404 instead of Express's HTML page
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Express 5 sends errors from async route handlers here
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

// --- Database and server --------------------------------------------------
// Only when run directly (node server.js). Tests load the app with require()
// and connect to their own in-memory database instead.
if (require.main === module) {
  const url = process.env.MONGODB_URI;
  mongoose
    .connect(url)
    .then(() => console.log('MongoDB connected successfully via Mongoose'))
    // Accounts listed in SITE_ADMIN_EMAILS become site admins
    .then(() => require('./lib/bootstrapAdmins').promoteSiteAdmins())
    .then((promoted) => promoted && console.log(`Promoted ${promoted} account(s) to site admin`))
    .catch((err) => console.error('MongoDB connection error:', err));

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
