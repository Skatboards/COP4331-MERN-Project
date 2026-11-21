import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShareText, shareUrl, solvedByLabel } from '../src/game/share.ts';

test('share text lists the result, time, clicks and streak', () => {
  const text = buildShareText({
    dateLabel: 'November 12, 2026',
    status: 'won',
    completion: 100,
    clicks: 61,
    timeMs: 222000,
    efficiency: 92,
    streak: 5,
    difficulty: 'Medium',
    url: 'https://example.test/archive/daily-2026-11-12',
  });
  assert.equal(text, [
    'Sweeple · November 12, 2026 (Medium)',
    '✅ Solved · 100% cleared',
    '⏱ 3:42 · 🖱 61 clicks · 92% efficiency',
    '🔥 5-day streak',
    'https://example.test/archive/daily-2026-11-12',
  ].join('\n'));
});

test('share text leaves out a missing time and streak', () => {
  const text = buildShareText({ dateLabel: 'Nov 1', status: 'lost', completion: 40, clicks: 1, url: 'u' });
  assert.equal(text, 'Sweeple · Nov 1\n💥 Not solved · 40% cleared\n🖱 1 click\nu');
});

test('share links point at the archive board', () => {
  assert.equal(shareUrl('daily-2026-11-12', 'https://s.test'), 'https://s.test/archive/daily-2026-11-12');
  assert.equal(solvedByLabel({ totalCompletions: 1531144 }), '1,531,144');
  assert.equal(solvedByLabel(null), '–');
});
