import { getPublicScores, getScoreApiConfig } from '../src/server/eventScores.ts';

function sendError(response: { status: (code: number) => { json: (body: unknown) => void } }, error: unknown): void {
  const statusCode = typeof error === 'object' && error && 'statusCode' in error
    ? Number((error as { statusCode: number }).statusCode)
    : 500;

  response.status(Number.isFinite(statusCode) ? statusCode : 500).json({
    error: error instanceof Error ? error.message : 'Unexpected server error.'
  });
}

export default async function handler(request: any, response: any): Promise<void> {
  if (request.method !== 'GET') {
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const limit = Number.parseInt(String(request.query?.limit ?? '8'), 10);
    const rows = await getPublicScores(getScoreApiConfig(), Number.isFinite(limit) ? limit : 8);
    response.status(200).json({ rows });
  } catch (error) {
    sendError(response, error);
  }
}
