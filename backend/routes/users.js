const express = require('express');
const { User, BoardAttempt } = require('../models');
const requireAuth = require('../middleware/auth');
const { publicUser } = require('./auth');

const router = express.Router();

// Fields of other players that anyone may see (no email address)
const PROFILE_FIELDS = 'firstName lastName username totalClicks boardsCompleted efficiency';

const LEADERBOARD_SORTS = {
  boardsCompleted: { boardsCompleted: -1, efficiency: -1 },
  efficiency: { efficiency: -1, boardsCompleted: -1 },
  totalClicks: { totalClicks: -1 }
};

// Reads ?limit= as a whole number between 1 and max
function readLimit(value, fallback, max) {
  const limit = Number.parseInt(value, 10);
  return Number.isNaN(limit) ? fallback : Math.min(Math.max(limit, 1), max);
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /api/users/me - The logged-in user's profile and stats
router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user: publicUser(user) });
});

// GET /api/users/me/attempts - The logged-in user's games, newest first
router.get('/me/attempts', requireAuth, async (req, res) => {
  const attempts = await BoardAttempt.find({ userId: req.userId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(readLimit(req.query.limit, 20, 100))
    .populate('boardId', 'seed');

  res.json({
    attempts: attempts.map((attempt) => ({
      id: attempt._id,
      seed: attempt.boardId?.seed ?? null,
      clicks: attempt.clicks,
      completed: attempt.completed,
      efficiency: attempt.efficiency,
      status: attempt.status,
      completedAt: attempt.completedAt
    }))
  });
});

// GET /api/users/search?q= - Find players by username or name
router.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) {
    return res.status(400).json({ error: 'Search text (q) is required' });
  }

  const pattern = new RegExp(escapeRegex(q), 'i');
  const users = await User.find({
    $or: [{ username: pattern }, { firstName: pattern }, { lastName: pattern }]
  })
    .select(PROFILE_FIELDS)
    .sort({ username: 1 })
    .limit(readLimit(req.query.limit, 20, 50));

  res.json({ users });
});

// GET /api/users/leaderboard?sort=&limit= - Top players
router.get('/leaderboard', async (req, res) => {
  const sort = req.query.sort ?? 'boardsCompleted';
  if (!Object.hasOwn(LEADERBOARD_SORTS, sort)) {
    return res.status(400).json({
      error: `sort must be one of: ${Object.keys(LEADERBOARD_SORTS).join(', ')}`
    });
  }

  const users = await User.find()
    .select(PROFILE_FIELDS)
    .sort(LEADERBOARD_SORTS[sort])
    .limit(readLimit(req.query.limit, 10, 50));

  res.json({ sort, users });
});

module.exports = router;
module.exports.readLimit = readLimit;
