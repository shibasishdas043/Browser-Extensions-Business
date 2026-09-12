/**
 * ZenWeb — Master Content Script
 * Initializes and reactively controls all 7 protection shields according to
 * user preferences synchronized in real-time with the Dashboard and Popup.
 */

import { getSettings, onSettingsChange } from './storage';
import { ZenWebSettings } from '../types';
import { downloadGuard } from '../features/fake-download-guard/logic';
import { humanSearch } from '../features/human-search/logic';
import { pinterestBlocker } from '../features/pinterest-blocker/logic';
import { videoKiller } from '../features/video-killer/logic';
import { recipeSkipper } from '../features/recipe-skipper/logic';
import { overlaySmasher } from '../features/overlay-smasher/logic';
import { formSalvager } from '../features/form-salvager/logic';

function applyShields(settings: ZenWebSettings): void {
  const master = settings.masterEnabled;

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

  // 5. Recipe Story Fluff Skipper
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

async function bootstrap() {
  try {
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
