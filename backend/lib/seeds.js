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
const DEFAULT_BOARD_TIMEZONE = 'America/New_York';

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

// The board day shown to everyone, in the configured board time zone.
function todayKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.BOARD_TIMEZONE || DEFAULT_BOARD_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

function todaySeed(now) {
  return `daily-${todayKey(now)}`;
}

function utcDay(at) {
  return new Date(at).toISOString().slice(0, 10);
}

function dayNumber(date) {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
}

// Layouts are available for real daily seeds from launch through the
// configured board day. Unlike playBlock, this rejects every future board.
function isLayoutAvailable(seed, now = new Date()) {
  const date = seedDate(seed);
  return date !== null && date >= launchDate() && date <= todayKey(now);
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

module.exports = {
  DAY_MS,
  launchDate,
  seedDate,
  todayKey,
  todaySeed,
  utcDay,
  dayNumber,
  isLayoutAvailable,
  playBlock,
  isOnTime
};
