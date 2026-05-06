const DEFAULT_PLAYER_NAME = "KARİYER-IN'26";
const MAX_PLAYER_NAME_LENGTH = 32;
const SCORE_STATUSES = ['valid', 'suspicious', 'disqualified', 'deleted'] as const;

type ScoreStatus = (typeof SCORE_STATUSES)[number];

type PublicScoreEntry = {
  id: string;
  playerName: string;
  score: number;
  pearls: number;
  createdAt: string;
};

type ScoreSubmission = {
  playerName: string;
  score: number;
  pearls: number;
  elapsedMs: number;
  clientId: string;
  runId: string;
};

type AdminScoreEntry = PublicScoreEntry & {
  scoreStatus: ScoreStatus;
  eventId: string;
  elapsedMs: number;
  maskedIp: string;
  userAgent: string;
  clientId: string;
  runId: string;
  sameClientScoreCount: number;
  adminAction: string;
  adminActionReason: string;
  adminActionAt: string | null;
  updatedAt: string | null;
};

type AdminStatusUpdate = {
  scoreStatus: ScoreStatus;
  reason: string;
};

function normalizePlayerName(value: string): string {
  const cleaned = value.replace(/\s+/g, ' ').trim();

  if (!cleaned) {
    return DEFAULT_PLAYER_NAME;
  }

  return cleaned.slice(0, MAX_PLAYER_NAME_LENGTH);
}

function normalizeScore(value: number): number {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
}

function normalizePearls(value: number): number {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
}

function normalizeElapsedMs(value: number): number {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
}

function isScoreStatus(value: string): value is ScoreStatus {
  return SCORE_STATUSES.includes(value as ScoreStatus);
}

type SupabaseRow = {
  id: string;
  player_name: string;
  score: number;
  pearls: number;
  created_at: string;
  score_status?: ScoreStatus;
  event_id?: string;
  elapsed_ms?: number;
  masked_ip?: string;
  user_agent?: string;
  client_id?: string;
  run_id?: string;
  admin_action?: string;
  admin_action_reason?: string;
  admin_action_at?: string | null;
  updated_at?: string | null;
};

export type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
};

export type ScoreApiConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  eventId: string;
  adminCode: string;
};

type SubmitResult = {
  entry: PublicScoreEntry;
  scoreStatus: ScoreStatus;
};

const SCORE_SELECT = [
  'id',
  'player_name',
  'score',
  'pearls',
  'created_at',
  'score_status',
  'event_id',
  'elapsed_ms',
  'masked_ip',
  'user_agent',
  'client_id',
  'run_id',
  'admin_action',
  'admin_action_reason',
  'admin_action_at',
  'updated_at'
].join(',');

export function getScoreApiConfig(env: Record<string, string | undefined> = process.env): ScoreApiConfig {
  const supabaseUrl = env.SUPABASE_URL?.trim() || '';
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';
  const eventId = env.EVENT_ID?.trim() || 'kariyer-in-2026-05-07';
  const adminCode = env.EVENT_ADMIN_CODE?.trim() || '';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    eventId,
    adminCode
  };
}

export function authorizeAdmin(config: ScoreApiConfig, providedCode: string | undefined): void {
  if (!config.adminCode || providedCode !== config.adminCode) {
    throw Object.assign(new Error('Unauthorized admin request.'), { statusCode: 401 });
  }
}

export function getHeaderValue(request: RequestLike, name: string): string {
  const lowerName = name.toLowerCase();
  const direct = request.headers[name] ?? request.headers[lowerName];
  const value = Array.isArray(direct) ? direct[0] : direct;
  return value ?? '';
}

export function getRequestIp(request: RequestLike): string {
  const forwardedFor = getHeaderValue(request, 'x-forwarded-for');
  const candidate = forwardedFor.split(',')[0].trim()
    || getHeaderValue(request, 'cf-connecting-ip').trim()
    || getHeaderValue(request, 'true-client-ip').trim()
    || getHeaderValue(request, 'x-real-ip').trim();

  return candidate;
}

