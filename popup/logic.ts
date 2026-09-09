import { getSettings, getStats, DEFAULT_SETTINGS } from '../utils/storage';
import { ZenWebSettings, ProtectionStats } from '../types';

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

/**
 * Dispatches the Panic 'Smash Overlay' command to the active tab.
 */
export async function triggerSmashOverlay(): Promise<{ success: boolean; message: string }> {
  try {
    if (typeof chrome === 'undefined' || !chrome.tabs) {
      return { success: true, message: 'Preview mode: Overlay Smashed!' };
    }

    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || !activeTab.id) {
      return { success: false, message: 'No active tab found' };
    }

    // Direct script injection to guarantee execution even without background listener
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => {
        let removedCount = 0;

        // 1. Force overflow and scrolling on document body and html
        document.documentElement.style.setProperty('overflow', 'auto', 'important');
        document.documentElement.style.setProperty('position', 'static', 'important');
        document.body.style.setProperty('overflow', 'auto', 'important');
        document.body.style.setProperty('position', 'static', 'important');
        document.body.style.setProperty('pointer-events', 'auto', 'important');

        // 2. Scan and remove backdrop / overlay elements
        const candidates = document.querySelectorAll('div, section, aside, dialog');
        candidates.forEach((el) => {
          const style = window.getComputedStyle(el);
          const isFixedOrSticky = style.position === 'fixed' || style.position === 'sticky';
          const zIndex = parseInt(style.zIndex, 10);
          const hasHighZIndex = !isNaN(zIndex) && zIndex > 999;
          const coversScreen =
            el.clientWidth >= window.innerWidth * 0.7 && el.clientHeight >= window.innerHeight * 0.7;

          // Check if it looks like a modal backdrop or newsletter dialog
          if (isFixedOrSticky && (hasHighZIndex || coversScreen)) {
            const hasCloseButton = el.querySelector('button, [role="button"], .close');
            const hasForm = el.querySelector('form, input[type="email"]');
            if (hasCloseButton || hasForm || coversScreen) {
              el.remove();
              removedCount++;
            }
          }
        });

        // 3. Remove blur or grayscale filters on body children
        document.querySelectorAll('*').forEach((node) => {
          const el = node as HTMLElement;
          if (el.style && (el.style.filter.includes('blur') || el.style.filter.includes('grayscale'))) {
            el.style.filter = 'none';
          }
        });

        return { removedCount };
      },
    });

    return { success: true, message: '💥 Overlay smashed & scroll restored!' };
  } catch (error) {
    console.error('Failed to smash overlay:', error);
    return { success: false, message: 'Could not access current page' };
  }
}

