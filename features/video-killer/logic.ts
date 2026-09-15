/**
 * Floating Video Killer — Logic Engine 2.0
 * Detects and neutralizes commercial video players, outstream video widgets,
 * and PiP players that detach and float in corners on scroll.
 */

import { injectVideoKillerStyles, removeVideoKillerStyles } from './ui';
import { recordProtectionEvent } from '../../content/storage';

const OUTSTREAM_SELECTORS = [
  'video',
  'iframe[src*="youtube"]',
  'iframe[src*="vimeo"]',
  'iframe[src*="connatix"]',
  'iframe[src*="primis"]',
  'iframe[src*="anyclip"]',
  'iframe[src*="playwire"]',
  'iframe[src*="jwplayer"]',
  'div[class*="connatix" i]',
  'div[class*="primis" i]',
  'div[class*="anyclip" i]',
  'div[class*="teads" i]',
  'div[class*="playwire" i]',
  'div[class*="jwplayer" i]',
  'div[class*="floating-video" i]',
  'div[class*="pip-player" i]',
  'div[id*="sticky-player" i]',
  'div[id*="connatix" i]',
  'div[class*="outstream" i]',
  'div[data-player-type*="float" i]',
];

export class VideoKiller {
  private isRunning = false;
  private observer: MutationObserver | null = null;
  private scrollHandler: (() => void) | null = null;
  private suppressedVideos = new WeakSet<HTMLElement>();

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    injectVideoKillerStyles();
    this.scan();

    this.scrollHandler = () => this.scan();
    window.addEventListener('scroll', this.scrollHandler, { passive: true });

    this.startObserver();
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
    }

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    removeVideoKillerStyles();
  }

  public scan(): void {
    if (!this.isRunning) return;

    let newlySuppressed = 0;
    const candidates = document.querySelectorAll<HTMLElement>(OUTSTREAM_SELECTORS.join(','));

    candidates.forEach((el) => {
      if (this.suppressedVideos.has(el)) return;

      const container =
        el.closest<HTMLElement>(
          '[class*="pip" i], [class*="sticky" i], [class*="floating" i], [class*="outstream" i], [id*="sticky" i], [class*="connatix" i], [class*="primis" i], [class*="teads" i]'
        ) || el;

      const style = window.getComputedStyle(container);
      const isFloating = style.position === 'fixed' || style.position === 'sticky';
      const rect = container.getBoundingClientRect();

      // Only suppress if it is floating in a corner / out of primary content flow
      const isCornerPip =
        isFloating &&
        rect.width > 0 &&
        rect.width < 500 &&
        rect.height < 360 &&
        (rect.bottom > window.innerHeight - 380 || rect.top < 120);

      // Known outstream sticky ads
      const isOutstreamAd =
        container.className &&
        typeof container.className === 'string' &&
        /connatix|primis|anyclip|teads|outstream|sticky-player/i.test(container.className);

      if (isCornerPip || (isFloating && isOutstreamAd)) {
        this.suppressedVideos.add(el);
        if (el instanceof HTMLVideoElement) {
          try {
            el.pause();
            el.muted = true;
          } catch {}
        }
        const innerVideo = container.querySelector('video');
        if (innerVideo) {
          try {
            innerVideo.pause();
            innerVideo.muted = true;
          } catch {}
        }

        container.classList.add('zw-suppressed-video');
        newlySuppressed++;
      }
    });

    if (newlySuppressed > 0) {
      recordProtectionEvent('videosSuppressed', newlySuppressed).catch(() => {});
    }
  }

  private startObserver(): void {
    if (this.observer) return;

    let scanTimer: number | null = null;
    this.observer = new MutationObserver(() => {
      if (scanTimer) clearTimeout(scanTimer);
      scanTimer = window.setTimeout(() => {
        this.scan();
      }, 400);
    });

    this.observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
}

export const videoKiller = new VideoKiller();
