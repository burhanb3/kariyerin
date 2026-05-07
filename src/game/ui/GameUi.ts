import type Phaser from 'phaser';

import type { AudioManager } from '../audio/AudioManager.ts';
import {
  DEFAULT_PLAYER_NAME,
  MAX_PLAYER_NAME_LENGTH
} from '../../shared/score.ts';
import type {
  LeaderboardEntry,
  LeaderboardScope,
  ResilientLeaderboardAdapter
} from '../services/leaderboard.ts';
import { GameEvents, type GameOverPayload, type MessagePayload, type ScorePayload } from '../types.ts';

type GameUiOptions = {
  root: HTMLElement;
  eventBus: Phaser.Events.EventEmitter;
  leaderboard: ResilientLeaderboardAdapter;
  audio: AudioManager;
  clubName: string;
  eventLabel: string;
  startGame: () => void;
  togglePause: () => void;
  setPaused: (paused: boolean) => void;
};

const bestScoreKey = 'octodash.bestScore.v1';
const clientIdKey = 'octodash.clientId.v1';
const leaderboardRowCount = 8;
const autoSubmitNamedDelayMs = 1200;

export class GameUi {
  private readonly root: HTMLElement;
  private readonly eventBus: Phaser.Events.EventEmitter;
  private readonly leaderboard: ResilientLeaderboardAdapter;
  private readonly audio: AudioManager;
  private readonly startGame: () => void;
  private readonly togglePause: () => void;
  private readonly setPaused: (paused: boolean) => void;
  private currentScope: LeaderboardScope = 'all-time';
  private lastGameOver: GameOverPayload | null = null;
  private currentRunId = '';
  private autoSubmitTimer: number | null = null;
  private autoSubmitArmed = false;

  constructor(options: GameUiOptions) {
    this.root = options.root;
    this.eventBus = options.eventBus;
    this.leaderboard = options.leaderboard;
    this.audio = options.audio;
    this.startGame = options.startGame;
    this.togglePause = options.togglePause;
    this.setPaused = options.setPaused;

    this.root.innerHTML = this.createMarkup();
    this.bindDomEvents();
    this.bindGameEvents();
    this.updateMuteButtons();
    void this.renderLeaderboard('all-time');
  }

  private createMarkup(): string {
    return `
      <div class="hud" data-hud>
        <div class="hud__cluster">
          <div class="hud-pill">
            <span class="hud-pill__label">Skor</span>
            <strong data-score>0</strong>
          </div>
          <div class="hud-pill">
            <span class="hud-pill__label">İnci</span>
            <strong data-pearls>0</strong>
          </div>
          <div class="hud-pill hud-pill--status" data-status-pill>
            <span data-status>Hazır</span>
          </div>
        </div>
        <div class="hud__actions">
          <button class="icon-button" type="button" data-action="pause" aria-label="Pause">
            <span class="icon-pause" aria-hidden="true"></span>
          </button>
          <button class="icon-button" type="button" data-action="mute" aria-label="Toggle sound">
            <span class="icon-sound" aria-hidden="true"></span>
          </button>
        </div>
      </div>

      <div class="toast" data-toast aria-live="polite"></div>

      <section class="screen screen--menu is-active" data-screen="menu">
        <div class="menu-layout">
          <div class="menu-copy">
            <h1>KARİYER-IN</h1>
            <div class="menu-actions">
              <button class="primary-button" type="button" data-action="play">Play</button>
              <button class="secondary-button" type="button" data-action="leaderboard">Sıralama</button>
            </div>
            <p class="controls">Space / Click</p>
          </div>
        </div>
      </section>

      <section class="screen screen--pause" data-screen="pause">
        <div class="panel panel--small">
          <p class="panel-kicker">Octodive</p>
          <h2>Duraklatıldı</h2>
          <div class="panel-actions">
            <button class="primary-button" type="button" data-action="resume">Devam Et</button>
            <button class="secondary-button" type="button" data-action="menu">Menu</button>
          </div>
        </div>
      </section>

      <section class="screen screen--gameover" data-screen="gameover">
        <div class="panel">
          <p class="panel-kicker" data-gameover-message>Dalış Tamamlandı</p>
          <h2>Game Over</h2>
          <div class="result-grid">
            <div>
              <span>Skor</span>
              <strong data-final-score>0</strong>
            </div>
            <div>
              <span>En İyi</span>
              <strong data-best-score>0</strong>
            </div>
            <div>
              <span>İnci</span>
              <strong data-final-pearls>0</strong>
            </div>
            <div>
              <span>Süre</span>
              <strong data-final-time>0s</strong>
            </div>
          </div>
          <label class="name-field">
            <span>Oyuncu Adı</span>
            <input data-player-name maxlength="${MAX_PLAYER_NAME_LENGTH}" autocomplete="name" placeholder="${DEFAULT_PLAYER_NAME}" />
          </label>
          <p class="submit-status" data-submit-status></p>
          <div class="panel-actions">
            <button class="primary-button" type="button" data-action="submit">Skoru Gönder</button>
            <button class="secondary-button" type="button" data-action="again">Tekrar Oyna</button>
            <button class="ghost-button" type="button" data-action="menu">Menu</button>
          </div>
        </div>
      </section>

      <section class="screen screen--leaderboard" data-screen="leaderboard">
        <div class="panel panel--leaderboard">
          <div class="leaderboard-heading">
            <div>
              <p class="panel-kicker">Canlı Skorlar</p>
              <h2>Liderlik Tablosu</h2>
            </div>
            <button class="icon-button" type="button" data-action="menu" aria-label="Menüye dön">
              <span class="icon-close" aria-hidden="true"></span>
            </button>
          </div>
          <div class="tabs" role="tablist" aria-label="Liderlik tablosu">
            <button type="button" class="tab is-active" data-scope="all-time">Tüm Zamanlar</button>
          </div>
          <div class="leaderboard-table-head" aria-hidden="true">
            <span>Sıra</span>
            <span>Oyuncu</span>
            <span>Skor</span>
          </div>
          <div class="leaderboard-status" data-leaderboard-status>Skorlar yükleniyor</div>
          <div class="leaderboard-list" data-leaderboard-list></div>
          <div class="leaderboard-actions">
            <button class="secondary-button leaderboard-button leaderboard-button--menu" type="button" data-action="menu">
              <span aria-hidden="true">←</span>
              <strong>Menu</strong>
            </button>
            <button class="primary-button leaderboard-button leaderboard-button--play" type="button" data-action="play">
              <strong>Play</strong>
              <span aria-hidden="true">▷</span>
            </button>
          </div>
        </div>
      </section>
    `;
  }

