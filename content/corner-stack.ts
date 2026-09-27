/**
 * Universal Corner Popup Stack Manager
 * Guarantees that all in-page feature popups, pills, and toasts appear
 * anchored at the bottom-right corner of the browser viewport.
 * Automatically stacks multiple concurrent popups vertically with clean spacing,
 * ensuring they NEVER overlap each other.
 */

export const CORNER_STACK_ID = 'zw-corner-stack-container';
export const CORNER_STACK_STYLE_ID = 'zw-corner-stack-styles';

/**
 * Injects the global layout CSS for the bottom-right corner popup stack.
 */
export function injectCornerStackStyles(): void {
  if (document.getElementById(CORNER_STACK_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = CORNER_STACK_STYLE_ID;
  style.textContent = `
    #${CORNER_STACK_ID} {
      all: initial;
      position: fixed !important;
      bottom: 24px !important;
      right: 24px !important;
      z-index: 2147483647 !important;
      display: flex !important;
      flex-direction: column-reverse !important;
      align-items: flex-end !important;
      gap: 12px !important;
      pointer-events: none !important;
      max-width: calc(100vw - 32px) !important;
      max-height: calc(100vh - 48px) !important;
      box-sizing: border-box !important;
    }

    #${CORNER_STACK_ID} > * {
      pointer-events: auto !important;
      position: static !important;
      margin: 0 !important;
      flex-shrink: 0 !important;
    }
  `;

  (document.head || document.documentElement).appendChild(style);
}

/**
 * Retrieves or creates the singleton corner stack container.
 */
export function getCornerStackContainer(): HTMLElement {
  injectCornerStackStyles();

  let container = document.getElementById(CORNER_STACK_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = CORNER_STACK_ID;
    (document.body || document.documentElement).appendChild(container);
  } else if (!container.parentNode) {
    (document.body || document.documentElement).appendChild(container);
  }

  return container;
}

/**
 * Mounts a popup or pill element into the bottom-right corner stack.
 * If already mounted, safely moves it to the active stack.
 */
export function mountCornerPopup(el: HTMLElement): void {
  if (!el) return;
  const container = getCornerStackContainer();
  if (el.parentElement !== container) {
    container.appendChild(el);
  }
}

/**
 * Safely removes a popup or pill element from the corner stack.
 */
export function unmountCornerPopup(el: HTMLElement | null): void {
  if (!el) return;
  if (el.parentNode) {
    el.parentNode.removeChild(el);
  }
  const container = document.getElementById(CORNER_STACK_ID);
  if (container && container.childNodes.length === 0) {
    container.remove();
  }
}
