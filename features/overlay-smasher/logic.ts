/**
 * Modal & Paywall Smasher — Logic Engine 2.0
 * Scans for screen-darkening newsletter modals, age-gate backdrops, and scroll-locks.
 * Automatically destroys overlays, eradicates blur filters, removes lock classes,
 * and restores full pointer-event interactivity to all page elements underneath.
 */

import { showSmashedToast, injectOverlaySmasherStyles } from './ui';
import { recordProtectionEvent } from '../../content/storage';

const LOCK_CLASS_REGEX =
  /(modal-open|has-modal|is-modal|dialog-open|popup-open|age-gate|agegate|age-verification|warning-open|disclaimer-open|blurred|blur|is-blurred|filter-blur|content-blur|page-blur|no-scroll|noscroll|overflow-hidden|prevent-scroll|lock-scroll|locked)/i;

const CANDIDATE_SELECTORS = [
  'dialog',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[aria-modal="true"]',
  '[class*="overlay" i]',
  '[class*="modal" i]',
  '[class*="backdrop" i]',
  '[class*="popup" i]',
  '[class*="paywall" i]',
  '[class*="consent" i]',
  '[class*="age-gate" i]',
  '[class*="agegate" i]',
  '[class*="disclaimer" i]',
  '[class*="warning" i]',
  '[class*="gate" i]',
  '[id*="overlay" i]',
  '[id*="modal" i]',
  '[id*="backdrop" i]',
  '[id*="paywall" i]',
  '[id*="age-gate" i]',
  '[id*="agegate" i]',
  '[id*="disclaimer" i]',
  '[id*="gate" i]',
  'section',
  'aside',
  'div',
];

export class OverlaySmasher {
  private isRunning = false;
  private observer: MutationObserver | null = null;
  private smashedSet = new WeakSet<Element>();
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private lastEscPress = 0;
  private lastToastTime = 0;

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    injectOverlaySmasherStyles();
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

