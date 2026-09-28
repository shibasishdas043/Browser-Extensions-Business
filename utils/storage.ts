import { ZenWebSettings, SettingKey, ProtectionStats, StatKey } from '../types';

export const DEFAULT_SETTINGS: ZenWebSettings = {
  masterEnabled: true,
  humanSearchEnabled: true,
  pinterestBlockerEnabled: true,
  floatingVideoKillerEnabled: true,
  recipeSkipperEnabled: true,
  recipeReaderEnabled: true,
  fakeDownloadGuardEnabled: true,
  formSalvagerEnabled: true,
  whitelistedDomains: [],
};

export const DEFAULT_STATS: ProtectionStats = {
  seoSpamFiltered: 0,
  pinterestHidden: 0,
  videosSuppressed: 0,
  recipesSkipped: 0,
  fakeDownloadsDefused: 0,
  formsBackedUp: 0,
  totalTimeSavedSeconds: 0,
};

const DEMO_BASELINE: ProtectionStats = {
  seoSpamFiltered: 14,
  pinterestHidden: 28,
  videosSuppressed: 5,
  recipesSkipped: 3,
  fakeDownloadsDefused: 12,
  formsBackedUp: 4,
  totalTimeSavedSeconds: 440,
};

const STATS_MIGRATION_KEY = 'zenweb_cleaned_demo_stats_v1';

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
 * Checks if a domain or its parent domain is whitelisted.
 */
export async function isDomainWhitelisted(domain: string): Promise<boolean> {
  const settings = await getSettings();
  const cleanDomain = domain.toLowerCase().replace(/^www\./, '');
  return settings.whitelistedDomains.some((d) => {
    const cd = d.toLowerCase().replace(/^www\./, '');
    return cleanDomain === cd || cleanDomain.endsWith('.' + cd);
  });
}

/**
 * Adds a domain to the whitelist.
 */
export async function addDomainToWhitelist(domain: string): Promise<string[]> {
  const settings = await getSettings();
  const cleanDomain = domain.toLowerCase().replace(/^www\./, '').trim();
  if (!cleanDomain) return settings.whitelistedDomains;

  const current = new Set(settings.whitelistedDomains.map((d) => d.toLowerCase().replace(/^www\./, '')));
  current.add(cleanDomain);

  const updated = Array.from(current);
  await updateSetting('whitelistedDomains', updated);
  return updated;
}

/**
 * Removes a domain from the whitelist.
 */
export async function removeDomainFromWhitelist(domain: string): Promise<string[]> {
  const settings = await getSettings();
  const cleanDomain = domain.toLowerCase().replace(/^www\./, '').trim();

  const updated = settings.whitelistedDomains.filter(
    (d) => d.toLowerCase().replace(/^www\./, '') !== cleanDomain
  );
  await updateSetting('whitelistedDomains', updated);
  return updated;
}

/**
 * Toggles a domain on or off the whitelist.
 */
export async function toggleDomainWhitelist(domain: string): Promise<boolean> {
  const whitelisted = await isDomainWhitelisted(domain);
  if (whitelisted) {
    await removeDomainFromWhitelist(domain);
    return false;
  } else {
    await addDomainToWhitelist(domain);
    return true;
  }
}

/**
 * Saves complete protection stats to storage.
 */
export async function saveStats(stats: ProtectionStats): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ [STATS_STORAGE_KEY]: stats });
      return;
    }
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch (error) {
    console.error('Failed to save ZenWeb stats:', error);
  }
}

export interface ImportResult {
  success: boolean;
  error?: string;
  settingsRestored: boolean;
  whitelistedDomainsCount: number;
  statsRestored: boolean;
  draftsRestoredCount: number;
}

export interface ExportMetaResult {
  jsonStr: string;
  totalDrafts: number;
  totalDomains: number;
  totalExclusions: number;
}

/**
 * Exports all settings and saved drafts to a downloadable JSON payload.
 */
export async function exportSettingsAndDrafts(): Promise<string> {
  const meta = await exportSettingsAndDraftsWithMeta();
  return meta.jsonStr;
}

/**
 * Exports settings, statistics, exclusions, and drafts with metadata counts.
 */
