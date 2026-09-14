/**
 * Form Salvager & Crash Guard — UI Module 2.0
 * Apple-grade non-destructive floating restore pill, hover snippet popovers,
 * keyboard shortcut integration (Alt+R / ⌥R), and form-level multi-field banners.
 * 100% XSS-Safe: strictly uses DOM APIs and textContent (no innerHTML).
 */

const STYLE_ID = 'zenweb-form-salvager-styles';
const PILL_CLASS = 'zw-salvage-pill';
const POPOVER_CLASS = 'zw-salvage-popover';
const FORM_BANNER_CLASS = 'zw-salvage-form-banner';
const SITE_PROMPT_CLASS = 'zw-salvage-site-prompt';
const SALVAGE_ATTR = 'data-zenweb-salvage-active';

export interface DraftMeta {
  wordCount: number;
  timeAgo: string;
  snippet?: string;
  revisionsCount?: number;
}

export interface SitePromptOptions {
  fieldCount: number;
  wordCount: number;
  timeAgo: string;
  snippet?: string;
  siteUrl?: string;
  onReload: () => void;
  onDiscard: () => void;
  onDismiss?: () => void;
}

interface ActiveSalvageItem {
  target: HTMLElement;
  pill: HTMLElement;
  popover: HTMLElement | null;
}

interface ActiveFormBanner {
  form: HTMLFormElement;
  banner: HTMLElement;
}

const activePills: ActiveSalvageItem[] = [];
const activeFormBanners: ActiveFormBanner[] = [];
let activeSitePrompt: HTMLElement | null = null;
let windowListenersAttached = false;

/**
 * Injects Apple glassmorphism styling for restore pills, hover popovers, and form banners.
 */