    document.documentElement.classList.remove('zw-smashed');
    document.body?.classList.remove('zw-smashed');
  }

  /**
   * Listens for cross-OS panic triggers:
   * 1. Double-tap Escape key (Escape / Esc across Windows, macOS, Linux).
   * 2. Direct hotkey fallback: Alt + Shift + X (Windows/Linux) or Option + Shift + X (macOS).
   */
  private attachShortcutListener(): void {
    this.keydownListener = (e: KeyboardEvent) => {
      // 1. Quick Panic Escape: Double-tap Escape
      const isEscape = e.key === 'Escape' || e.key === 'Esc' || e.code === 'Escape';
      if (isEscape && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const now = Date.now();
        if (now - this.lastEscPress < 500) {
          e.preventDefault();
          this.smashNow(true);
        }
        this.lastEscPress = now;
        return;
      }

      // 2. Panic Overlay Smash: Alt + Shift + X (Windows/Linux) or Option + Shift + X (macOS)
      const isAltShiftX = e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && (
        e.code === 'KeyX' || e.key.toLowerCase() === 'x' || e.key === '˛' || e.key === '≈'
      );
      const isCmdShiftX = e.metaKey && e.shiftKey && !e.altKey && !e.ctrlKey && e.code === 'KeyX';

      if (isAltShiftX || isCmdShiftX) {
        e.preventDefault();
        e.stopPropagation();
        this.smashNow(true);
      }
    };
    document.addEventListener('keydown', this.keydownListener, true);
  }

  /**
   * Programmatic on-demand smash: destroys modals, eradicates blur, and restores full page interactivity.
   */
  public smashNow(showToast = true): number {
    let count = 0;
    let unblurredCount = 0;

    injectOverlaySmasherStyles();

    // 1. Mark document as smashed to trigger global high-priority CSS unblur rules
    const docEl = document.documentElement;
    const bodyEl = document.body;

    if (docEl) {
      docEl.classList.add('zw-smashed');
      docEl.style.setProperty('overflow', 'auto', 'important');
      docEl.style.setProperty('overflow-y', 'auto', 'important');
      docEl.style.setProperty('position', 'static', 'important');
      docEl.style.setProperty('pointer-events', 'auto', 'important');
    }

    if (bodyEl) {
      bodyEl.classList.add('zw-smashed');
      bodyEl.style.setProperty('overflow', 'auto', 'important');
      bodyEl.style.setProperty('overflow-y', 'auto', 'important');
      bodyEl.style.setProperty('position', 'static', 'important');
      bodyEl.style.setProperty('pointer-events', 'auto', 'important');
      bodyEl.style.setProperty('user-select', 'auto', 'important');
    }

    // 2. Identify all fixed/sticky fullscreen elements, modal backdrops, or age gates
    const candidates = document.querySelectorAll<HTMLElement>(CANDIDATE_SELECTORS.join(','));

    candidates.forEach((el) => {
      if (this.smashedSet.has(el)) return;

      // Exclude ZenWeb's own UI elements
      if (el.id?.startsWith('zw-') || (typeof el.className === 'string' && el.className.includes('zw-'))) {
        return;
      }

      // Preserve primary site navigation bars and headers
      const tagName = el.tagName.toLowerCase();
      const rect = el.getBoundingClientRect();
      const isNavOrHeader =
        tagName === 'header' ||
        tagName === 'nav' ||
        el.getAttribute('role') === 'navigation' ||
        /navbar|site-header|main-nav/i.test(`${el.id} ${el.className}`) ||
        (rect.height > 0 && rect.height <= 85 && (rect.top <= 5 || rect.bottom >= window.innerHeight - 5));

      if (isNavOrHeader) {
        return;
      }

      const style = window.getComputedStyle(el);
      const isFixedOrSticky = style.position === 'fixed' || style.position === 'sticky';
      const isAbsoluteFull =
        style.position === 'absolute' &&
        rect.width >= window.innerWidth * 0.8 &&
        rect.height >= window.innerHeight * 0.8;

      const zIndex = parseInt(style.zIndex, 10);
      const hasHighZIndex = !isNaN(zIndex) && zIndex > 200;
      const coversScreen =
        rect.width >= window.innerWidth * 0.65 && rect.height >= window.innerHeight * 0.65;

      const hasModalIndicators =
        el.querySelector('form, input[type="email"], [class*="newsletter" i], [class*="subscribe" i], [class*="paywall" i], [class*="age" i], [class*="verify" i], [class*="disclaimer" i]') !== null ||
        el.getAttribute('role') === 'dialog' ||
        el.getAttribute('role') === 'alertdialog' ||
        el.getAttribute('aria-modal') === 'true' ||
        tagName === 'dialog' ||
        style.backdropFilter.includes('blur') ||
        (style as any).webkitBackdropFilter?.includes('blur');

      if ((isFixedOrSticky || isAbsoluteFull) && (hasHighZIndex || coversScreen || hasModalIndicators)) {
        this.smashedSet.add(el);
        el.remove();
        count++;
      }
    });

    // 3. Deep Unblur & Interactive Recovery on page elements
    // A. Strip locking/blur classes from html and body
    [docEl, bodyEl].forEach((rootEl) => {
      if (!rootEl) return;
      Array.from(rootEl.classList).forEach((cls) => {
        if (LOCK_CLASS_REGEX.test(cls)) {
          rootEl.classList.remove(cls);
          unblurredCount++;
        }
      });
    });

    // B. Clear filters and restore pointer-events across all DOM nodes
    const allElements = document.querySelectorAll<HTMLElement>('*');
    allElements.forEach((el) => {
      if (el.id?.startsWith('zw-') || (typeof el.className === 'string' && el.className.includes('zw-'))) {
        return;
      }

      // Strip modal/blur classes from containers
      if (el.classList && el.classList.length > 0) {
        Array.from(el.classList).forEach((cls) => {
          if (LOCK_CLASS_REGEX.test(cls)) {
            el.classList.remove(cls);
            unblurredCount++;
          }
        });
      }

      // Check inline styles
      if (el.style) {
        const inlineFilter = el.style.filter || '';
        const inlineBackdrop = el.style.backdropFilter || (el.style as any).webkitBackdropFilter || '';
        if (inlineFilter.includes('blur') || inlineFilter.includes('grayscale') || inlineBackdrop.includes('blur')) {
          el.style.setProperty('filter', 'none', 'important');
          el.style.setProperty('backdrop-filter', 'none', 'important');
          el.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
          unblurredCount++;
        }
        if (el.style.pointerEvents === 'none') {
          el.style.setProperty('pointer-events', 'auto', 'important');
        }
        if (el.style.userSelect === 'none') {
          el.style.setProperty('user-select', 'auto', 'important');
        }
      }

      // Check computed styles for CSS stylesheet rules
      try {
        const computed = window.getComputedStyle(el);
        const compFilter = computed.filter || '';
        const compBackdrop = computed.backdropFilter || (computed as any).webkitBackdropFilter || '';

        if (compFilter.includes('blur') || compFilter.includes('grayscale') || compBackdrop.includes('blur')) {
          el.style.setProperty('filter', 'none', 'important');
          el.style.setProperty('backdrop-filter', 'none', 'important');
          el.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
          unblurredCount++;
        }

        // Restore pointer-events on container elements that websites disable during modal display
        if (computed.pointerEvents === 'none' && !/^(svg|path|circle|line|polygon|rect|g)$/i.test(el.tagName)) {
          el.style.setProperty('pointer-events', 'auto', 'important');
        }

        if (computed.userSelect === 'none') {
          el.style.setProperty('user-select', 'auto', 'important');
        }
      } catch {}
    });

    if (count > 0 || unblurredCount > 0) {
      recordProtectionEvent('overlaysSmashed', Math.max(1, count)).catch(() => {});
      if (showToast) {
        const now = Date.now();
        if (now - this.lastToastTime > 3000) {
          this.lastToastTime = now;
          const msg = count > 0
            ? `🛡️ ${count} overlay(s) smashed & screen unblurred`
            : `🛡️ Screen unblurred & scrolling restored`;
          showSmashedToast(msg);
        }
      }
    }

    return count;
  }

  /**
   * Automatic background scan on scroll lock, blur trap, or DOM mutation.
   */
  public scan(): void {
    if (!this.isRunning) return;

    const bodyStyle = window.getComputedStyle(document.body);
    const docStyle = window.getComputedStyle(document.documentElement);
    const isScrollLocked =
      bodyStyle.overflow === 'hidden' ||
      bodyStyle.overflowY === 'hidden' ||
      docStyle.overflow === 'hidden' ||
      docStyle.overflowY === 'hidden' ||
      bodyStyle.position === 'fixed';

    const hasLockClass =
      LOCK_CLASS_REGEX.test(document.documentElement.className) ||
      LOCK_CLASS_REGEX.test(document.body.className);

    const hasBlurredContainer = Boolean(
      document.querySelector('[class*="blur" i], [style*="blur" i], [class*="age-gate" i], [id*="age-gate" i]')
    );

    if (isScrollLocked || hasLockClass || hasBlurredContainer) {
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
