/**
 * Modal & Paywall Smasher — Logic Engine 2.0
 * Scans for screen-darkening newsletter modals, subscription paywalls, and scroll-locks.
 * Automatically neutralizes marketing overlays, eradicates blur filters, removes lock classes,
 * and restores full pointer-event interactivity to page elements underneath.
 *
 * CRITICAL SAFEGUARDS:
 * 1. Strictly protects authentic checkpoints (18+ age verification, security/CAPTCHA, legal gates).
 * 2. Prevents blank/black screen states: never smashes the sole visible gateway on a page.
 * 3. Non-destructive hiding: preserves DOM elements with full Undo / Restore capability.
 */

import { showSmashedToast, injectOverlaySmasherStyles } from './ui';
import { recordProtectionEvent } from '../../content/storage';

const LOCK_CLASS_REGEX =
  /(modal-open|has-modal|is-modal|dialog-open|popup-open|blurred|blur|is-blurred|filter-blur|content-blur|page-blur|no-scroll|noscroll|overflow-hidden|prevent-scroll|lock-scroll|locked)/i;

const CANDIDATE_SELECTORS = [
  'dialog:not([class*="age" i]):not([id*="age" i])',
  '[role="dialog"]:not([class*="age" i]):not([id*="age" i])',
  '[role="alertdialog"]:not([class*="age" i]):not([id*="age" i])',
  '[aria-modal="true"]:not([class*="age" i]):not([id*="age" i])',
  '[class*="overlay" i]:not([class*="age" i])',
  '[class*="modal" i]:not([class*="age" i])',
  '[class*="backdrop" i]',
  '[class*="popup" i]',
  '[class*="paywall" i]',
  '[class*="newsletter" i]',
  '[class*="subscribe" i]',
  '[id*="overlay" i]:not([id*="age" i])',
  '[id*="modal" i]:not([id*="age" i])',
  '[id*="backdrop" i]',
  '[id*="paywall" i]',
  '[id*="newsletter" i]',
  '[id*="subscribe" i]',
];

interface SmashedRecord {
  element: HTMLElement;
  originalDisplay: string;
  originalVisibility: string;
}

/**
 * Accurately determines if an element is an authentic, required entry checkpoint:
 * - Age verification (18+, 21+, adult content disclaimer, date of birth)
 * - Security / Bot verification (Cloudflare Turnstile, challenge, reCAPTCHA, hCaptcha)
 * - Mandatory legal compliance / cookie consent choices (CMPs)
 * These checkpoints require explicit user interaction to set cookies or reveal content.
 * Destroying them breaks the page and leaves a black/blank screen.
 */
export function isAuthenticCheckpoint(el: HTMLElement): boolean {
  if (!el) return false;

  // 1. Check ID and Class names
  const idClass = `${el.id || ''} ${typeof el.className === 'string' ? el.className : ''}`.toLowerCase();
  const checkpointIdClassRegex =
    /(age[-_]?gate|age[-_]?verification|age[-_]?check|adult[-_]?gate|adult[-_]?warning|adult[-_]?confirm|dob[-_]?gate|cf[-_]?turnstile|cf[-_]?challenge|g[-_]?recaptcha|h[-_]?captcha|challenge[-_]?platform|challenge[-_]?form|onetrust|cookiebot|didomi|usercentrics|klaro|axeptio)/i;

  if (checkpointIdClassRegex.test(idClass)) {
    return true;
  }

  // 2. Check if inside or containing a security challenge or known checkpoint widget
  if (
    el.closest?.(
      '[id*="cf-challenge" i], [class*="cf-turnstile" i], [id*="turnstile" i], [class*="g-recaptcha" i], [class*="h-captcha" i], [id*="challenge-platform" i], [class*="age-gate" i], [id*="age-gate" i], [class*="agegate" i]'
    )
  ) {
    return true;
  }

  if (
    el.querySelector?.(
      '[class*="cf-turnstile" i], [id*="turnstile" i], [class*="g-recaptcha" i], [class*="h-captcha" i], [id*="challenge-platform" i], [class*="age-gate" i], [id*="age-gate" i]'
    )
  ) {
    return true;
  }

  // 3. Check text content for age verification or security checkpoint keywords
  const text = (el.innerText || el.textContent || '').slice(0, 3000).toLowerCase();
  if (!text) return false;

  const hasAgeKeywords =
    /(18\s*(?:or\s*older|\+|plus|years\s*of\s*age)|under\s*18|over\s*18|at\s*least\s*18|21\s*(?:or\s*older|\+|plus)|under\s*21|over\s*21|legal\s*drinking\s*age|legal\s*smoking\s*age|legal\s*age\s*to\s*view|age\s*verification|verify\s*(?:your\s*)?age|confirm\s*(?:your\s*)?age|adult\s*website|adult\s*content|age[-_ ]restricted|date\s*of\s*birth|birth\s*date|enter\s*your\s*birth|year\s*of\s*birth|age\s*of\s*majority|parental\s*controls|restricted\s*to\s*adults|\brta\b)/i.test(
      text
    );

  const hasSecurityKeywords =
    /(verifying\s*you\s*are\s*human|verify\s*you\s*are\s*human|checking\s*(?:your\s*)?browser|security\s*check|checking\s*if\s*the\s*site\s*connection\s*is\s*secure|please\s*verify\s*you\s*are\s*a\s*human|ddos\s*protection\s*by|cloudflare\s*ray\s*id)/i.test(
      text
    );

  if (hasSecurityKeywords) {
    return true;
  }

  // 4. Check action buttons inside the dialog
  const buttons = Array.from(
    el.querySelectorAll('button, a, input[type="submit"], input[type="button"], [role="button"]')
  );
  const buttonTexts = buttons.map((b) => (b.textContent || (b as HTMLInputElement).value || '').trim().toLowerCase());

  const hasAgeButtons = buttonTexts.some((btnText) =>
    /(18\s*(?:or\s*older|\+|plus)|under\s*18|over\s*18|21\s*(?:or\s*older|\+|plus)|under\s*21|i\s*am\s*18|i\s*am\s*under\s*18|i\s*am\s*over\s*18|enter\s*site|enter|exit\s*site|exit|leave|confirm\s*age|verify\s*age|i\s*agree|i\s*am\s*of\s*legal\s*age)/i.test(
      btnText
    )
  );

  if (hasAgeKeywords && (hasAgeButtons || buttonTexts.length > 0)) {
    return true;
  }

  // Dual-choice checkpoint gateway (e.g. [I am 18+ - Enter] / [Exit])
  const hasEnterChoice = buttonTexts.some((b) => /enter/i.test(b));
  const hasExitChoice = buttonTexts.some((b) => /exit|leave|under/i.test(b));
  if (hasEnterChoice && hasExitChoice && hasAgeKeywords) {
    return true;
  }

  return false;
}

