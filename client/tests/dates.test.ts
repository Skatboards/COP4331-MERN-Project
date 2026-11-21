import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LAUNCH_DATE, addDays, formatDuration, isPlayableDate, randomPastDate, seedDate,
} from '../src/game/dates.ts';

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
