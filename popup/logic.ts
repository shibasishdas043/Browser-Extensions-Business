import { getStats } from '../utils/storage';
import { ProtectionStats } from '../types';

/**
 * Opens the full settings dashboard in a new tab.
 */
export async function openFullSettings(): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.runtime?.getURL) {
      chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
      return;
    }
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
      return;
    }
    // Dev fallback
    window.open('/options/options.html', '_blank');
  } catch (error) {
    console.error('Failed to open settings in new tab:', error);
  }
}

/**
 * Loads the current session protection statistics.
 */
export async function loadSessionStats(): Promise<ProtectionStats> {
  return await getStats();
}