export function maskIpAddress(value: string): string {
  const ip = value.trim();

  if (!ip) {
    return 'unknown';
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
  }

  if (ip.includes(':')) {
    const parts = ip.split(':').filter(Boolean);
    return `${parts.slice(0, 3).join(':')}:xxxx`;
  }

  return 'unknown';
}

function safeText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function assertObject(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw Object.assign(new Error('Invalid JSON payload.'), { statusCode: 400 });
  }
}

export function parseScoreSubmission(value: unknown): ScoreSubmission {
  assertObject(value);

  const score = normalizeScore(Number(value.score));
  const pearls = normalizePearls(Number(value.pearls));
  const elapsedMs = normalizeElapsedMs(Number(value.elapsedMs));
  const clientId = safeText(value.clientId, 96);
  const runId = safeText(value.runId, 96);

  if (!Number.isFinite(Number(value.score)) || !Number.isFinite(Number(value.pearls)) || !Number.isFinite(Number(value.elapsedMs))) {
    throw Object.assign(new Error('Score, pearls, and elapsedMs must be numeric.'), { statusCode: 400 });
  }

  if (!clientId || !runId) {
    throw Object.assign(new Error('Missing clientId or runId.'), { statusCode: 400 });
  }

  return {
    playerName: normalizePlayerName(safeText(value.playerName, 120)),
    score,
    pearls,
    elapsedMs,
    clientId,
    runId
  };
}

export function parseAdminStatusUpdate(value: unknown): AdminStatusUpdate {
  assertObject(value);

  const scoreStatus = safeText(value.scoreStatus, 32);

  if (!isScoreStatus(scoreStatus)) {
    throw Object.assign(new Error('Invalid score status.'), { statusCode: 400 });
  }

  return {
    scoreStatus,
    reason: safeText(value.reason, 240)
  };
}

function evaluateScoreStatus(submission: ScoreSubmission): { scoreStatus: ScoreStatus; reason: string } {
  const elapsedSeconds = Math.max(1, submission.elapsedMs / 1000);
  const generousScoreCap = 1000 + elapsedSeconds * 85 + submission.pearls * 240;

  if (submission.elapsedMs < 1500 && submission.score > 300) {
    return { scoreStatus: 'suspicious', reason: 'score too high for very short run' };
  }

  if (submission.score > generousScoreCap || submission.score > 30000 || submission.pearls > 160) {
    return { scoreStatus: 'suspicious', reason: 'score exceeds event safety envelope' };
  }

  return { scoreStatus: 'valid', reason: '' };
}

function mapPublicScore(row: SupabaseRow): PublicScoreEntry {
  return {
    id: row.id,
    playerName: row.player_name,
    score: row.score,
    pearls: row.pearls,
    createdAt: row.created_at
  };
}

function mapAdminScore(row: SupabaseRow, sameClientScoreCount: number): AdminScoreEntry {
  return {
    ...mapPublicScore(row),
    scoreStatus: row.score_status ?? 'valid',
    eventId: row.event_id ?? '',
    elapsedMs: row.elapsed_ms ?? 0,
    maskedIp: row.masked_ip ?? 'unknown',
    userAgent: row.user_agent ?? '',
    clientId: row.client_id ?? '',
    runId: row.run_id ?? '',
    sameClientScoreCount,
    adminAction: row.admin_action ?? '',
    adminActionReason: row.admin_action_reason ?? '',
    adminActionAt: row.admin_action_at ?? null,
    updatedAt: row.updated_at ?? null
  };
}

function createHeaders(config: ScoreApiConfig): HeadersInit {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    'Content-Type': 'application/json'
  };
}

async function supabaseFetch(config: ScoreApiConfig, endpoint: URL, init?: RequestInit): Promise<Response> {
  return fetch(endpoint, {
    ...init,
    headers: {
      ...createHeaders(config),
      ...init?.headers
    }
  });
}

async function readRows(response: Response): Promise<SupabaseRow[]> {
  if (!response.ok) {
    throw Object.assign(new Error(`Supabase request failed: ${response.status}`), { statusCode: response.status });
  }

  return (await response.json()) as SupabaseRow[];
}

