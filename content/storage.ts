import { ZenWebSettings, ProtectionStats, StatKey } from '../types';

const SETTINGS_KEY = 'zenweb_settings';
const STATS_KEY = 'zenweb_stats';

const DEFAULT_SETTINGS: ZenWebSettings = {
  masterEnabled: true,
  humanSearchEnabled: true,
  pinterestBlockerEnabled: true,
  floatingVideoKillerEnabled: true,
  recipeSkipperEnabled: true,
  recipeReaderEnabled: true,
  autoOverlaySmasherEnabled: true,
  fakeDownloadGuardEnabled: true,
  formSalvagerEnabled: true,
  whitelistedDomains: [],
};

export const DEFAULT_STATS: ProtectionStats = {
  seoSpamFiltered: 0,
  pinterestHidden: 0,
  videosSuppressed: 0,
  recipesSkipped: 0,
  overlaysSmashed: 0,
  fakeDownloadsDefused: 0,
  formsBackedUp: 0,
  totalTimeSavedSeconds: 0,
};

const DEMO_BASELINE: ProtectionStats = {
  seoSpamFiltered: 14,
  pinterestHidden: 28,
  videosSuppressed: 5,
  recipesSkipped: 3,
  overlaysSmashed: 8,
  fakeDownloadsDefused: 12,
  formsBackedUp: 4,
  totalTimeSavedSeconds: 440,
};

const STATS_MIGRATION_KEY = 'zenweb_cleaned_demo_stats_v1';

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
      const res = await chrome.storage.local.get([STATS_KEY, STATS_MIGRATION_KEY]);
      let stored = res[STATS_KEY] as ProtectionStats | undefined;
      const alreadyCleaned = Boolean(res[STATS_MIGRATION_KEY]);
      if (!alreadyCleaned && stored) {
        stored = {
          seoSpamFiltered: Math.max(0, (stored.seoSpamFiltered || 0) - DEMO_BASELINE.seoSpamFiltered),
          pinterestHidden: Math.max(0, (stored.pinterestHidden || 0) - DEMO_BASELINE.pinterestHidden),
          videosSuppressed: Math.max(0, (stored.videosSuppressed || 0) - DEMO_BASELINE.videosSuppressed),
          recipesSkipped: Math.max(0, (stored.recipesSkipped || 0) - DEMO_BASELINE.recipesSkipped),
          overlaysSmashed: Math.max(0, (stored.overlaysSmashed || 0) - DEMO_BASELINE.overlaysSmashed),
          fakeDownloadsDefused: Math.max(0, (stored.fakeDownloadsDefused || 0) - DEMO_BASELINE.fakeDownloadsDefused),
          formsBackedUp: Math.max(0, (stored.formsBackedUp || 0) - DEMO_BASELINE.formsBackedUp),
          totalTimeSavedSeconds: Math.max(0, (stored.totalTimeSavedSeconds || 0) - DEMO_BASELINE.totalTimeSavedSeconds),
        };
        await chrome.storage.local.set({ [STATS_KEY]: stored, [STATS_MIGRATION_KEY]: true });
      }
      return stored ? { ...DEFAULT_STATS, ...stored } : DEFAULT_STATS;
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
      const res = await chrome.storage.local.get([STATS_KEY, STATS_MIGRATION_KEY]);
      let current = (res[STATS_KEY] ? { ...DEFAULT_STATS, ...res[STATS_KEY] } : { ...DEFAULT_STATS }) as ProtectionStats;
      const alreadyCleaned = Boolean(res[STATS_MIGRATION_KEY]);
      if (!alreadyCleaned && res[STATS_KEY]) {
        current = {
          seoSpamFiltered: Math.max(0, (current.seoSpamFiltered || 0) - DEMO_BASELINE.seoSpamFiltered),
          pinterestHidden: Math.max(0, (current.pinterestHidden || 0) - DEMO_BASELINE.pinterestHidden),
          videosSuppressed: Math.max(0, (current.videosSuppressed || 0) - DEMO_BASELINE.videosSuppressed),
          recipesSkipped: Math.max(0, (current.recipesSkipped || 0) - DEMO_BASELINE.recipesSkipped),
          overlaysSmashed: Math.max(0, (current.overlaysSmashed || 0) - DEMO_BASELINE.overlaysSmashed),
          fakeDownloadsDefused: Math.max(0, (current.fakeDownloadsDefused || 0) - DEMO_BASELINE.fakeDownloadsDefused),
          formsBackedUp: Math.max(0, (current.formsBackedUp || 0) - DEMO_BASELINE.formsBackedUp),
          totalTimeSavedSeconds: Math.max(0, (current.totalTimeSavedSeconds || 0) - DEMO_BASELINE.totalTimeSavedSeconds),
        };
      }
      const count = (current[key] || 0) + increment;
      const time = (current.totalTimeSavedSeconds || 0) + increment * 15;
      await chrome.storage.local.set({
        [STATS_KEY]: { ...current, [key]: count, totalTimeSavedSeconds: time },
        [STATS_MIGRATION_KEY]: true,
      });
    }
  } catch (err) {
    console.error('[ZenWeb] Failed to record event:', err);
  }
}
