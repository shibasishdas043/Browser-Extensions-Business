/**
 * ZenWeb — Background Service Worker (Manifest V3)
 * Manages global extension lifecycle, context menus, keyboard commands,
 * active tab badge indicators, and cross-extension communication.
 */

import { ExtensionMessage } from '../types';

// Palette tokens
const BADGE_COLOR_ACTIVE = '#10b981'; // ZenWeb Emerald
const BADGE_COLOR_MUTED = '#64748b';

/**
 * Initialize context menus and badge defaults on installation or update.
 */
chrome.runtime.onInstalled.addListener(() => {
  // Set default badge background
  chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_ACTIVE });

  // Clear existing menus and re-create cleanly
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'zenweb-smash-overlay',
      title: '💥 Smash Overlays on this page',
      contexts: ['page', 'frame'],
    });

    chrome.contextMenus.create({
      id: 'zenweb-jump-recipe',
      title: '🍳 Jump to Recipe / Reader View',
      contexts: ['page'],
    });

    chrome.contextMenus.create({
      id: 'zenweb-separator-1',
      type: 'separator',
      contexts: ['page'],
    });

    chrome.contextMenus.create({
      id: 'zenweb-open-vault',
      title: '✍️ Open Saved Drafts Vault',
      contexts: ['page', 'editable'],
    });

    chrome.contextMenus.create({
      id: 'zenweb-open-dashboard',
      title: '⚙️ ZenWeb Dashboard & Settings',
      contexts: ['page'],
    });
  });
});

/**
 * Handle Context Menu Clicks
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  switch (info.menuItemId) {
    case 'zenweb-smash-overlay':
      await dispatchToTab(tab.id, { action: 'SMASH_OVERLAY' });
      break;

    case 'zenweb-jump-recipe':
      await dispatchToTab(tab.id, { action: 'JUMP_RECIPE' });
      break;

    case 'zenweb-open-vault':
      chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html#vault') });
      break;

    case 'zenweb-open-dashboard':
      chrome.runtime.openOptionsPage();
      break;
  }
});

/**
 * Handle Global Keyboard Shortcuts
 */
chrome.commands.onCommand.addListener(async (command, tab) => {
  const targetTabId = tab?.id;
  if (!targetTabId) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) return;
    await routeCommand(command, activeTab.id);
  } else {
    await routeCommand(command, targetTabId);
  }
});

async function routeCommand(command: string, tabId: number): Promise<void> {
  if (command === 'smash-overlay') {
    await dispatchToTab(tabId, { action: 'SMASH_OVERLAY' });
  } else if (command === 'jump-recipe') {
    await dispatchToTab(tabId, { action: 'JUMP_RECIPE' });
  }
}

/**
 * Dispatches an ExtensionMessage to a tab, falling back to direct scripting if content script is idle.
 */
async function dispatchToTab(tabId: number, msg: ExtensionMessage): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, msg);
  } catch {
    // If content script was not injected or is unresponsive, inject fallback action
    if (msg.action === 'SMASH_OVERLAY') {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
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

            const lockRegex = /(modal-open|has-modal|is-modal|dialog-open|popup-open|age-gate|agegate|blurred|blur|is-blurred|filter-blur|no-scroll|noscroll|overflow-hidden|prevent-scroll|lock-scroll|locked)/i;
            [docEl, bodyEl].forEach((r) => {
              if (!r) return;
              Array.from(r.classList).forEach((c) => {
                if (lockRegex.test(c)) r.classList.remove(c);
              });
            });

            const overlays = document.querySelectorAll<HTMLElement>(
              'dialog, [role="dialog"], [role="alertdialog"], [aria-modal="true"], div[class*="modal" i], div[class*="overlay" i], div[class*="backdrop" i], div[class*="age-gate" i]'
            );
            overlays.forEach((el) => {
              const s = window.getComputedStyle(el);
              if (s.position === 'fixed' || s.position === 'sticky') el.remove();
            });

            // Eradicate filters and restore pointer-events on page elements
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
          },
        });
      } catch (err) {
        console.warn('[ZenWeb Background] Fallback scripting error:', err);
      }
    }
  }
}

/**
 * Listen for messages from content scripts and popups.
 */
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  if (!message || !message.action) return false;

  switch (message.action) {
    case 'UPDATE_BADGE': {
      const tabId = sender.tab?.id;
      if (tabId) {
        const count = Number(message.payload?.count || 0);
        const text = count > 0 ? String(count > 99 ? '99+' : count) : '';
        chrome.action.setBadgeText({ text, tabId });
        chrome.action.setBadgeBackgroundColor({
          color: message.payload?.paused ? BADGE_COLOR_MUTED : BADGE_COLOR_ACTIVE,
          tabId,
        });
      }
      sendResponse({ success: true });
      break;
    }

    case 'OPEN_OPTIONS': {
      chrome.runtime.openOptionsPage();
      sendResponse({ success: true });
      break;
    }

    case 'OPEN_VAULT': {
      chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html#vault') });
      sendResponse({ success: true });
      break;
    }

    default:
      break;
  }

  return true;
});

// Clean up badge when tab navigates to a new page
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    chrome.action.setBadgeText({ text: '', tabId });
  }
});