export async function submitScore(
  config: ScoreApiConfig,
  request: RequestLike,
  submission: ScoreSubmission
): Promise<SubmitResult> {
  const evaluation = evaluateScoreStatus(submission);
  const endpoint = new URL('/rest/v1/octodash_scores', config.supabaseUrl);
  const response = await supabaseFetch(config, endpoint, {
    method: 'POST',
    headers: {
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      player_name: submission.playerName,
      score: submission.score,
      pearls: submission.pearls,
      elapsed_ms: submission.elapsedMs,
      score_status: evaluation.scoreStatus,
      event_id: config.eventId,
      masked_ip: maskIpAddress(getRequestIp(request)),
      user_agent: getHeaderValue(request, 'user-agent').slice(0, 500),
      client_id: submission.clientId,
      run_id: submission.runId,
      admin_action: evaluation.scoreStatus === 'suspicious' ? 'auto_suspicious' : null,
      admin_action_reason: evaluation.reason,
      admin_action_at: evaluation.scoreStatus === 'suspicious' ? new Date().toISOString() : null
    })
  });

  const rows = await readRows(response);
  const row = rows[0];

  if (!row) {
    throw Object.assign(new Error('Supabase did not return the inserted score.'), { statusCode: 502 });
  }

  return {
    entry: mapPublicScore(row),
    scoreStatus: evaluation.scoreStatus
  };
}

export async function getPublicScores(config: ScoreApiConfig, limit = 8): Promise<PublicScoreEntry[]> {
  const endpoint = new URL('/rest/v1/octodash_scores', config.supabaseUrl);
  endpoint.searchParams.set('select', 'id,player_name,score,pearls,created_at');
  endpoint.searchParams.set('score_status', 'eq.valid');
  endpoint.searchParams.set('event_id', `eq.${config.eventId}`);
  endpoint.searchParams.set('order', 'score.desc,created_at.asc');
  endpoint.searchParams.set('limit', String(Math.min(Math.max(limit, 1), 100)));

  const rows = await readRows(await supabaseFetch(config, endpoint));
  return rows.map(mapPublicScore);
}

export async function getAdminScores(config: ScoreApiConfig, limit = 200): Promise<AdminScoreEntry[]> {
  const endpoint = new URL('/rest/v1/octodash_scores', config.supabaseUrl);
  endpoint.searchParams.set('select', SCORE_SELECT);
  endpoint.searchParams.set('event_id', `eq.${config.eventId}`);
  endpoint.searchParams.set('order', 'score.desc,created_at.asc');
  endpoint.searchParams.set('limit', String(Math.min(Math.max(limit, 1), 500)));

  const rows = await readRows(await supabaseFetch(config, endpoint));
  const counts = new Map<string, number>();

  for (const row of rows) {
    const clientId = row.client_id ?? '';
    counts.set(clientId, (counts.get(clientId) ?? 0) + 1);
  }

  return rows.map((row) => mapAdminScore(row, counts.get(row.client_id ?? '') ?? 0));
}

export async function updateScoreStatus(
  config: ScoreApiConfig,
  scoreId: string,
  update: AdminStatusUpdate
): Promise<AdminScoreEntry> {
  const endpoint = new URL('/rest/v1/octodash_scores', config.supabaseUrl);
  endpoint.searchParams.set('id', `eq.${scoreId}`);
  endpoint.searchParams.set('event_id', `eq.${config.eventId}`);

  const now = new Date().toISOString();
  const response = await supabaseFetch(config, endpoint, {
    method: 'PATCH',
    headers: {
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      score_status: update.scoreStatus,
      admin_action: update.scoreStatus,
      admin_action_reason: update.reason,
      admin_action_at: now,
      updated_at: now
    })
  });

  const rows = await readRows(response);
  const row = rows[0];

  if (!row) {
    throw Object.assign(new Error('Score not found.'), { statusCode: 404 });
  }

  return mapAdminScore(row, 1);
}