/**
 * Checks whether an element is the sole visible content on the page.
 * If removing this element would leave the page empty/black, it is an essential entry gateway.
 */
export function isSoleVisibleContent(el: HTMLElement): boolean {
  try {
    const body = document.body;
    if (!body) return false;
    if (el === body || el === document.documentElement) return true;

    const children = Array.from(body.children) as HTMLElement[];
    let otherMeaningfulVisible = 0;

    for (const child of children) {
      if (child === el || child.contains(el) || el.contains(child)) continue;
      if (child.id?.startsWith('zw-') || child.tagName === 'SCRIPT' || child.tagName === 'STYLE') continue;

      const style = window.getComputedStyle(child);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

      const rect = child.getBoundingClientRect();
      if (rect.height > 80 && rect.width > 80 && (child.innerText || '').trim().length > 20) {
        otherMeaningfulVisible++;
        break;
      }
    }

    return otherMeaningfulVisible === 0;
  } catch {
    return false;
  }
}

/**
 * Verifies if the page has become completely blank/black after an operation.
 */
export function isScreenBlank(): boolean {
  try {
    const body = document.body;
    if (!body) return true;

    const visibleElements = document.querySelectorAll<HTMLElement>(
      'main, article, section, [id*="content" i], [class*="content" i], [id*="player" i], [class*="player" i], video, iframe, p, h1, h2, h3, img'
    );

    for (let i = 0; i < visibleElements.length; i++) {
      const node = visibleElements[i];
      if (node.id?.startsWith('zw-') || node.closest('[data-zw-smashed]')) continue;

      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

      const rect = node.getBoundingClientRect();
      if (rect.width > 50 && rect.height > 20) {
        return false;
      }
    }

    const bodyText = (body.innerText || '').trim();
    return bodyText.length < 30;
  } catch {
    return false;
  }
}

export class OverlaySmasher {
  private isRunning = false;
  private observer: MutationObserver | null = null;
  private smashedSet = new WeakSet<Element>();
  private lastSmashedBatch: SmashedRecord[] = [];
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
      const isAltShiftX =
        e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey &&
        (e.code === 'KeyX' || e.key.toLowerCase() === 'x' || e.key === '˛' || e.key === '≈');
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
   * Programmatic on-demand smash: neutralizes marketing modals, eradicates blur, and restores full page interactivity.
   * Strictly preserves authentic checkpoints (18+ age verification, security challenges, login checkpoints).
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

    // 2. Identify fixed/sticky fullscreen elements, modal backdrops, or newsletter popups
    const candidates = document.querySelectorAll<HTMLElement>(CANDIDATE_SELECTORS.join(','));
    const currentBatch: SmashedRecord[] = [];

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