export async function exportSettingsAndDraftsWithMeta(): Promise<ExportMetaResult> {
  const settings = await getSettings();
  const stats = await getStats();
  const drafts: Record<string, any> = {};
  const uniqueDomains = new Set<string>();

  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const all = await chrome.storage.local.get(null);
      for (const [k, v] of Object.entries(all)) {
        if (k.startsWith('zenweb_draft_')) {
          drafts[k] = v;
          if (v && typeof v === 'object') {
            const rawUrl = (v as any).url || (v as any).siteUrl || '';
            try {
              const host = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`).hostname.replace(/^www\./, '');
              if (host) uniqueDomains.add(host);
            } catch {
              if (rawUrl) uniqueDomains.add(rawUrl.split('/')[0]);
            }
          }
        }
      }
    } else {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('zenweb_draft_')) {
          try {
            const item = JSON.parse(localStorage.getItem(k) || '{}');
            drafts[k] = item;
            const rawUrl = item.url || item.siteUrl || '';
            if (rawUrl) {
              try {
                const host = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`).hostname.replace(/^www\./, '');
                if (host) uniqueDomains.add(host);
              } catch {
                uniqueDomains.add(rawUrl.split('/')[0]);
              }
            }
          } catch {}
        }
      }
    }
  } catch (err) {
    console.error('Failed reading drafts for export:', err);
  }

  const totalDrafts = Object.keys(drafts).length;
  const totalDomains = uniqueDomains.size;
  const totalExclusions = settings.whitelistedDomains?.length || 0;

  const backup = {
    format: 'zenweb_backup',
    version: '2.0.0',
    timestamp: Date.now(),
    exportedAt: new Date().toISOString(),
    summary: {
      totalDrafts,
      totalDomains,
      totalExclusions,
      totalTimeSavedSeconds: stats.totalTimeSavedSeconds || 0,
    },
    settings,
    stats,
    drafts,
  };

  return {
    jsonStr: JSON.stringify(backup, null, 2),
    totalDrafts,
    totalDomains,
    totalExclusions,
  };
}

/**
 * Imports and seamlessly validates settings, statistics, exclusions, and drafts from a JSON backup.
 */
