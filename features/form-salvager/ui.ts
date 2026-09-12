/**
 * Form Salvager & Crash Guard — UI Module
 * Injects non-intrusive restore pill when recoverable input drafts are detected.
 */

const STYLE_ID = 'zenweb-form-salvager-styles';

export function injectFormSalvagerStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .zw-form-restore-pill {
      all: initial;
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      margin: 4px 0 !important;
      padding: 4px 10px !important;
      background: rgba(6, 182, 212, 0.12) !important;
      color: #0891b2 !important;
      border: 1px solid rgba(6, 182, 212, 0.3) !important;
      border-radius: 9999px !important;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      user-select: none !important;
      transition: all 0.15s ease !important;
    }

    .zw-form-restore-pill:hover {
      background: rgba(6, 182, 212, 0.22) !important;
      transform: translateY(-1px) !important;
    }
  `;

  (document.head || document.documentElement).appendChild(style);
}

export function createRestorePill(onRestore: () => void): HTMLElement {
  injectFormSalvagerStyles();

  const pill = document.createElement('button');
  pill.className = 'zw-form-restore-pill';
  pill.type = 'button';
  pill.title = 'ZenWeb detected a saved draft for this input. Click to restore.';
  pill.textContent = '✍️ Restore Lost Draft';

  pill.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onRestore();
    pill.remove();
  });

  return pill;
}
