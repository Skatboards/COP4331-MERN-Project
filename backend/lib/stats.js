// Rebuilds the stored stats on boards and users from their finished
// attempts. Recording a game (POST /api/boards/:seed/attempts) updates these
// stats one game at a time; when attempts are removed or changed by other
// means, such as deleting a user, call these to bring the totals back in line.
//
// The meanings match routes/boards.js:
//   boards.totalAttempts               finished games (won or lost)
//   boards.totalCompletions            games won
//   boards.globalCompletionPercentage  won / finished * 100
//   boards.averageClicks               average clicks over finished games
//   boards.averageEfficiency           average efficiency over won games
//   users.totalClicks                  clicks summed over finished games
//   users.boardsCompleted              games won
//   users.efficiency                   average efficiency over won games
// Values are rounded to 2 decimal places, like the running averages.
const mongoose = require('mongoose');
const { Board, BoardAttempt, User } = require('../models');

const FINISHED = { $in: ['won', 'lost'] };

function round2(value) {
  return Math.round(value * 100) / 100;
}

function toObjectIds(ids) {
  return [...new Set(ids.map(String))].map((id) => new mongoose.Types.ObjectId(id));
}

// Recomputes the stats of each board in boardIds (ids or strings)
async function recomputeBoardStats(boardIds) {
  const ids = toObjectIds(boardIds);
  if (ids.length === 0) return;

  const rows = await BoardAttempt.aggregate([
    { $match: { boardId: { $in: ids }, status: FINISHED } },
    {
      $group: {
        _id: '$boardId',
        totalAttempts: { $sum: 1 },
        totalCompletions: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] } },
        totalClicks: { $sum: '$clicks' },
        wonEfficiency: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, '$efficiency', 0] } }
      }
    }
  ]);
  const byBoard = new Map(rows.map((row) => [String(row._id), row]));

  await Board.bulkWrite(
    ids.map((id) => {
      const row = byBoard.get(String(id));
      const attempts = row?.totalAttempts ?? 0;
      const completions = row?.totalCompletions ?? 0;
      return {
        updateOne: {
          filter: { _id: id },
          update: {
            $set: {
              totalAttempts: attempts,
              totalCompletions: completions,
              globalCompletionPercentage: attempts ? round2((completions / attempts) * 100) : 0,
              averageClicks: attempts ? round2(row.totalClicks / attempts) : 0,
              averageEfficiency: completions ? round2(row.wonEfficiency / completions) : 0
            }
          }
        }
      };
    })
  );
}

// Recomputes one user's stats
async function recomputeUserStats(userId) {
  const [id] = toObjectIds([userId]);
  const [row] = await BoardAttempt.aggregate([
    { $match: { userId: id, status: FINISHED } },
    {
      $group: {
        _id: null,
        totalClicks: { $sum: '$clicks' },
        boardsCompleted: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, 1, 0] } },
        wonEfficiency: { $sum: { $cond: [{ $eq: ['$status', 'won'] }, '$efficiency', 0] } }
      }
    }
  ]);

  const boardsCompleted = row?.boardsCompleted ?? 0;
  await User.updateOne(
    { _id: id },
    {
      $set: {
        totalClicks: row?.totalClicks ?? 0,
        boardsCompleted,
        efficiency: boardsCompleted ? round2(row.wonEfficiency / boardsCompleted) : 0
      }
    }
  );
}

module.exports = { recomputeBoardStats, recomputeUserStats };
