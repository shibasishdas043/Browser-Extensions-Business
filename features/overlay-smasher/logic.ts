/**
 * Modal & Paywall Smasher — Logic Engine 2.0
 * Scans for screen-darkening newsletter modals, paywall backdrops, and scroll-locks.
 * Provides on-demand Panic smashing, double-tap Escape trigger, and automatic restoration.
 */

import { showSmashedToast } from './ui';
import { recordProtectionEvent } from '../../content/storage';

export class OverlaySmasher {
  private isRunning = false;
  private observer: MutationObserver | null = null;
  private smashedSet = new WeakSet<Element>();
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private lastEscPress = 0;

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.scan();
    this.startObserver();
    this.attachShortcutListener();
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.keydownListener) {
      document.removeEventListener('keydown', this.keydownListener, true);
      this.keydownListener = null;
    }
  }

  /**
   * Listens for double-tap Escape key to immediately trigger on-demand smash.
   */
  private attachShortcutListener(): void {
    this.keydownListener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const now = Date.now();
        if (now - this.lastEscPress < 450) {
          // Double-tap Escape detected
          this.smashNow(true);
        }
        this.lastEscPress = now;
      }
    };
    document.addEventListener('keydown', this.keydownListener, true);
  }

  /**
   * Programmatic on-demand smash: forces scroll recovery and destroys modals immediately.
   */
  public smashNow(showToast = true): number {
    let count = 0;

    // 1. Force overflow and unlock scrolling on html and body
    const docEl = document.documentElement;
    const bodyEl = document.body;

    if (docEl) {
      docEl.style.setProperty('overflow', 'auto', 'important');
      docEl.style.setProperty('overflow-y', 'auto', 'important');
      docEl.style.setProperty('position', 'static', 'important');
    }

    if (bodyEl) {
      bodyEl.style.setProperty('overflow', 'auto', 'important');
      bodyEl.style.setProperty('overflow-y', 'auto', 'important');
      bodyEl.style.setProperty('position', 'static', 'important');
      bodyEl.style.setProperty('pointer-events', 'auto', 'important');
    }

    // 2. Identify all fixed/sticky fullscreen elements or common modal classes
    const candidates = document.querySelectorAll<HTMLElement>(
      'div, section, aside, dialog, [class*="overlay" i], [class*="modal" i], [class*="backdrop" i], [class*="popup" i], [class*="paywall" i], [id*="overlay" i], [id*="modal" i], [id*="paywall" i], [class*="consent" i]'
    );

    candidates.forEach((el) => {
      if (this.smashedSet.has(el)) return;

      const style = window.getComputedStyle(el);
      const isFixedOrSticky = style.position === 'fixed' || style.position === 'sticky';
      const zIndex = parseInt(style.zIndex, 10);
      const hasHighZIndex = !isNaN(zIndex) && zIndex > 500;
      const coversScreen =
        el.clientWidth >= window.innerWidth * 0.65 && el.clientHeight >= window.innerHeight * 0.65;

      const hasModalIndicators =
        el.querySelector('form, input[type="email"], [class*="newsletter" i], [class*="subscribe" i], [class*="paywall" i]') !== null ||
        el.getAttribute('role') === 'dialog' ||
        el.tagName.toLowerCase() === 'dialog';

      if (isFixedOrSticky && (hasHighZIndex || coversScreen || hasModalIndicators)) {
        // Exclude ZenWeb's own UI elements
        if (el.className && typeof el.className === 'string' && el.className.includes('zw-')) {
          return;
        }

        this.smashedSet.add(el);
        el.remove();
        count++;
      }
    });

    // 3. Remove blur/grayscale filter locks on page content
    document.querySelectorAll<HTMLElement>('*').forEach((el) => {
      if (el.style) {
        const filter = el.style.filter || '';
        if (filter.includes('blur') || filter.includes('grayscale')) {
          el.style.filter = 'none';
        }
      }
    });

    if (count > 0 || showToast) {
      recordProtectionEvent('overlaysSmashed', Math.max(1, count)).catch(() => {});
      if (showToast) {
        showSmashedToast(`🛡️ ${count > 0 ? `${count} overlay(s)` : 'Scroll lock'} smashed`);
      }
    }

    return count;
  }

  /**
   * Automatic background scan on scroll lock or DOM mutation.
   */
  public scan(): void {
    if (!this.isRunning) return;

    // Check if the page is scroll-locked
    const bodyStyle = window.getComputedStyle(document.body);
    const docStyle = window.getComputedStyle(document.documentElement);
    const isScrollLocked =
      bodyStyle.overflow === 'hidden' ||
      bodyStyle.overflowY === 'hidden' ||
      docStyle.overflow === 'hidden' ||
      docStyle.overflowY === 'hidden';

    if (isScrollLocked) {
      this.smashNow(true);
    }
  }

  private startObserver(): void {
    if (this.observer) return;

    let scanTimer: number | null = null;
    this.observer = new MutationObserver(() => {
      if (scanTimer) clearTimeout(scanTimer);
      scanTimer = window.setTimeout(() => {
        this.scan();
      }, 350);
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
