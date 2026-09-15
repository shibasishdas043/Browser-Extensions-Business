/**
 * Recipe Story Fluff Skipper — UI Module 2.0
 * Injects a floating Apple-styled "Jump / View Recipe" pill and
 * a clean distraction-free frosted Recipe Reader Modal.
 * 100% XSS-Safe: strictly uses DOM APIs and textContent.
 */

import { ExtractedRecipe } from '../../types';

const STYLE_ID = 'zenweb-recipe-skipper-styles';
const BTN_ID = 'zw-jump-to-recipe-btn';
const MODAL_ID = 'zw-recipe-reader-modal';

export function injectRecipeSkipperStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes zwJumpBtnEnter {
      from { opacity: 0; transform: translateY(12px) scale(0.95); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    @keyframes zwRecipeModalEnter {
      from { opacity: 0; transform: scale(0.94) translateY(12px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }

    #${BTN_ID} {
      all: initial;
      position: fixed !important;
      bottom: 24px !important;
      right: 24px !important;
      z-index: 2147483640 !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 8px !important;
      padding: 9px 18px !important;
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
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35) !important;
      cursor: pointer !important;
      user-select: none !important;
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, border-color 0.2s ease !important;
      animation: zwJumpBtnEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
    }

    #${BTN_ID}:hover {
      transform: translateY(-2px) scale(1.03) !important;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45) !important;
      border-color: rgba(245, 158, 11, 0.6) !important;
    }

    #${BTN_ID} .zw-recipe-icon {
      font-size: 14px !important;
    }

    #${BTN_ID} .zw-recipe-arrow {
      color: #f59e0b !important;
      font-weight: 700 !important;
    }

    /* ── Recipe Reader Modal ── */
    #${MODAL_ID} {
      all: initial;
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483646 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 24px !important;
      background: rgba(0, 0, 0, 0.65) !important;
      backdrop-filter: blur(12px) !important;
      -webkit-backdrop-filter: blur(12px) !important;
      box-sizing: border-box !important;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif !important;
    }

    .zw-recipe-card {
      all: initial;
      display: flex !important;
      flex-direction: column !important;
      width: 100% !important;
      max-width: 680px !important;
      max-height: 88vh !important;
      background: rgba(28, 28, 30, 0.96) !important;
      backdrop-filter: saturate(180%) blur(24px) !important;
      -webkit-backdrop-filter: saturate(180%) blur(24px) !important;
      border: 1px solid rgba(255, 255, 255, 0.16) !important;
      border-radius: 20px !important;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6) !important;
      color: #f5f5f7 !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
      animation: zwRecipeModalEnter 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif !important;
    }

    .zw-recipe-header {
      padding: 20px 24px 16px !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
      display: flex !important;
      align-items: flex-start !important;
      justify-content: space-between !important;
      gap: 16px !important;
    }

    .zw-recipe-title {
      font-size: 20px !important;
      font-weight: 700 !important;
      color: #ffffff !important;
      letter-spacing: -0.02em !important;
      line-height: 1.25 !important;
      margin: 0 !important;
    }

    .zw-recipe-meta-row {
      display: flex !important;
      flex-wrap: wrap !important;
      gap: 8px !important;
      margin-top: 8px !important;
    }

    .zw-recipe-tag {
      font-size: 11px !important;
      font-weight: 600 !important;
      color: #f59e0b !important;
      background: rgba(245, 158, 11, 0.14) !important;
      border: 1px solid rgba(245, 158, 11, 0.28) !important;
      padding: 3px 9px !important;
      border-radius: 9999px !important;
    }

    .zw-recipe-body {
      padding: 20px 24px !important;
      overflow-y: auto !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 20px !important;
    }

    .zw-recipe-section-title {
      font-size: 14px !important;
      font-weight: 700 !important;
      color: #ffffff !important;
      text-transform: uppercase !important;
      letter-spacing: 0.04em !important;
      margin-bottom: 10px !important;
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
    }

    .zw-ingredient-item {
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
      padding: 6px 0 !important;
      font-size: 14px !important;
      color: #e5e5ea !important;
      cursor: pointer !important;
      user-select: none !important;
    }

    .zw-ingredient-item.zw-checked {
      color: #86868b !important;
      text-decoration: line-through !important;
    }

    .zw-ingredient-item input {
      accent-color: #f59e0b !important;
      cursor: pointer !important;
    }

    .zw-step-item {
      display: flex !important;
      gap: 12px !important;
      padding: 8px 0 !important;
      font-size: 14px !important;
      line-height: 1.5 !important;
      color: #e5e5ea !important;
    }

    .zw-step-number {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 24px !important;
      height: 24px !important;
      border-radius: 50% !important;
      background: rgba(245, 158, 11, 0.2) !important;
      color: #f59e0b !important;
      font-size: 12px !important;
      font-weight: 700 !important;
      flex-shrink: 0 !important;
      margin-top: 1px !important;
    }

    .zw-recipe-footer {
      padding: 14px 24px !important;
      border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      background: rgba(20, 20, 22, 0.8) !important;
    }

    .zw-recipe-close-btn {
      all: initial;
      cursor: pointer !important;
      color: rgba(255, 255, 255, 0.5) !important;
      font-size: 18px !important;
      padding: 4px 8px !important;
      border-radius: 50% !important;
      transition: color 0.15s ease !important;
    }

    .zw-recipe-close-btn:hover {
      color: #ffffff !important;
    }
  `;

  (document.head || document.documentElement).appendChild(style);
}

export function showJumpToRecipeButton(onJump: () => void, hasStructuredRecipe = false): void {
  if (document.getElementById(BTN_ID)) return;

  const btn = document.createElement('button');
  btn.id = BTN_ID;
  btn.type = 'button';
  btn.title = hasStructuredRecipe
    ? 'Distraction-free Recipe Reader (Alt+Shift+J)'
    : 'Skip fluff and scroll directly to recipe instructions';

  const icon = document.createElement('span');
  icon.className = 'zw-recipe-icon';
  icon.textContent = '🍳';

  const text = document.createElement('span');
  text.textContent = hasStructuredRecipe ? 'View Clean Recipe' : 'Jump to Recipe';

  const arrow = document.createElement('span');
  arrow.className = 'zw-recipe-arrow';
  arrow.textContent = hasStructuredRecipe ? '⚡' : '↓';

  btn.appendChild(icon);
  btn.appendChild(text);
  btn.appendChild(arrow);

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    onJump();
  });

  document.body.appendChild(btn);
}

export function showRecipeReaderModal(recipe: ExtractedRecipe, onScrollToOriginal?: () => void): HTMLElement {
  injectRecipeSkipperStyles();
  closeRecipeReaderModal();

  const backdrop = document.createElement('div');
  backdrop.id = MODAL_ID;

  const card = document.createElement('div');
  card.className = 'zw-recipe-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');

  // Header
  const header = document.createElement('div');
  header.className = 'zw-recipe-header';

  const titleWrap = document.createElement('div');
  const title = document.createElement('h2');
  title.className = 'zw-recipe-title';
  title.textContent = recipe.title;
  titleWrap.appendChild(title);

  const metaRow = document.createElement('div');
  metaRow.className = 'zw-recipe-meta-row';

  if (recipe.prepTime) {
    const prep = document.createElement('span');
    prep.className = 'zw-recipe-tag';
    prep.textContent = `Prep: ${recipe.prepTime}`;
    metaRow.appendChild(prep);
  }
  if (recipe.cookTime) {
    const cook = document.createElement('span');
    cook.className = 'zw-recipe-tag';
    cook.textContent = `Cook: ${recipe.cookTime}`;
    metaRow.appendChild(cook);
  }
  if (recipe.totalTime && recipe.totalTime !== recipe.cookTime) {
    const total = document.createElement('span');
    total.className = 'zw-recipe-tag';
    total.textContent = `Total: ${recipe.totalTime}`;
    metaRow.appendChild(total);
  }
  if (recipe.recipeYield) {
    const yld = document.createElement('span');
    yld.className = 'zw-recipe-tag';
    yld.textContent = `Yield: ${recipe.recipeYield}`;
    metaRow.appendChild(yld);
  }
  titleWrap.appendChild(metaRow);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'zw-recipe-close-btn';
  closeBtn.textContent = '✕';
  closeBtn.title = 'Close recipe reader';
  closeBtn.addEventListener('click', closeRecipeReaderModal);

  header.appendChild(titleWrap);
  header.appendChild(closeBtn);

  // Body
  const body = document.createElement('div');
  body.className = 'zw-recipe-body';

  // Ingredients section
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    const ingSection = document.createElement('div');
    const ingTitle = document.createElement('div');
    ingTitle.className = 'zw-recipe-section-title';
    ingTitle.textContent = `🛒 Ingredients (${recipe.ingredients.length})`;
    ingSection.appendChild(ingTitle);

    const list = document.createElement('div');
    recipe.ingredients.forEach((ing) => {
      const label = document.createElement('label');
      label.className = 'zw-ingredient-item';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.addEventListener('change', () => {
        label.classList.toggle('zw-checked', cb.checked);
      });

      const span = document.createElement('span');
      span.textContent = ing;

      label.appendChild(cb);
      label.appendChild(span);
      list.appendChild(label);
    });
    ingSection.appendChild(list);
    body.appendChild(ingSection);
  }

  // Instructions section
  if (recipe.instructions && recipe.instructions.length > 0) {
    const stepSection = document.createElement('div');
    const stepTitle = document.createElement('div');
    stepTitle.className = 'zw-recipe-section-title';
    stepTitle.textContent = `👨‍🍳 Instructions (${recipe.instructions.length} steps)`;
    stepSection.appendChild(stepTitle);

    const stepList = document.createElement('div');
    recipe.instructions.forEach((step, idx) => {
      const row = document.createElement('div');
      row.className = 'zw-step-item';

      const num = document.createElement('div');
      num.className = 'zw-step-number';
      num.textContent = String(idx + 1);

      const text = document.createElement('div');
      text.textContent = step;

      row.appendChild(num);
      row.appendChild(text);
      stepList.appendChild(row);
    });
    stepSection.appendChild(stepList);
    body.appendChild(stepSection);
  }

  // Footer
  const footer = document.createElement('div');
  footer.className = 'zw-recipe-footer';

  const brandInfo = document.createElement('span');
  brandInfo.style.fontSize = '12px';
  brandInfo.style.color = '#86868b';
  brandInfo.textContent = 'ZenWeb Distraction-Free Reader';

  const actionGroup = document.createElement('div');
  actionGroup.style.display = 'flex';
  actionGroup.style.gap = '8px';

  if (onScrollToOriginal) {
    const scrollBtn = document.createElement('button');
    scrollBtn.type = 'button';
    scrollBtn.style.cssText =
      'background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.18); color:#ffffff; padding:6px 12px; border-radius:9999px; font-size:12px; cursor:pointer; font-weight:600;';
    scrollBtn.textContent = 'Scroll on Page';
    scrollBtn.addEventListener('click', () => {
      closeRecipeReaderModal();
      onScrollToOriginal();
    });
    actionGroup.appendChild(scrollBtn);
  }

  const doneBtn = document.createElement('button');
  doneBtn.type = 'button';
  doneBtn.style.cssText =
    'background:#f59e0b; border:none; color:#000000; padding:6px 14px; border-radius:9999px; font-size:12px; cursor:pointer; font-weight:700;';
  doneBtn.textContent = 'Done Cooking';
  doneBtn.addEventListener('click', closeRecipeReaderModal);
  actionGroup.appendChild(doneBtn);

  footer.appendChild(brandInfo);
  footer.appendChild(actionGroup);

  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(footer);
  backdrop.appendChild(card);

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeRecipeReaderModal();
  });

  document.body.appendChild(backdrop);
  return backdrop;
}

export function closeRecipeReaderModal(): void {
  const modal = document.getElementById(MODAL_ID);
  if (modal) modal.remove();
}

export function removeRecipeSkipperUI(): void {
  closeRecipeReaderModal();
  const btn = document.getElementById(BTN_ID);
  if (btn) btn.remove();
  const style = document.getElementById(STYLE_ID);
  if (style) style.remove();
}
