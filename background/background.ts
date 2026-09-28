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
 * Prevent unhandled promise rejections from transient tab closures & navigations in MV3
 */
self.addEventListener('unhandledrejection', (event) => {
  const reason = (event as PromiseRejectionEvent).reason;
  const msg = reason?.message || String(reason || '');
  if (
    msg.includes('No tab with id') ||
    msg.includes('Receiving end does not exist') ||
    msg.includes('The message port closed') ||
    msg.includes('Could not establish connection')
  ) {
    event.preventDefault();
  }
});

/**
 * Initialize context menus and badge defaults on installation or update.
 */
chrome.runtime.onInstalled.addListener(() => {
  // Set default badge background
  chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR_ACTIVE }).catch(() => {});

  // Clear existing menus and re-create cleanly
  chrome.contextMenus.removeAll(() => {
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
  try {
    const tabExists = await chrome.tabs.get(tab.id).catch(() => null);
    if (!tabExists) return;

    switch (info.menuItemId) {
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
  } catch {}
});

/**
 * Handle Global Keyboard Shortcuts
 */
chrome.commands.onCommand.addListener(async (command, tab) => {
  try {
    const targetTabId = tab?.id;
    if (!targetTabId) {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
      if (!activeTab?.id) return;
      await routeCommand(command, activeTab.id);
    } else {
      await routeCommand(command, targetTabId);
    }
  } catch {}
});

async function routeCommand(command: string, tabId: number): Promise<void> {
  if (command === 'jump-recipe') {
    await dispatchToTab(tabId, { action: 'JUMP_RECIPE' });
  }
}

/**
 * Dispatches an ExtensionMessage to a tab.
 */
async function dispatchToTab(tabId: number, msg: ExtensionMessage): Promise<void> {
  try {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) return;
    await chrome.tabs.sendMessage(tabId, msg);
  } catch (err) {
    console.warn('[ZenWeb Background] Failed to dispatch message to tab:', err);
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
        (async () => {
          try {
            const tab = await chrome.tabs.get(tabId);
            if (!tab) return;
            await chrome.action.setBadgeText({ text, tabId });
            await chrome.action.setBadgeBackgroundColor({
              color: message.payload?.paused ? BADGE_COLOR_MUTED : BADGE_COLOR_ACTIVE,
              tabId,
            });
          } catch {}
        })();
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

  return false;
});

// Clean up badge when tab navigates to a new page
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab) {
        await chrome.action.setBadgeText({ text: '', tabId });
      }
    } catch {}
  }
});
