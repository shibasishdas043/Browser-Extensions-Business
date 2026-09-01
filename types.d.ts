export interface ZenWebSettings {
  // Master toggle
  masterEnabled: boolean;

  // Search Protections
  humanSearchEnabled: boolean;
  pinterestBlockerEnabled: boolean;

  // Browsing & Reading Protections
  floatingVideoKillerEnabled: boolean;
  recipeSkipperEnabled: boolean;
  autoOverlaySmasherEnabled: boolean;

  // Security & Utilities
  fakeDownloadGuardEnabled: boolean;
  formSalvagerEnabled: boolean;
}

export type SettingKey = keyof ZenWebSettings;

export interface SalvagedFormEntry {
  url: string;
  fieldId: string;
  name: string;
  value: string;
  timestamp: number;
}

export interface ProtectionStats {
  seoSpamFiltered: number;
  pinterestHidden: number;
  videosSuppressed: number;
  recipesSkipped: number;
  overlaysSmashed: number;
  fakeDownloadsDefused: number;
  formsBackedUp: number;
  totalTimeSavedSeconds: number;
}

export type StatKey = keyof Omit<ProtectionStats, 'totalTimeSavedSeconds'>;

export interface ExtensionMessage {
  action: 'SMASH_OVERLAY' | 'RESTORE_FORM' | 'GET_SETTINGS' | 'UPDATE_SETTINGS' | 'GET_STATS' | 'OPEN_OPTIONS';
  payload?: any;
}

