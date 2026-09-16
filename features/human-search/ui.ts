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
      gap: 7px !important;
      padding: 0 16px !important;
      height: 38px !important;
      background: #ffffff !important;
      color: #202124 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Google Sans", "SF Pro Text", "Roboto", "Segoe UI", sans-serif !important;
      font-size: 13px !important;
      font-weight: 500 !important;
      line-height: 1 !important;
      border-radius: 9999px !important;
      border: 1px solid #dadce0 !important;
      box-shadow: 0 1px 6px rgba(32, 33, 36, 0.12) !important;
      cursor: pointer !important;
      user-select: none !important;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
      position: absolute !important;
      left: calc(100% + 12px) !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
      white-space: nowrap !important;
      z-index: 1000 !important;
    }

    #${BADGE_ID}:hover {
      background: #f8fafd !important;
      border-color: #10b981 !important;
      color: #059669 !important;
      box-shadow: 0 2px 10px rgba(16, 185, 129, 0.22) !important;
      transform: translateY(calc(-50% - 1px)) !important;
    }

    #${BADGE_ID}.zw--active {
      background: #10b981 !important;
      color: #ffffff !important;
      border-color: #10b981 !important;
      box-shadow: 0 2px 8px rgba(16, 185, 129, 0.35) !important;
    }

    #${BADGE_ID}.zw--active:hover {
      background: #059669 !important;
      border-color: #059669 !important;
      color: #ffffff !important;
      box-shadow: 0 3px 12px rgba(16, 185, 129, 0.45) !important;
      transform: translateY(calc(-50% - 1px)) !important;
    }

    /* Dark theme support */
    @media (prefers-color-scheme: dark) {
      #${BADGE_ID} {
        background: #303134 !important;
        color: #e8eaed !important;
        border-color: #5f6368 !important;
        box-shadow: 0 1px 6px rgba(0, 0, 0, 0.4) !important;
      }
      #${BADGE_ID}:hover {
        background: #3c4043 !important;
        border-color: #34d399 !important;
        color: #34d399 !important;
        box-shadow: 0 2px 10px rgba(52, 211, 153, 0.25) !important;
      }
    }

    html[data-darkmode="true"] #${BADGE_ID},
    body[data-darkmode="true"] #${BADGE_ID},
    .dark-theme #${BADGE_ID} {
      background: #303134 !important;
      color: #e8eaed !important;
      border-color: #5f6368 !important;
      box-shadow: 0 1px 6px rgba(0, 0, 0, 0.4) !important;
    }

    /* Responsive fallback for narrow displays */
    @media (max-width: 960px) {
      #${BADGE_ID} {
        position: static !important;
        transform: none !important;
        margin: 12px auto 0 !important;
        display: flex !important;
        width: fit-content !important;
      }
      #${BADGE_ID}:hover {
        transform: translateY(-1px) !important;
      }
      #${BADGE_ID}.zw--active:hover {
        transform: translateY(-1px) !important;
      }
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
  const existing = document.getElementById(BADGE_ID);
  if (existing) return existing;

  // 1. Locate the active search input/textarea
  const searchInput = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    'textarea[name="q"], input[name="q"], input#searchbox, #searchbox_input, #search_form_input, input[name="p"], input[type="search"]'
  );

  let target: HTMLElement | null = null;

  if (searchInput) {
    // Priority: Google .A8SBwf (wraps .RNNXgb) or .RNNXgb itself
    target =
      searchInput.closest<HTMLElement>('.A8SBwf') ||
      searchInput.closest<HTMLElement>('.RNNXgb, [jsname="RNNXgb"]') ||
      searchInput.closest<HTMLElement>('.b_searchboxForm, #sb_form') ||
      searchInput.closest<HTMLElement>('#search_form, #searchbox_homepage, .header__form, .searchbox') ||
      searchInput.closest<HTMLElement>('form[role="search"], form#tsf, form');
  }

  // Fallback: If search input isn't in DOM yet, try known search bar wrappers
  if (!target) {
    const fallbackSelectors = [
      '.A8SBwf',
      '.RNNXgb',
      '[jsname="RNNXgb"]',
      '#sb_form',
      '#search_form',
      'form[role="search"]',
      '#tsf',
    ];
    for (const s of fallbackSelectors) {
      const el = document.querySelector<HTMLElement>(s);
      if (el) {
        target = el;
        break;
      }
    }
  }

  if (!target) return null;

  // Ensure target has relative positioning so the pill anchors directly beside it
  const computedPos = window.getComputedStyle(target).position;
  if (computedPos === 'static') {
    target.style.position = 'relative';
  }

  // Ensure target does not clip the pill
  if (window.getComputedStyle(target).overflow === 'hidden') {
    target.style.overflow = 'visible';
  }

  const btn = document.createElement('button');
  btn.id = BADGE_ID;
  btn.type = 'button';
  btn.title = 'Prioritize authentic human discussions & filter AI SEO slop';

  const icon = document.createElement('span');
  icon.textContent = '💬';
  icon.style.fontSize = '14px';

  const text = document.createElement('span');
  text.textContent = 'Human Discussions';

  btn.appendChild(icon);
  btn.appendChild(text);

  const url = new URL(window.location.href);
  const paramName = url.searchParams.has('q') ? 'q' : 'query';
  const q = url.searchParams.get(paramName) || '';
  const isCurrentlyActive =
    q.includes('reddit.com') ||
    q.includes('quora.com') ||
    q.includes('stackoverflow.com') ||
    q.includes('news.ycombinator.com');
  if (isCurrentlyActive) {
    btn.classList.add('zw--active');
  }

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const active = btn.classList.toggle('zw--active');
    onToggle(active);
  });

  // Attach submit listener to search form so typing on homepage with active pill preserves filter
  const form = searchInput?.closest<HTMLFormElement>('form') || target.closest<HTMLFormElement>('form');
  if (form && !form.dataset.zwHumanSearchBound) {
    form.dataset.zwHumanSearchBound = 'true';
    form.addEventListener('submit', () => {
      if (btn.classList.contains('zw--active')) {
        const input = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(
          'textarea[name="q"], input[name="q"], input[type="search"]'
        );
        if (input && input.value.trim()) {
          const val = input.value.trim();
          const forumQuery = '(site:reddit.com OR site:news.ycombinator.com OR site:stackoverflow.com OR site:quora.com)';
          if (!val.includes('site:reddit.com')) {
            input.value = `${val} ${forumQuery}`;
          }
        }
      }
    });
  }

  target.appendChild(btn);
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
