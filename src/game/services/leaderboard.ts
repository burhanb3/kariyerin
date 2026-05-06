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

export class EventApiLeaderboardAdapter implements LeaderboardAdapter {
  readonly mode = 'supabase' as const;
  baseUrl: string;
  fetcher: typeof fetch;

  constructor(baseUrl = '', fetcher: typeof fetch = fetch) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetcher = fetcher;
  }

  async getScores(_scope: LeaderboardScope, limit = 10): Promise<LeaderboardEntry[]> {
    const endpoint = `${this.baseUrl}/api/scores?limit=${encodeURIComponent(String(limit))}`;
    const response = await this.fetcher(endpoint);

    if (!response.ok) {
      throw new Error(`Leaderboard fetch failed: ${response.status}`);
    }

    const payload = (await response.json()) as ApiScoresResponse;
    return payload.rows;
  }

  async submitScore(score: ScoreSubmission): Promise<LeaderboardEntry> {
    const response = await this.fetcher(`${this.baseUrl}/api/submit-score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(score)
    });

    if (!response.ok) {
      throw new Error(`Leaderboard submit failed: ${response.status}`);
    }

    const payload = (await response.json()) as ApiSubmitResponse;
    return payload.entry;
  }
}

export class ResilientLeaderboardAdapter implements LeaderboardAdapter {
  readonly mode: 'supabase' | 'local';
  private usingFallback = false;
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
    return this.usingFallback || this.primary === null;
  }

  async getScores(scope: LeaderboardScope, limit = 10): Promise<LeaderboardEntry[]> {
    if (!this.primary || this.usingFallback) {
      return this.fallback.getScores(scope, limit);
    }

    try {
      return await this.primary.getScores(scope, limit);
    } catch {
      this.usingFallback = true;
      return this.fallback.getScores(scope, limit);
    }
  }

  async submitScore(score: ScoreSubmission): Promise<LeaderboardEntry> {
    if (!this.primary || this.usingFallback) {
      return this.fallback.submitScore(score);
    }

    try {
      return await this.primary.submitScore(score);
    } catch {
      this.usingFallback = true;
      return this.fallback.submitScore(score);
    }
  }
}

export function createLeaderboard(env: ImportMetaEnv): ResilientLeaderboardAdapter {
  const fallback = new LocalLeaderboardAdapter();

  if (env.VITE_DISABLE_SERVER_LEADERBOARD === 'true') {
    return new ResilientLeaderboardAdapter(null, fallback);
  }

  return new ResilientLeaderboardAdapter(
    new EventApiLeaderboardAdapter(env.VITE_LEADERBOARD_API_BASE?.trim() || ''),
    fallback
  );
}
