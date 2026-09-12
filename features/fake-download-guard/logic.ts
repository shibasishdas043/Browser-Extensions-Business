/**
 * Deceptive Download Guard — Logic Engine
 * Scans web pages for deceptive advertising banners masquerading as download buttons,
 * quarantines traps, and protects genuine software downloads.
 */

import { quarantineElement, removeAllQuarantines, injectGuardStyles } from './ui';
import { recordProtectionEvent } from '../../content/storage';

// Known binary/archive extensions that signal a legitimate download link
const REAL_FILE_REGEX = /\.(zip|rar|7z|tar\.gz|tgz|tar|bz2|gz|exe|msi|dmg|pkg|apk|iso|bin|pdf|epub|torrent|deb|rpm)(\?.*)?$/i;

// Ad network domains and click tracking patterns
const AD_NETWORK_REGEX = /(doubleclick\.net|googlesyndication\.com|googleadservices\.com|taboola\.com|outbrain\.com|adnxs\.com|adroll\.com|popads\.net|adcash\.com|propellerads\.com|trafficjunky\.com|exoclick\.com|mgid\.com|revcontent\.com|criteo\.com|adsterra\.com|bidvertiser\.com)/i;
const AD_QUERY_PARAM_REGEX = /[?&](click_id|aff_id|affiliate_id|utm_campaign|subid|ad_id|ad_url|track_id|redirect_url)=/i;

// Download bait keywords (multi-language support)
const DOWNLOAD_BAIT_REGEX = /\b(download|start download|download now|direct download|fast download|instant download|free download|installer|télécharger|descargar|herunterladen)\b/i;

// Common ad container selectors
const AD_CONTAINER_SELECTORS = [
  'ins.adsbygoogle',
  '[id*="google_ads"]',
  '[id*="aswift"]',
  '[class*="ad-container"]',
  '[class*="advertisement"]',
  '[class*="ad-slot"]',
  '[class*="banner-ad"]',
  '[class*="ads-wrapper"]',
  '[data-ad-client]',
  '[data-ad-slot]',
  'iframe[src*="ad"]',
  'iframe[id*="google_ads"]',
];

export class FakeDownloadGuard {
  private observer: MutationObserver | null = null;
  private isScanning = false;
  private isRunning = false;
  private inspectedElements = new WeakSet<HTMLElement>();

