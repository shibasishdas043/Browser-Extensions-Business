/**
 * Form Salvager & Crash Guard — UI Module 2.0
 * Apple-grade non-destructive floating restore prompt in the viewport corner.
 * 100% XSS-Safe: strictly uses DOM APIs and textContent (no innerHTML).
 */

const STYLE_ID = 'zenweb-form-salvager-styles';
const SITE_PROMPT_CLASS = 'zw-salvage-site-prompt';

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

let activeSitePrompt: HTMLElement | null = null;

/**
 * Checks if the current window is on a search engine page (Google, Bing, DuckDuckGo, etc.).
 */
export function isSearchEnginePage(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  try {
    const raw = window.location.hostname;
    const host = raw.toLowerCase().replace(/^www\./, '');
    if (
      host.startsWith('mail.google.') ||
      host.startsWith('docs.google.') ||
      host.startsWith('drive.google.') ||
      host.startsWith('calendar.google.') ||
      host.startsWith('meet.google.') ||
      host.startsWith('chat.google.')
    ) {
      return false;
    }
    return (
      host === 'google.com' ||
      host.endsWith('.google.com') ||
      host.includes('google.') ||
      host === 'bing.com' ||
      host.endsWith('.bing.com') ||
      host === 'duckduckgo.com' ||
      host.endsWith('.duckduckgo.com') ||
      host === 'search.brave.com' ||
      host === 'brave.com' ||
      host === 'yahoo.com' ||
      host.endsWith('.yahoo.com') ||
      host === 'ecosia.org' ||
      host.endsWith('.ecosia.org') ||
      host === 'startpage.com' ||
      host.endsWith('.startpage.com') ||
      host === 'kagi.com' ||
      host.endsWith('.kagi.com') ||
      host === 'qwant.com' ||
      host.endsWith('.qwant.com') ||
      host.includes('yandex.') ||
      host === 'baidu.com' ||
      host.endsWith('.baidu.com') ||
      host === 'ask.com' ||
      host.endsWith('.ask.com') ||
      host === 'search.aol.com' ||
      host === 'naver.com' ||
      host.endsWith('.naver.com')
    );
  } catch {
    return false;
  }
}

/**
 * Cleanly extracts and formats the website domain or host name for display.
 */
export function formatWebsiteName(siteUrl?: string): string {
  try {
    if (siteUrl && siteUrl !== 'file://') {
      const url = siteUrl.includes('://') ? new URL(siteUrl) : new URL(`https://${siteUrl}`);
      const host = url.hostname.replace(/^www\./i, '');
      if (host) return host;
    }
  } catch {}

  if (typeof window !== 'undefined' && window.location) {
    try {
      const host = (window.location.hostname || window.location.host || '').replace(/^www\./i, '');
      if (host) return host;
      if (window.location.protocol === 'file:') return 'Local File';
    } catch {}
  }

  return 'Current Website';
}

/**
 * Injects styling for the corner restore prompt and field restoration glow.
 */
