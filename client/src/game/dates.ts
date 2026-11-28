// The first daily board; earlier days cannot be played
export const LAUNCH_DATE: string =
  (import.meta.env?.VITE_LAUNCH_DATE as string | undefined) ?? '2026-10-15';
export const BOARD_TIMEZONE: string =
  (import.meta.env?.VITE_BOARD_TIMEZONE as string | undefined) ?? 'America/New_York';

const DAY_MS = 24 * 60 * 60 * 1000;

// "2026-11-12" from "daily-2026-11-12", or null for other seeds
export function seedDate(seed: string | null | undefined): string | null {
  const date = seed?.match(/^daily-(\d{4}-\d{2}-\d{2})$/)?.[1];
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  return date;
}

export function seedForDate(date: string): string {
  return `daily-${date}`;
}

// The shared board day in the configured board time zone, as YYYY-MM-DD
export function todayKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BOARD_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function todaySeed(now = new Date()): string {
  return seedForDate(todayKey(now));
}

// Adds whole days to a YYYY-MM-DD date
export function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  return new Date(parsed.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

export function isFutureDate(date: string, now = new Date()): boolean {
  return date > todayKey(now);
}

export function isBeforeLaunch(date: string): boolean {
  return date < LAUNCH_DATE;
}

// Whether a board can be opened: from launch up to the player's today
export function isPlayableDate(date: string | null, now = new Date()): date is string {
  return Boolean(date) && !isFutureDate(date as string, now) && !isBeforeLaunch(date as string);
}

export type DateStyle = 'long' | 'short' | 'weekday' | 'weekdayLong';

export function formatDate(date: string, style: DateStyle = 'long'): string {
  const options: Intl.DateTimeFormatOptions =
    style === 'short' ? { month: 'short', day: 'numeric' }
      : style === 'weekday' ? { weekday: 'short' }
        : style === 'weekdayLong' ? { weekday: 'long', month: 'long', day: 'numeric' }
          : { month: 'long', day: 'numeric', year: 'numeric' };
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`));
}

// Title for a board page: the date for daily boards, else the seed itself
export function boardTitle(seed: string): string {
  const date = seedDate(seed);
  return date ? formatDate(date) : seed;
}

// A past day between launch and yesterday, avoiding the dates in exclude
// when possible. Returns null when no past day exists yet.
export function randomPastDate(
  exclude: Iterable<string> = [],
  now = new Date(),
  random: () => number = Math.random,
): string | null {
  const yesterday = addDays(todayKey(now), -1);
  if (yesterday < LAUNCH_DATE) return null;
  const count = daysBetween(LAUNCH_DATE, yesterday) + 1;
  const skip = new Set(exclude);
  const open: string[] = [];
  for (let i = 0; i < count; i++) {
    const date = addDays(LAUNCH_DATE, i);
    if (!skip.has(date)) open.push(date);
  }
  const pool = open.length > 0 ? open : Array.from({ length: count }, (_, i) => addDays(LAUNCH_DATE, i));
  return pool[Math.floor(random() * pool.length)];
}

// m:ss, or h:mm:ss past an hour
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return '–';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
