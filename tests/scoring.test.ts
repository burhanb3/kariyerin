import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  addDistance,
  collectPearl,
  computeDisplayScore,
  createScoreState,
  tickCombo
} from '../src/game/systems/scoring.ts';

describe('score system', () => {
  test('combines distance points with pearl and combo bonuses', () => {
    let state = createScoreState();

    state = addDistance(state, 1000);
    state = collectPearl(state).state;
    state = collectPearl(state).state;

    assert.equal(state.pearlCount, 2);
    assert.equal(state.combo, 2);
    assert.equal(state.pearlScore, 165);
    assert.equal(computeDisplayScore(state), 245);
  });

  test('combo expires when pearls are not collected quickly enough', () => {
    let state = createScoreState();

    state = collectPearl(state).state;
    state = tickCombo(state, 2600);
    state = collectPearl(state).state;

    assert.equal(state.combo, 1);
    assert.equal(state.pearlScore, 150);
  });
});
