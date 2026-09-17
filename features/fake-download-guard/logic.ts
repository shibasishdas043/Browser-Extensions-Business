/**
 * Deceptive Download Guard — Logic Engine
 * Scans web pages for deceptive advertising banners masquerading as download buttons,
 * quarantines traps, and protects genuine software downloads.
 */

import { quarantineElement, removeAllQuarantines, injectGuardStyles } from './ui';
import { recordProtectionEvent } from '../../content/storage';

// Known binary, archive, disk image, installer, package, and media extensions that signal a legitimate download link
const REAL_FILE_REGEX =
  /\.(zip|rar|7z|tar\.gz|tgz|tar|bz2|gz|xz|zst|zstandard|exe|msi|dmg|pkg|apk|xapk|apks|iso|bin|img|vhd|vmdk|ova|pdf|epub|mobi|azw3|torrent|deb|rpm|appimage|jar|crx|xpi|whl|gem|app|ipa|cab|mp3|flac|wav|mp4|mkv|avi)(\?.*)?$/i;

// Ad network domains, affiliate tracking platforms, and click tracking patterns
const AD_NETWORK_REGEX =
  /(doubleclick\.net|googlesyndication\.com|googleadservices\.com|taboola\.com|outbrain\.com|adnxs\.com|adroll\.com|popads\.net|adcash\.com|propellerads\.com|trafficjunky\.com|exoclick\.com|mgid\.com|revcontent\.com|criteo\.com|adsterra\.com|bidvertiser\.com|adkeep\.com|clickadu\.com|hilltopads\.com|yllix\.com|monetag\.com|richpush\.com|richads\.com|admaven\.com|juicyads\.com|plugrush\.com|trafficstars\.com|adxad\.com|onclkds\.com|tsyndicate\.com|zeroredirect\.com|smartadserver\.com|adk2x\.com|coinhive)/i;
const AD_QUERY_PARAM_REGEX =
  /[?&](click_id|aff_id|affiliate_id|utm_campaign|subid|ad_id|ad_url|track_id|redirect_url|ad_click)=/i;

// Download bait keywords (multi-language and high-intent phrases)
const DOWNLOAD_BAIT_REGEX =
  /\b(download|start download|download now|direct download|fast download|instant download|free download|high speed download|secure download|download here|click to download|continue to download|download apk|download zip|installer|install now|télécharger|téléchargement|telecharger|descargar|descarga|descargar gratis|descargar ahora|herunterladen|scaricare|baixar|baixar agora)\b/i;

// Well-known trusted software repositories, open-source hosts, package registries, and primary vendor sites
export const TRUSTED_SOFTWARE_HOSTS = [
  'github.com',
  'gitlab.com',
  'bitbucket.org',
  'sourceforge.net',
  'archive.org',
  'pypi.org',
  'npmjs.com',
  'npmjs.org',
  'crates.io',
  'docker.com',
  'apache.org',
  'mozilla.org',
  'firefox.com',
  'google.com',
  'microsoft.com',
  'apple.com',
  'ubuntu.com',
  'canonical.com',
  'debian.org',
  'archlinux.org',
  'kernel.org',
  'python.org',
  'nodejs.org',
  'rust-lang.org',
  'golang.org',
  'videolan.org',
  'gimp.org',
  'blender.org',
  'libreoffice.org',
  'audacityteam.org',
  'notepad-plus-plus.org',
  '7-zip.org',
  'wireshark.org',
  'raw.githubusercontent.com',
  'objects.githubusercontent.com',
  'github-releases.githubusercontent.com',
  'drive.google.com',
  'dropbox.com',
  'mediafire.com',
  'mega.nz',
];

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
  '[class*="ad-unit"]',
  '[class*="sponsored-download"]',
  '[id*="sponsored-download"]',
  '[data-ad-client]',
  '[data-ad-slot]',
  'iframe[src*="ad"]',
  'iframe[id*="google_ads"]',
];

/**
 * Checks whether a given URL points to a verified trusted software repository or mirror.
 */
export function isTrustedSoftwareHost(urlStr: string): boolean {
  if (!urlStr) return false;
  try {
    const base = typeof window !== 'undefined' && window.location ? window.location.href : 'https://localhost';
    const parsed = new URL(urlStr, base);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    return TRUSTED_SOFTWARE_HOSTS.some(
      (trusted) => host === trusted || host.endsWith('.' + trusted)
    );
  } catch {
    return false;
  }
}