export function injectFormSalvagerStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
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
      background: transparent !important;
      border: none !important;
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
      color: #ffffff !important;
      background: transparent !important;
      font-family: inherit !important;
      font-size: 13px !important;
      font-weight: 500 !important;
      line-height: 1 !important;
      transition: color 0.15s ease !important;
    }

    .${SITE_PROMPT_CLASS} .zw-site-prompt-btn-close:hover {
      color: #ff3b30 !important;
      background: transparent !important;
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
      font-style: normal !important;
      font-weight: 500 !important;
      color: #d2d2d7 !important;
      background: rgba(255, 255, 255, 0.05) !important;
      border-left: 2px solid #2997ff !important;
      padding: 4px 7px !important;
      border-radius: 0 5px 5px 0 !important;
      max-height: 44px !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
      box-sizing: border-box !important;
    }

    .${SITE_PROMPT_CLASS} .zw-site-prompt-actions {
      all: initial;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 8px !important;
      margin-top: 2px !important;
      padding-top: 8px !important;
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
      height: 26px !important;
      box-sizing: border-box !important;
      background: #0066cc !important;
      color: #ffffff !important;
      border: none !important;
      border-radius: 9999px !important;
      padding: 0 14px !important;
      font-family: inherit !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      line-height: 1 !important;
      letter-spacing: -0.01em !important;
      white-space: nowrap !important;
      vertical-align: middle !important;
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
      justify-content: center !important;
      height: 26px !important;
      box-sizing: border-box !important;
      color: rgba(255, 255, 255, 0.45) !important;
      background: transparent !important;
      font-family: inherit !important;
      font-size: 11px !important;
      font-weight: 500 !important;
      line-height: 1 !important;
      white-space: nowrap !important;
      padding: 0 6px !important;
      border-radius: 6px !important;
      transition: color 0.15s ease !important;
    }

    .${SITE_PROMPT_CLASS} .zw-site-prompt-btn-discard:hover {
      color: #ff3b30 !important;
      background: transparent !important;
    }
  `;

  (document.head || document.documentElement).appendChild(style);
}

/**
 * Creates vector pen/feather icon in Apple SF style.
 */
function createPenIcon(size = 13): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
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
 * Triggers visual cyan border glow on a restored element.
 */
export function flashRestoredGlow(el: HTMLElement): void {
  el.classList.remove('zw-restored-glow');
  void el.offsetWidth;
  el.classList.add('zw-restored-glow');
  setTimeout(() => {
    el.classList.remove('zw-restored-glow');
  }, 1300);
}

/**
 * Displays a floating Apple-styled pop-up prompt in the corner offering to reload saved form data.
 * Strictly guarantees that only one prompt instance exists in the UI at any time.
 */
export function showSiteRestorePrompt(options: SitePromptOptions): HTMLElement | null {
  if (isSearchEnginePage()) return null;

  injectFormSalvagerStyles();

  // If prompt already exists on screen, update metadata in place rather than spawning a duplicate
  const existing = document.querySelector(`.${SITE_PROMPT_CLASS}`) as HTMLElement | null;
  if (existing && activeSitePrompt) {
    const sub = existing.querySelector('.zw-site-prompt-body > span') as HTMLElement | null;
    if (sub) {
      const fieldLabel = options.fieldCount === 1 ? '1 field' : `${options.fieldCount} fields`;
      sub.textContent = `${fieldLabel} saved · ${options.timeAgo}`;
    }
    return existing;
  }

  // Force-dismiss any stale prompt elements immediately before creating a new one
  dismissSiteRestorePrompt(true);

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
  iconBadge.appendChild(createPenIcon(14));

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

  const websiteName = formatWebsiteName(options.siteUrl);
  if (websiteName) {
    const siteBox = document.createElement('span');
    siteBox.className = 'zw-site-prompt-quote';
    siteBox.textContent = websiteName;
    body.appendChild(siteBox);
  }

  // Actions
  const actions = document.createElement('div');
  actions.className = 'zw-site-prompt-actions';

  const reloadBtn = document.createElement('button');
  reloadBtn.type = 'button';
  reloadBtn.className = 'zw-site-prompt-btn-reload';
  reloadBtn.textContent = 'Reload All Saved Data';
  reloadBtn.title = 'Reload all saved text into this form';

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

export function dismissSiteRestorePrompt(immediate = false): void {
  if (immediate) {
    document.querySelectorAll(`.${SITE_PROMPT_CLASS}`).forEach((el) => el.remove());
    activeSitePrompt = null;
    return;
  }

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
 * Dismisses any active site restore prompt and cleans up styles.
 */
export function removeAllRestorePills(): void {
  dismissSiteRestorePrompt();
  const style = document.getElementById(STYLE_ID);
  if (style) style.remove();
}
