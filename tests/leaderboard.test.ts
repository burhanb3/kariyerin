import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  EventApiLeaderboardAdapter,
  LocalLeaderboardAdapter,
  DEFAULT_PLAYER_NAME,
  MemoryScoreStore,
  ResilientLeaderboardAdapter,
  normalizePlayerName
} from '../src/game/services/leaderboard.ts';

describe('leaderboard fallback', () => {
  test('normalizes event player names for display and storage', () => {
    assert.equal(normalizePlayerName('   Ada Lovelace   '), 'Ada Lovelace');
    assert.equal(normalizePlayerName(''), DEFAULT_PLAYER_NAME);
    assert.equal(normalizePlayerName('Very Long Engineering Champion With Extra Text'), 'Very Long Engineering Champion W');
  });

  test('sorts all-time scores by score descending and oldest tie first', async () => {
    const store = new MemoryScoreStore([
      { id: '1', playerName: 'Mae', score: 120, pearls: 1, createdAt: '2026-04-27T10:00:00.000Z' },
      { id: '2', playerName: 'Lin', score: 220, pearls: 3, createdAt: '2026-04-27T09:00:00.000Z' },
      { id: '3', playerName: 'Noor', score: 220, pearls: 2, createdAt: '2026-04-27T08:00:00.000Z' }
    ]);
    const leaderboard = new LocalLeaderboardAdapter(store);

    const rows = await leaderboard.getScores('all-time', 3);

    assert.deepEqual(
      rows.map((row) => row.playerName),
      ['Noor', 'Lin', 'Mae']
    );
  });

  test('daily leaderboard only includes scores from the selected day', async () => {
    const store = new MemoryScoreStore([
      { id: '1', playerName: 'Yesterday', score: 300, pearls: 1, createdAt: '2026-04-27T23:59:00.000Z' },
      { id: '2', playerName: 'Today', score: 180, pearls: 2, createdAt: '2026-04-28T09:00:00.000Z' }
    ]);
    const leaderboard = new LocalLeaderboardAdapter(store, new Date('2026-04-28T12:00:00.000Z'));

    const rows = await leaderboard.getScores('today', 10);

    assert.deepEqual(
      rows.map((row) => row.playerName),
      ['Today']
    );
  });

  test('score submission still uses the event API after a read fallback', async () => {
    const fallback = new LocalLeaderboardAdapter(new MemoryScoreStore([]));
    const api = new EventApiLeaderboardAdapter('', (async (input, init) => {
      const url = String(input);

      if (url.startsWith('/api/scores')) {
        return Response.json({ error: 'temporarily unavailable' }, { status: 503 });
      }

      assert.equal(url, '/api/submit-score');
      assert.equal(init?.method, 'POST');

      return Response.json({
        entry: {
          id: 'api-score',
          playerName: 'Ada Lovelace',
          score: 420,
          pearls: 3,
          createdAt: '2026-05-07T10:00:00.000Z'
        }
      });
    }) as typeof fetch);
    const leaderboard = new ResilientLeaderboardAdapter(api, fallback);

    const rows = await leaderboard.getScores('all-time', 8);
    assert.deepEqual(rows, []);
    assert.equal(leaderboard.isUsingFallback, true);

    const submitted = await leaderboard.submitScore({
      playerName: 'Ada Lovelace',
      score: 420,
      pearls: 3,
      elapsedMs: 8000,
      clientId: 'client-1',
      runId: 'run-1'
    });

    assert.equal(submitted.id, 'api-score');
    assert.equal(leaderboard.isUsingFallback, false);
  });
});
