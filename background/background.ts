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
            document.documentElement.style.setProperty('overflow', 'auto', 'important');
            document.body.style.setProperty('overflow', 'auto', 'important');
            document.body.style.setProperty('pointer-events', 'auto', 'important');
            const overlays = document.querySelectorAll(
              'div[class*="modal"], div[class*="overlay"], div[class*="backdrop"], dialog'
            );
            overlays.forEach((el) => {
              const s = window.getComputedStyle(el);
              if (s.position === 'fixed' || s.position === 'sticky') el.remove();
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
