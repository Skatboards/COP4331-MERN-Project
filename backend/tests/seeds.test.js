const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  dayNumber,
  isLayoutAvailable,
  isOnTime,
  launchDate,
  playBlock,
  seedDate,
  todayKey,
  todaySeed,
  utcDay
} = require('../lib/seeds');

function withEnv(name, value, run) {
  const before = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    run();
  } finally {
    if (before === undefined) delete process.env[name];
    else process.env[name] = before;
  }
}

describe('daily seed dates', () => {
  test('rolls the canonical board day over at midnight US Eastern by default', () => {
    withEnv('BOARD_TIMEZONE', undefined, () => {
      assert.equal(todaySeed(new Date('2026-11-13T04:59:00Z')), 'daily-2026-11-12');
      assert.equal(todaySeed(new Date('2026-11-13T05:00:00Z')), 'daily-2026-11-13');
    });
  });

  test('supports a configured board time zone', () => {
    withEnv('BOARD_TIMEZONE', 'UTC', () => {
      assert.equal(todayKey(new Date('2026-11-13T00:30:00Z')), '2026-11-13');
    });
  });

  test('recognizes only real daily dates', () => {
    assert.equal(seedDate('daily-2026-11-12'), '2026-11-12');
    assert.equal(seedDate('daily-2026-02-30'), null);
    assert.equal(seedDate('daily-1'), null);
    assert.equal(seedDate('anything'), null);
  });

  test('converts UTC days to stable day numbers', () => {
    assert.equal(utcDay(new Date('2026-11-12T23:59:59Z')), '2026-11-12');
    assert.equal(dayNumber('2026-11-13') - dayNumber('2026-11-12'), 1);
  });
});

describe('seed availability policies', () => {
  test('offers layouts through today and rejects every future board', () => {
    const now = new Date('2026-11-12T17:00:00Z');
    assert.equal(isLayoutAvailable('daily-2026-11-12', now), true);
    assert.equal(isLayoutAvailable('daily-2026-11-11', now), true);
    assert.equal(isLayoutAvailable('daily-2026-11-13', now), false);
    assert.equal(isLayoutAvailable('daily-2027-01-01', now), false);
    assert.equal(isLayoutAvailable('daily-2026-02-30', now), false);
    assert.equal(isLayoutAvailable('test-1', now), false);
  });

  test('permits one UTC day ahead for play and rejects pre-launch boards', () => {
    const now = new Date('2026-11-12T17:00:00Z');
    withEnv('LAUNCH_DATE', '2026-10-15', () => {
      assert.equal(launchDate(), '2026-10-15');
      assert.equal(playBlock('daily-2026-11-13', now), null);
      assert.equal(playBlock('daily-2026-11-14', now), 'locked');
      assert.equal(playBlock('daily-2026-10-14', now), 'before-launch');
      assert.equal(playBlock('test-1', now), null);
    });
  });

  test('counts games within one UTC day of the board date as on time', () => {
    assert.equal(isOnTime('daily-2026-11-12', new Date('2026-11-11T12:00:00Z')), true);
    assert.equal(isOnTime('daily-2026-11-12', new Date('2026-11-13T12:00:00Z')), true);
    assert.equal(isOnTime('daily-2026-11-12', new Date('2026-11-14T00:00:00Z')), false);
    assert.equal(isOnTime('test-1', new Date('2026-11-12T12:00:00Z')), false);
  });
});
