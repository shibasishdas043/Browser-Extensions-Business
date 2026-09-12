/**
 * Modal & Paywall Smasher — Logic Engine
 * Scans for screen-darkening newsletter modals and backdrop elements that lock scrolling,
 * neutralizes them, restores body scroll, and records smashed overlays.
 */

import { showSmashedToast } from './ui';
import { recordProtectionEvent } from '../../content/storage';

export class OverlaySmasher {
  private isRunning = false;
  private observer: MutationObserver | null = null;
  private smashedSet = new WeakSet<Element>();

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.scan();
    this.startObserver();
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  public scan(): void {
    if (!this.isRunning) return;

    // 1. Check if the page is scroll-locked
    const bodyStyle = window.getComputedStyle(document.body);
    const docStyle = window.getComputedStyle(document.documentElement);
    const isScrollLocked =
      bodyStyle.overflow === 'hidden' ||
      bodyStyle.overflowY === 'hidden' ||
      docStyle.overflow === 'hidden' ||
      docStyle.overflowY === 'hidden';

    if (!isScrollLocked) return;

    // 2. Find fullscreen or high z-index backdrop overlay candidates
    let newlySmashed = 0;
    const candidates = document.querySelectorAll<HTMLElement>(
      'div, section, aside, dialog, [class*="overlay"], [class*="modal"], [class*="backdrop"], [class*="popup"]'
    );

    candidates.forEach((el) => {
      if (this.smashedSet.has(el)) return;

      const style = window.getComputedStyle(el);
      const isFixedOrSticky = style.position === 'fixed' || style.position === 'sticky';
      const zIndex = parseInt(style.zIndex, 10);
      const hasHighZIndex = !isNaN(zIndex) && zIndex > 999;
      const coversScreen =
        el.clientWidth >= window.innerWidth * 0.7 && el.clientHeight >= window.innerHeight * 0.7;

      if (isFixedOrSticky && (hasHighZIndex || coversScreen)) {
        const hasNewsletter = el.querySelector('form, input[type="email"], [class*="newsletter"], [class*="subscribe"]');
        const hasCloseBtn = el.querySelector('button, [role="button"], .close, [aria-label*="close" i]');

        if (hasNewsletter || hasCloseBtn || coversScreen) {
          this.smashedSet.add(el);
          el.remove();
          newlySmashed++;
        }
      }
    });

    if (newlySmashed > 0) {
      // Restore scrolling on document body and html
      document.documentElement.style.setProperty('overflow', 'auto', 'important');
      document.documentElement.style.setProperty('position', 'static', 'important');
      document.body.style.setProperty('overflow', 'auto', 'important');
      document.body.style.setProperty('position', 'static', 'important');
      document.body.style.setProperty('pointer-events', 'auto', 'important');

      showSmashedToast('🛡️ Scroll lock & modal overlay smashed');
      recordProtectionEvent('overlaysSmashed', newlySmashed).catch(() => {});
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
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
  }
}

export const overlaySmasher = new OverlaySmasher();
