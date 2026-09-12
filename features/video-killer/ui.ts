/**
 * Floating Video Killer — UI Module
 * Neutralizes intrusive detached floating / sticky video players.
 */

const STYLE_ID = 'zenweb-video-killer-styles';

export function injectVideoKillerStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .zw-suppressed-video {
      display: none !important;
      visibility: hidden !important;
      pointer-events: none !important;
    }
  `;

  (document.head || document.documentElement).appendChild(style);
}

export function removeVideoKillerStyles(): void {
  const style = document.getElementById(STYLE_ID);
  if (style) style.remove();

  document.querySelectorAll('.zw-suppressed-video').forEach((el) => {
    el.classList.remove('zw-suppressed-video');
  });
}
