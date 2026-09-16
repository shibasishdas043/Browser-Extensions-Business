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

    // Try sending message to content script first for full engine handling
    try {
      const response = await chrome.tabs.sendMessage(activeTab.id, { action: 'SMASH_OVERLAY' });
      if (response?.success) {
        return { success: true, message: '💥 Overlay smashed & screen unblurred!' };
      }
    } catch {
      // Content script may not be loaded on this tab, proceed to fallback scripting
    }

    // Direct script injection fallback to guarantee execution
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => {
        let removedCount = 0;

        // 1. Force unblur, scrolling, and interactive pointer-events
        const docEl = document.documentElement;
        const bodyEl = document.body;

        if (docEl) {
          docEl.classList.add('zw-smashed');
          docEl.style.setProperty('overflow', 'auto', 'important');
          docEl.style.setProperty('overflow-y', 'auto', 'important');
          docEl.style.setProperty('position', 'static', 'important');
          docEl.style.setProperty('pointer-events', 'auto', 'important');
        }

        if (bodyEl) {
          bodyEl.classList.add('zw-smashed');
          bodyEl.style.setProperty('overflow', 'auto', 'important');
          bodyEl.style.setProperty('overflow-y', 'auto', 'important');
          bodyEl.style.setProperty('position', 'static', 'important');
          bodyEl.style.setProperty('pointer-events', 'auto', 'important');
          bodyEl.style.setProperty('user-select', 'auto', 'important');
        }

        // 2. Strip lock/blur classes from html and body
        const lockRegex = /(modal-open|has-modal|is-modal|dialog-open|popup-open|age-gate|agegate|blurred|blur|is-blurred|filter-blur|no-scroll|noscroll|overflow-hidden|prevent-scroll|lock-scroll|locked)/i;
        [docEl, bodyEl].forEach((r) => {
          if (!r) return;
          Array.from(r.classList).forEach((c) => {
            if (lockRegex.test(c)) r.classList.remove(c);
          });
        });

        // 3. Scan and remove backdrop / overlay elements
        const candidates = document.querySelectorAll<HTMLElement>(
          'dialog, [role="dialog"], [role="alertdialog"], [aria-modal="true"], div, section, aside'
        );
        candidates.forEach((el) => {
          if (el.id?.startsWith('zw-') || (typeof el.className === 'string' && el.className.includes('zw-'))) return;

          const tagName = el.tagName.toLowerCase();
          const rect = el.getBoundingClientRect();
          const isNav = tagName === 'header' || tagName === 'nav' || /navbar|header/i.test(`${el.id} ${el.className}`);
          if (isNav && rect.height <= 85) return;

          const style = window.getComputedStyle(el);
          const isFixedOrSticky = style.position === 'fixed' || style.position === 'sticky';
          const zIndex = parseInt(style.zIndex, 10);
          const hasHighZIndex = !isNaN(zIndex) && zIndex > 200;
          const coversScreen =
            rect.width >= window.innerWidth * 0.65 && rect.height >= window.innerHeight * 0.65;
          const hasModalIndicators =
            el.querySelector('form, input[type="email"], [class*="newsletter" i], [class*="subscribe" i], [class*="paywall" i], [class*="age" i]') !== null ||
            el.getAttribute('role') === 'dialog' ||
            el.getAttribute('aria-modal') === 'true' ||
            tagName === 'dialog';

          if (isFixedOrSticky && (hasHighZIndex || coversScreen || hasModalIndicators)) {
            el.remove();
            removedCount++;
          }
        });

        // 4. Eradicate all blur and restore pointer-events on content elements
        document.querySelectorAll<HTMLElement>('*').forEach((el) => {
          if (el.id?.startsWith('zw-') || (typeof el.className === 'string' && el.className.includes('zw-'))) return;

          if (el.style) {
            const inlineFilter = el.style.filter || '';
            const inlineBackdrop = el.style.backdropFilter || (el.style as any).webkitBackdropFilter || '';
            if (inlineFilter.includes('blur') || inlineFilter.includes('grayscale') || inlineBackdrop.includes('blur')) {
              el.style.setProperty('filter', 'none', 'important');
              el.style.setProperty('backdrop-filter', 'none', 'important');
              el.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
            }
            if (el.style.pointerEvents === 'none') {
              el.style.setProperty('pointer-events', 'auto', 'important');
            }
          }

          try {
            const computed = window.getComputedStyle(el);
            if (computed.filter?.includes('blur') || computed.backdropFilter?.includes('blur')) {
              el.style.setProperty('filter', 'none', 'important');
              el.style.setProperty('backdrop-filter', 'none', 'important');
              el.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
            }
            if (computed.pointerEvents === 'none' && !/^(svg|path|circle|line|polygon|rect|g)$/i.test(el.tagName)) {
              el.style.setProperty('pointer-events', 'auto', 'important');
            }
          } catch {}
        });

        return { removedCount };
      },
    });

    return { success: true, message: '💥 Overlay smashed & screen unblurred!' };
  } catch (error) {
    console.error('Failed to smash overlay:', error);
    return { success: false, message: 'Could not access current page' };
  }
}

