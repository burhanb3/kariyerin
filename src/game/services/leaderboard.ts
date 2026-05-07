import {
  DEFAULT_PLAYER_NAME,
  normalizePearls,
  normalizePlayerName,
  normalizeScore,
  type PublicScoreEntry,
  type ScoreSubmission
} from '../../shared/score.ts';

export { DEFAULT_PLAYER_NAME, normalizePlayerName } from '../../shared/score.ts';

export type LeaderboardScope = 'all-time' | 'today';

export type LeaderboardEntry = PublicScoreEntry;

export type LeaderboardAdapter = {
  readonly mode: 'supabase' | 'local';
  getScores(scope: LeaderboardScope, limit?: number): Promise<LeaderboardEntry[]>;
  submitScore(score: ScoreSubmission): Promise<LeaderboardEntry>;
};

export type StoredScore = LeaderboardEntry;

export type ScoreStore = {
  read(): StoredScore[];
  write(scores: StoredScore[]): void;
};

const STORAGE_KEY = 'octodash.leaderboard.v1';

const seedScores: StoredScore[] = [
  { id: 'seed-1', playerName: DEFAULT_PLAYER_NAME, score: 0, pearls: 0, createdAt: '2026-05-07T00:00:00.000Z' },
  { id: 'seed-2', playerName: DEFAULT_PLAYER_NAME, score: 0, pearls: 0, createdAt: '2026-05-07T00:01:00.000Z' },
  { id: 'seed-3', playerName: DEFAULT_PLAYER_NAME, score: 0, pearls: 0, createdAt: '2026-05-07T00:02:00.000Z' },
  { id: 'seed-4', playerName: DEFAULT_PLAYER_NAME, score: 0, pearls: 0, createdAt: '2026-05-07T00:03:00.000Z' },
  { id: 'seed-5', playerName: DEFAULT_PLAYER_NAME, score: 0, pearls: 0, createdAt: '2026-05-07T00:04:00.000Z' },
  { id: 'seed-6', playerName: DEFAULT_PLAYER_NAME, score: 0, pearls: 0, createdAt: '2026-05-07T00:05:00.000Z' },
  { id: 'seed-7', playerName: DEFAULT_PLAYER_NAME, score: 0, pearls: 0, createdAt: '2026-05-07T00:06:00.000Z' },
  { id: 'seed-8', playerName: DEFAULT_PLAYER_NAME, score: 0, pearls: 0, createdAt: '2026-05-07T00:07:00.000Z' }
];

function createId(): string {
  if ('crypto' in globalThis && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function sortScores(scores: StoredScore[]): StoredScore[] {
  return [...scores].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export class MemoryScoreStore implements ScoreStore {
  private scores: StoredScore[];

  constructor(initialScores: StoredScore[] = seedScores) {
    this.scores = [...initialScores];
  }

  read(): StoredScore[] {
    return [...this.scores];
  }

  write(scores: StoredScore[]): void {
    this.scores = [...scores];
  }
}

export class BrowserLocalScoreStore implements ScoreStore {
  read(): StoredScore[] {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as StoredScore[]) : [...seedScores];
    } catch {
      return [...seedScores];
    }
  }

  write(scores: StoredScore[]): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
    } catch {
      // The game still runs if private mode or storage policy blocks writes.
    }
  }
}

export class LocalLeaderboardAdapter implements LeaderboardAdapter {
  readonly mode = 'local' as const;
  store: ScoreStore;
  now: Date;

  constructor(
    store: ScoreStore = typeof window === 'undefined'
      ? new MemoryScoreStore()
      : new BrowserLocalScoreStore(),
    now: Date = new Date()
  ) {
    this.store = store;
    this.now = now;
  }

  async getScores(scope: LeaderboardScope, limit = 10): Promise<LeaderboardEntry[]> {
    const currentDay = toDayKey(this.now);
    const rows = this.store.read().filter((row) => {
      if (scope === 'all-time') {
        return true;
      }

      return row.createdAt.slice(0, 10) === currentDay;
    });

    return sortScores(rows).slice(0, limit);
  }

