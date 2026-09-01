import {
  getSettings,
  updateSetting,
  saveSettings,
  DEFAULT_SETTINGS,
  getStats,
  resetStats,
} from '../utils/storage';
import { ZenWebSettings, SettingKey, ProtectionStats } from '../types';

class ZenWebOptionsUI {
  private masterToggle!: HTMLInputElement;
  private checkboxes!: NodeListOf<HTMLInputElement>;
  private resetAllBtn!: HTMLButtonElement;
  private resetStatsBtn!: HTMLButtonElement;
  private toastEl!: HTMLElement;
  private toastMsgEl!: HTMLElement;
  private toastTimer: number | null = null;

  constructor() {
    document.addEventListener('DOMContentLoaded', () => this.init());
  }

  private async init() {
    this.queryElements();
    this.bindEvents();
    await this.loadSettings();
    await this.loadStats();
  }

  private queryElements() {
    this.masterToggle = document.getElementById('masterEnabled') as HTMLInputElement;
    this.checkboxes = document.querySelectorAll<HTMLInputElement>('[data-setting]');
    this.resetAllBtn = document.getElementById('zw-btn-reset-all') as HTMLButtonElement;
    this.resetStatsBtn = document.getElementById('zw-btn-reset-stats') as HTMLButtonElement;
    this.toastEl = document.getElementById('zw-options-toast') as HTMLElement;
    this.toastMsgEl = document.getElementById('zw-options-toast-msg') as HTMLElement;
  }

  private bindEvents() {
    this.masterToggle.addEventListener('change', async () => {
      const isEnabled = this.masterToggle.checked;
      await updateSetting('masterEnabled', isEnabled);
      this.checkboxes.forEach((cb) => {
        cb.disabled = !isEnabled;
      });
      this.showToast(isEnabled ? 'Master protections active' : 'Master protections paused');
    });

    this.checkboxes.forEach((cb) => {
      cb.addEventListener('change', async () => {
        const key = cb.dataset.setting as SettingKey;
        if (key) {
          await updateSetting(key, cb.checked);
          this.showToast('Setting updated');
        }
      });
    });

    this.resetAllBtn.addEventListener('click', async () => {
      await saveSettings(DEFAULT_SETTINGS);
      await this.loadSettings();
      this.showToast('All settings reset to default');
    });

    this.resetStatsBtn.addEventListener('click', async () => {
      const fresh = await resetStats();
      this.displayStats(fresh);
      this.showToast('Session statistics cleared');
    });
  }

  private async loadSettings() {
    const settings = await getSettings();
    this.masterToggle.checked = settings.masterEnabled;

    this.checkboxes.forEach((cb) => {
      const key = cb.dataset.setting as SettingKey;
      if (key && typeof settings[key] === 'boolean') {
        cb.checked = settings[key] as boolean;
        cb.disabled = !settings.masterEnabled;
      }
    });
  }

  private async loadStats() {
    const stats = await getStats();
    this.displayStats(stats);
  }

  private displayStats(stats: ProtectionStats) {
    const map: Record<string, number> = {
      'stat-seo': stats.seoSpamFiltered,
      'stat-pinterest': stats.pinterestHidden,
      'stat-videos': stats.videosSuppressed,
      'stat-recipes': stats.recipesSkipped,
      'stat-overlays': stats.overlaysSmashed,
      'stat-downloads': stats.fakeDownloadsDefused,
      'stat-forms': stats.formsBackedUp,
    };

    for (const [id, val] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (el) el.textContent = val.toString();
    }
  }

  private showToast(msg: string) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMsgEl.textContent = msg;
    this.toastEl.classList.add('show');
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.classList.remove('show');
    }, 2000);
  }
}

new ZenWebOptionsUI();

