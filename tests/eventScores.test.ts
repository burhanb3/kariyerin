import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  authorizeAdmin,
  getPublicScores,
  maskIpAddress,
  parseScoreSubmission,
  submitScore,
  updateScoreStatus,
  type RequestLike,
  type ScoreApiConfig
} from '../src/server/eventScores.ts';

const config: ScoreApiConfig = {
  supabaseUrl: 'https://octodive.supabase.co',
  serviceRoleKey: 'service-role-key',
  eventId: 'kariyer-in-test',
  adminCode: 'admin-secret'
};

function createRequest(headers: RequestLike['headers'] = {}): RequestLike {
  return { headers };
}

describe('event score security api', () => {
  test('masks IP addresses before storage or admin display', () => {
    assert.equal(maskIpAddress('185.34.101.77'), '185.34.101.xxx');
    assert.equal(maskIpAddress('2a02:1234:abcd:9876::1'), '2a02:1234:abcd:xxxx');
    assert.equal(maskIpAddress(''), 'unknown');
  });

  test('rejects malformed score submissions', () => {
    assert.throws(() => parseScoreSubmission({ score: 'bad', pearls: 1, elapsedMs: 2000, clientId: 'c', runId: 'r' }));
    assert.throws(() => parseScoreSubmission({ score: 10, pearls: 1, elapsedMs: 2000, clientId: '', runId: 'r' }));
  });

  test('submits suspicious scores with masked IP and server-derived user agent', async () => {
    let capturedBody = {} as Record<string, unknown>;
    const previousFetch = globalThis.fetch;

    globalThis.fetch = async (_input, init) => {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json([
        {
          id: 'score-1',
          player_name: 'Ada Lovelace',
          score: 900,
          pearls: 0,
          created_at: '2026-05-07T10:00:00.000Z'
        }
      ]);
    };

    try {
      const result = await submitScore(
        config,
        createRequest({
          'x-forwarded-for': '185.34.101.77, 10.0.0.1',
          'user-agent': 'Event Phone'
        }),
        parseScoreSubmission({
          playerName: 'Ada Lovelace',
          score: 900,
          pearls: 0,
          elapsedMs: 1000,
          clientId: 'client-1',
          runId: 'run-1'
        })
      );

      assert.equal(result.scoreStatus, 'suspicious');
      assert.equal(capturedBody.masked_ip, '185.34.101.xxx');
      assert.equal(capturedBody.user_agent, 'Event Phone');
      assert.equal(capturedBody.score_status, 'suspicious');
      assert.equal(capturedBody.client_id, 'client-1');
      assert.equal(capturedBody.run_id, 'run-1');
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  test('public score query filters to valid event scores', async () => {
    let capturedUrl = '';
    const previousFetch = globalThis.fetch;

    globalThis.fetch = async (input) => {
      capturedUrl = String(input);
      return Response.json([
        {
          id: 'score-1',
          player_name: 'Valid Player',
          score: 1200,
          pearls: 4,
          created_at: '2026-05-07T10:00:00.000Z'
        }
      ]);
    };

    try {
      const rows = await getPublicScores(config, 8);

      assert.equal(rows[0].playerName, 'Valid Player');
      assert.match(capturedUrl, /score_status=eq\.valid/);
      assert.match(capturedUrl, /event_id=eq\.kariyer-in-test/);
      assert.doesNotMatch(capturedUrl, /user_agent/);
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  test('admin status updates write soft action and audit fields', async () => {
    let capturedBody = {} as Record<string, unknown>;
    const previousFetch = globalThis.fetch;

    globalThis.fetch = async (_input, init) => {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json([
        {
          id: 'score-1',
          player_name: 'Noor',
          score: 1200,
          pearls: 4,
          created_at: '2026-05-07T10:00:00.000Z',
          score_status: 'deleted',
          event_id: 'kariyer-in-test',
          elapsed_ms: 42000,
          masked_ip: '185.34.101.xxx',
          user_agent: 'Event Phone',
          client_id: 'client-1',
          run_id: 'run-1',
          admin_action: 'deleted',
          admin_action_reason: 'test cleanup',
          admin_action_at: '2026-05-07T10:10:00.000Z',
          updated_at: '2026-05-07T10:10:00.000Z'
        }
      ]);
    };

    try {
      const row = await updateScoreStatus(config, 'score-1', {
        scoreStatus: 'deleted',
        reason: 'test cleanup'
      });

      assert.equal(row.scoreStatus, 'deleted');
      assert.equal(capturedBody.score_status, 'deleted');
      assert.equal(capturedBody.admin_action, 'deleted');
      assert.equal(capturedBody.admin_action_reason, 'test cleanup');
      assert.ok(capturedBody.admin_action_at);
      assert.ok(capturedBody.updated_at);
    } finally {
      globalThis.fetch = previousFetch;
    }
  });

  test('admin requests require the configured code', () => {
    assert.doesNotThrow(() => authorizeAdmin(config, 'admin-secret'));
    assert.throws(() => authorizeAdmin(config, 'wrong-code'));
  });
});
