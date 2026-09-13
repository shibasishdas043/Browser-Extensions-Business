import { ZenWebSettings, ProtectionStats, StatKey } from '../types';

const SETTINGS_KEY = 'zenweb_settings';
const STATS_KEY = 'zenweb_stats';

const DEFAULT_SETTINGS: ZenWebSettings = {
  masterEnabled: true,
  humanSearchEnabled: true,
  pinterestBlockerEnabled: true,
  floatingVideoKillerEnabled: true,
  recipeSkipperEnabled: true,
  autoOverlaySmasherEnabled: true,
  fakeDownloadGuardEnabled: true,
  formSalvagerEnabled: true,
};

export const DEFAULT_STATS: ProtectionStats = {
  seoSpamFiltered: 14,
  pinterestHidden: 28,
  videosSuppressed: 5,
  recipesSkipped: 3,
  overlaysSmashed: 8,
  fakeDownloadsDefused: 12,
  formsBackedUp: 4,
  totalTimeSavedSeconds: 440,
};

export async function getSettings(): Promise<ZenWebSettings> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const res = await chrome.storage.local.get(SETTINGS_KEY);
      return res[SETTINGS_KEY] ? { ...DEFAULT_SETTINGS, ...res[SETTINGS_KEY] } : DEFAULT_SETTINGS;
    }
    const local = localStorage.getItem(SETTINGS_KEY);
    return local ? { ...DEFAULT_SETTINGS, ...JSON.parse(local) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function onSettingsChange(callback: (newSettings: ZenWebSettings) => void): void {
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[SETTINGS_KEY]) {
        const val = changes[SETTINGS_KEY].newValue as ZenWebSettings;
        callback({ ...DEFAULT_SETTINGS, ...val });
      }
    });
  }
}

export async function getStats(): Promise<ProtectionStats> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const res = await chrome.storage.local.get(STATS_KEY);
      return res[STATS_KEY] ? { ...DEFAULT_STATS, ...res[STATS_KEY] } : DEFAULT_STATS;
    }
    const local = localStorage.getItem(STATS_KEY);
    return local ? { ...DEFAULT_STATS, ...JSON.parse(local) } : DEFAULT_STATS;
  } catch {
    return DEFAULT_STATS;
  }
}

export function onStatsChange(callback: (newStats: ProtectionStats) => void): void {
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[STATS_KEY]) {
        const val = changes[STATS_KEY].newValue as ProtectionStats;
        callback({ ...DEFAULT_STATS, ...val });
      }
    });
  }
}

export async function recordProtectionEvent(key: StatKey, increment = 1): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const res = await chrome.storage.local.get(STATS_KEY);
      const current = (res[STATS_KEY] ? { ...DEFAULT_STATS, ...res[STATS_KEY] } : { ...DEFAULT_STATS }) as ProtectionStats;
      const count = (current[key] || 0) + increment;
      const time = (current.totalTimeSavedSeconds || 0) + increment * 15;
      await chrome.storage.local.set({
        [STATS_KEY]: { ...current, [key]: count, totalTimeSavedSeconds: time },
      });
    }
  } catch (err) {
    console.error('[ZenWeb] Failed to record event:', err);
  }
}
