/**
 * Floating Video Killer — UI Module 2.0
 * Neutralizes intrusive detached floating and sticky outstream video players
 * with zero layout shift and 100% audio/visual suppression.
 */

export const STYLE_ID = 'zenweb-video-killer-styles';
export const SUPPRESSED_ATTR = 'data-zenweb-video-suppressed';
export const SUPPRESSED_CLASS = 'zw-suppressed-video';

export function injectVideoKillerStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .${SUPPRESSED_CLASS},
    [${SUPPRESSED_ATTR}="true"] {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
      opacity: 0 !important;
      width: 0 !important;
      height: 0 !important;
      min-width: 0 !important;
      min-height: 0 !important;
      max-width: 0 !important;
      max-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
    }
  `;

  (document.head || document.documentElement).appendChild(style);
}

export function removeVideoKillerStyles(): void {
  const style = document.getElementById(STYLE_ID);
  if (style) style.remove();

  document.querySelectorAll<HTMLElement>(`.${SUPPRESSED_CLASS}, [${SUPPRESSED_ATTR}="true"]`).forEach((el) => {
    el.classList.remove(SUPPRESSED_CLASS);
    el.removeAttribute(SUPPRESSED_ATTR);
  });
}

