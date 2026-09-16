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
import {
  PROMINENT_DISCUSSION_DOMAINS,
  FORUM_SEARCH_QUERY,
  SEO_FARM_DOMAINS,
} from './constants';

export { PROMINENT_DISCUSSION_DOMAINS, FORUM_SEARCH_QUERY, SEO_FARM_DOMAINS };

export class HumanSearchBypass {
  private isRunning = false;
  private observer: MutationObserver | null = null;
  private inspectedLinks = new WeakSet<Element>();

  private popstateHandler: (() => void) | null = null;
  private navInterval: number | null = null;

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    if (!this.isSearchResultsPage()) {
      // Keep homepages (google.com) clean and distraction-free. Listen for search navigation.
      this.listenNavigation();
      return;
    }

    injectHumanSearchStyles();
    this.ensureButtonInjected();

    this.scanAndBadgeResults();
    this.startObserver();
    this.listenNavigation();
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.popstateHandler) {
      window.removeEventListener('popstate', this.popstateHandler);
      this.popstateHandler = null;
    }

    if (this.navInterval) {
      clearInterval(this.navInterval);
      this.navInterval = null;
    }

    removeHumanSearchUI();
  }

  private isSearchResultsPage(): boolean {
    const host = window.location.hostname;
    const isSearchEngine =
      host.includes('google.') ||
      host.includes('bing.') ||
      host.includes('duckduckgo.') ||
      host.includes('search.brave.com');

    if (!isSearchEngine) return false;

    const url = new URL(window.location.href);
    return (
      url.pathname.includes('/search') ||
      url.pathname.includes('/html') ||
      url.searchParams.has('q') ||
      url.searchParams.has('query') ||
      url.searchParams.has('p')
    );
  }

  private ensureButtonInjected(): void {
    if (!this.isRunning || !this.isSearchResultsPage()) return;
    injectHumanSearchButton((isActive) => {
      this.handleToggle(isActive);
    });
  }

  private handleToggle(isActive: boolean): void {
    const url = new URL(window.location.href);
    const paramName = url.searchParams.has('q') ? 'q' : 'query';
    let q = url.searchParams.get(paramName) || '';

    // If query not in URL (e.g. on homepage), retrieve live value from search input
    const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      'textarea[name="q"], input[name="q"], input#searchbox, #searchbox_input, #search_form_input, input[name="p"], input[type="search"]'
    );
    if (!q && input && input.value.trim()) {
      q = input.value.trim();
    }

    if (isActive) {
      if (q && !q.includes('site:reddit.com')) {
        const combined = `${q} ${FORUM_SEARCH_QUERY}`.trim();
        // If on homepage without /search path, navigate to /search endpoint
        if (!url.pathname.includes('/search') && !url.pathname.includes('/html')) {
          url.pathname = '/search';
        }
        url.searchParams.set(paramName, combined);
        recordProtectionEvent('seoSpamFiltered', 5).catch(() => {});
        window.location.href = url.toString();
      } else if (!q && input) {
        // If query field is empty on homepage, focus the input for immediate typing
        input.focus();
      }
    } else {
      if (q) {
        const cleaned = q
          .replace(/\(site:[^)]+\)/gi, '')
          .replace(FORUM_SEARCH_QUERY, '')
          .replace(/site:(reddit\.com|news\.ycombinator\.com|stackoverflow\.com|stackexchange\.com|quora\.com|github\.com|medium\.com|dev\.to|lobste\.rs|xda-developers\.com)/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        url.searchParams.set(paramName, cleaned);
        window.location.href = url.toString();
      }
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

        // Check for known SEO content farm
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
    // Exclude header, navigation, top bar, and search form elements
    if (link.closest('header, nav, #gb, #top_nav, [role="navigation"], form, #searchform')) {
      return null;
    }

    // Google: div.g, div[data-hveid]
    // Bing: li.b_algo
    // DuckDuckGo: article, div[data-testid="result"]
    // Brave: div.snippet
    const container = link.closest<HTMLElement>(
      'div.g, li.b_algo, article, div[data-testid="result"], div.snippet'
    );
    return container;
  }

  private startObserver(): void {
    if (this.observer) return;

    let scanTimer: number | null = null;
    this.observer = new MutationObserver(() => {
      this.ensureButtonInjected();
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

  private listenNavigation(): void {
    if (this.popstateHandler) return;

    const handleRoute = () => {
      if (this.isSearchResultsPage()) {
        injectHumanSearchStyles();
        this.ensureButtonInjected();
        this.scanAndBadgeResults();
        this.startObserver();
      } else {
        removeHumanSearchUI();
      }
    };

    this.popstateHandler = handleRoute;
    window.addEventListener('popstate', this.popstateHandler);

    let lastUrl = window.location.href;
    this.navInterval = window.setInterval(() => {
      if (!this.isRunning) return;
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        handleRoute();
      }
    }, 400);
  }
}

export const humanSearch = new HumanSearchBypass();
