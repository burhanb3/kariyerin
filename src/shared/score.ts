export const DEFAULT_PLAYER_NAME = "KARİYER-IN'26";
export const MAX_PLAYER_NAME_LENGTH = 32;

export const SCORE_STATUSES = ['valid', 'suspicious', 'disqualified', 'deleted'] as const;

export type ScoreStatus = (typeof SCORE_STATUSES)[number];

export type PublicScoreEntry = {
  id: string;
  playerName: string;
  score: number;
  pearls: number;
  createdAt: string;
};

export type ScoreSubmission = {
  playerName: string;
  score: number;
  pearls: number;
  elapsedMs: number;
  clientId: string;
  runId: string;
};

export type AdminScoreEntry = PublicScoreEntry & {
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

export type AdminStatusUpdate = {
  scoreStatus: ScoreStatus;
  reason: string;
};

export function normalizePlayerName(value: string): string {
  const cleaned = value.replace(/\s+/g, ' ').trim();

  if (!cleaned) {
    return DEFAULT_PLAYER_NAME;
  }

  return cleaned.slice(0, MAX_PLAYER_NAME_LENGTH);
}

export function normalizeScore(value: number): number {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
}

export function normalizePearls(value: number): number {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
}

export function normalizeElapsedMs(value: number): number {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
}

export function isScoreStatus(value: string): value is ScoreStatus {
  return SCORE_STATUSES.includes(value as ScoreStatus);
}