      // SAFEGUARD 1: Strictly protect authentic checkpoints (18+ age verification, security, CAPTCHA)
      if (isAuthenticCheckpoint(el)) {
        return;
      }

      // SAFEGUARD 2: Strictly protect the sole visible gateway of the page (prevents blank/black screen)
      if (isSoleVisibleContent(el)) {
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
        el.querySelector('form, input[type="email"], [class*="newsletter" i], [class*="subscribe" i], [class*="paywall" i]') !== null ||
        el.getAttribute('role') === 'dialog' ||
        el.getAttribute('role') === 'alertdialog' ||
        el.getAttribute('aria-modal') === 'true' ||
        tagName === 'dialog' ||
        style.backdropFilter.includes('blur') ||
        (style as any).webkitBackdropFilter?.includes('blur');

      if ((isFixedOrSticky || isAbsoluteFull) && (hasHighZIndex || coversScreen || hasModalIndicators)) {
        this.smashedSet.add(el);
        currentBatch.push({
          element: el,
          originalDisplay: el.style.display,
          originalVisibility: el.style.visibility,
        });

        // Non-destructive hiding: preserves the DOM element and all event handlers for instant Undo
        el.setAttribute('data-zw-smashed', 'true');
        el.style.setProperty('display', 'none', 'important');
        count++;
      }
    });

    if (currentBatch.length > 0) {
      this.lastSmashedBatch = currentBatch;
    }

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

      // Do NOT unblur or tamper with authentic checkpoints
      if (isAuthenticCheckpoint(el)) {
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

        if (computed.pointerEvents === 'none' && !/^(svg|path|circle|line|polygon|rect|g)$/i.test(el.tagName)) {
          el.style.setProperty('pointer-events', 'auto', 'important');
        }

        if (computed.userSelect === 'none') {
          el.style.setProperty('user-select', 'auto', 'important');
        }
      } catch {}
    });

    // SAFEGUARD 3: Blank/Black Screen Circuit Breaker
    // If smashing caused the entire screen to become blank, automatically revert the smash!
    if (count > 0 && isScreenBlank()) {
      this.undoLastSmash();
      if (showToast) {
        showSmashedToast('⚠️ Checkpoint required to view content · Kept intact');
      }
      return 0;
    }

    if (count > 0 || unblurredCount > 0) {
      recordProtectionEvent('overlaysSmashed', Math.max(1, count)).catch(() => {});
      if (showToast) {
        const now = Date.now();
        if (now - this.lastToastTime > 2500) {
          this.lastToastTime = now;
          const msg = count > 0
            ? `🛡️ ${count} overlay(s) neutralized`
            : `🛡️ Screen unblurred & scrolling restored`;
          showSmashedToast(msg, count > 0 ? () => this.undoLastSmash() : undefined);
        }
      }
    }

    return count;
  }

  /**
   * Instantly restores the last batch of neutralized overlays and restores original state.
   */
  public undoLastSmash(): number {
    const count = this.lastSmashedBatch.length;
    if (count === 0) return 0;

    this.lastSmashedBatch.forEach((record) => {
      record.element.removeAttribute('data-zw-smashed');
      if (record.originalDisplay) {
        record.element.style.display = record.originalDisplay;
      } else {
        record.element.style.removeProperty('display');
      }

      if (record.originalVisibility) {
        record.element.style.visibility = record.originalVisibility;
      } else {
        record.element.style.removeProperty('visibility');
      }

      this.smashedSet.delete(record.element);
    });

    this.lastSmashedBatch = [];
    document.documentElement.classList.remove('zw-smashed');
    document.body?.classList.remove('zw-smashed');
    return count;
  }

  /**
   * Automatic background scan on scroll lock, blur trap, or DOM mutation.
   * Will NEVER auto-smash authentic checkpoints or essential entry gates.
   */
  public scan(): void {
    if (!this.isRunning) return;

    // Check if an authentic checkpoint is currently displayed on the page
    const activeModal = document.querySelector<HTMLElement>(
      'dialog, [role="dialog"], [aria-modal="true"], [class*="modal" i], [class*="overlay" i], [id*="gate" i], [class*="gate" i]'
    );
    if (activeModal && isAuthenticCheckpoint(activeModal)) {
      return; // Do not auto-smash authentic checkpoints!
    }

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
      document.querySelector('[class*="blur" i], [style*="blur" i]')
    );

    if (isScrollLocked || hasLockClass || hasBlurredContainer) {
      this.smashNow(true);
    }
  }

  public isAuthenticCheckpoint(el: HTMLElement): boolean {
    return isAuthenticCheckpoint(el);
  }

  public isSoleVisibleContent(el: HTMLElement): boolean {
    return isSoleVisibleContent(el);
  }

  public isScreenBlank(): boolean {
    return isScreenBlank();
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

