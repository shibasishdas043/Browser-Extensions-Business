/**
 * Pinterest Search Blocker — Logic Engine
 * Detects and conceals Pinterest login-walled results on search engines.
 */

import { injectPinterestBlockerStyles, removePinterestBlockerStyles } from './ui';
import { recordProtectionEvent } from '../../content/storage';

const PINTEREST_DOMAIN_REGEX = /(pinterest\.com|pinterest\.co|pinterest\.ca|pinterest\.de|pinterest\.fr|pinterest\.es|pinterest\.it|pinterest\.jp)/i;

export class PinterestBlocker {
  private isRunning = false;
  private observer: MutationObserver | null = null;
  private blockedElements = new WeakSet<Element>();

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    injectPinterestBlockerStyles();
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

    removePinterestBlockerStyles();
  }

  public scan(): void {
    if (!this.isRunning) return;

    let newlyHidden = 0;
    const links = document.querySelectorAll<HTMLAnchorElement>('a[href*="pinterest."]');

    links.forEach((link) => {
      if (this.blockedElements.has(link)) return;
      this.blockedElements.add(link);

      const href = link.href || '';
      if (PINTEREST_DOMAIN_REGEX.test(href)) {
        // Find container result card
        const card = link.closest<HTMLElement>(
          'div[data-sokoban-container], div.g, div.isv-r, [data-ri], div[jscontroller], li'
        ) || link;

        card.classList.add('zw-pinterest-hidden');
        newlyHidden++;
      }
    });

    if (newlyHidden > 0) {
      recordProtectionEvent('pinterestHidden', newlyHidden).catch(() => {});
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

export const pinterestBlocker = new PinterestBlocker();
