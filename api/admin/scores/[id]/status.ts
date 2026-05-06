import {
  authorizeAdmin,
  getHeaderValue,
  getScoreApiConfig,
  parseAdminStatusUpdate,
  updateScoreStatus
} from '../../../../src/server/eventScores.ts';

async function readBody(request: { body?: unknown }): Promise<unknown> {
  if (typeof request.body === 'string') {
    return JSON.parse(request.body);
  }

  return request.body;
}

function sendError(response: { status: (code: number) => { json: (body: unknown) => void } }, error: unknown): void {
  const statusCode = typeof error === 'object' && error && 'statusCode' in error
    ? Number((error as { statusCode: number }).statusCode)
    : 500;

  response.status(Number.isFinite(statusCode) ? statusCode : 500).json({
    error: error instanceof Error ? error.message : 'Unexpected server error.'
  });
}

export default async function handler(request: any, response: any): Promise<void> {
  if (request.method !== 'PATCH') {
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const config = getScoreApiConfig();
    authorizeAdmin(config, getHeaderValue(request, 'x-admin-code'));

    const scoreId = String(request.query?.id ?? '').trim();
    if (!scoreId) {
      response.status(400).json({ error: 'Missing score id.' });
      return;
    }

    const update = parseAdminStatusUpdate(await readBody(request));
    const row = await updateScoreStatus(config, scoreId, update);
    response.status(200).json({ row });
  } catch (error) {
    sendError(response, error);
  }
}
