/**
 * Human Search Bypass — UI Module 2.0
 * Injects modern search engine toolbar buttons and in-page result badges.
 * 100% XSS-Safe DOM creation.
 */

import { FORUM_SEARCH_QUERY, PROMINENT_DISCUSSION_DOMAINS } from './constants';

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
      gap: 5px !important;
      padding: 0 11px !important;
      height: 30px !important;
      background: #ffffff !important;
      color: #202124 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Google Sans", "SF Pro Text", "Roboto", "Segoe UI", sans-serif !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      line-height: 1 !important;
      border-radius: 9999px !important;
      border: none !important;
      outline: none !important;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12) !important;
      cursor: pointer !important;
      user-select: none !important;
      transition: background 0.15s ease, color 0.15s ease !important;
      position: absolute !important;
      left: calc(100% + 10px) !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
      white-space: nowrap !important;
      z-index: 1000 !important;
      pointer-events: auto !important;
    }

    #${BADGE_ID} * {
      pointer-events: none !important;
    }

    #${BADGE_ID}:hover {
      background: #174ea6 !important;
      color: #ffffff !important;
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
      transform: translateY(-50%) !important;
    }

    #${BADGE_ID}:focus,
    #${BADGE_ID}:focus-visible,
    #${BADGE_ID}:active {
      outline: none !important;
      border: none !important;
    }

    #${BADGE_ID}.zw--active {
      background: #065f46 !important;
      color: #ffffff !important;
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
    }

    #${BADGE_ID}.zw--active:hover {
      background: #047857 !important;
      color: #ffffff !important;
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
      transform: translateY(-50%) !important;
    }

    /* Dark theme support */
    @media (prefers-color-scheme: dark) {
      #${BADGE_ID} {
        background: #303134 !important;
        color: #e8eaed !important;
        border: none !important;
        outline: none !important;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35) !important;
      }
      #${BADGE_ID}:hover {
        background: #1a73e8 !important;
        color: #ffffff !important;
        border: none !important;
        outline: none !important;
        box-shadow: none !important;
      }
      #${BADGE_ID}.zw--active {
        background: #065f46 !important;
        color: #ffffff !important;
        border: none !important;
        outline: none !important;
        box-shadow: none !important;
      }
      #${BADGE_ID}.zw--active:hover {
        background: #047857 !important;
        border: none !important;
        outline: none !important;
        color: #ffffff !important;
        box-shadow: none !important;
      }
    }

    html[data-darkmode="true"] #${BADGE_ID},
    body[data-darkmode="true"] #${BADGE_ID},
    .dark-theme #${BADGE_ID} {
      background: #303134 !important;
      color: #e8eaed !important;
      border: none !important;
      outline: none !important;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35) !important;
    }

    html[data-darkmode="true"] #${BADGE_ID}:hover,
    body[data-darkmode="true"] #${BADGE_ID}:hover,
    .dark-theme #${BADGE_ID}:hover {
      background: #1a73e8 !important;
      color: #ffffff !important;
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
    }

    html[data-darkmode="true"] #${BADGE_ID}.zw--active,
    body[data-darkmode="true"] #${BADGE_ID}.zw--active,
    .dark-theme #${BADGE_ID}.zw--active {
      background: #065f46 !important;
      color: #ffffff !important;
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
    }

    html[data-darkmode="true"] #${BADGE_ID}.zw--active:hover,
    body[data-darkmode="true"] #${BADGE_ID}.zw--active:hover,
    .dark-theme #${BADGE_ID}.zw--active:hover {
      background: #047857 !important;
      color: #ffffff !important;
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
    }

    /* Responsive fallback for narrow displays */
    @media (max-width: 960px) {
      #${BADGE_ID} {
        position: static !important;
        transform: none !important;
        margin: 8px auto 0 !important;
        display: flex !important;
        width: fit-content !important;
      }
      #${BADGE_ID}:hover {
        transform: none !important;
      }
      #${BADGE_ID}.zw--active:hover {
        transform: none !important;
      }
    }

    /* ── In-Page Badges ── */
    .zw-discussion-pill {
      display: none !important;
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
  const existing = document.getElementById(BADGE_ID);
  if (existing) return existing;

  // 1. Locate the active search input/textarea
  const searchInput = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    'textarea[name="q"], input[name="q"], input#searchbox, #searchbox_input, #search_form_input, input[name="p"], input[type="search"]'
  );

  let searchBox: HTMLElement | null = null;
  let anchorContainer: HTMLElement | null = null;

  if (searchInput) {
    // Locate the interactive search box element (which has :hover styling and input box borders)
    searchBox =
      searchInput.closest<HTMLElement>('.b_searchboxForm') ||
      searchInput.closest<HTMLElement>('.RNNXgb, [jsname="RNNXgb"]') ||
      searchInput.closest<HTMLElement>('.search--header, [class*="searchbox_searchbox"], .searchbox, .search__autocomplete') ||
      searchInput.closest<HTMLElement>('.search') ||
      searchInput.parentElement;

    // Locate the positioned parent wrapper that houses the search box
    anchorContainer =
      searchInput.closest<HTMLElement>('#sb_form') ||
      searchInput.closest<HTMLElement>('.A8SBwf') ||
      searchInput.closest<HTMLElement>('#search_form, #searchbox_homepage, .header__form') ||
      searchInput.closest<HTMLElement>('form[role="search"], form#tsf, form') ||
      searchBox?.parentElement ||
      null;
  }

  // Fallback: If search input isn't in DOM yet, try known search box wrappers
  if (!searchBox && !anchorContainer) {
    const fallbackBoxSelectors = [
      '.b_searchboxForm',
      '.RNNXgb',
      '[jsname="RNNXgb"]',
      '.search--header',
      '[class*="searchbox_searchbox"]',
      '.searchbox',
    ];
    for (const s of fallbackBoxSelectors) {
      const el = document.querySelector<HTMLElement>(s);
      if (el) {
        searchBox = el;
        anchorContainer = el.closest<HTMLElement>('#sb_form, .A8SBwf, #search_form, .header__form, form') || el.parentElement;
        break;
      }
    }
  }

  if (!searchBox && !anchorContainer) {
    const fallbackContainerSelectors = [
      '#sb_form',
      '.A8SBwf',
      '#search_form',
      'form[role="search"]',
      '#tsf',
      'form',
    ];
    for (const s of fallbackContainerSelectors) {
      const el = document.querySelector<HTMLElement>(s);
      if (el) {
        anchorContainer = el;
        break;
      }
    }
  }

  const container = anchorContainer || searchBox?.parentElement;
  if (!container && !searchBox) return null;

  // Ensure anchor container has relative positioning so the pill anchors directly beside it
  if (container) {
    const computedPos = window.getComputedStyle(container).position;
    if (computedPos === 'static') {
      container.style.position = 'relative';
    }
    if (window.getComputedStyle(container).overflow === 'hidden') {
      container.style.overflow = 'visible';
    }
  }

  const btn = document.createElement('button');
  btn.id = BADGE_ID;
  btn.type = 'button';
  btn.title = 'Prioritize authentic human discussions & filter AI SEO slop';

  const icon = document.createElement('span');
  icon.textContent = '💬';
  icon.style.fontSize = '12px';
  icon.style.lineHeight = '1';

  const text = document.createElement('span');
  text.textContent = 'Human Discussions';

  btn.appendChild(icon);
  btn.appendChild(text);

  const url = new URL(window.location.href);
  const paramName = url.searchParams.has('q') ? 'q' : 'query';
  const q = url.searchParams.get(paramName) || '';
  const isCurrentlyActive = PROMINENT_DISCUSSION_DOMAINS.some((d) => q.includes(d));
  if (isCurrentlyActive) {
    btn.classList.add('zw--active');
  }

  // Isolate all mouse and pointer events on the button so they NEVER propagate or
  // bubble into the search bar, preventing search engines (Bing, Google, DuckDuckGo, Brave)
  // from receiving mouse movements or highlighting the search bar.
  const isolatedEvents = [
    'pointerenter',
    'pointerleave',
    'pointerover',
    'pointerout',
    'pointermove',
    'mouseenter',
    'mouseleave',
    'mouseover',
    'mouseout',
    'mousemove',
    'mousedown',
    'mouseup',
    'pointerdown',
    'pointerup',
  ];

  for (const evtName of isolatedEvents) {
    btn.addEventListener(
      evtName,
      (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
      },
      { capture: true }
    );
  }

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    const active = btn.classList.toggle('zw--active');
    onToggle(active);
  });

  // Attach submit listener to search form so typing on homepage with active pill preserves filter
  const form = searchInput?.closest<HTMLFormElement>('form') || container?.closest<HTMLFormElement>('form');
  if (form && !form.dataset.zwHumanSearchBound) {
    form.dataset.zwHumanSearchBound = 'true';
    form.addEventListener('submit', () => {
      if (btn.classList.contains('zw--active')) {
        const input = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          'textarea[name="q"], input[name="q"], input[type="search"]'
        );
        if (input && input.value.trim()) {
          const val = input.value.trim();
          if (!val.includes('site:reddit.com')) {
            input.value = `${val} ${FORUM_SEARCH_QUERY}`;
          }
        }
      }
    });
  }

  // DOM Placement:
  // Crucial: insert btn as a sibling AFTER searchBox so it is NEVER a descendant
  // of the interactive search bar. Because CSS :hover bubbles to ancestors,
  // placing btn as a sibling ensures hovering btn NEVER triggers :hover on the search bar
  // (e.g. Bing .b_searchboxForm:hover, Google .RNNXgb:hover, or clear button visibility).
  if (searchBox && searchBox.parentElement) {
    searchBox.insertAdjacentElement('afterend', btn);
  } else if (container) {
    container.appendChild(btn);
  }

  return btn;
}

export function badgeDiscussionResult(_card: HTMLElement, _source: string): void {
  // Disabled per user preference: clean SERP without extra discussion pills
  return;
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
