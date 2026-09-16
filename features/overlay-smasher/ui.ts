/**
 * Modal & Paywall Smasher — UI Module
 * Injects non-intrusive toast notifications and comprehensive global unblur CSS
 * so pages are crystal clear and fully interactive after overlays are destroyed.
 */

const STYLE_ID = 'zenweb-overlay-smasher-styles';
const TOAST_ID = 'zw-smashed-overlay-toast';

export function injectOverlaySmasherStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* ── Global Unblur & Interactive Recovery System ── */
    html.zw-smashed,
    html.zw-smashed body {
      overflow: auto !important;
      overflow-y: auto !important;
      position: static !important;
      pointer-events: auto !important;
      user-select: auto !important;
    }

    /* Force-defeat any class or stylesheet based blur/pointer-events lock on page contents */
    html.zw-smashed body > *:not([class*="zw-"]):not(#${TOAST_ID}):not(#zw-jump-to-recipe-btn):not(#zw-recipe-reader-modal):not(#zw-recipe-reader-modal *),
    html.zw-smashed main,
    html.zw-smashed #root,
    html.zw-smashed #app,
    html.zw-smashed #__next,
    html.zw-smashed [id*="page" i],
    html.zw-smashed [id*="main" i],
    html.zw-smashed [id*="wrap" i],
    html.zw-smashed [class*="page" i],
    html.zw-smashed [class*="wrap" i],
    html.zw-smashed [class*="content" i],
    html.zw-smashed [class*="container" i],
    html.zw-smashed [class*="blur" i],
    html.zw-smashed [class*="blurred" i],
    html.zw-smashed [class*="filter" i] {
      filter: none !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      pointer-events: auto !important;
      user-select: auto !important;
    }

    #${TOAST_ID} {
      all: initial;
      position: fixed !important;
      bottom: 24px !important;
      left: 24px !important;
      z-index: 2147483645 !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 8px !important;
      padding: 8px 14px !important;
      background: rgba(29, 29, 31, 0.94) !important;
      backdrop-filter: saturate(180%) blur(20px) !important;
      -webkit-backdrop-filter: saturate(180%) blur(20px) !important;
      color: #ffffff !important;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      line-height: 1 !important;
      border-radius: 9999px !important;
      border: 1px solid rgba(168, 85, 247, 0.4) !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3) !important;
      animation: zwToastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
      pointer-events: none !important;
    }

    @keyframes zwToastSlideIn {
      from { opacity: 0; transform: translateY(10px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `;

  (document.head || document.documentElement).appendChild(style);
}

export function showSmashedToast(msg: string): void {
  injectOverlaySmasherStyles();

  let toast = document.getElementById(TOAST_ID);
  if (!toast) {
    toast = document.createElement('div');
    toast.id = TOAST_ID;
    document.body.appendChild(toast);
  }

  toast.textContent = msg;

  setTimeout(() => {
    if (toast && toast.parentNode) {
      toast.remove();
    }
  }, 2400);
}
