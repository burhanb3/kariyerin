import {
  SCORE_STATUSES,
  type AdminScoreEntry,
  type ScoreStatus
} from '../shared/score.ts';

type AdminAppOptions = {
  root: HTMLElement;
};

const statusLabels: Record<ScoreStatus, string> = {
  valid: 'Geçerli',
  suspicious: 'Şüpheli',
  disqualified: 'Diskalifiye',
  deleted: 'Silindi'
};

const statusActions: Array<{ status: ScoreStatus; label: string }> = [
  { status: 'valid', label: 'Geçerli yap' },
  { status: 'suspicious', label: 'Şüpheli işaretle' },
  { status: 'disqualified', label: 'Diskalifiye et' },
  { status: 'deleted', label: 'Silindi olarak işaretle' }
];

export class AdminApp {
  private readonly root: HTMLElement;
  private adminCode = '';
  private rows: AdminScoreEntry[] = [];

  constructor(options: AdminAppOptions) {
    this.root = options.root;
    this.root.innerHTML = this.createMarkup();
    this.bindEvents();
    this.renderSummary();
  }

  private createMarkup(): string {
    return `
      <main class="admin-shell">
        <section class="admin-header">
          <div>
            <p class="admin-kicker">Octodive Event Control</p>
            <h1>Skor Yönetimi</h1>
          </div>
          <form class="admin-login" data-admin-login>
            <label>
              <span>Admin kodu</span>
              <input data-admin-code type="password" autocomplete="current-password" />
            </label>
            <button type="submit">Bağlan</button>
          </form>
        </section>

        <section class="admin-summary" data-admin-summary></section>
        <p class="admin-status" data-admin-status>Skorları görmek için admin kodunu girin.</p>
        <section class="admin-score-list" data-admin-score-list></section>
      </main>
    `;
  }

  private bindEvents(): void {
    this.query<HTMLFormElement>('[data-admin-login]').addEventListener('submit', (event) => {
      event.preventDefault();
      const code = this.query<HTMLInputElement>('[data-admin-code]').value.trim();
      this.adminCode = code;
      void this.loadScores();
    });

    this.root.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-score-id][data-score-status]');

      if (!button) {
        return;
      }

      const scoreId = button.dataset.scoreId ?? '';
      const scoreStatus = button.dataset.scoreStatus ?? '';

      if (!SCORE_STATUSES.includes(scoreStatus as ScoreStatus)) {
        return;
      }

      const reason = window.prompt('Aksiyon sebebi (opsiyonel):', '') ?? '';
      void this.updateStatus(scoreId, scoreStatus as ScoreStatus, reason);
    });
  }

  private async loadScores(): Promise<void> {
    const status = this.query<HTMLElement>('[data-admin-status]');

    if (!this.adminCode) {
      this.rows = [];
      this.renderRows();
      status.textContent = 'Skorları görmek için admin kodunu girin.';
      return;
    }

    status.textContent = 'Skorlar yükleniyor...';

    try {
      const response = await fetch('/api/admin/scores?limit=200', {
        headers: this.createAdminHeaders()
      });

      if (!response.ok) {
        throw new Error(`Admin skorları alınamadı: ${response.status}`);
      }

      const payload = (await response.json()) as { rows: AdminScoreEntry[] };
      this.rows = payload.rows;
      this.renderRows();
      status.textContent = `${this.rows.length} skor listelendi. Public tabloda sadece geçerli skorlar görünür.`;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Admin skorları alınamadı.';
      this.rows = [];
      this.query<HTMLElement>('[data-admin-score-list]').innerHTML = '';
      this.renderSummary();
    }
  }

  private async updateStatus(scoreId: string, scoreStatus: ScoreStatus, reason: string): Promise<void> {
    const status = this.query<HTMLElement>('[data-admin-status]');
    status.textContent = 'Admin aksiyonu kaydediliyor...';

    try {
      const response = await fetch(`/api/admin/scores/${encodeURIComponent(scoreId)}/status`, {
        method: 'PATCH',
        headers: {
          ...this.createAdminHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scoreStatus,
          reason
        })
      });

      if (!response.ok) {
        throw new Error(`Admin aksiyonu kaydedilemedi: ${response.status}`);
      }

      await this.loadScores();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Admin aksiyonu kaydedilemedi.';
    }
  }

  private renderRows(): void {
    this.renderSummary();

    const list = this.query<HTMLElement>('[data-admin-score-list]');
    list.innerHTML = this.rows.map((row, index) => this.renderRow(row, index)).join('');
  }

  private renderSummary(): void {
    const summary = this.query<HTMLElement>('[data-admin-summary]');
    const byStatus = new Map<ScoreStatus, number>();

    for (const row of this.rows) {
      byStatus.set(row.scoreStatus, (byStatus.get(row.scoreStatus) ?? 0) + 1);
    }

    summary.innerHTML = SCORE_STATUSES.map((scoreStatus) => `
      <article class="admin-summary-card admin-summary-card--${scoreStatus}">
        <span>${statusLabels[scoreStatus]}</span>
        <strong>${byStatus.get(scoreStatus) ?? 0}</strong>
      </article>
    `).join('');
  }

  private renderRow(row: AdminScoreEntry, index: number): string {
    const formatter = new Intl.NumberFormat('en-US');
    const date = new Date(row.createdAt).toLocaleString('tr-TR');
    const actionDate = row.adminActionAt ? new Date(row.adminActionAt).toLocaleString('tr-TR') : '-';
    const userAgent = row.userAgent || '-';

    return `
      <article class="admin-score admin-score--${row.scoreStatus}">
        <div class="admin-score__main">
          <span class="admin-rank">#${index + 1}</span>
          <div>
            <h2>${this.escape(row.playerName)}</h2>
            <p>${formatter.format(row.score)} skor · ${row.pearls} inci · ${Math.round(row.elapsedMs / 1000)}s</p>
          </div>
          <strong class="admin-status-pill">${statusLabels[row.scoreStatus]}</strong>
        </div>

        <dl class="admin-meta">
          <div><dt>Tarih</dt><dd>${this.escape(date)}</dd></div>
          <div><dt>Maskeli IP</dt><dd>${this.escape(row.maskedIp)}</dd></div>
          <div><dt>Aynı client</dt><dd>${row.sameClientScoreCount} skor</dd></div>
          <div><dt>Client ID</dt><dd>${this.escape(row.clientId)}</dd></div>
          <div><dt>Run ID</dt><dd>${this.escape(row.runId)}</dd></div>
          <div><dt>User agent</dt><dd>${this.escape(userAgent)}</dd></div>
          <div><dt>Son aksiyon</dt><dd>${this.escape(row.adminAction || '-')}</dd></div>
          <div><dt>Aksiyon zamanı</dt><dd>${this.escape(actionDate)}</dd></div>
          <div><dt>Sebep</dt><dd>${this.escape(row.adminActionReason || '-')}</dd></div>
        </dl>

        <div class="admin-actions">
          ${statusActions.map((action) => `
            <button
              type="button"
              data-score-id="${this.escape(row.id)}"
              data-score-status="${action.status}"
              ${row.scoreStatus === action.status ? 'disabled' : ''}
            >
              ${action.label}
            </button>
          `).join('')}
        </div>
      </article>
    `;
  }

  private createAdminHeaders(): HeadersInit {
    return {
      'x-admin-code': this.adminCode
    };
  }

  private query<T extends HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);

    if (!element) {
      throw new Error(`Missing admin element: ${selector}`);
    }

    return element;
  }

  private escape(value: string): string {
    const element = document.createElement('span');
    element.textContent = value;
    return element.innerHTML;
  }
}