export function injectFormSalvagerStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes zwSalvagePillEnter {
      from {
        opacity: 0;
        transform: translateY(6px) scale(0.93);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @keyframes zwPopoverEnter {
      from {
        opacity: 0;
        transform: translateY(4px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @keyframes zwRestoredGlowAnim {
      0% {
        box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.5) !important;
        outline: 2px solid #0066cc !important;
      }
      60% {
        box-shadow: 0 0 0 5px rgba(0, 102, 204, 0.18) !important;
        outline: 2px solid #0071e3 !important;
      }
      100% {
        box-shadow: none !important;
        outline: none !important;
      }
    }

    .zw-restored-glow {
      animation: zwRestoredGlowAnim 1.1s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
    }

    /* ── Apple-Grade Discreet Restore Pill (Nested inside field) ── */
    .${PILL_CLASS} {
      all: initial;
      display: inline-flex !important;
      align-items: center !important;
      gap: 5px !important;
      padding: 2px 4px 2px 8px !important;
      height: 24px !important;
      background: rgba(29, 29, 31, 0.90) !important;
      backdrop-filter: saturate(180%) blur(20px) !important;
      -webkit-backdrop-filter: saturate(180%) blur(20px) !important;
      color: #ffffff !important;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif !important;
      font-size: 11px !important;
      font-weight: 400 !important;
      line-height: 1 !important;
      letter-spacing: -0.015em !important;
      border-radius: 9999px !important;
      border: 1px solid rgba(255, 255, 255, 0.14) !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.24) !important;
      z-index: 2147483640 !important;
      position: absolute !important;
      box-sizing: border-box !important;
      user-select: none !important;
      pointer-events: auto !important;
      animation: zwSalvagePillEnter 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
      white-space: nowrap !important;
      transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease !important;
      cursor: default !important;
    }

    .${PILL_CLASS}:hover {
      background: rgba(29, 29, 31, 0.96) !important;
      border-color: rgba(41, 151, 255, 0.4) !important;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.32) !important;
    }

    .${PILL_CLASS} .zw-salvage-brand {
      all: initial;
      display: inline-flex !important;
      align-items: center !important;
      gap: 4px !important;
      font-family: inherit !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      color: #ffffff !important;
      letter-spacing: -0.02em !important;
      line-height: 1 !important;
    }

    .${PILL_CLASS} .zw-salvage-brand svg {
      display: block !important;
      flex-shrink: 0 !important;
    }

    .${PILL_CLASS} .zw-salvage-sub {
      all: initial;
      display: inline !important;
      font-family: inherit !important;
      font-size: 11px !important;
      font-weight: 400 !important;
      color: #a1a1a6 !important;
      letter-spacing: -0.01em !important;
      line-height: 1 !important;
      white-space: nowrap !important;
    }

    .${PILL_CLASS} .zw-salvage-kbd {
      all: initial;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      background: rgba(255, 255, 255, 0.08) !important;
      border: 1px solid rgba(255, 255, 255, 0.14) !important;
      border-radius: 4px !important;
      color: #d2d2d7 !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
      font-size: 9px !important;
      font-weight: 500 !important;
      padding: 1px 4px !important;
      line-height: 1 !important;
      margin-left: 1px !important;
    }

    .${PILL_CLASS} .zw-salvage-btn-restore {
      all: initial;
      cursor: pointer !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      background: #0066cc !important;
      color: #ffffff !important;
      border: none !important;
      border-radius: 9999px !important;
      padding: 2px 8px !important;
      font-family: inherit !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      letter-spacing: -0.01em !important;
      line-height: 1 !important;
      margin-left: 2px !important;
      transition: background 0.15s ease, transform 0.1s ease !important;
    }

    .${PILL_CLASS} .zw-salvage-btn-restore:hover {
      background: #0071e3 !important;
    }

    .${PILL_CLASS} .zw-salvage-btn-restore:active {
      transform: scale(0.95) !important;
    }

    .${PILL_CLASS} .zw-salvage-btn-discard {
      all: initial;
      cursor: pointer !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      background: transparent !important;
      color: rgba(255, 255, 255, 0.4) !important;
      border-radius: 50% !important;
      width: 16px !important;
      height: 16px !important;
      font-family: inherit !important;
      font-size: 10px !important;
      font-weight: 500 !important;
      line-height: 1 !important;
      margin-left: -1px !important;
      transition: color 0.15s ease, background 0.15s ease !important;
    }

    .${PILL_CLASS} .zw-salvage-btn-discard:hover {
      color: #ff3b30 !important;
      background: rgba(255, 59, 48, 0.15) !important;
    }

    /* ── Snippet Hover Popover ── */
    .${POPOVER_CLASS} {
      all: initial;
      position: absolute !important;
      z-index: 2147483645 !important;
      width: 270px !important;
      padding: 10px 14px !important;
      background: rgba(20, 20, 24, 0.96) !important;
      backdrop-filter: saturate(180%) blur(24px) !important;
      -webkit-backdrop-filter: saturate(180%) blur(24px) !important;
      border: 1px solid rgba(255, 255, 255, 0.16) !important;
      border-radius: 12px !important;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.2) !important;
      color: #f1f5f9 !important;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif !important;
      font-size: 12px !important;
      line-height: 1.4 !important;
      box-sizing: border-box !important;
      pointer-events: none !important;
      animation: zwPopoverEnter 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
      display: none;
    }

    .${POPOVER_CLASS}.zw--visible {
      display: block !important;
    }

    .${POPOVER_CLASS} .zw-popover-quote {
      all: initial;
      display: block !important;
      color: #e2e8f0 !important;
      font-family: inherit !important;
      font-size: 12px !important;
      font-style: italic !important;
      line-height: 1.4 !important;
      margin-bottom: 6px !important;
      word-break: break-word !important;
      max-height: 60px !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }

    .${POPOVER_CLASS} .zw-popover-meta {
      all: initial;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      color: #94a3b8 !important;
      font-family: inherit !important;
      font-size: 10px !important;
      font-weight: 500 !important;
      border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
      padding-top: 6px !important;
    }

    /* ── Form-Level Consolidated Banner ── */
    .${FORM_BANNER_CLASS} {
      all: initial;
      position: absolute !important;
      z-index: 2147483638 !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 8px !important;
      padding: 4px 6px 4px 12px !important;
      height: 28px !important;
      background: rgba(29, 29, 31, 0.90) !important;
      backdrop-filter: saturate(180%) blur(20px) !important;
      -webkit-backdrop-filter: saturate(180%) blur(20px) !important;
      color: #ffffff !important;
      border: 1px solid rgba(255, 255, 255, 0.14) !important;
      border-radius: 9999px !important;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.24) !important;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif !important;
      font-size: 12px !important;
      letter-spacing: -0.015em !important;
      box-sizing: border-box !important;
      animation: zwSalvagePillEnter 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
    }

    .${FORM_BANNER_CLASS} .zw-banner-btn-restore {
      all: initial;
      cursor: pointer !important;
      display: inline-flex !important;
      align-items: center !important;
      background: #0066cc !important;
      color: #ffffff !important;
      border-radius: 9999px !important;
      padding: 3px 10px !important;
      font-family: inherit !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      letter-spacing: -0.01em !important;
      transition: background 0.15s ease, transform 0.1s ease !important;
    }

    .${FORM_BANNER_CLASS} .zw-banner-btn-restore:hover {
      background: #0071e3 !important;
    }

    .${FORM_BANNER_CLASS} .zw-banner-btn-restore:active {
      transform: scale(0.95) !important;
    }

    .${FORM_BANNER_CLASS} .zw-banner-btn-discard {
      all: initial;
      cursor: pointer !important;
      color: rgba(255, 255, 255, 0.45) !important;
      font-size: 11px !important;
      padding: 2px 5px !important;
      border-radius: 50% !important;
      transition: color 0.15s ease, background 0.15s ease !important;
    }

    .${FORM_BANNER_CLASS} .zw-banner-btn-discard:hover {
      color: #ffffff !important;
      background: rgba(255, 255, 255, 0.12) !important;
    }

    /* ── Floating Site-Level Restore Prompt ── */
    @keyframes zwSitePromptEnter {
      from {
        opacity: 0;
        transform: translateY(16px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .${SITE_PROMPT_CLASS} {
      all: initial;
      position: fixed !important;
      bottom: 24px !important;
      right: 24px !important;
      z-index: 2147483647 !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 9px !important;
      width: 300px !important;
      max-width: calc(100vw - 32px) !important;
      padding: 13px 15px !important;
      background: rgba(29, 29, 31, 0.92) !important;
      backdrop-filter: saturate(180%) blur(24px) !important;
      -webkit-backdrop-filter: saturate(180%) blur(24px) !important;
      border: 1px solid rgba(255, 255, 255, 0.14) !important;
      border-radius: 16px !important;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.38), 0 0 0 1px rgba(255, 255, 255, 0.06) !important;
      color: #ffffff !important;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif !important;
      font-size: 12px !important;
      line-height: 1.4 !important;
      box-sizing: border-box !important;
      animation: zwSitePromptEnter 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
      pointer-events: auto !important;
      user-select: none !important;
      transition: opacity 0.2s ease, transform 0.2s ease !important;
    }

    .${SITE_PROMPT_CLASS} .zw-site-prompt-header {
      all: initial;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      width: 100% !important;
      font-family: inherit !important;
    }

    .${SITE_PROMPT_CLASS} .zw-site-prompt-title-wrap {
      all: initial;
      display: flex !important;
      align-items: center !important;
      gap: 7px !important;
      font-family: inherit !important;
    }

    .${SITE_PROMPT_CLASS} .zw-site-prompt-icon-badge {
      all: initial;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 22px !important;
      height: 22px !important;
      border-radius: 6px !important;
      background: rgba(41, 151, 255, 0.15) !important;
      border: 1px solid rgba(41, 151, 255, 0.25) !important;
      flex-shrink: 0 !important;
    }

    .${SITE_PROMPT_CLASS} .zw-site-prompt-title {
      all: initial;
      font-family: inherit !important;
      font-size: 13px !important;
      font-weight: 600 !important;
      color: #ffffff !important;
      letter-spacing: -0.015em !important;
      line-height: 1.2 !important;
    }

    .${SITE_PROMPT_CLASS} .zw-site-prompt-btn-close {
      all: initial;
      cursor: pointer !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 18px !important;
      height: 18px !important;
      border-radius: 50% !important;
      color: rgba(255, 255, 255, 0.45) !important;
      font-family: inherit !important;
      font-size: 12px !important;
      line-height: 1 !important;
      transition: color 0.15s ease, background 0.15s ease !important;
    }

    .${SITE_PROMPT_CLASS} .zw-site-prompt-btn-close:hover {
      color: #ffffff !important;
      background: rgba(255, 255, 255, 0.12) !important;
    }

    .${SITE_PROMPT_CLASS} .zw-site-prompt-body {
      all: initial;
      display: flex !important;
      flex-direction: column !important;
      gap: 5px !important;
      font-family: inherit !important;
      font-size: 11px !important;
      color: #a1a1a6 !important;
      line-height: 1.35 !important;
    }

    .${SITE_PROMPT_CLASS} .zw-site-prompt-quote {
      all: initial;
      display: block !important;
      font-family: inherit !important;
      font-size: 11px !important;
      font-style: italic !important;
      color: #d2d2d7 !important;
      background: rgba(255, 255, 255, 0.05) !important;
      border-left: 2px solid #2997ff !important;
      padding: 4px 7px !important;
      border-radius: 0 5px 5px 0 !important;
      max-height: 44px !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      word-break: break-word !important;
      box-sizing: border-box !important;
    }

    .${SITE_PROMPT_CLASS} .zw-site-prompt-actions {
      all: initial;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 8px !important;
      padding-top: 3px !important;
      border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
      font-family: inherit !important;
    }

    .${SITE_PROMPT_CLASS} .zw-site-prompt-btn-reload {
      all: initial;
      cursor: pointer !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 4px !important;
      background: #0066cc !important;
      color: #ffffff !important;
      border: none !important;
      border-radius: 9999px !important;
      padding: 5px 12px !important;
      font-family: inherit !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      letter-spacing: -0.01em !important;
      transition: background 0.15s ease, transform 0.1s ease !important;
    }

    .${SITE_PROMPT_CLASS} .zw-site-prompt-btn-reload:hover {
      background: #0071e3 !important;
    }

    .${SITE_PROMPT_CLASS} .zw-site-prompt-btn-reload:active {
      transform: scale(0.95) !important;
    }

    .${SITE_PROMPT_CLASS} .zw-site-prompt-btn-discard {
      all: initial;
      cursor: pointer !important;
      display: inline-flex !important;
      align-items: center !important;
      color: rgba(255, 255, 255, 0.45) !important;
      font-family: inherit !important;
      font-size: 11px !important;
      font-weight: 500 !important;
      padding: 3px 6px !important;
      border-radius: 6px !important;
      transition: color 0.15s ease, background 0.15s ease !important;
    }

    .${SITE_PROMPT_CLASS} .zw-site-prompt-btn-discard:hover {
      color: #ff3b30 !important;
      background: rgba(255, 59, 48, 0.12) !important;
    }

    [${SALVAGE_ATTR}="true"] {
      box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.35) !important;
      transition: box-shadow 0.2s ease !important;
    }
  `;

  (document.head || document.documentElement).appendChild(style);
  attachWindowListeners();
}

/**
 * Creates vector pen/feather icon in Apple SF style.
 */
function createPenIcon(): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', '#2997ff');
  svg.setAttribute('stroke-width', '2.2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path1.setAttribute('d', 'M12 20h9');

  const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path2.setAttribute('d', 'M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z');

  svg.appendChild(path1);
  svg.appendChild(path2);
  return svg;
}

/**
 * Repositions all active restore pills and popovers relative to target elements.
 */
export function updateRestorePillPositions(): void {
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;

  // 1. Reposition field pills: cleanly nested inside the input/textarea right edge
  for (let i = activePills.length - 1; i >= 0; i--) {
    const item = activePills[i];
    const { target, pill, popover } = item;

    if (!document.body.contains(target)) {
      pill.remove();
      popover?.remove();
      activePills.splice(i, 1);
      continue;
    }

    const rect = target.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;

    const pillWidth = pill.offsetWidth || 135;
    const pillHeight = pill.offsetHeight || 24;

    const posX = rect.right + scrollX - pillWidth - 6;
    let posY: number;

    if (rect.height > 55) {
      // Textarea or rich-text editor: cleanly nested in top-right corner
      posY = rect.top + scrollY + 8;
    } else {
      // Single-line input: vertically centered cleanly inside the right edge of input
      posY = rect.top + scrollY + Math.max(2, Math.floor((rect.height - pillHeight) / 2));
    }

    pill.style.left = `${posX}px`;
    pill.style.top = `${posY}px`;

    // Reposition popover if present
    if (popover) {
      const popoverWidth = popover.offsetWidth || 240;
      let popoverX = rect.right + scrollX - popoverWidth;
      if (popoverX < 8) popoverX = 8;
      const popoverY = posY - (popover.offsetHeight || 70) - 6;
      popover.style.left = `${popoverX}px`;
      popover.style.top = `${popoverY > scrollY ? popoverY : posY + pillHeight + 6}px`;
    }
  }

  // 2. Reposition form-level banners: docked cleanly at top-right above the form
  for (let i = activeFormBanners.length - 1; i >= 0; i--) {
    const item = activeFormBanners[i];
    const { form, banner } = item;

    if (!document.body.contains(form)) {
      banner.remove();
      activeFormBanners.splice(i, 1);
      continue;
    }

    const rect = form.getBoundingClientRect();
    const bannerHeight = banner.offsetHeight || 28;
    const bannerWidth = banner.offsetWidth || 165;
    let posX = rect.right + scrollX - bannerWidth - 12;
    if (posX < 8) posX = 8;
    let posY = rect.top + scrollY - bannerHeight - 8;
    if (posY < scrollY + 4) {
      posY = rect.top + scrollY + 8;
    }

    banner.style.left = `${posX}px`;
    banner.style.top = `${posY}px`;
  }
}

function attachWindowListeners(): void {
  if (windowListenersAttached) return;
  windowListenersAttached = true;
  window.addEventListener('resize', updateRestorePillPositions, { passive: true });
  window.addEventListener('scroll', updateRestorePillPositions, { passive: true, capture: true });
}

/**
 * Triggers visual cyan border glow on a restored element.
 */
export function flashRestoredGlow(el: HTMLElement): void {
  el.classList.remove('zw-restored-glow');
  // Trigger reflow to restart CSS animation
  void el.offsetWidth;
  el.classList.add('zw-restored-glow');
  setTimeout(() => {
    el.classList.remove('zw-restored-glow');
  }, 1300);
}

/**
 * Displays an Apple-styled floating restore pill over a field with saved draft.
 */
export function showRestorePill(
  target: HTMLElement,
  meta: DraftMeta,
  onRestore: () => void,
  onDiscard: () => void
): HTMLElement {
  injectFormSalvagerStyles();
  dismissRestorePill(target);

  target.setAttribute(SALVAGE_ATTR, 'true');

  const pill = document.createElement('div');
  pill.className = PILL_CLASS;
  pill.setAttribute('role', 'alert');
  pill.setAttribute('aria-label', 'ZenWeb detected a saved draft for this input');

  // Brand + Icon
  const brand = document.createElement('span');
  brand.className = 'zw-salvage-brand';
  brand.appendChild(createPenIcon());

  const brandText = document.createElement('span');
  brandText.textContent = 'Draft';
  brand.appendChild(brandText);

  // Dot separator
  const dot = document.createElement('span');
  dot.className = 'zw-salvage-sep';

  // Subtitle / Time info
  const sub = document.createElement('span');
  sub.className = 'zw-salvage-sub';
  sub.textContent = `· ${meta.timeAgo}`;

  // Keyboard shortcut badge
  const kbd = document.createElement('span');
  kbd.className = 'zw-salvage-kbd';
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
  kbd.textContent = isMac ? '⌥R' : 'Alt+R';
  kbd.title = 'Press shortcut while field is focused to restore';

  // Restore button
  const restoreBtn = document.createElement('button');
  restoreBtn.className = 'zw-salvage-btn-restore';
  restoreBtn.type = 'button';
  restoreBtn.textContent = 'Restore';
  restoreBtn.title = 'Restore saved text into this field (or press Alt+R)';

  restoreBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onRestore();
    flashRestoredGlow(target);
    dismissRestorePill(target);
  });

  // Discard button
  const discardBtn = document.createElement('button');
  discardBtn.className = 'zw-salvage-btn-discard';
  discardBtn.type = 'button';
  discardBtn.textContent = '✕';
  discardBtn.title = 'Discard this saved draft';

  discardBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDiscard();
    dismissRestorePill(target);
  });

  pill.appendChild(brand);
  pill.appendChild(dot);
  pill.appendChild(sub);
  pill.appendChild(kbd);
  pill.appendChild(restoreBtn);
  pill.appendChild(discardBtn);

  // ── Create Snippet Hover Popover ──
  let popover: HTMLElement | null = null;
  if (meta.snippet) {
    popover = document.createElement('div');
    popover.className = POPOVER_CLASS;

    const quote = document.createElement('span');
    quote.className = 'zw-popover-quote';
    quote.textContent = `“${meta.snippet}”`;

    const popMeta = document.createElement('div');
    popMeta.className = 'zw-popover-meta';

    const countLabel = meta.wordCount === 1 ? '1 word' : `${meta.wordCount} words`;
    const countSpan = document.createElement('span');
    countSpan.textContent = `Total: ${countLabel}`;

    const hintSpan = document.createElement('span');
    hintSpan.textContent = 'Click Restore or Alt+R';

    popMeta.appendChild(countSpan);
    popMeta.appendChild(hintSpan);

    popover.appendChild(quote);
    popover.appendChild(popMeta);

    document.body.appendChild(popover);

    pill.addEventListener('mouseenter', () => {
      popover?.classList.add('zw--visible');
      updateRestorePillPositions();
    });
    pill.addEventListener('mouseleave', () => {
      popover?.classList.remove('zw--visible');
    });
  }

  document.body.appendChild(pill);
  activePills.push({ target, pill, popover });

  requestAnimationFrame(() => updateRestorePillPositions());

  return pill;
}

/**
 * Injects a form-level consolidated banner when 2 or more recoverable fields exist.
 */
export function showFormLevelBanner(
  form: HTMLFormElement,
  fieldCount: number,
  onRestoreAll: () => void,
  onDismissAll: () => void
): HTMLElement {
  injectFormSalvagerStyles();
  dismissFormLevelBanner(form);

  const banner = document.createElement('div');
  banner.className = FORM_BANNER_CLASS;

  const brand = document.createElement('span');
  brand.className = 'zw-salvage-brand';
  brand.appendChild(createPenIcon());

  const label = document.createElement('span');
  label.style.fontWeight = '600';
  label.textContent = `${fieldCount} drafts saved`;

  const restoreAllBtn = document.createElement('button');
  restoreAllBtn.className = 'zw-banner-btn-restore';
  restoreAllBtn.type = 'button';
  restoreAllBtn.textContent = 'Restore All';

  restoreAllBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onRestoreAll();
    dismissFormLevelBanner(form);
  });

  const discardBtn = document.createElement('button');
  discardBtn.className = 'zw-banner-btn-discard';
  discardBtn.type = 'button';
  discardBtn.textContent = '✕';
  discardBtn.title = 'Dismiss form banner';

  discardBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDismissAll();
    dismissFormLevelBanner(form);
  });

  banner.appendChild(brand);
  banner.appendChild(label);
  banner.appendChild(restoreAllBtn);
  banner.appendChild(discardBtn);

  document.body.appendChild(banner);
  activeFormBanners.push({ form, banner });

  requestAnimationFrame(() => updateRestorePillPositions());

  return banner;
}

export function dismissFormLevelBanner(form: HTMLFormElement): void {
  const idx = activeFormBanners.findIndex((b) => b.form === form);
  if (idx !== -1) {
    activeFormBanners[idx].banner.remove();
    activeFormBanners.splice(idx, 1);
  }
}

/**
 * Dismisses the restore pill and popover for a given target element.
 */
export function dismissRestorePill(target: HTMLElement): void {
  target.removeAttribute(SALVAGE_ATTR);
  const idx = activePills.findIndex((p) => p.target === target);
  if (idx !== -1) {
    const item = activePills[idx];
    item.pill.remove();
    item.popover?.remove();
    activePills.splice(idx, 1);
  }
}

/**
 * Displays a floating Apple-styled pop-up prompt in the corner offering to reload saved form data.
 */
export function showSiteRestorePrompt(options: SitePromptOptions): HTMLElement {
  injectFormSalvagerStyles();
  dismissSiteRestorePrompt();

  const prompt = document.createElement('div');
  prompt.className = SITE_PROMPT_CLASS;
  prompt.setAttribute('role', 'alertdialog');
  prompt.setAttribute('aria-label', 'ZenWeb detected unsubmitted form data for this site');

  // Header
  const header = document.createElement('div');
  header.className = 'zw-site-prompt-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'zw-site-prompt-title-wrap';

  const iconBadge = document.createElement('div');
  iconBadge.className = 'zw-site-prompt-icon-badge';
  iconBadge.appendChild(createPenIcon());

  const title = document.createElement('span');
  title.className = 'zw-site-prompt-title';
  title.textContent = 'Unsubmitted Form Draft';

  titleWrap.appendChild(iconBadge);
  titleWrap.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'zw-site-prompt-btn-close';
  closeBtn.textContent = '✕';
  closeBtn.title = 'Dismiss prompt';
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    options.onDismiss?.();
    dismissSiteRestorePrompt();
  });

  header.appendChild(titleWrap);
  header.appendChild(closeBtn);

  // Body
  const body = document.createElement('div');
  body.className = 'zw-site-prompt-body';

  const sub = document.createElement('span');
  const fieldLabel = options.fieldCount === 1 ? '1 field' : `${options.fieldCount} fields`;
  sub.textContent = `${fieldLabel} saved · ${options.timeAgo}`;
  body.appendChild(sub);

  if (options.snippet) {
    const quote = document.createElement('span');
    quote.className = 'zw-site-prompt-quote';
    quote.textContent = `“${options.snippet}”`;
    body.appendChild(quote);
  }

  // Actions
  const actions = document.createElement('div');
  actions.className = 'zw-site-prompt-actions';

  const reloadBtn = document.createElement('button');
  reloadBtn.type = 'button';
  reloadBtn.className = 'zw-site-prompt-btn-reload';
  reloadBtn.textContent = 'Reload Saved Data';
  reloadBtn.title = 'Reload saved text into this form';

  reloadBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    options.onReload();
    reloadBtn.textContent = '✓ Data Reloaded!';
    reloadBtn.style.background = '#10b981';
    reloadBtn.style.borderColor = '#10b981';
    setTimeout(() => {
      dismissSiteRestorePrompt();
    }, 1200);
  });

  const discardBtn = document.createElement('button');
  discardBtn.type = 'button';
  discardBtn.className = 'zw-site-prompt-btn-discard';
  discardBtn.textContent = 'Discard Draft';
  discardBtn.title = 'Permanently delete this saved draft';

  discardBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    options.onDiscard();
    dismissSiteRestorePrompt();
  });

  actions.appendChild(reloadBtn);
  actions.appendChild(discardBtn);

  prompt.appendChild(header);
  prompt.appendChild(body);
  prompt.appendChild(actions);

  document.body.appendChild(prompt);
  activeSitePrompt = prompt;

  return prompt;
}

export function dismissSiteRestorePrompt(): void {
  if (activeSitePrompt) {
    activeSitePrompt.style.opacity = '0';
    activeSitePrompt.style.transform = 'translateY(16px) scale(0.96)';
    const el = activeSitePrompt;
    activeSitePrompt = null;
    setTimeout(() => {
      el.remove();
    }, 200);
  }
}

/**
 * Removes all restore pills and form banners from the page.
 */
export function removeAllRestorePills(): void {
  dismissSiteRestorePrompt();

  for (const item of activePills) {
    item.target.removeAttribute(SALVAGE_ATTR);
    item.pill.remove();
    item.popover?.remove();
  }
  activePills.length = 0;

  for (const item of activeFormBanners) {
    item.banner.remove();
  }
  activeFormBanners.length = 0;

  const style = document.getElementById(STYLE_ID);
  if (style) style.remove();
}


