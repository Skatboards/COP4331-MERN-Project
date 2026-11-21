// Rules for daily board seeds ("daily-YYYY-MM-DD").
//
// Players get a new board at their own local midnight, so the server allows
// one day of slack either side of its UTC date:
//   - a board dated after UTC today + 1 day is still locked;
//   - a game is "on time" (counts toward a streak) when it is finished
//     within one day of the board's date.
// Boards before LAUNCH_DATE cannot be played. Seeds that are not daily
// boards (used by tests and tools) are not checked.

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LAUNCH_DATE = '2026-10-15';

function launchDate() {
  const value = process.env.LAUNCH_DATE;
  return /^\d{4}-\d{2}-\d{2}$/.test(value ?? '') ? value : DEFAULT_LAUNCH_DATE;
}

// "2026-11-12" for "daily-2026-11-12"; null for other seeds or bad dates
function seedDate(seed) {
  const date = typeof seed === 'string' ? seed.match(/^daily-(\d{4}-\d{2}-\d{2})$/)?.[1] : null;
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  return date;
}

function utcDay(at) {
  return new Date(at).toISOString().slice(0, 10);
}

function dayNumber(date) {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
}

// Why a seed cannot be played right now: 'locked', 'before-launch', or null
function playBlock(seed, now = new Date()) {
  const date = seedDate(seed);
  if (!date) return null;
  if (dayNumber(date) > dayNumber(utcDay(now)) + 1) return 'locked';
  if (date < launchDate()) return 'before-launch';
  return null;
}

// Whether a game on this seed finished at `at` was played on the board's day
function isOnTime(seed, at = new Date()) {
  const date = seedDate(seed);
  if (!date) return false;
  return Math.abs(dayNumber(utcDay(at)) - dayNumber(date)) <= 1;
}

// Sends 403 for locked or pre-launch boards; returns true when it did
function rejectBlockedSeed(seed, res) {
  const block = playBlock(seed);
  if (block === 'locked') {
    res.status(403).json({ error: 'This board is locked until its day', code: 'BOARD_LOCKED' });
    return true;
  }
  if (block === 'before-launch') {
    res.status(403).json({ error: 'This board is from before Sweeple launched', code: 'BEFORE_LAUNCH' });
    return true;
  }
  return false;
}

module.exports = { DAY_MS, launchDate, seedDate, utcDay, dayNumber, playBlock, isOnTime, rejectBlockedSeed };
