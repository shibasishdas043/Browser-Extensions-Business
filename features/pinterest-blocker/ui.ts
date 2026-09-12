/**
 * Pinterest Search Blocker — UI Module
 * Hides walled Pinterest cards from Google Search and Google Images with smooth CSS.
 */

const STYLE_ID = 'zenweb-pinterest-blocker-styles';

export function injectPinterestBlockerStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .zw-pinterest-hidden {
      display: none !important;
    }
  `;

  (document.head || document.documentElement).appendChild(style);
}

export function removePinterestBlockerStyles(): void {
  const style = document.getElementById(STYLE_ID);
  if (style) style.remove();

  document.querySelectorAll('.zw-pinterest-hidden').forEach((el) => {
    el.classList.remove('zw-pinterest-hidden');
  });
}
