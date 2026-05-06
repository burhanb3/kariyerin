import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { getDifficulty } from '../src/game/systems/difficulty.ts';

describe('difficulty curve', () => {
  test('ramps speed, spawn pressure, gap size, and pattern level over time', () => {
    const opening = getDifficulty(0);
    const midRun = getDifficulty(42_000);
    const lateRun = getDifficulty(95_000);

    assert.equal(opening.patternLevel, 1);
    assert.equal(lateRun.patternLevel, 4);
    assert.ok(midRun.worldSpeed > opening.worldSpeed);
    assert.ok(lateRun.worldSpeed > midRun.worldSpeed);
    assert.ok(midRun.spawnIntervalMs < opening.spawnIntervalMs);
    assert.ok(lateRun.spawnIntervalMs < midRun.spawnIntervalMs);
    assert.ok(lateRun.gapSize < opening.gapSize);
  });

  test('caps values so the game stays readable during long runs', () => {
    const veryLate = getDifficulty(10 * 60_000);

    assert.equal(veryLate.worldSpeed, 375);
    assert.equal(veryLate.spawnIntervalMs, 900);
    assert.equal(veryLate.gapSize, 168);
  });
});