export class FakeDownloadGuard {
  private observer: MutationObserver | null = null;
  private isScanning = false;
  private isRunning = false;
  // Dynamic signature map allows re-evaluation when ad scripts inject content asynchronously
  private inspectedSignatures = new WeakMap<HTMLElement, string>();

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
   * Generates a signature of the element's current state to detect dynamic alterations by ad scripts.
   */
  private getElementSignature(el: HTMLElement): string {
    const tagName = el.tagName.toLowerCase();
    const src = (el as HTMLImageElement | HTMLIFrameElement).src || '';
    const href = (el as HTMLAnchorElement).href || '';
    const text = (el.textContent || '').trim().slice(0, 60);
    const className = typeof el.className === 'string' ? el.className : '';
    const id = el.id || '';
    return `${tagName}|${src}|${href}|${text}|${className}|${id}`;
  }

  /**
   * Scans the document for download candidates.
   */
  public scan(): void {
    if (!this.isRunning || this.isScanning) return;
    this.isScanning = true;

    requestAnimationFrame(() => {
      let newlyDefusedCount = 0;

      // Scan candidate anchors, buttons, iframes, ad containers, and images
      const candidates = document.querySelectorAll<HTMLElement>(
        'a[href], button, [role="button"], iframe, ins.adsbygoogle, img'
      );

      candidates.forEach((el) => {
        // Skip extension's own UI elements
        if (el.id?.startsWith('zw-') || (typeof el.className === 'string' && el.className.includes('zw-'))) {
          return;
        }

        // If already overridden by the user, respect user choice
        if (el.getAttribute('data-zenweb-override') === 'true') {
          return;
        }

        const sig = this.getElementSignature(el);
        if (this.inspectedSignatures.get(el) === sig) {
          return;
        }
        this.inspectedSignatures.set(el, sig);

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
  public evaluateElement(el: HTMLElement): { isTrap: boolean; reason: string } {
    const tagName = el.tagName.toLowerCase();

    // Skip if already quarantined or explicitly overridden
    if (el.getAttribute('data-zenweb-override') === 'true') {
      return { isTrap: false, reason: '' };
    }

    // Check if element is inside an identified ad container
    const isInsideAdContainer = Boolean(el.closest(AD_CONTAINER_SELECTORS.join(',')));

    // Text content / button label
    const text = (el.textContent || '').trim();
    const hasDownloadKeyword = DOWNLOAD_BAIT_REGEX.test(text);

    // Image alt or src check
    let imgHasDownloadBait = false;
    let imgBaitSrc = false;
    if (tagName === 'img') {
      const img = el as HTMLImageElement;
      const altOrTitle = `${img.alt} ${img.title}`;
      imgHasDownloadBait = DOWNLOAD_BAIT_REGEX.test(altOrTitle);
      imgBaitSrc = /(download|installer|setup)[-_]?(button|now|btn|green|blue)?\.(png|jpg|gif|webp)/i.test(img.src);
    } else {
      const innerImg = el.querySelector('img');
      if (innerImg) {
        const altOrTitle = `${innerImg.alt} ${innerImg.title}`;
        imgHasDownloadBait = DOWNLOAD_BAIT_REGEX.test(altOrTitle);
        imgBaitSrc = /(download|installer|setup)[-_]?(button|now|btn|green|blue)?\.(png|jpg|gif|webp)/i.test(innerImg.src);
      }
    }

    const hasBaitSignal = hasDownloadKeyword || imgHasDownloadBait || imgBaitSrc;

    // ── Case 1: Download keyword or bait button inside an Ad Container ──
    if (isInsideAdContainer && hasBaitSignal) {
      return { isTrap: true, reason: 'Fake Download' };
    }

    // ── Case 2: Anchor links (Check Destination & Cross-Origin Discrepancy) ──
    if (tagName === 'a') {
      const link = el as HTMLAnchorElement;
      const href = link.href || link.getAttribute('href') || '';

      // Skip non-http or in-page anchors unless they have suspicious click handlers
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
        const onclick = link.getAttribute('onclick') || '';
        if (hasBaitSignal && (onclick.includes('window.open') || AD_NETWORK_REGEX.test(onclick))) {
          return { isTrap: true, reason: 'Fake Download' };
        }
        return { isTrap: false, reason: '' };
      }

      // SAFEGUARD 1: Verified Trusted Software Host Allowlist (GitHub, SourceForge, PyPI, etc.)
      if (isTrustedSoftwareHost(href)) {
        return { isTrap: false, reason: '' };
      }

      // SAFEGUARD 2: Verified Binary / Archive file download
      const isGenuineFile = REAL_FILE_REGEX.test(link.pathname) || link.hasAttribute('download');
      if (isGenuineFile) {
        // Even if it has a file extension, if it directly targets an ad-network click tracker, it's deceptive
        if (AD_NETWORK_REGEX.test(href) && AD_QUERY_PARAM_REGEX.test(href)) {
          return { isTrap: true, reason: 'Fake Download' };
        }
        return { isTrap: false, reason: '' };
      }

      // Check for ad network links or affiliate click trackers masquerading as downloads
      const isAdNetworkUrl = AD_NETWORK_REGEX.test(href);
      const hasTrackerParams = AD_QUERY_PARAM_REGEX.test(href);

      if (hasBaitSignal && (isAdNetworkUrl || hasTrackerParams)) {
        return { isTrap: true, reason: 'Fake Download' };
      }

      // Cross-origin check: link text says "Download" but links to an external domain with no file extension
      try {
        const base = typeof window !== 'undefined' && window.location ? window.location.href : 'https://localhost';
        const currentHost = typeof window !== 'undefined' && window.location ? window.location.hostname : 'localhost';
        const targetUrl = new URL(href, base);
        const isCrossOrigin =
          targetUrl.hostname !== currentHost &&
          !targetUrl.hostname.endsWith('.' + currentHost);

        if (hasBaitSignal && isCrossOrigin && !isGenuineFile) {
          // Exclude trusted software repositories
          if (!isTrustedSoftwareHost(href)) {
            const isShortBait = text.length < 40 && (hasDownloadKeyword || imgHasDownloadBait || imgBaitSrc);
            if (isShortBait) {
              return { isTrap: true, reason: 'Fake Download' };
            }
          }
        }
      } catch {
        // Invalid URL
      }
    }

    // ── Case 3: Ad Iframes (Refined to prevent generic display banner false positives) ──
    if (tagName === 'iframe') {
      const iframe = el as HTMLIFrameElement;
      const src = iframe.src || '';
      const isAdNetworkIframe = AD_NETWORK_REGEX.test(src);

      if (isAdNetworkIframe) {
        // Only flag if the iframe has download intent/context, NOT generic display ads:
        // 1. Located inside or immediately near a download container
        const isNearDownload = Boolean(el.closest('[class*="download" i], [id*="download" i]'));
        // 2. Iframe title, name, or src specifically contains download bait keywords
        const iframeMeta = `${iframe.title} ${iframe.name} ${src}`;
        const hasDownloadMeta = DOWNLOAD_BAIT_REGEX.test(iframeMeta);
        // 3. Iframe has data-ad-type indicating download
        const hasDownloadAttr = el.getAttribute('data-ad-type')?.includes('download');

        if (isNearDownload || hasDownloadMeta || hasDownloadAttr) {
          return { isTrap: true, reason: 'Fake Download' };
        }
      }
    }

    // ── Case 4: Standalone Buttons and Clickjackers ──
    if (tagName === 'button' || el.getAttribute('role') === 'button') {
      if (hasBaitSignal) {
        if (isInsideAdContainer) {
          return { isTrap: true, reason: 'Fake Download' };
        }
        const onclick = el.getAttribute('onclick') || '';
        if (onclick && (onclick.includes('window.open') || AD_NETWORK_REGEX.test(onclick))) {
          return { isTrap: true, reason: 'Fake Download' };
        }
      }
    }

    // ── Case 5: Standalone Deceptive Download Images ──
    if (tagName === 'img' && (imgHasDownloadBait || imgBaitSrc)) {
      if (isInsideAdContainer) {
        return { isTrap: true, reason: 'Fake Download' };
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
        if (m.addedNodes.length > 0 || (m.type === 'attributes' && (m.attributeName === 'src' || m.attributeName === 'href'))) {
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
      attributes: true,
      attributeFilter: ['src', 'href', 'class'],
    });
  }
}

// Singleton instance
export const downloadGuard = new FakeDownloadGuard();

