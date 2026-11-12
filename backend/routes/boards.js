const express = require('express');
const { User, Board, BoardAttempt } = require('../models');
const requireAuth = require('../middleware/auth');
const { readLimit } = require('./users');
const { todaySeed, isAvailableSeed, layoutOf } = require('../game/board');

const router = express.Router();

// Board seeds look like "daily-2026-10-20"
const SEED_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

const BOARD_FIELDS =
  'seed totalAttempts totalCompletions globalCompletionPercentage averageClicks averageEfficiency createdAt';

// GET /api/boards/:seed/progress - Resume this user's game
router.get('/:seed/progress', requireAuth, async (req, res) => {
  const board = await Board.findOne({ seed: req.params.seed });
  if (!board) return res.json({ game: null, played: null });
  const attempt = await BoardAttempt.findOne({ userId: req.userId, boardId: board._id });
  if (!attempt) return res.json({ game: null, played: null });
  if (attempt.status !== 'in_progress') {
    return res.json({
      game: null,
      played: { status: attempt.status, clicks: attempt.clicks }
    });
  }
  res.json({ game: attempt.gameState ?? null, played: null });
});

// PUT is represented by POST in apiRequest; save the user's current game.
router.post('/:seed/progress', requireAuth, async (req, res) => {
  const game = req.body?.game;
  if (!game || game.seed !== req.params.seed || !['playing', 'won', 'lost'].includes(game.status) ||
      !Array.isArray(game.revealed) || !Array.isArray(game.flags) ||
      !Number.isInteger(game.clicks) || game.clicks < 0 ||
      typeof req.body.completionPercentage !== 'number' || req.body.completionPercentage < 0 || req.body.completionPercentage > 100 ||
      !(game.explodedAt === null || Number.isInteger(game.explodedAt))) {
    return res.status(400).json({ error: 'Invalid game state' });
  }
  const board = await Board.findOneAndUpdate(
    { seed: req.params.seed }, { $setOnInsert: { seed: req.params.seed } },
    { upsert: true, returnDocument: 'after' }
  );
  if (game.status !== 'playing') {
    return res.status(400).json({ error: 'Finished games must be submitted as attempts' });
  }
  const existing = await BoardAttempt.findOne({ userId: req.userId, boardId: board._id });
  if (existing && existing.status !== 'in_progress') {
    return res.status(409).json({ error: 'You have already played this board' });
  }
  await BoardAttempt.findOneAndUpdate(
    { userId: req.userId, boardId: board._id },
    { $set: {
      gameState: game,
      clicks: game.clicks,
      completionPercentage: req.body.completionPercentage,
      status: 'in_progress',
      completed: false
    } },
    { upsert: true, returnDocument: 'after' }
  );
  res.json({ saved: true });
});

// Rejects requests whose :seed is not a valid board seed
router.param('seed', (req, res, next, seed) => {
  if (!SEED_PATTERN.test(seed)) {
    return res.status(400).json({ error: 'Invalid board seed' });
  }
  next();
});

// Running average in an update pipeline: (oldAverage * count + value) / (count + 1)
function runningAverage(averageField, countField, value) {
  return {
    $round: [
      {
        $divide: [
          { $add: [{ $multiply: [`$${averageField}`, `$${countField}`] }, value] },
          { $add: [`$${countField}`, 1] }
        ]
      },
      2
    ]
  };
}

// GET /api/boards - Most recent boards
router.get('/', async (req, res) => {
  const boards = await Board.find()
    .select(BOARD_FIELDS)
    .sort({ createdAt: -1, _id: -1 })
    .limit(readLimit(req.query.limit, 10, 50));

  res.json({ boards });
});

// GET /api/boards/today - Today's board layout, by the server's date
router.get('/today', (req, res) => {
  res.json(layoutOf(todaySeed()));
});

// GET /api/boards/:seed/layout - The layout of today's or an earlier day's board
router.get('/:seed/layout', (req, res) => {
  if (!isAvailableSeed(req.params.seed)) {
    return res.status(404).json({ error: 'Board not found' });
  }
  res.json(layoutOf(req.params.seed));
});

// GET /api/boards/:seed - One board's global stats
router.get('/:seed', async (req, res) => {
  const board = await Board.findOne({ seed: req.params.seed }).select(BOARD_FIELDS);
  if (!board) {
    return res.status(404).json({ error: 'Board not found' });
  }
  res.json({ board });
});

