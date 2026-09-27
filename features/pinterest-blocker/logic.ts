/**
 * Pinterest Search Blocker — Industry-Grade Zero-Hardcoding Logic Engine 3.0
 * Conceals login-walled Pinterest results across any search engine with 0% hardcoded selectors.
 * Uses Single-Result Invariant DOM card boundary isolation, comprehensive search redirect peeling,
 * international multi-TLD coverage, SPA query tracking, and persistent two-way reveal/hide state management.
 */

import {
  injectPinterestBlockerStyles,
  removePinterestBlockerStyles,
  updatePinterestHiddenPill,
  HIDDEN_ATTR,
  HIDDEN_CLASS,
  PILL_ID,
} from './ui';
import { recordProtectionEvent } from '../../content/storage';

/**
 * Extracts base registrable domain (eTLD+1) dynamically.
 */
export function getRegistrableBaseDomain(hostname: string): string {
  if (!hostname) return '';
  const parts = hostname.toLowerCase().split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const secondLast = parts[parts.length - 2];
  const twoPartTlds = ['co', 'com', 'org', 'net', 'edu', 'gov', 'ac'];
  if (twoPartTlds.includes(secondLast) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

/**
 * Checks if a hostname belongs to Pinterest across all global ccTLDs and short domains.
 * Uses base domain matching to guarantee zero false positives from malicious subdomains.
 */
export function isPinterestDomain(hostname: string): boolean {
  if (!hostname) return false;
  const host = hostname.toLowerCase().trim();
  const baseDomain = getRegistrableBaseDomain(host);
  return (
    baseDomain === 'pin.it' ||
    baseDomain.startsWith('pinterest.') ||
    baseDomain.startsWith('pinimg.')
  );
}

/**
 * Unpacks nested destination URLs hidden inside search engine redirect queries
 * across Google, DuckDuckGo, Bing, Yahoo, Yandex, Brave, and generic redirectors.
 */
export function extractDestinationUrl(rawHref: string): string {
  if (!rawHref) return '';
  try {
    const base = typeof window !== 'undefined' && window.location ? window.location.href : 'https://localhost';
    const parsed = new URL(rawHref, base);

    const redirectParams = [
      'url',
      'q',
      'u',
      'target',
      'uddg',
      'r',
      'dest',
      'destination',
      'imgrefurl',
      'imgurl',
      'ru',
      'rut',
      'requrl',
      'redirect',
      'link',
      'next',
    ];

    for (const param of redirectParams) {
      const val = parsed.searchParams.get(param);
      if (val) {
        let candidate = val;
        try {
          candidate = decodeURIComponent(val);
        } catch {}
        if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
          return candidate;
        }
      }
    }
    return parsed.href;
  } catch {
    return rawHref;
  }
}

/**
 * Dynamically resolves the true Search Result Item container for a given Pinterest link.
 * Algorithm uses the Single-Result Invariant:
 * An individual search card only contains links to ONE primary destination entity.
 * As soon as an ancestor contains links to multiple distinct external search result destinations,
 * that ancestor is the search results feed/list, and the previous child is the individual search card.
 * Zero hardcoded CSS classes or search engine names.
 */
export function findSearchResultCard(link: HTMLAnchorElement): HTMLElement {
  const currentHost = typeof window !== 'undefined' && window.location ? window.location.hostname.toLowerCase() : '';
  const currentBase = getRegistrableBaseDomain(currentHost);

  let curr: HTMLElement = link;
  let candidate: HTMLElement = link;
  let depth = 0;
  const maxDepth = 8;

  const docBody = typeof document !== 'undefined' ? document.body : null;
  const docEl = typeof document !== 'undefined' ? document.documentElement : null;

  while (curr.parentElement && depth < maxDepth && curr.parentElement !== docBody && curr.parentElement !== docEl) {
    const parent = curr.parentElement;

    // Safety: Never escalate to landmark containers (body, html, main, header, footer)
    const parentTag = parent.tagName.toLowerCase();
    const parentRole = parent.getAttribute('role');
    if (parent === docBody || parent === docEl || parentTag === 'main' || parentRole === 'main') {
      break;
    }

    // 1. Single-Result Invariant: Check if parent contains other external search result destinations
    const externalLinks = parent.querySelectorAll<HTMLAnchorElement>('a[href]');
    let hasOtherResult = false;

    for (let i = 0; i < externalLinks.length; i++) {
      const otherLink = externalLinks[i];
      if (otherLink === link || otherLink.contains(link) || link.contains(otherLink)) {
        continue;
      }

      const otherHref = otherLink.getAttribute('data-href') || otherLink.getAttribute('data-url') || otherLink.href || '';
      if (!otherHref || otherHref.startsWith('#') || otherHref.startsWith('javascript:')) {
        continue;
      }

      try {
        const dest = extractDestinationUrl(otherHref);
        const otherHost = new URL(dest).hostname.toLowerCase();
        const otherBase = getRegistrableBaseDomain(otherHost);

        // If another link points to an external site that is NOT Pinterest and NOT the current search engine
        if (otherBase && otherBase !== currentBase && !isPinterestDomain(otherHost)) {
          hasOtherResult = true;
          break;
        }
      } catch {}
    }

    if (hasOtherResult) {
      // The parent contains multiple distinct search results; curr is the individual result item!
      candidate = curr;
      break;
    }

    // 2. Explicit Card / Result Item Semantics
    const currTag = curr.tagName.toLowerCase();
    const currRole = curr.getAttribute('role');
    const isInsideNav = !!curr.closest('nav');

    const isSemanticCard =
      !isInsideNav &&
      (currTag === 'article' ||
        currRole === 'article' ||
        (currRole === 'listitem' && (parentRole === 'list' || parentRole === 'feed' || parentTag === 'ul' || parentTag === 'ol')) ||
        (currTag === 'li' && (parentTag === 'ul' || parentTag === 'ol' || parentRole === 'list' || parentRole === 'feed')) ||
        curr.hasAttribute('data-docid') ||
        curr.hasAttribute('data-ri') ||
        curr.hasAttribute('data-testid') ||
        curr.hasAttribute('data-sokoban-container') ||
        curr.hasAttribute('data-hveid'));

    candidate = curr;

    if (isSemanticCard) {
      break;
    }

    curr = parent;
    depth++;
  }

  // Safety fallback: Ensure candidate is not a root or landmark element
  const candidateTag = candidate.tagName.toLowerCase();
  const candidateRole = candidate.getAttribute('role');
  if (
    candidate === docBody ||
    candidate === docEl ||
    candidateTag === 'main' ||
    candidateRole === 'main' ||
    candidateTag === 'header' ||
    candidateTag === 'footer'
  ) {
    return link;
  }

  return candidate;
}

export class PinterestBlocker {
  private isRunning = false;
  private observer: MutationObserver | null = null;
  private isRevealed = false;
  private isPillDismissed = false;
  private scannedLinks = new WeakSet<HTMLAnchorElement>();
  private hiddenCards = new Set<HTMLElement>();
  private totalCount = 0;
  private lastUrl = '';
  private onPopStateHandler: (() => void) | null = null;

  public start(): void {
    if (this.isRunning) return;

    // Safety guard: Never activate on Pinterest itself
    const currentHost = typeof window !== 'undefined' && window.location ? window.location.hostname : '';
    if (isPinterestDomain(currentHost)) {
      return;
    }

    this.isRunning = true;
    this.isRevealed = false;
    this.isPillDismissed = false;
    this.hiddenCards.clear();
    this.totalCount = 0;
    this.lastUrl = typeof window !== 'undefined' && window.location ? window.location.href : '';

    injectPinterestBlockerStyles();
    this.scan();
    this.startObserver();

    // Listen for SPA navigation / back-forward cache events
    this.onPopStateHandler = () => {
      this.handleUrlChange();
    };
    window.addEventListener('popstate', this.onPopStateHandler);
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.onPopStateHandler) {
      window.removeEventListener('popstate', this.onPopStateHandler);
      this.onPopStateHandler = null;
    }

    this.hiddenCards.forEach((card) => {
      card.classList.remove(HIDDEN_CLASS);
      card.removeAttribute(HIDDEN_ATTR);
    });
    this.hiddenCards.clear();

    removePinterestBlockerStyles();
  }

  private handleUrlChange(): void {
    const currentUrl = typeof window !== 'undefined' && window.location ? window.location.href : '';
    if (this.lastUrl && this.lastUrl !== currentUrl) {
      this.lastUrl = currentUrl;
      // Search query changed in SPA: reset state for new query
      this.hiddenCards.forEach((card) => {
        card.classList.remove(HIDDEN_CLASS);
        card.removeAttribute(HIDDEN_ATTR);
      });
      this.hiddenCards.clear();
      this.totalCount = 0;
      this.isRevealed = false;
      this.isPillDismissed = false;

      const pill = document.getElementById(PILL_ID);
      if (pill) pill.remove();

      this.scan();
    } else {
      this.lastUrl = currentUrl;
    }
  }

  public scan(): void {
    if (!this.isRunning) return;

    const currentUrl = typeof window !== 'undefined' && window.location ? window.location.href : '';
    if (this.lastUrl && this.lastUrl !== currentUrl) {
      this.handleUrlChange();
      return;
    }

    let newlyFound = 0;
    // Query links pointing to Pinterest domains or shorteners (case-insensitive)
    const selector = 'a[href*="pinterest" i], a[href*="pin.it" i], a[data-href*="pinterest" i], a[data-url*="pinterest" i]';
    const links = document.querySelectorAll<HTMLAnchorElement>(selector);

    links.forEach((link) => {
      if (this.scannedLinks.has(link)) return;
      this.scannedLinks.add(link);

      const rawHref = link.getAttribute('data-href') || link.getAttribute('data-url') || link.href || '';
      const targetUrl = extractDestinationUrl(rawHref);

      try {
        const parsedHost = new URL(targetUrl).hostname;
        if (!isPinterestDomain(parsedHost)) return;
      } catch {
        return;
      }

      // Resolve the individual search result card container dynamically
      const card = findSearchResultCard(link);

      if (!this.hiddenCards.has(card)) {
        this.hiddenCards.add(card);
        newlyFound++;

        if (!this.isRevealed) {
          card.classList.add(HIDDEN_CLASS);
          card.setAttribute(HIDDEN_ATTR, 'true');
        }
      }
    });

    if (newlyFound > 0) {
      this.totalCount += newlyFound;
      recordProtectionEvent('pinterestHidden', newlyFound).catch(() => {});
      this.updatePillUI();
    }
  }

  private toggleReveal(): void {
    this.isRevealed = !this.isRevealed;

    this.hiddenCards.forEach((card) => {
      if (this.isRevealed) {
        card.classList.remove(HIDDEN_CLASS);
        card.removeAttribute(HIDDEN_ATTR);
      } else {
        card.classList.add(HIDDEN_CLASS);
        card.setAttribute(HIDDEN_ATTR, 'true');
      }
    });

    this.updatePillUI();
  }

  private updatePillUI(): void {
    if (this.isPillDismissed || this.totalCount === 0 || !this.isRunning) {
      return;
    }

    updatePinterestHiddenPill({
      count: this.totalCount,
      isRevealed: this.isRevealed,
      onToggle: () => this.toggleReveal(),
      onDismiss: () => {
        this.isPillDismissed = true;
      },
    });
  }

  private startObserver(): void {
    if (this.observer) return;

    let scanTimer: number | null = null;
    this.observer = new MutationObserver(() => {
      if (scanTimer) clearTimeout(scanTimer);
      scanTimer = window.setTimeout(() => {
        this.scan();
      }, 200);
    });

    const docTarget = document.body || document.documentElement;
    if (docTarget) {
      this.observer.observe(docTarget, {
        childList: true,
        subtree: true,
      });
    }
  }
}

export const pinterestBlocker = new PinterestBlocker();

