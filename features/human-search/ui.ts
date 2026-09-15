/**
 * Human Search Bypass — UI Module 2.0
 * Injects modern search engine toolbar buttons and in-page result badges.
 * 100% XSS-Safe DOM creation.
 */

const STYLE_ID = 'zenweb-human-search-styles';
const BADGE_ID = 'zw-human-search-btn';
const BADGED_ATTR = 'data-zenweb-badged';

export function injectHumanSearchStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${BADGE_ID} {
      all: initial;
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      padding: 6px 14px !important;
      margin: 8px 12px !important;
      background: rgba(255, 255, 255, 0.94) !important;
      backdrop-filter: saturate(180%) blur(16px) !important;
      -webkit-backdrop-filter: saturate(180%) blur(16px) !important;
      color: #1d1d1f !important;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      line-height: 1 !important;
      border-radius: 9999px !important;
      border: 1px solid rgba(0, 0, 0, 0.14) !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08) !important;
      cursor: pointer !important;
      user-select: none !important;
      transition: all 0.18s ease !important;
      z-index: 1000 !important;
    }

    #${BADGE_ID}:hover {
      background: #ffffff !important;
      border-color: rgba(16, 185, 129, 0.45) !important;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.18) !important;
      transform: translateY(-1px) !important;
    }

    #${BADGE_ID}.zw--active {
      background: #10b981 !important;
      color: #ffffff !important;
      border-color: #10b981 !important;
      box-shadow: 0 3px 12px rgba(16, 185, 129, 0.35) !important;
    }

    /* ── In-Page SERP Badges ── */
    .zw-discussion-pill {
      all: initial;
      display: inline-flex !important;
      align-items: center !important;
      gap: 4px !important;
      padding: 2px 7px !important;
      margin-bottom: 4px !important;
      background: rgba(16, 185, 129, 0.12) !important;
      color: #059669 !important;
      border: 1px solid rgba(16, 185, 129, 0.28) !important;
      border-radius: 9999px !important;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      line-height: 1.2 !important;
      letter-spacing: -0.01em !important;
    }

    .zw-seo-farm-pill {
      all: initial;
      display: inline-flex !important;
      align-items: center !important;
      gap: 4px !important;
      padding: 2px 7px !important;
      margin-bottom: 4px !important;
      background: rgba(239, 68, 68, 0.1) !important;
      color: #dc2626 !important;
      border: 1px solid rgba(239, 68, 68, 0.24) !important;
      border-radius: 9999px !important;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      line-height: 1.2 !important;
    }

    .zw-seo-farm-dimmed {
      opacity: 0.58 !important;
      transition: opacity 0.2s ease !important;
    }

    .zw-seo-farm-dimmed:hover {
      opacity: 1 !important;
    }
  `;

  (document.head || document.documentElement).appendChild(style);
}

export function injectHumanSearchButton(onToggle: (isActive: boolean) => void): HTMLElement | null {
  if (document.getElementById(BADGE_ID)) return null;

  // Search toolbar anchors across Google, Bing, DuckDuckGo, Brave
  const selectors = [
    '#top_nav',
    '#hdtb',
    '#searchform',
    '[role="navigation"]',
    '#rcnt',
    '.header__search',
    '#b_header',
    'header',
  ];

  let target: HTMLElement | null = null;
  for (const s of selectors) {
    const el = document.querySelector<HTMLElement>(s);
    if (el) {
      target = el;
      break;
    }
  }

  if (!target) return null;

  const btn = document.createElement('button');
  btn.id = BADGE_ID;
  btn.type = 'button';
  btn.title = 'Prioritize authentic human discussions & filter AI SEO slop';

  const icon = document.createElement('span');
  icon.textContent = '💬';

  const text = document.createElement('span');
  text.textContent = 'Human Discussions';

  btn.appendChild(icon);
  btn.appendChild(text);

  const url = new URL(window.location.href);
  const paramName = url.searchParams.has('q') ? 'q' : 'query';
  const q = url.searchParams.get(paramName) || '';
  const isCurrentlyActive = q.includes('reddit.com') || q.includes('quora.com') || q.includes('stackoverflow.com');
  if (isCurrentlyActive) {
    btn.classList.add('zw--active');
  }

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const active = btn.classList.toggle('zw--active');
    onToggle(active);
  });

  target.insertAdjacentElement('afterbegin', btn);
  return btn;
}

export function badgeDiscussionResult(card: HTMLElement, source: string): void {
  if (card.hasAttribute(BADGED_ATTR)) return;
  card.setAttribute(BADGED_ATTR, 'discussion');

  const pill = document.createElement('div');
  pill.className = 'zw-discussion-pill';

  const cleanSource = source.replace(/^(www\.)/, '');
  pill.textContent = `💬 Human Discussion · ${cleanSource}`;

  card.insertAdjacentElement('afterbegin', pill);
}

export function flagSeoFarmResult(card: HTMLElement, source: string): void {
  if (card.hasAttribute(BADGED_ATTR)) return;
  card.setAttribute(BADGED_ATTR, 'seofarm');
  card.classList.add('zw-seo-farm-dimmed');

  const pill = document.createElement('div');
  pill.className = 'zw-seo-farm-pill';

  const cleanSource = source.replace(/^(www\.)/, '');
  pill.textContent = `⚠️ SEO Content Farm · ${cleanSource}`;

  card.insertAdjacentElement('afterbegin', pill);
}

export function removeHumanSearchUI(): void {
  const btn = document.getElementById(BADGE_ID);
  if (btn) btn.remove();

  document.querySelectorAll('.zw-discussion-pill, .zw-seo-farm-pill').forEach((el) => el.remove());
  document.querySelectorAll('.zw-seo-farm-dimmed').forEach((el) => el.classList.remove('zw-seo-farm-dimmed'));
  document.querySelectorAll(`[${BADGED_ATTR}]`).forEach((el) => el.removeAttribute(BADGED_ATTR));

  const style = document.getElementById(STYLE_ID);
  if (style) style.remove();
}