  async submitScore(score: ScoreSubmission): Promise<LeaderboardEntry> {
    const entry: LeaderboardEntry = {
      id: createId(),
      playerName: normalizePlayerName(score.playerName),
      score: normalizeScore(score.score),
      pearls: normalizePearls(score.pearls),
      createdAt: this.now.toISOString()
    };

    const nextScores = sortScores([entry, ...this.store.read()]).slice(0, 100);
    this.store.write(nextScores);

    return entry;
  }
}

type ApiScoresResponse = {
  rows: PublicScoreEntry[];
};

type ApiSubmitResponse = {
  entry: PublicScoreEntry;
};

function normalizeApiBase(value: string): string {
  const trimmed = value.trim().replace(/\/$/, '');

  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return '';
}

async function readApiError(response: Response): Promise<string> {
  const fallback = `HTTP ${response.status}`;

  try {
    const text = await response.text();
    const trimmed = text.trim();

    if (!trimmed) {
      return fallback;
    }

    try {
      const payload = JSON.parse(trimmed) as { error?: unknown };
      const error = typeof payload.error === 'string' ? payload.error : trimmed;
      return `${fallback}: ${error.slice(0, 300)}`;
    } catch {
      return `${fallback}: ${trimmed.replace(/\s+/g, ' ').slice(0, 300)}`;
    }
  } catch {
    return fallback;
  }
}

export class EventApiLeaderboardAdapter implements LeaderboardAdapter {
  readonly mode = 'supabase' as const;
  baseUrl: string;
  fetcher: typeof fetch;

  constructor(baseUrl = '', fetcher: typeof fetch = fetch) {
    this.baseUrl = normalizeApiBase(baseUrl);
    this.fetcher = fetcher === fetch ? fetch.bind(globalThis) : fetcher;
  }

  private createEndpoint(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  async getScores(_scope: LeaderboardScope, limit = 10): Promise<LeaderboardEntry[]> {
    const endpoint = this.createEndpoint(`/api/scores?limit=${encodeURIComponent(String(limit))}`);
    const response = await this.fetcher(endpoint);

    if (!response.ok) {
      throw new Error(`Leaderboard fetch failed: ${await readApiError(response)}`);
    }

    const payload = (await response.json()) as ApiScoresResponse;
    return payload.rows;
  }

  async submitScore(score: ScoreSubmission): Promise<LeaderboardEntry> {
    const response = await this.fetcher(this.createEndpoint('/api/submit-score'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(score)
    });

    if (!response.ok) {
      throw new Error(`Leaderboard submit failed: ${await readApiError(response)}`);
    }

    const payload = (await response.json()) as ApiSubmitResponse;
    return payload.entry;
  }
}

export class ResilientLeaderboardAdapter implements LeaderboardAdapter {
  readonly mode: 'supabase' | 'local';
  private lastReadUsedFallback = false;
  primary: LeaderboardAdapter | null;
  fallback: LeaderboardAdapter;

  constructor(
    primary: LeaderboardAdapter | null,
    fallback: LeaderboardAdapter
  ) {
    this.primary = primary;
    this.fallback = fallback;
    this.mode = primary?.mode ?? fallback.mode;
  }

  get isUsingFallback(): boolean {
    return this.lastReadUsedFallback || this.primary === null;
  }

  async getScores(scope: LeaderboardScope, limit = 10): Promise<LeaderboardEntry[]> {
    if (!this.primary) {
      this.lastReadUsedFallback = true;
      return this.fallback.getScores(scope, limit);
    }

    try {
      const rows = await this.primary.getScores(scope, limit);
      this.lastReadUsedFallback = false;
      return rows;
    } catch {
      this.lastReadUsedFallback = true;
      return this.fallback.getScores(scope, limit);
    }
  }

  async submitScore(score: ScoreSubmission): Promise<LeaderboardEntry> {
    if (!this.primary) {
      return this.fallback.submitScore(score);
    }

    const entry = await this.primary.submitScore(score);
    this.lastReadUsedFallback = false;
    return entry;
  }
}

export function createLeaderboard(env: ImportMetaEnv): ResilientLeaderboardAdapter {
  const fallback = new LocalLeaderboardAdapter();

  return new ResilientLeaderboardAdapter(
    new EventApiLeaderboardAdapter(env.VITE_LEADERBOARD_API_BASE?.trim() || ''),
    fallback
  );
}