  /**
   * Starts monitoring the document for fake download buttons and deceptive ads.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    injectGuardStyles();
    this.scan();
    this.startObserver();
  }

  /**
   * Stops monitoring and restores any quarantined elements.
   */
  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    removeAllQuarantines();
  }

  /**
   * Scans the document for download candidates.
   */
  public scan(): void {
    if (!this.isRunning || this.isScanning) return;
    this.isScanning = true;

    requestAnimationFrame(() => {
      let newlyDefusedCount = 0;

      // 1. Scan candidate anchors, buttons, and iframes
      const candidates = document.querySelectorAll<HTMLElement>(
        'a[href], button, [role="button"], iframe, ins.adsbygoogle, img'
      );

      candidates.forEach((el) => {
        if (this.inspectedElements.has(el)) return;
        this.inspectedElements.add(el);

        const check = this.evaluateElement(el);
        if (check.isTrap) {
          quarantineElement(el, check.reason);
          newlyDefusedCount++;
        }
      });

      if (newlyDefusedCount > 0) {
        recordProtectionEvent('fakeDownloadsDefused', newlyDefusedCount).catch((err) => {
          console.error('[ZenWeb] Failed to record defused stats:', err);
        });
      }

      this.isScanning = false;
    });
  }

  /**
   * Evaluates whether a given DOM element is an ad trap masquerading as a download.
   */
  private evaluateElement(el: HTMLElement): { isTrap: boolean; reason: string } {
    const tagName = el.tagName.toLowerCase();

    // Check if element is directly inside a confirmed ad container
    const isInsideAdContainer = el.closest(AD_CONTAINER_SELECTORS.join(','));

    // Text content / button label
    const text = (el.textContent || '').trim();
    const hasDownloadKeyword = DOWNLOAD_BAIT_REGEX.test(text);

    // Image alt or src check
    let imgHasDownloadBait = false;
    if (tagName === 'img') {
      const img = el as HTMLImageElement;
      const altOrTitle = `${img.alt} ${img.title} ${img.src}`;
      imgHasDownloadBait = DOWNLOAD_BAIT_REGEX.test(altOrTitle);
    } else {
      const innerImg = el.querySelector('img');
      if (innerImg) {
        const altOrTitle = `${innerImg.alt} ${innerImg.title} ${innerImg.src}`;
        imgHasDownloadBait = DOWNLOAD_BAIT_REGEX.test(altOrTitle);
      }
    }

    // ── Case 1: Download keyword inside an Ad Container ──
    if (isInsideAdContainer && (hasDownloadKeyword || imgHasDownloadBait)) {
      return { isTrap: true, reason: 'Fake Download' };
    }

    // ── Case 2: Anchor links (Check Destination Discrepancy) ──
    if (tagName === 'a') {
      const link = el as HTMLAnchorElement;
      const href = link.href || link.getAttribute('href') || '';

      // Skip non-http or in-page anchors unless they have suspicious click handlers
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
        if (hasDownloadKeyword && link.getAttribute('onclick')) {
          return { isTrap: true, reason: 'Fake Download' };
        }
        return { isTrap: false, reason: '' };
      }

      // Check if target is a genuine file
      const isGenuineFile = REAL_FILE_REGEX.test(link.pathname) || link.hasAttribute('download');
      if (isGenuineFile) {
        // Genuine download link verified
        return { isTrap: false, reason: '' };
      }

      // Check for ad network links or affiliate click trackers masquerading as downloads
      const isAdNetworkUrl = AD_NETWORK_REGEX.test(href);
      const hasTrackerParams = AD_QUERY_PARAM_REGEX.test(href);

      if ((hasDownloadKeyword || imgHasDownloadBait) && (isAdNetworkUrl || hasTrackerParams)) {
        return { isTrap: true, reason: 'Fake Download' };
      }

      // Cross-origin check: link text says "Download" but links to completely different domain with no file extension
      try {
        const targetUrl = new URL(href, window.location.href);
        const isCrossOrigin = targetUrl.hostname !== window.location.hostname &&
                              !targetUrl.hostname.endsWith('.' + window.location.hostname);

        if (hasDownloadKeyword && isCrossOrigin && !isGenuineFile) {
          // If it's an external domain, not a binary file, and text is just "Download" or "Start Download"
          const isShortBait = text.length < 35 && DOWNLOAD_BAIT_REGEX.test(text);
          if (isShortBait) {
            return { isTrap: true, reason: 'Fake Download' };
          }
        }
      } catch {
        // Invalid URL
      }
    }

    // ── Case 3: Ad Iframes ──
    if (tagName === 'iframe') {
      const iframe = el as HTMLIFrameElement;
      const src = iframe.src || '';
      if (AD_NETWORK_REGEX.test(src)) {
        // Only flag if iframe dimensions resemble a banner/button
        const rect = el.getBoundingClientRect();
        if ((rect.width > 120 && rect.height > 30) || el.closest('[class*="download"]')) {
          return { isTrap: true, reason: 'Fake Download' };
        }
      }
    }

    return { isTrap: false, reason: '' };
  }

  /**
   * Starts MutationObserver to monitor dynamically loaded elements.
   */
  private startObserver(): void {
    if (this.observer) return;

    this.observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (const m of mutations) {
        if (m.addedNodes.length > 0) {
          shouldScan = true;
          break;
        }
      }
      if (shouldScan) {
        this.scan();
      }
    });

    this.observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
}

// Singleton instance
export const downloadGuard = new FakeDownloadGuard();