// GET /api/boards/:seed/attempts - Best finished games on a board
router.get('/:seed/attempts', async (req, res) => {
  const board = await Board.findOne({ seed: req.params.seed });
  if (!board) {
    return res.status(404).json({ error: 'Board not found' });
  }

  const attempts = await BoardAttempt.find({ boardId: board._id, status: { $ne: 'in_progress' } })
    .sort({ completed: -1, efficiency: -1, clicks: 1 })
    .limit(readLimit(req.query.limit, 10, 50))
    .populate('userId', 'username');

  res.json({
    seed: board.seed,
    attempts: attempts.map((attempt) => ({
      username: attempt.userId?.username ?? null,
      clicks: attempt.clicks,
      completed: attempt.completed,
      efficiency: attempt.efficiency,
      status: attempt.status,
      completedAt: attempt.completedAt
    }))
  });
});

// POST /api/boards/:seed/attempts - Record the logged-in user's finished game
// on a board (one per user per board) and update the board and user stats
router.post('/:seed/attempts', requireAuth, async (req, res) => {
  const { clicks, status } = req.body ?? {};
  let { efficiency } = req.body ?? {};
  let { completionPercentage } = req.body ?? {};

  if (!Number.isInteger(clicks) || clicks < 0) {
    return res.status(400).json({ error: 'clicks must be a whole number of 0 or more' });
  }
  if (status !== 'won' && status !== 'lost') {
    return res.status(400).json({ error: 'status must be "won" or "lost"' });
  }
  if (status === 'won') {
    if (typeof efficiency !== 'number' || !(efficiency >= 0 && efficiency <= 100)) {
      return res.status(400).json({ error: 'efficiency must be a number from 0 to 100' });
    }
  } else {
    // A lost game scores no efficiency
    efficiency = 0;
  }
  if (completionPercentage === undefined) completionPercentage = status === 'won' ? 100 : 0;
  if (typeof completionPercentage !== 'number' || completionPercentage < 0 || completionPercentage > 100) {
    return res.status(400).json({ error: 'completionPercentage must be a number from 0 to 100' });
  }
  if (status === 'won') completionPercentage = 100;

  if (!(await User.exists({ _id: req.userId }))) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Boards are created the first time anyone finishes them
  const board = await Board.findOneAndUpdate(
    { seed: req.params.seed },
    { $setOnInsert: { seed: req.params.seed } },
    { upsert: true, returnDocument: 'after' }
  );

  const won = status === 'won';
  let attempt;
  try {
    attempt = await BoardAttempt.findOneAndUpdate(
      { userId: req.userId, boardId: board._id, status: 'in_progress' },
      { $set: {
      userId: req.userId,
      boardId: board._id,
      clicks,
      completed: won,
      efficiency,
      completionPercentage,
      status,
      completedAt: new Date(),
      gameState: null
      } },
      { upsert: true, returnDocument: 'after' }
    );
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'You have already played this board' });
    }
    throw err;
  }

  // Each update reads the old values in the same step, so two games finishing
  // at once cannot overwrite each other's totals
  await Board.updateOne(
    { _id: board._id },
    [
      {
        $set: {
          totalAttempts: { $add: ['$totalAttempts', 1] },
          totalCompletions: { $add: ['$totalCompletions', won ? 1 : 0] },
          averageClicks: runningAverage('averageClicks', 'totalAttempts', clicks),
          globalCompletionPercentage: {
            $round: [
              {
                $multiply: [
                  { $divide: [{ $add: ['$totalCompletions', won ? 1 : 0] }, { $add: ['$totalAttempts', 1] }] },
                  100
                ]
              },
              2
            ]
          },
          // Efficiency averages only count games that were won
          ...(won && {
            averageEfficiency: runningAverage('averageEfficiency', 'totalCompletions', efficiency)
          })
        }
      }
    ],
    { updatePipeline: true }
  );

  await User.updateOne(
    { _id: req.userId },
    [
      {
        $set: {
          totalClicks: { $add: ['$totalClicks', clicks] },
          ...(won && {
            boardsCompleted: { $add: ['$boardsCompleted', 1] },
            efficiency: runningAverage('efficiency', 'boardsCompleted', efficiency)
          })
        }
      }
    ],
    { updatePipeline: true }
  );

  res.status(201).json({
    attempt: {
      id: attempt._id,
      seed: board.seed,
      clicks: attempt.clicks,
      completed: attempt.completed,
      efficiency: attempt.efficiency,
      status: attempt.status,
      completedAt: attempt.completedAt
    },
    board: await Board.findById(board._id).select(BOARD_FIELDS)
  });
});

module.exports = router;
