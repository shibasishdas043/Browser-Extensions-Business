/**
 * ZenWeb — Master Content Script 2.0
 * Initializes and reactively controls all 7 protection shields according to
 * user preferences, whitelist exclusions, and runtime extension commands.
 */

import { getSettings, onSettingsChange } from './storage';
import { ZenWebSettings, ExtensionMessage } from '../types';
import { downloadGuard } from '../features/fake-download-guard/logic';
import { humanSearch } from '../features/human-search/logic';
import { pinterestBlocker } from '../features/pinterest-blocker/logic';
import { videoKiller } from '../features/video-killer/logic';
import { recipeSkipper } from '../features/recipe-skipper/logic';
import { overlaySmasher } from '../features/overlay-smasher/logic';
import { formSalvager } from '../features/form-salvager/logic';

let currentSettings: ZenWebSettings | null = null;

function isCurrentDomainWhitelisted(settings: ZenWebSettings): boolean {
  if (!settings.whitelistedDomains || settings.whitelistedDomains.length === 0) return false;
  const currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
  return settings.whitelistedDomains.some((d) => {
    const cleanD = d.toLowerCase().replace(/^www\./, '');
    return currentHost === cleanD || currentHost.endsWith('.' + cleanD);
  });
}

function stopAllShields(): void {
  downloadGuard.stop();
  humanSearch.stop();
  pinterestBlocker.stop();
  videoKiller.stop();
  recipeSkipper.stop();
  overlaySmasher.stop();
  formSalvager.stop();

  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'UPDATE_BADGE',
        payload: { count: 0, paused: true },
      });
    }
  } catch {}
}

function applyShields(settings: ZenWebSettings): void {
  currentSettings = settings;
  const master = settings.masterEnabled;

  // Check domain exclusion whitelist
  if (isCurrentDomainWhitelisted(settings)) {
    stopAllShields();
    return;
  }

  // 1. Deceptive Download Guard
  if (master && settings.fakeDownloadGuardEnabled) {
    downloadGuard.start();
  } else {
    downloadGuard.stop();
  }

  // 2. Human Search Bypass
  if (master && settings.humanSearchEnabled) {
    humanSearch.start();
  } else {
    humanSearch.stop();
  }

  // 3. Pinterest Search Blocker
  if (master && settings.pinterestBlockerEnabled) {
    pinterestBlocker.start();
  } else {
    pinterestBlocker.stop();
  }

  // 4. Sticky Video Suppressor
  if (master && settings.floatingVideoKillerEnabled) {
    videoKiller.start();
  } else {
    videoKiller.stop();
  }

  // 5. Recipe Story Fluff Skipper & Reader
  if (master && settings.recipeSkipperEnabled) {
    recipeSkipper.start();
  } else {
    recipeSkipper.stop();
  }

  // 6. Modal & Paywall Overlay Smasher
  if (master && settings.autoOverlaySmasherEnabled) {
    overlaySmasher.start();
  } else {
    overlaySmasher.stop();
  }

  // 7. Form Salvager & Crash Guard
  if (master && settings.formSalvagerEnabled) {
    formSalvager.start();
  } else {
    formSalvager.stop();
  }
}

/**
 * Listen for extension runtime messages (panic smash, jump recipe, tab stats).
 */
function attachMessageListeners(): void {
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg: ExtensionMessage, _sender, sendResponse) => {
      switch (msg.action) {
        case 'SMASH_OVERLAY': {
          const removed = overlaySmasher.smashNow(true);
          sendResponse({ success: true, removedCount: removed });
          break;
        }

        case 'JUMP_RECIPE': {
          recipeSkipper.openReaderOrJump();
          sendResponse({ success: true });
          break;
        }

        case 'GET_TAB_STATS': {
          const isWhitelisted = currentSettings ? isCurrentDomainWhitelisted(currentSettings) : false;
          sendResponse({
            isWhitelisted,
            hostname: window.location.hostname,
          });
          break;
        }

        default:
          break;
      }
      return true;
    });
  }
}

async function bootstrap() {
  try {
    attachMessageListeners();
    const settings = await getSettings();
    applyShields(settings);

    // React to dynamic setting toggles in real-time across tabs & dashboard
    onSettingsChange((newSettings) => {
      applyShields(newSettings);
    });
  } catch (error) {
    console.error('[ZenWeb Content Script] Initialization error:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
