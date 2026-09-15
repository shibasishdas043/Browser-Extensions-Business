/**
 * Pinterest Search Blocker — UI Module 2.0
 * Hides walled Pinterest cards with smooth CSS and displays an unobtrusive indicator pill.
 */

const STYLE_ID = 'zenweb-pinterest-blocker-styles';
const PILL_ID = 'zw-pinterest-hidden-pill';

export function injectPinterestBlockerStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .zw-pinterest-hidden {
      display: none !important;
    }

    #${PILL_ID} {
      all: initial;
      position: fixed !important;
      bottom: 24px !important;
      left: 24px !important;
      z-index: 2147483640 !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 8px !important;
      padding: 6px 12px 6px 10px !important;
      background: rgba(29, 29, 31, 0.92) !important;
      backdrop-filter: saturate(180%) blur(20px) !important;
      -webkit-backdrop-filter: saturate(180%) blur(20px) !important;
      color: #ffffff !important;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      line-height: 1 !important;
      border-radius: 9999px !important;
      border: 1px solid rgba(255, 255, 255, 0.16) !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25) !important;
      user-select: none !important;
      pointer-events: auto !important;
      transition: all 0.2s ease !important;
    }

    #${PILL_ID} button {
      all: initial;
      cursor: pointer !important;
      color: #f43f5e !important;
      font-family: inherit !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      padding: 2px 6px !important;
      border-radius: 9999px !important;
      background: rgba(244, 63, 94, 0.14) !important;
      transition: background 0.15s ease !important;
    }

    #${PILL_ID} button:hover {
      background: rgba(244, 63, 94, 0.28) !important;
    }
  `;

  (document.head || document.documentElement).appendChild(style);
}

export function showPinterestHiddenPill(count: number, onReveal: () => void): void {
  injectPinterestBlockerStyles();

  let pill = document.getElementById(PILL_ID);
  if (!pill) {
    pill = document.createElement('div');
    pill.id = PILL_ID;
    document.body.appendChild(pill);
  }

  pill.innerHTML = '';

  const label = document.createElement('span');
  label.textContent = `📌 ${count} Pinterest ${count === 1 ? 'result' : 'results'} hidden`;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Show';
  btn.addEventListener('click', () => {
    onReveal();
    pill?.remove();
  });

  pill.appendChild(label);
  pill.appendChild(btn);
}

export function removePinterestBlockerStyles(): void {
  const pill = document.getElementById(PILL_ID);
  if (pill) pill.remove();

  const style = document.getElementById(STYLE_ID);
  if (style) style.remove();

  document.querySelectorAll('.zw-pinterest-hidden').forEach((el) => {
    el.classList.remove('zw-pinterest-hidden');
  });
}
