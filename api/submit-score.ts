import {
  getScoreApiConfig,
  parseScoreSubmission,
  submitScore
} from './_lib/eventScores';

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
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const config = getScoreApiConfig();
    const submission = parseScoreSubmission(await readBody(request));
    const result = await submitScore(config, request, submission);
    response.status(200).json(result);
  } catch (error) {
    sendError(response, error);
  }
}
