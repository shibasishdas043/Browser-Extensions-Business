/**
 * Recipe Story Fluff Skipper — UI Module
 * Injects a floating Apple-styled "Jump to Recipe" pill when recipe schema is detected.
 */

const STYLE_ID = 'zenweb-recipe-skipper-styles';
const BTN_ID = 'zw-jump-to-recipe-btn';

export function injectRecipeSkipperStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${BTN_ID} {
      all: initial;
      position: fixed !important;
      bottom: 24px !important;
      right: 24px !important;
      z-index: 2147483640 !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 8px !important;
      padding: 10px 18px !important;
      background: rgba(29, 29, 31, 0.94) !important;
      backdrop-filter: saturate(180%) blur(20px) !important;
      -webkit-backdrop-filter: saturate(180%) blur(20px) !important;
      color: #ffffff !important;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif !important;
      font-size: 13px !important;
      font-weight: 600 !important;
      line-height: 1 !important;
      border-radius: 9999px !important;
      border: 1px solid rgba(255, 255, 255, 0.18) !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3) !important;
      cursor: pointer !important;
      user-select: none !important;
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease !important;
      animation: zwJumpBtnEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
    }

    @keyframes zwJumpBtnEnter {
      from { opacity: 0; transform: translateY(12px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    #${BTN_ID}:hover {
      transform: translateY(-2px) scale(1.03) !important;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4) !important;
      border-color: rgba(245, 158, 11, 0.5) !important;
    }

    #${BTN_ID} .zw-recipe-icon {
      font-size: 15px !important;
    }

    #${BTN_ID} .zw-recipe-arrow {
      color: #f59e0b !important;
      font-weight: 700 !important;
    }
  `;

  (document.head || document.documentElement).appendChild(style);
}

export function showJumpToRecipeButton(onJump: () => void): void {
  if (document.getElementById(BTN_ID)) return;

  const btn = document.createElement('button');
  btn.id = BTN_ID;
  btn.type = 'button';
  btn.title = 'Skip fluff story and jump directly to recipe ingredients and instructions';

  const icon = document.createElement('span');
  icon.className = 'zw-recipe-icon';
  icon.textContent = '🍳';

  const text = document.createElement('span');
  text.textContent = 'Jump to Recipe';

  const arrow = document.createElement('span');
  arrow.className = 'zw-recipe-arrow';
  arrow.textContent = '↓';

  btn.appendChild(icon);
  btn.appendChild(text);
  btn.appendChild(arrow);

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    onJump();
  });

  document.body.appendChild(btn);
}

export function removeRecipeSkipperUI(): void {
  const btn = document.getElementById(BTN_ID);
  if (btn) btn.remove();
  const style = document.getElementById(STYLE_ID);
  if (style) style.remove();
}
