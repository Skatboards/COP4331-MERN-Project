import type { Attempt } from '../api/types';
import { LAUNCH_DATE, addDays, seedDate, todayKey } from './dates.ts';

export type DayStatus = 'won' | 'lost' | 'progress' | 'missed' | 'today' | 'future' | 'unavailable';

export type CalendarDay = {
  date: string;
  status: DayStatus;
  attempt: Attempt | null;
};

// Games by board date (daily boards only)
export function attemptsByDate(attempts: Attempt[]): Map<string, Attempt> {
  const byDate = new Map<string, Attempt>();
  for (const attempt of attempts) {
    const date = seedDate(attempt.seed);
    if (date && !byDate.has(date)) byDate.set(date, attempt);
  }
  return byDate;
}

// The first day a player could have played: launch, or the day their
// account was made if later (days before that are not "missed")
export function firstPlayableDay(accountCreatedAt?: string | null): string {
  if (!accountCreatedAt) return LAUNCH_DATE;
  const created = new Date(accountCreatedAt);
  if (Number.isNaN(created.getTime())) return LAUNCH_DATE;
  const day = todayKey(created);
  return day > LAUNCH_DATE ? day : LAUNCH_DATE;
}

export function dayStatus(date: string, attempt: Attempt | undefined, today: string, firstDay: string): DayStatus {
  if (date > today) return 'future';
  if (attempt?.status === 'won') return 'won';
  if (attempt?.status === 'lost') return 'lost';
  if (attempt?.status === 'in_progress') return 'progress';
  if (date === today) return 'today';
  if (date < LAUNCH_DATE) return 'unavailable';
  return date < firstDay ? 'unavailable' : 'missed';
}

export function daysFrom(start: string, count: number, byDate: Map<string, Attempt>, today: string, firstDay: string): CalendarDay[] {
  return Array.from({ length: count }, (_, index) => {
    const date = addDays(start, index);
    const attempt = byDate.get(date) ?? null;
    return { date, attempt, status: dayStatus(date, attempt ?? undefined, today, firstDay) };
  });
}

// "2026-11" → first day and number of days of that month
export function monthRange(month: string): { first: string; last: string; length: number; offset: number } {
  const [year, monthNumber] = month.split('-').map(Number);
  const first = `${month}-01`;
  const length = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const last = addDays(first, length - 1);
  // Sunday-first weekday of the 1st
  const offset = new Date(`${first}T00:00:00Z`).getUTCDay();
  return { first, last, length, offset };
}

export function shiftMonth(month: string, by: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + by, 1));
  return shifted.toISOString().slice(0, 7);
}

// The 7 days ending today (oldest first)
export function lastSevenDays(today: string): string {
  return addDays(today, -6);
}

export function missedDays(days: CalendarDay[]): CalendarDay[] {
  return days.filter((day) => day.status === 'missed');
}
