/**
 * Pinterest Search Blocker — UI Module 3.0
 * Injects non-intrusive indicator pill with two-way reveal/hide toggle,
 * dismiss capability, and clean suppression styles.
 * 100% XSS-Safe: strictly DOM APIs and textContent.
 */

import { mountCornerPopup, unmountCornerPopup } from '../../content/corner-stack';

export const STYLE_ID = 'zenweb-pinterest-blocker-styles';
export const PILL_ID = 'zw-pinterest-hidden-pill';
export const HIDDEN_CLASS = 'zw-pinterest-hidden';
export const HIDDEN_ATTR = 'data-zenweb-pinterest-hidden';

export interface PillOptions {
  count: number;
  isRevealed: boolean;
  onToggle: () => void;
  onDismiss: () => void;
}

export function injectPinterestBlockerStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes zwPillSlideUp {
      from { opacity: 0; transform: translateY(12px) scale(0.95); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    .${HIDDEN_CLASS},
    [${HIDDEN_ATTR}="true"] {
      display: none !important;
    }

    #${PILL_ID} {
      all: initial;
      display: inline-flex !important;
      align-items: center !important;
      gap: 8px !important;
      padding: 6px 8px 6px 12px !important;
      background: rgba(29, 29, 31, 0.94) !important;
      backdrop-filter: saturate(180%) blur(20px) !important;
      -webkit-backdrop-filter: saturate(180%) blur(20px) !important;
      color: #ffffff !important;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      line-height: 1 !important;
      letter-spacing: -0.015em !important;
      border-radius: 9999px !important;
      border: 1px solid rgba(255, 255, 255, 0.18) !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35), 0 2px 6px rgba(0, 0, 0, 0.2) !important;
      user-select: none !important;
      pointer-events: auto !important;
      animation: zwPillSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
      white-space: nowrap !important;
      transition: transform 0.18s ease, box-shadow 0.18s ease !important;
      box-sizing: border-box !important;
    }

    #${PILL_ID}:hover {
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45) !important;
    }

    #${PILL_ID} .zw-pill-label {
      all: initial;
      display: inline-flex !important;
      align-items: center !important;
      gap: 5px !important;
      font-family: inherit !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      color: #ffffff !important;
      line-height: 1 !important;
    }

    #${PILL_ID} .zw-pill-btn-toggle {
      all: initial;
      cursor: pointer !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 3px 8px !important;
      border-radius: 9999px !important;
      background: rgba(244, 63, 94, 0.18) !important;
      border: 1px solid rgba(244, 63, 94, 0.35) !important;
      color: #fb7185 !important;
      font-family: inherit !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      letter-spacing: -0.01em !important;
      line-height: 1 !important;
      transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease !important;
    }

    #${PILL_ID} .zw-pill-btn-toggle:hover {
      background: rgba(244, 63, 94, 0.32) !important;
      border-color: rgba(244, 63, 94, 0.6) !important;
      color: #ffffff !important;
    }

    #${PILL_ID} .zw-pill-btn-close {
      all: initial;
      cursor: pointer !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 18px !important;
      height: 18px !important;
      border-radius: 50% !important;
      color: rgba(255, 255, 255, 0.5) !important;
      font-size: 11px !important;
      line-height: 1 !important;
      font-family: inherit !important;
      transition: color 0.15s ease, background 0.15s ease !important;
    }

    #${PILL_ID} .zw-pill-btn-close:hover {
      color: #ffffff !important;
      background: rgba(255, 255, 255, 0.15) !important;
    }
  `;

  (document.head || document.documentElement).appendChild(style);
}

export function updatePinterestHiddenPill(options: PillOptions): void {
  injectPinterestBlockerStyles();

  let pill = document.getElementById(PILL_ID);
  if (!pill) {
    pill = document.createElement('div');
    pill.id = PILL_ID;
  }

  // Clear previous child nodes safely without innerHTML
  while (pill.firstChild) {
    pill.removeChild(pill.firstChild);
  }

  // 1. Label
  const label = document.createElement('span');
  label.className = 'zw-pill-label';
  const unit = options.count === 1 ? 'result' : 'results';
  const stateText = options.isRevealed ? 'revealed' : 'hidden';
  label.textContent = `📌 ${options.count} Pinterest ${unit} ${stateText}`;

  // 2. Toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'zw-pill-btn-toggle';
  toggleBtn.textContent = options.isRevealed ? 'Hide again' : 'Show';
  toggleBtn.title = options.isRevealed ? 'Re-conceal Pinterest results' : 'Show all concealed Pinterest results';
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    options.onToggle();
  });

  // 3. Dismiss button
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'zw-pill-btn-close';
  closeBtn.textContent = '✕';
  closeBtn.title = 'Dismiss pill';
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    options.onDismiss();
    unmountCornerPopup(pill);
  });

  pill.appendChild(label);
  pill.appendChild(toggleBtn);
  pill.appendChild(closeBtn);

  // Mount cleanly into the universal bottom-right corner stack
  mountCornerPopup(pill);
}

export function removePinterestBlockerStyles(): void {
  const pill = document.getElementById(PILL_ID);
  if (pill) unmountCornerPopup(pill);

  const style = document.getElementById(STYLE_ID);
  if (style) style.remove();

  document.querySelectorAll<HTMLElement>(`.${HIDDEN_CLASS}, [${HIDDEN_ATTR}="true"]`).forEach((el) => {
    el.classList.remove(HIDDEN_CLASS);
    el.removeAttribute(HIDDEN_ATTR);
  });
}

