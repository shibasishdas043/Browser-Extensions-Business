/**
 * Human Search Bypass — UI Module
 * Injects a discreet Apple-styled toggle on search engines to filter SEO blog slop.
 */

const STYLE_ID = 'zenweb-human-search-styles';
const BADGE_ID = 'zw-human-search-btn';

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
      padding: 6px 12px !important;
      margin: 8px 0 !important;
      background: rgba(255, 255, 255, 0.9) !important;
      backdrop-filter: saturate(180%) blur(16px) !important;
      -webkit-backdrop-filter: saturate(180%) blur(16px) !important;
      color: #1d1d1f !important;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      line-height: 1 !important;
      border-radius: 9999px !important;
      border: 1px solid rgba(0, 0, 0, 0.12) !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06) !important;
      cursor: pointer !important;
      user-select: none !important;
      transition: all 0.18s ease !important;
      z-index: 1000 !important;
    }

    #${BADGE_ID}:hover {
      background: #ffffff !important;
      border-color: rgba(16, 185, 129, 0.4) !important;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15) !important;
      transform: translateY(-1px) !important;
    }

    #${BADGE_ID}.zw--active {
      background: #10b981 !important;
      color: #ffffff !important;
      border-color: #10b981 !important;
      box-shadow: 0 3px 10px rgba(16, 185, 129, 0.35) !important;
    }
  `;

  (document.head || document.documentElement).appendChild(style);
}

export function injectHumanSearchButton(onToggle: (isActive: boolean) => void): HTMLElement | null {
  if (document.getElementById(BADGE_ID)) return null;

  // Locate search tools or bar container
  const target = document.querySelector('#top_nav, #hdtb, #searchform, [role="navigation"], #rcnt');
  if (!target) return null;

  const btn = document.createElement('button');
  btn.id = BADGE_ID;
  btn.type = 'button';
  btn.title = 'Filter out AI SEO blogs and prioritize authentic human discussions';

  const icon = document.createElement('span');
  icon.textContent = '💬';

  const text = document.createElement('span');
  text.textContent = 'Human Discussions';

  btn.appendChild(icon);
  btn.appendChild(text);

  const url = new URL(window.location.href);
  const q = url.searchParams.get('q') || '';
  const isCurrentlyActive = q.includes('reddit.com') || q.includes('quora.com');
  if (isCurrentlyActive) {
    btn.classList.add('zw--active');
  }

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const active = btn.classList.toggle('zw--active');
    onToggle(active);
  });

  target.insertAdjacentElement('beforebegin', btn);
  return btn;
}

export function removeHumanSearchUI(): void {
  const btn = document.getElementById(BADGE_ID);
  if (btn) btn.remove();
  const style = document.getElementById(STYLE_ID);
  if (style) style.remove();
}