export async function importSettingsAndDrafts(jsonStr: string): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    settingsRestored: false,
    whitelistedDomainsCount: 0,
    statsRestored: false,
    draftsRestoredCount: 0,
  };

  try {
    if (!jsonStr || typeof jsonStr !== 'string') {
      result.error = 'Empty or invalid backup data provided.';
      return result;
    }

    let data: any;
    try {
      data = JSON.parse(jsonStr);
    } catch {
      result.error = 'Invalid JSON syntax. Please select a valid .json backup file.';
      return result;
    }

    if (!data || typeof data !== 'object') {
      result.error = 'Unrecognized backup structure.';
      return result;
    }

    // 1. Resolve and restore Settings
    const rawSettings = data.settings && typeof data.settings === 'object'
      ? data.settings
      : (data.masterEnabled !== undefined ? data : null);

    if (rawSettings && typeof rawSettings === 'object') {
      let cleanDomains: string[] = [];
      if (Array.isArray(rawSettings.whitelistedDomains)) {
        cleanDomains = Array.from(
          new Set(
            rawSettings.whitelistedDomains
              .filter((d: any) => typeof d === 'string' && d.trim().length > 0)
              .map((d: string) =>
                d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0]
              )
              .filter(Boolean)
          )
        ) as string[];
      } else {
        const currentSettings = await getSettings();
        cleanDomains = currentSettings.whitelistedDomains || [];
      }

      const mergedSettings: ZenWebSettings = {
        masterEnabled: typeof rawSettings.masterEnabled === 'boolean' ? rawSettings.masterEnabled : DEFAULT_SETTINGS.masterEnabled,
        humanSearchEnabled: typeof rawSettings.humanSearchEnabled === 'boolean' ? rawSettings.humanSearchEnabled : DEFAULT_SETTINGS.humanSearchEnabled,
        pinterestBlockerEnabled: typeof rawSettings.pinterestBlockerEnabled === 'boolean' ? rawSettings.pinterestBlockerEnabled : DEFAULT_SETTINGS.pinterestBlockerEnabled,
        floatingVideoKillerEnabled: typeof rawSettings.floatingVideoKillerEnabled === 'boolean' ? rawSettings.floatingVideoKillerEnabled : DEFAULT_SETTINGS.floatingVideoKillerEnabled,
        recipeSkipperEnabled: typeof rawSettings.recipeSkipperEnabled === 'boolean' ? rawSettings.recipeSkipperEnabled : DEFAULT_SETTINGS.recipeSkipperEnabled,
        recipeReaderEnabled: typeof rawSettings.recipeReaderEnabled === 'boolean' ? rawSettings.recipeReaderEnabled : DEFAULT_SETTINGS.recipeReaderEnabled,
        fakeDownloadGuardEnabled: typeof rawSettings.fakeDownloadGuardEnabled === 'boolean' ? rawSettings.fakeDownloadGuardEnabled : DEFAULT_SETTINGS.fakeDownloadGuardEnabled,
        formSalvagerEnabled: typeof rawSettings.formSalvagerEnabled === 'boolean' ? rawSettings.formSalvagerEnabled : DEFAULT_SETTINGS.formSalvagerEnabled,
        whitelistedDomains: cleanDomains,
      };

      await saveSettings(mergedSettings);
      result.settingsRestored = true;
      result.whitelistedDomainsCount = cleanDomains.length;
    }

    // 2. Resolve and restore Stats (if present)
    if (data.stats && typeof data.stats === 'object') {
      const cleanStats: ProtectionStats = {
        seoSpamFiltered: Math.max(0, Number(data.stats.seoSpamFiltered) || 0),
        pinterestHidden: Math.max(0, Number(data.stats.pinterestHidden) || 0),
        videosSuppressed: Math.max(0, Number(data.stats.videosSuppressed) || 0),
        recipesSkipped: Math.max(0, Number(data.stats.recipesSkipped) || 0),
        fakeDownloadsDefused: Math.max(0, Number(data.stats.fakeDownloadsDefused) || 0),
        formsBackedUp: Math.max(0, Number(data.stats.formsBackedUp) || 0),
        totalTimeSavedSeconds: Math.max(0, Number(data.stats.totalTimeSavedSeconds) || 0),
      };
      await saveStats(cleanStats);
      result.statsRestored = true;
    }

    // 3. Resolve and restore Saved Drafts (supports dictionary map or array format)
    const normalizedDrafts: Record<string, any> = {};

    if (data.drafts) {
      if (Array.isArray(data.drafts)) {
        for (const item of data.drafts) {
          if (item && typeof item === 'object') {
            const rawKey = item.fieldKey || item.key || item.id || `field_${Date.now()}_${Math.random()}`;
            const storageKey = rawKey.startsWith('zenweb_draft_') ? rawKey : `zenweb_draft_${rawKey}`;
            normalizedDrafts[storageKey] = {
              url: item.url || '',
              siteUrl: item.siteUrl || item.url || '',
              fieldKey: storageKey,
              fieldLabel: item.fieldLabel || 'Imported Field',
              fieldKind: item.fieldKind || 'text',
              value: typeof item.value === 'string' ? item.value : String(item.value || ''),
              checked: Boolean(item.checked),
              selectedValues: Array.isArray(item.selectedValues) ? item.selectedValues : undefined,
              timestamp: Number(item.timestamp) || Date.now(),
              wordCount: Number(item.wordCount) || (typeof item.value === 'string' ? item.value.trim().split(/\s+/).filter(Boolean).length : 0),
              isContentEditable: Boolean(item.isContentEditable),
              revisions: Array.isArray(item.revisions) ? item.revisions : [],
            };
          }
        }
      } else if (typeof data.drafts === 'object') {
        for (const [k, v] of Object.entries(data.drafts)) {
          if (v && typeof v === 'object') {
            const storageKey = k.startsWith('zenweb_draft_') ? k : `zenweb_draft_${k}`;
            const item = v as any;
            normalizedDrafts[storageKey] = {
              url: item.url || '',
              siteUrl: item.siteUrl || item.url || '',
              fieldKey: storageKey,
              fieldLabel: item.fieldLabel || 'Imported Field',
              fieldKind: item.fieldKind || 'text',
              value: typeof item.value === 'string' ? item.value : String(item.value || ''),
              checked: Boolean(item.checked),
              selectedValues: Array.isArray(item.selectedValues) ? item.selectedValues : undefined,
              timestamp: Number(item.timestamp) || Date.now(),
              wordCount: Number(item.wordCount) || (typeof item.value === 'string' ? item.value.trim().split(/\s+/).filter(Boolean).length : 0),
              isContentEditable: Boolean(item.isContentEditable),
              revisions: Array.isArray(item.revisions) ? item.revisions : [],
            };
          }
        }
      }

      const draftCount = Object.keys(normalizedDrafts).length;
      if (draftCount > 0) {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          await chrome.storage.local.set(normalizedDrafts);
        } else {
          for (const [k, v] of Object.entries(normalizedDrafts)) {
            localStorage.setItem(k, JSON.stringify(v));
          }
        }
        result.draftsRestoredCount = draftCount;
      }
    }

    if (!result.settingsRestored && result.draftsRestoredCount === 0 && !result.statsRestored) {
      result.error = 'Backup file contains neither valid settings nor saved drafts.';
      return result;
    }

    result.success = true;
    return result;
  } catch (err: any) {
    console.error('Failed to import backup:', err);
    result.error = err?.message || 'Unexpected error while restoring backup.';
    return result;
  }
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
      const result = await chrome.storage.local.get([STATS_STORAGE_KEY, STATS_MIGRATION_KEY]);
      let stored = result[STATS_STORAGE_KEY] as ProtectionStats | undefined;
      const alreadyCleaned = Boolean(result[STATS_MIGRATION_KEY]);

      if (!alreadyCleaned) {
        if (stored) {
          stored = {
            seoSpamFiltered: Math.max(0, (stored.seoSpamFiltered || 0) - DEMO_BASELINE.seoSpamFiltered),
            pinterestHidden: Math.max(0, (stored.pinterestHidden || 0) - DEMO_BASELINE.pinterestHidden),
            videosSuppressed: Math.max(0, (stored.videosSuppressed || 0) - DEMO_BASELINE.videosSuppressed),
            recipesSkipped: Math.max(0, (stored.recipesSkipped || 0) - DEMO_BASELINE.recipesSkipped),
            fakeDownloadsDefused: Math.max(0, (stored.fakeDownloadsDefused || 0) - DEMO_BASELINE.fakeDownloadsDefused),
            formsBackedUp: Math.max(0, (stored.formsBackedUp || 0) - DEMO_BASELINE.formsBackedUp),
            totalTimeSavedSeconds: Math.max(0, (stored.totalTimeSavedSeconds || 0) - DEMO_BASELINE.totalTimeSavedSeconds),
          };
          await chrome.storage.local.set({
            [STATS_STORAGE_KEY]: stored,
            [STATS_MIGRATION_KEY]: true,
          });
        } else {
          await chrome.storage.local.set({
            [STATS_STORAGE_KEY]: { ...DEFAULT_STATS },
            [STATS_MIGRATION_KEY]: true,
          });
        }
      }
      return stored ? { ...DEFAULT_STATS, ...stored } : { ...DEFAULT_STATS };
    }
    const alreadyCleaned = localStorage.getItem(STATS_MIGRATION_KEY);
    const local = localStorage.getItem(STATS_STORAGE_KEY);
    let stored = local ? JSON.parse(local) : undefined;
    if (!alreadyCleaned) {
      if (stored) {
        stored = {
          seoSpamFiltered: Math.max(0, (stored.seoSpamFiltered || 0) - DEMO_BASELINE.seoSpamFiltered),
          pinterestHidden: Math.max(0, (stored.pinterestHidden || 0) - DEMO_BASELINE.pinterestHidden),
          videosSuppressed: Math.max(0, (stored.videosSuppressed || 0) - DEMO_BASELINE.videosSuppressed),
          recipesSkipped: Math.max(0, (stored.recipesSkipped || 0) - DEMO_BASELINE.recipesSkipped),
          fakeDownloadsDefused: Math.max(0, (stored.fakeDownloadsDefused || 0) - DEMO_BASELINE.fakeDownloadsDefused),
          formsBackedUp: Math.max(0, (stored.formsBackedUp || 0) - DEMO_BASELINE.formsBackedUp),
          totalTimeSavedSeconds: Math.max(0, (stored.totalTimeSavedSeconds || 0) - DEMO_BASELINE.totalTimeSavedSeconds),
        };
        localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stored));
      } else {
        localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(DEFAULT_STATS));
      }
      localStorage.setItem(STATS_MIGRATION_KEY, 'true');
    }
    return local ? { ...DEFAULT_STATS, ...stored } : { ...DEFAULT_STATS };
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


