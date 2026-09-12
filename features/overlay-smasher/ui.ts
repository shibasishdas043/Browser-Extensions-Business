/**
 * Modal & Paywall Smasher — UI Module
 * Injects non-intrusive toast notifications when a locking overlay is automatically smashed.
 */

const STYLE_ID = 'zenweb-overlay-smasher-styles';
const TOAST_ID = 'zw-smashed-overlay-toast';

export function injectOverlaySmasherStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
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
