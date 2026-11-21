import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LAUNCH_DATE, addDays, formatDuration, isPlayableDate, randomPastDate, seedDate,
} from '../src/game/dates.ts';
import { dayStatus, firstPlayableDay, monthRange, shiftMonth } from '../src/game/calendar.ts';
import type { Attempt } from '../src/api/types.ts';

const now = new Date(2026, 10, 17, 12);

test('seedDate reads daily seeds and rejects others', () => {
  assert.equal(seedDate('daily-2026-11-12'), '2026-11-12');
  assert.equal(seedDate('daily-2026-02-30'), null);
  assert.equal(seedDate('daily-1'), null);
});

test('only days from launch to today are playable', () => {
  assert.equal(isPlayableDate('2026-11-17', now), true);
  assert.equal(isPlayableDate('2026-11-18', now), false);
  assert.equal(isPlayableDate(addDays(LAUNCH_DATE, -1), now), false);
});

test('random past days are before today and skip played days', () => {
  for (let i = 0; i < 50; i++) {
    const date = randomPastDate([], now) as string;
    assert.ok(date >= LAUNCH_DATE && date < '2026-11-17', date);
  }
  const played = Array.from({ length: 40 }, (_, i) => addDays(LAUNCH_DATE, i)).filter((d) => d !== '2026-11-01');
  assert.equal(randomPastDate(played, now), '2026-11-01');
});

test('durations print as m:ss', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(65_400), '1:05');
  assert.equal(formatDuration(3_725_000), '1:02:05');
  assert.equal(formatDuration(null), '–');
});

test('calendar days: missed, locked and before the account', () => {
  const won = { status: 'won' } as Attempt;
  assert.equal(dayStatus('2026-11-10', won, '2026-11-17', LAUNCH_DATE), 'won');
  assert.equal(dayStatus('2026-11-10', undefined, '2026-11-17', LAUNCH_DATE), 'missed');
  assert.equal(dayStatus('2026-11-17', undefined, '2026-11-17', LAUNCH_DATE), 'today');
  assert.equal(dayStatus('2026-11-18', undefined, '2026-11-17', LAUNCH_DATE), 'future');
  assert.equal(dayStatus('2026-11-01', undefined, '2026-11-17', '2026-11-05'), 'unavailable');
  assert.equal(firstPlayableDay('2020-01-01T00:00:00Z'), LAUNCH_DATE);
});

test('month helpers', () => {
  assert.deepEqual(monthRange('2026-11'), { first: '2026-11-01', last: '2026-11-30', length: 30, offset: 0 });
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
});