  private bindDomEvents(): void {
    this.root.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const actionButton = target.closest<HTMLElement>('[data-action]');
      const scopeButton = target.closest<HTMLButtonElement>('[data-scope]');

      if (scopeButton) {
        this.audio.playClick();
        void this.renderLeaderboard(scopeButton.dataset.scope as LeaderboardScope);
        return;
      }

      if (!actionButton) {
        return;
      }

      this.audio.playClick();

      switch (actionButton.dataset.action) {
        case 'play':
        case 'again':
          void this.requestLandscapeFullscreen();
          void this.audio.unlock();
          this.autoSubmitArmed = false;
          this.clearAutoSubmitTimer();
          this.currentRunId = this.createId('run');
          this.showGameplay();
          this.startGame();
          break;
        case 'leaderboard':
          this.showScreen('leaderboard');
          void this.renderLeaderboard(this.currentScope);
          break;
        case 'pause':
          this.togglePause();
          break;
        case 'resume':
          this.showGameplay();
          this.setPaused(false);
          break;
        case 'menu':
          this.autoSubmitArmed = false;
          this.clearAutoSubmitTimer();
          this.setPaused(true);
          this.showScreen('menu');
          break;
        case 'mute':
          this.audio.toggleMuted();
          this.updateMuteButtons();
          break;
        case 'submit':
          void this.submitScore();
          break;
      }
    });

    this.root.addEventListener('input', (event) => {
      const input = (event.target as HTMLElement).closest<HTMLInputElement>('[data-player-name]');

      if (!input || !this.autoSubmitArmed || !input.value.trim()) {
        return;
      }

      this.scheduleAutoSubmit(
        autoSubmitNamedDelayMs,
        'İsim alındı. Yeni rekor otomatik gönderilecek.'
      );
    });
  }

  private bindGameEvents(): void {
    this.eventBus.on(GameEvents.score, (payload: ScorePayload) => {
      this.setText('[data-score]', String(payload.score));
      this.setText('[data-pearls]', String(payload.pearls));

      const statusPill = this.query<HTMLElement>('[data-status-pill]');
      if (payload.shieldMs > 0) {
        statusPill.dataset.mode = 'shield';
        this.setText('[data-status]', `${Math.ceil(payload.shieldMs / 1000)}s`);
      } else {
        statusPill.dataset.mode = 'idle';
        this.setText('[data-status]', '');
      }
    });

    this.eventBus.on(GameEvents.message, (payload: MessagePayload) => {
      this.showToast(payload.text, payload.tone ?? 'system');
    });

    this.eventBus.on(GameEvents.gameOver, (payload: GameOverPayload) => {
      this.showGameOver(payload);
    });

    this.eventBus.on(GameEvents.pauseChange, ({ paused }: { paused: boolean }) => {
      if (paused) {
        this.showScreen('pause', true);
      } else {
        this.showGameplay();
      }
    });

    this.eventBus.on(GameEvents.muteChange, () => {
      this.updateMuteButtons();
    });
  }

  private async submitScore(): Promise<void> {
    if (!this.lastGameOver) {
      return;
    }

    const button = this.query<HTMLButtonElement>('[data-action="submit"]');
    const input = this.query<HTMLInputElement>('[data-player-name]');
    const status = this.query<HTMLElement>('[data-submit-status]');
    const playerName = input.value.trim();

    if (button.disabled) {
      return;
    }

    if (!playerName) {
      status.textContent = 'Skoru göndermek için adınızı yazın.';
      return;
    }

    this.autoSubmitArmed = false;
    this.clearAutoSubmitTimer();
    button.disabled = true;
    status.textContent = 'Skor gönderiliyor...';

    try {
      await this.leaderboard.submitScore({
        playerName,
        score: this.lastGameOver.score,
        pearls: this.lastGameOver.pearls,
        elapsedMs: this.lastGameOver.elapsedMs,
        clientId: this.getClientId(),
        runId: this.currentRunId || this.createId('run')
      });
      status.textContent = 'Skor etkinlik tablosuna gönderildi.';
      await this.renderLeaderboard('all-time');
      button.textContent = 'Gönderildi';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
      console.error('Score submit failed', { message });
      status.textContent = `Skor gönderilemedi. ${message}`;
      button.disabled = false;
      button.textContent = 'Tekrar Dene';
    }
  }

  private async renderLeaderboard(scope: LeaderboardScope): Promise<void> {
    this.currentScope = scope;
    this.root.querySelectorAll<HTMLButtonElement>('[data-scope]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.scope === scope);
    });

    const list = this.query<HTMLElement>('[data-leaderboard-list]');
    const status = this.query<HTMLElement>('[data-leaderboard-status]');
    list.innerHTML = '<div class="leaderboard-empty">Skorlar yükleniyor...</div>';

    try {
      const rows = await this.leaderboard.getScores(scope, leaderboardRowCount);
      const displayRows = this.fillLeaderboardRows(rows, leaderboardRowCount);
      status.textContent = this.leaderboard.isUsingFallback
        ? 'Yerel yedek skor tablosu'
        : 'Canlı Supabase skor tablosu';
      list.innerHTML = displayRows.map((entry, index) => this.renderLeaderboardEntry(entry, index)).join('');
    } catch {
      status.textContent = 'Liderlik tablosu kullanılamıyor';
      list.innerHTML = '<div class="leaderboard-empty">Backend yanıt verdiğinde skorlar burada görünecek.</div>';
    }
  }

  private renderLeaderboardEntry(entry: LeaderboardEntry, index: number): string {
    const rank = index + 1;
    const badgeClass = rank <= 3 ? ` rank-badge--${rank}` : '';
    const avatarClass = ` leaderboard-avatar--${((rank - 1) % 8) + 1}`;
    const date = new Date(entry.createdAt).toLocaleDateString('tr-TR', { month: 'short', day: 'numeric' });
    const score = new Intl.NumberFormat('en-US').format(entry.score);

    return `
      <article class="leaderboard-row leaderboard-row--${rank}">
        <span class="rank-badge${badgeClass}"><span>${rank}</span></span>
        <span class="leaderboard-avatar${avatarClass}" aria-hidden="true"></span>
        <div class="leaderboard-player">
          <strong>${this.escape(entry.playerName)}</strong>
          <span>${entry.pearls} inci · ${date}</span>
        </div>
        <strong class="leaderboard-score">${score}</strong>
      </article>
    `;
  }

  private fillLeaderboardRows(rows: LeaderboardEntry[], limit: number): LeaderboardEntry[] {
    if (rows.length >= limit) {
      return rows.slice(0, limit);
    }

    const placeholders = Array.from({ length: limit - rows.length }, (_, index): LeaderboardEntry => {
      const rank = rows.length + index + 1;

      return {
        id: `placeholder-${rank}`,
        playerName: DEFAULT_PLAYER_NAME,
        score: 0,
        pearls: 0,
        createdAt: '2026-05-06T00:00:00.000Z'
      };
    });

    return [...rows, ...placeholders];
  }

  private showGameOver(payload: GameOverPayload): void {
    this.clearAutoSubmitTimer();
    this.lastGameOver = payload;
    const previousBest = this.getBestScore();
    const best = Math.max(previousBest, payload.score);
    const isNewBest = payload.score > previousBest;
    window.localStorage.setItem(bestScoreKey, String(best));

    const formatter = new Intl.NumberFormat('en-US');
    this.setText('[data-final-score]', formatter.format(payload.score));
    this.setText('[data-best-score]', formatter.format(best));
    this.setText('[data-final-pearls]', formatter.format(payload.pearls));
    this.setText('[data-final-time]', `${Math.round(payload.elapsedMs / 1000)}s`);
    this.setText('[data-gameover-message]', this.randomGameOverMessage(isNewBest));
    this.query<HTMLElement>('[data-submit-status]').textContent = '';
    const input = this.query<HTMLInputElement>('[data-player-name]');
    const submit = this.query<HTMLButtonElement>('[data-action="submit"]');
    submit.disabled = false;
    submit.textContent = 'Skoru Gönder';
    this.showScreen('gameover');

    this.autoSubmitArmed = isNewBest;

    if (isNewBest) {
      if (input.value.trim()) {
        this.scheduleAutoSubmit(
          autoSubmitNamedDelayMs,
          'Yeni rekor otomatik gönderilecek.'
        );
      } else {
        this.query<HTMLElement>('[data-submit-status]').textContent =
          'Yeni rekor! Adınızı yazınca otomatik gönderilecek.';
      }
    }
  }

  private scheduleAutoSubmit(delayMs: number, message: string): void {
    if (!this.autoSubmitArmed) {
      return;
    }

    const submit = this.query<HTMLButtonElement>('[data-action="submit"]');

    if (submit.disabled) {
      return;
    }

    this.clearAutoSubmitTimer();
    this.query<HTMLElement>('[data-submit-status]').textContent = message;
    this.autoSubmitTimer = window.setTimeout(() => {
      this.autoSubmitTimer = null;
      void this.submitScore();
    }, delayMs);
  }

  private clearAutoSubmitTimer(): void {
    if (this.autoSubmitTimer === null) {
      return;
    }

    window.clearTimeout(this.autoSubmitTimer);
    this.autoSubmitTimer = null;
  }

  private showGameplay(): void {
    this.root.querySelectorAll<HTMLElement>('[data-screen]').forEach((screen) => {
      screen.classList.remove('is-active');
    });
    this.query<HTMLElement>('[data-hud]').classList.add('is-active');
  }

  private async requestLandscapeFullscreen(): Promise<void> {
    const isLandscapePhone = window.matchMedia?.('(pointer: coarse) and (orientation: landscape)').matches ?? false;

    if (!isLandscapePhone || document.fullscreenElement || !document.documentElement.requestFullscreen) {
      return;
    }

    try {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    } catch {
      // iOS Safari may deny fullscreen for normal pages; CSS safe-area sizing is the fallback.
    }
  }

  private showScreen(name: string, keepHud = false): void {
    this.root.querySelectorAll<HTMLElement>('[data-screen]').forEach((screen) => {
      screen.classList.toggle('is-active', screen.dataset.screen === name);
    });
    this.query<HTMLElement>('[data-hud]').classList.toggle('is-active', keepHud);
  }

  private showToast(text: string, tone: string): void {
    const toast = this.query<HTMLElement>('[data-toast]');
    toast.textContent = text;
    toast.dataset.tone = tone;
    toast.classList.remove('is-active');
    window.requestAnimationFrame(() => {
      toast.classList.add('is-active');
    });
  }

  private updateMuteButtons(): void {
    this.root.querySelectorAll<HTMLElement>('.icon-sound').forEach((icon) => {
      icon.classList.toggle('is-muted', this.audio.muted);
    });
  }

  private getBestScore(): number {
    return Number.parseInt(window.localStorage.getItem(bestScoreKey) ?? '0', 10) || 0;
  }

  private getClientId(): string {
    const existing = window.localStorage.getItem(clientIdKey);

    if (existing) {
      return existing;
    }

    const clientId = this.createId('client');
    window.localStorage.setItem(clientIdKey, clientId);
    return clientId;
  }

  private createId(prefix: string): string {
    if ('crypto' in window && typeof window.crypto.randomUUID === 'function') {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  private randomGameOverMessage(isNewBest: boolean): string {
    if (isNewBest) {
      return 'Yeni Rekor Dalış';
    }

    const messages = ['Dalış Tamamlandı', 'Güzel Dalış', 'Mercan Rotası', 'Bir Kez Daha'];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  private setText(selector: string, value: string): void {
    this.query<HTMLElement>(selector).textContent = value;
  }

  private query<T extends HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);

    if (!element) {
      throw new Error(`Missing UI element: ${selector}`);
    }

    return element;
  }

  private escape(value: string): string {
    const element = document.createElement('span');
    element.textContent = value;
    return element.innerHTML;
  }
}
