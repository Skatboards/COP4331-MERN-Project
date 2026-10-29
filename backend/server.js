require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// --- App ------------------------------------------------------------------
const app = express();

// Allow the React frontend, which runs at a different address, to call this API
app.use(cors());
// Turn JSON request bodies into a JavaScript object at req.body
app.use(express.json());

// GET /api/health - Health check (used by Docker Compose and CI)
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// GET /api/ping - Hello World check
app.get('/api/ping', (req, res) => {
  res.status(200).json({ message: 'Hello World' });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/boards', require('./routes/boards'));

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
    .catch((err) => console.error('MongoDB connection error:', err));

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
