import { ZenWebSettings, SettingKey, ProtectionStats, StatKey } from '../types';

export const DEFAULT_SETTINGS: ZenWebSettings = {
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

const SETTINGS_STORAGE_KEY = 'zenweb_settings';
const STATS_STORAGE_KEY = 'zenweb_stats';

/**
 * Retrieves the current settings from chrome.storage.local with defaults fallback.
 */
export async function getSettings(): Promise<ZenWebSettings> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const result = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
      const stored = result[SETTINGS_STORAGE_KEY];
      return stored ? { ...DEFAULT_SETTINGS, ...stored } : { ...DEFAULT_SETTINGS };
    }
    // Fallback for dev / non-extension preview
    const local = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return local ? { ...DEFAULT_SETTINGS, ...JSON.parse(local) } : { ...DEFAULT_SETTINGS };
  } catch (error) {
    console.error('Failed to load ZenWeb settings:', error);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Saves complete settings to storage.
 */
export async function saveSettings(settings: ZenWebSettings): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: settings });
      return;
    }
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save ZenWeb settings:', error);
  }
}

/**
 * Updates a single setting and persists it.
 */
export async function updateSetting<K extends SettingKey>(
  key: K,
  value: ZenWebSettings[K]
): Promise<ZenWebSettings> {
  const current = await getSettings();
  const updated: ZenWebSettings = {
    ...current,
    [key]: value,
  };
  await saveSettings(updated);
  return updated;
}

/**
 * Subscribes to settings change events.
 */
export function onSettingsChange(callback: (newSettings: ZenWebSettings) => void): void {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[SETTINGS_STORAGE_KEY]) {
        const newSettings = changes[SETTINGS_STORAGE_KEY].newValue as ZenWebSettings;
        callback({ ...DEFAULT_SETTINGS, ...newSettings });
      }
    });
  }
}

/**
 * Subscribes to protection stats change events in real-time.
 */
export function onStatsChange(callback: (newStats: ProtectionStats) => void): void {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[STATS_STORAGE_KEY]) {
        const newStats = changes[STATS_STORAGE_KEY].newValue as ProtectionStats;
        callback({ ...DEFAULT_STATS, ...newStats });
      }
    });
  }
}

/**
 * Retrieves protection stats from local storage.
 */
export async function getStats(): Promise<ProtectionStats> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const result = await chrome.storage.local.get(STATS_STORAGE_KEY);
      const stored = result[STATS_STORAGE_KEY];
      return stored ? { ...DEFAULT_STATS, ...stored } : { ...DEFAULT_STATS };
    }
    const local = localStorage.getItem(STATS_STORAGE_KEY);
    return local ? { ...DEFAULT_STATS, ...JSON.parse(local) } : { ...DEFAULT_STATS };
  } catch (error) {
    console.error('Failed to load ZenWeb stats:', error);
    return { ...DEFAULT_STATS };
  }
}

/**
 * Increments a protection stat metric in local storage.
 */
export async function recordProtectionEvent(key: StatKey, increment = 1): Promise<ProtectionStats> {
  const current = await getStats();
  const updated: ProtectionStats = {
    ...current,
    [key]: (current[key] || 0) + increment,
    totalTimeSavedSeconds: current.totalTimeSavedSeconds + increment * 15,
  };
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [STATS_STORAGE_KEY]: updated });
    } else {
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (err) {
    console.error('Failed to record protection event:', err);
  }
  return updated;
}

/**
 * Resets stats back to initial state.
 */
export async function resetStats(): Promise<ProtectionStats> {
  const freshStats: ProtectionStats = {
    seoSpamFiltered: 0,
    pinterestHidden: 0,
    videosSuppressed: 0,
    recipesSkipped: 0,
    overlaysSmashed: 0,
    fakeDownloadsDefused: 0,
    formsBackedUp: 0,
    totalTimeSavedSeconds: 0,
  };
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [STATS_STORAGE_KEY]: freshStats });
    } else {
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(freshStats));
    }
  } catch (err) {
    console.error('Failed to reset stats:', err);
  }
  return freshStats;
}

