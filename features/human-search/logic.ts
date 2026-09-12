/**
 * Human Search Bypass — Logic Engine
 * Detects search engine pages, injects human discussion shortcuts, and tracks filtered SEO spam.
 */

import { injectHumanSearchStyles, injectHumanSearchButton, removeHumanSearchUI } from './ui';
import { recordProtectionEvent } from '../../content/storage';

export class HumanSearchBypass {
  private isRunning = false;

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Check if on search engine
    const host = window.location.hostname;
    const isSearchEngine = host.includes('google.') || host.includes('bing.') || host.includes('duckduckgo.');
    if (!isSearchEngine) return;

    injectHumanSearchStyles();
    injectHumanSearchButton((isActive) => {
      this.handleToggle(isActive);
    });

    this.scanAndMarkSeoSpam();
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    removeHumanSearchUI();
  }

  private handleToggle(isActive: boolean): void {
    const url = new URL(window.location.href);
    const q = url.searchParams.get('q') || '';

    const forumQuery = '(site:reddit.com OR site:news.ycombinator.com OR site:quora.com)';

    if (isActive) {
      if (!q.includes('site:reddit.com')) {
        url.searchParams.set('q', `${q} ${forumQuery}`.trim());
        recordProtectionEvent('seoSpamFiltered', 5).catch(() => {});
        window.location.href = url.toString();
      }
    } else {
      const cleaned = q.replace(forumQuery, '').replace('site:reddit.com', '').trim();
      url.searchParams.set('q', cleaned);
      window.location.href = url.toString();
    }
  }

  private scanAndMarkSeoSpam(): void {
    // Detect typical AI spam domain results
    const spamDomains = ['geeksforgeeks.org', 'w3schools.com', 'tutorialspoint.com', 'javatpoint.com'];
    let count = 0;
    document.querySelectorAll('a[href]').forEach((el) => {
      const href = el.getAttribute('href') || '';
      if (spamDomains.some((d) => href.includes(d))) {
        count++;
      }
    });
    if (count > 0) {
      recordProtectionEvent('seoSpamFiltered', count).catch(() => {});
    }
  }
}

export const humanSearch = new HumanSearchBypass();
