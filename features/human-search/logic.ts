/**
 * Human Search Bypass — Logic Engine 2.0
 * Detects search engine pages, injects human discussion shortcuts,
 * badges verified human discussions, and flags SEO content mills.
 */

import {
  injectHumanSearchStyles,
  injectHumanSearchButton,
  badgeDiscussionResult,
  flagSeoFarmResult,
  removeHumanSearchUI,
} from './ui';
import { recordProtectionEvent } from '../../content/storage';

const DISCUSSION_DOMAINS = [
  'reddit.com',
  'news.ycombinator.com',
  'stackoverflow.com',
  'stackexchange.com',
  'github.com/orgs',
  'github.com/discussions',
  'quora.com',
  'lobste.rs',
];

const SEO_FARM_DOMAINS = [
  'geeksforgeeks.org',
  'w3schools.com',
  'tutorialspoint.com',
  'javatpoint.com',
  'guru99.com',
  'programmingsimplified.com',
];

export class HumanSearchBypass {
  private isRunning = false;
  private observer: MutationObserver | null = null;
  private inspectedLinks = new WeakSet<Element>();

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const host = window.location.hostname;
    const isSearchEngine =
      host.includes('google.') ||
      host.includes('bing.') ||
      host.includes('duckduckgo.') ||
      host.includes('search.brave.com');

    if (!isSearchEngine) return;

    injectHumanSearchStyles();
    injectHumanSearchButton((isActive) => {
      this.handleToggle(isActive);
    });

    this.scanAndBadgeResults();
    this.startObserver();
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    removeHumanSearchUI();
  }

  private handleToggle(isActive: boolean): void {
    const url = new URL(window.location.href);
    const paramName = url.searchParams.has('q') ? 'q' : 'query';
    const q = url.searchParams.get(paramName) || '';

    const forumQuery = '(site:reddit.com OR site:news.ycombinator.com OR site:stackoverflow.com OR site:quora.com)';

    if (isActive) {
      if (!q.includes('site:reddit.com')) {
        url.searchParams.set(paramName, `${q} ${forumQuery}`.trim());
        recordProtectionEvent('seoSpamFiltered', 5).catch(() => {});
        window.location.href = url.toString();
      }
    } else {
      const cleaned = q.replace(forumQuery, '').replace('site:reddit.com', '').trim();
      url.searchParams.set(paramName, cleaned);
      window.location.href = url.toString();
    }
  }

  public scanAndBadgeResults(): void {
    if (!this.isRunning) return;

    let seoFarmsFound = 0;
    const links = document.querySelectorAll<HTMLAnchorElement>('a[href^="http"]');

    links.forEach((link) => {
      if (this.inspectedLinks.has(link)) return;
      this.inspectedLinks.add(link);

      const href = link.href || '';
      try {
        const parsed = new URL(href);
        const host = parsed.hostname.toLowerCase();

        // 1. Is this a human discussion link?
        const isDiscussion = DISCUSSION_DOMAINS.some((d) => host.includes(d) || href.includes(d));
        if (isDiscussion) {
          const card = this.findResultContainer(link);
          if (card) badgeDiscussionResult(card, host);
        }

        // 2. Is this a known SEO farm?
        const isSeoFarm = SEO_FARM_DOMAINS.some((d) => host.includes(d));
        if (isSeoFarm) {
          const card = this.findResultContainer(link);
          if (card) {
            flagSeoFarmResult(card, host);
            seoFarmsFound++;
          }
        }
      } catch {}
    });

    if (seoFarmsFound > 0) {
      recordProtectionEvent('seoSpamFiltered', seoFarmsFound).catch(() => {});
    }
  }

  private findResultContainer(link: HTMLElement): HTMLElement | null {
    // Google: div.g, div[data-hveid]
    // Bing: li.b_algo
    // DuckDuckGo: article, div[data-testid="result"]
    // Brave: div.snippet
    const container = link.closest<HTMLElement>(
      'div.g, li.b_algo, article, div[data-testid="result"], div.snippet, div[jscontroller], div[data-sokoban-container]'
    );
    return container;
  }

  private startObserver(): void {
    if (this.observer) return;

    let scanTimer: number | null = null;
    this.observer = new MutationObserver(() => {
      if (scanTimer) clearTimeout(scanTimer);
      scanTimer = window.setTimeout(() => {
        this.scanAndBadgeResults();
      }, 400);
    });

    this.observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
}

export const humanSearch = new HumanSearchBypass();
