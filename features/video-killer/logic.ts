/**
 * Floating Video Killer — Logic Engine
 * Detects and neutralizes commercial video players that detach and float in corners on scroll.
 */

import { injectVideoKillerStyles, removeVideoKillerStyles } from './ui';
import { recordProtectionEvent } from '../../content/storage';

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
    const candidates = document.querySelectorAll<HTMLElement>(
      'video, iframe[src*="youtube"], iframe[src*="vimeo"], [class*="floating-video"], [class*="pip-player"], [id*="sticky-player"]'
    );

    candidates.forEach((el) => {
      if (this.suppressedVideos.has(el)) return;

      const container = el.closest<HTMLElement>(
        '[class*="pip"], [class*="sticky"], [class*="floating"], [class*="outstream"], [id*="sticky"]'
      ) || el;

      const style = window.getComputedStyle(container);
      const isFloating = style.position === 'fixed' || style.position === 'sticky';
      const rect = container.getBoundingClientRect();

      // Only suppress if it is floating in a corner / out of primary content flow
      const isCornerPip = isFloating && rect.width < 450 && rect.height < 320 && (rect.bottom > window.innerHeight - 350 || rect.top < 100);

      if (isCornerPip) {
        this.suppressedVideos.add(el);
        if (el instanceof HTMLVideoElement) {
          try { el.pause(); } catch {}
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

    this.observer = new MutationObserver(() => {
      this.scan();
    });

    this.observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
}

export const videoKiller = new VideoKiller();
