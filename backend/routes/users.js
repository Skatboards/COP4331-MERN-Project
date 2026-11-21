const express = require('express');
const { User, Board, BoardAttempt } = require('../models');
const { seedDate, dayNumber, DAY_MS } = require('../lib/seeds');
const { computeStreaks } = require('../lib/stats');
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

// Longest from-to range of board dates one request may ask for: one calendar
// month, which is all the archive page shows at a time
const MAX_RANGE_DAYS = 31;

function attemptJson(attempt, seed) {
  return {
    id: attempt._id,
    seed: seed ?? attempt.boardId?.seed ?? null,
    clicks: attempt.clicks,
    completed: attempt.completed,
    efficiency: attempt.efficiency,
    completionPercentage: attempt.status === 'won' ? 100 : attempt.completionPercentage,
    status: attempt.status,
    completedAt: attempt.completedAt,
    timeMs: attempt.timeMs ?? null,
    onTime: attempt.onTime ?? false,
    mode: attempt.mode ?? 'daily'
  };
}

// The daily seeds from one YYYY-MM-DD date to another, inclusive
function seedsBetween(from, to) {
  const seeds = [];
  for (let day = dayNumber(from); day <= dayNumber(to); day++) {
    seeds.push(`daily-${new Date(day * DAY_MS).toISOString().slice(0, 10)}`);
  }
  return seeds;
}

// GET /api/users/me/attempts?from=&to=&limit= - The logged-in user's games,
// newest first, with their stats. from and to (YYYY-MM-DD, inclusive) keep
// only daily boards in that range, e.g. one calendar month.
router.get('/me/attempts', requireAuth, async (req, res) => {
  const { from, to } = req.query;
  const filter = { userId: req.userId };
  const listFilter = { ...filter };

  if (from !== undefined || to !== undefined) {
    const fromDate = seedDate(`daily-${from}`);
    const toDate = seedDate(`daily-${to}`);
    if (!fromDate || !toDate || fromDate > toDate) {
      return res.status(400).json({ error: 'from and to must be YYYY-MM-DD dates, from first' });
    }
    if (dayNumber(toDate) - dayNumber(fromDate) >= MAX_RANGE_DAYS) {
      return res.status(400).json({ error: `from and to may be at most ${MAX_RANGE_DAYS} days apart` });
    }
    const boards = await Board.find({ seed: { $in: seedsBetween(fromDate, toDate) } }).select('_id');
    listFilter.boardId = { $in: boards.map((board) => board._id) };
  }

  const [attempts, finished, gamesPlayed, user, playersRanked] = await Promise.all([
    BoardAttempt.find(listFilter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(readLimit(req.query.limit, 20, 100))
      .select('-gameState -finalState')
      .populate('boardId', 'seed'),
    BoardAttempt.find({ ...filter, status: { $in: ['won', 'lost'] } })
      .select('status efficiency onTime completedAt boardId')
      .populate('boardId', 'seed'),
    BoardAttempt.countDocuments(filter),
    User.findById(req.userId).select('totalClicks efficiency boardsCompleted'),
    User.countDocuments({ boardsCompleted: { $gt: 0 } })
  ]);

  if (!user) return res.status(404).json({ error: 'User not found' });

  const won = finished.filter((attempt) => attempt.status === 'won');
  const { currentStreak, longestStreak } = computeStreaks(finished.map((attempt) => ({
    seed: attempt.boardId?.seed,
    status: attempt.status,
    onTime: attempt.onTime,
    completedAt: attempt.completedAt
  })));
  // Place on the efficiency leaderboard (GET /leaderboard?sort=efficiency)
  const efficiencyRank = user.boardsCompleted > 0
    ? await User.countDocuments({
      boardsCompleted: { $gt: 0 },
      $or: [
        { efficiency: { $gt: user.efficiency } },
        { efficiency: user.efficiency, boardsCompleted: { $gt: user.boardsCompleted } }
      ]
    }) + 1
    : null;

  res.json({
    stats: {
      gamesPlayed,
      gamesWon: won.length,
      winRate: finished.length ? Math.round((won.length / finished.length) * 100) : 0,
      averageEfficiency: user.efficiency,
      totalClicks: user.totalClicks,
      bestEfficiency: won.reduce((best, attempt) => Math.max(best, attempt.efficiency), 0),
      currentStreak,
      longestStreak,
      efficiencyRank,
      playersRanked
    },
    attempts: attempts.map((attempt) => attemptJson(attempt))
  });
});

// GET /api/users/me/attempts/:seed - The logged-in user's game on one
// board, with how they left it; attempt is null if they haven't played it
router.get('/me/attempts/:seed', requireAuth, async (req, res) => {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(req.params.seed)) {
    return res.status(400).json({ error: 'Invalid board seed' });
  }
  const board = await Board.findOne({ seed: req.params.seed }).select('_id');
  const attempt = board && await BoardAttempt.findOne({ userId: req.userId, boardId: board._id });
  if (!attempt) return res.json({ attempt: null });
  res.json({
    attempt: { ...attemptJson(attempt, req.params.seed), finalState: attempt.finalState ?? null }
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
module.exports.escapeRegex = escapeRegex;
