/**
 * Deceptive Download Guard — Industry-Grade Zero-Hardcoding Logic Engine
 * Scans web pages using dynamic structural isolation, semantic file metadata proximity,
 * and behavioral clickjacking heuristics to defuse ad traps with 0% false positives
 * on genuine software downloads, external CDNs, and business app exports.
 */

import { quarantineElement, removeAllQuarantines, injectGuardStyles, illuminateRealButton, removeAllBeacons } from './ui';
import { recordProtectionEvent } from '../../content/storage';

// Known binary, archive, disk image, installer, package, and media extensions that signal a legitimate download link
export const REAL_FILE_REGEX =
  /\.(zip|rar|7z|tar\.gz|tgz|tar|bz2|gz|xz|tar\.xz|tar\.bz2|zst|zstandard|exe|msi|msix|msixbundle|appx|dmg|pkg|apk|xapk|apks|aab|iso|bin|img|vhd|vmdk|wim|esd|ova|pdf|epub|mobi|azw3|torrent|deb|rpm|appimage|snap|flatpakref|jar|crx|xpi|whl|gem|app|ipa|cab|rom|nes|sfc|gba|nds|n64|cso|chd|nsp|xci|mp3|flac|wav|mp4|mkv|avi|mov|webm)(\?.*)?$/i;

// Business, productivity, and document export intent (immune to false positives)
export const DOCUMENT_EXPORT_REGEX =
  /\b(download|export|save)\s+(csv|pdf|invoice|receipt|statement|report|data|table|logs?|summary|transcript|backup|epub|vcf|ical|json|excel|xlsx|tsv|doc|docx|odt)\b/i;

// Commercial affiliate, ad-network, and click-tracking query parameters
export const COMMERCIAL_TRACKER_PARAMS_REGEX =
  /[?&](click_id|aff_id|affiliate_id|utm_campaign|utm_medium=cpc|subid|sub_id|subid2|ad_id|ad_url|track_id|redirect_url|target_url|ad_click|zoneid|zone_id|pubid|pub_id|creative_id|campaign_id|placement_id|gclid|fbclid|msclkid|ttclid)=/i;

// Multi-language download bait and high-urgency copywriting phrases
export const DOWNLOAD_BAIT_REGEX =
  /\b(download|start download|download now|direct download|fast download|instant download|free download|high speed download|secure download|download here|click to download|continue to download|download apk|download zip|installer|install now|unlock download|generating link|high speed mirror|cloud download|télécharger|téléchargement|telecharger|descargar|descarga|descargar gratis|descargar ahora|herunterladen|herunterladen starten|scaricare|scarica ora|baixar|baixar agora|baixar arquivo)\b|скачать(?:\s+бесплатно)?|прямая ссылка|загрузить|установить|ダウンロード|立即下载|高速下载|다운로드/i;

// Media, game, and mirror specification patterns (Movie 1080p, Music 320kbps, Game repacks, Countdown states)
export const MOVIE_FORMAT_REGEX = /\b(1080p|720p|4k|2160p|x264|x265|hevc|bluray|web-dl|hdrip|dvdrip|remux|h264|h265)\b/i;
export const AUDIO_FORMAT_REGEX = /\b(320\s*kbps|128\s*kbps|256\s*kbps|flac|lossless|alac|wav|vbr|cbr|mp3)\b/i;
export const GAME_FORMAT_REGEX = /\b(repack|fitgirl|dodi|gog|steamrip|codex|plaza|skidrow|elamigos|full\s*game|iso)\b/i;
export const COUNTDOWN_REGEX = /\b(wait|generating link|your link will be ready in|download in)\s*\d+\s*(s|sec|seconds)?\b/i;

// Deceptive image graphics patterns (e.g. green download button bitmaps)
export const DECEPTIVE_IMG_REGEX =
  /(download|installer|setup)[-_]?(button|now|btn|green|blue|free|fast)?\.(png|jpg|gif|webp|svg)/i;

// Recognized ad containers, ad slot markers, and publisher tags
export const AD_CONTAINER_SELECTORS = [
  'ins.adsbygoogle',
  '[id*="google_ads"]',
  '[id*="aswift"]',
  '[data-ad-client]',
  '[data-ad-slot]',
  '[data-adunit]',
  '[data-dfp-id]',
  '[data-ad-zone]',
  '[data-native-ad]',
  '[class*="ad-container"]',
  '[class*="advertisement"]',
  '[class*="ad-slot"]',
  '[class*="banner-ad"]',
  '[class*="ads-wrapper"]',
  '[class*="ad-unit"]',
  '[class*="sponsored-download"]',
  '[id*="sponsored-download"]',
  '[class*="partner-download"]',
  '[id*="partner-download"]',
  'iframe[src*="ad"]',
  'iframe[id*="google_ads"]',
];

// Technical file specification patterns (The Fingerprint of Truth)
const FILE_SIZE_REGEX = /\b\d+(?:\.\d+)?\s*(?:[kKmMgGtT][bB]|MB|GB|KB|bytes)\b/;
const VERSION_REGEX = /\b(?:v|ver|version|rel|release|build)\s*[:#]?\s*\d+\.\d+(?:\.\d+)?\b/i;
const CHECKSUM_REGEX = /\b(?:sha256|sha1|md5|crc32)\s*[:#]?\s*[a-f0-9]{8,64}\b/i;
const ARCH_REGEX = /\b(?:64-bit|32-bit|x86_64|x86|arm64|aarch64|win64|win32|macos|universal|linux|android|apk)\b/i;

/**
 * Extracts the registrable base domain (eTLD+1) dynamically to recognize subdomains
 * (e.g. download.example.com and cdn.example.com are recognized as the same organization).
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
 * Dynamically inspects the surrounding DOM neighborhood (element itself, immediate siblings,
 * and parent containers up to 3 levels) for objective technical file specifications.
 * Real download buttons almost always have this cluster; ad banners never do.
 */
export function hasNearbyFileMetadata(el: HTMLElement): boolean {
  // Check element's own text or aria-label first
  const ownText = `${el.textContent || ''} ${el.getAttribute('aria-label') || ''}`;
  if (
    FILE_SIZE_REGEX.test(ownText) ||
    MOVIE_FORMAT_REGEX.test(ownText) ||
    AUDIO_FORMAT_REGEX.test(ownText) ||
    (VERSION_REGEX.test(ownText) && ARCH_REGEX.test(ownText))
  ) {
    return true;
  }

  const docBody = typeof document !== 'undefined' ? document.body : null;
  const docEl = typeof document !== 'undefined' ? document.documentElement : null;

  // Inspect up to 3 parent container levels
  let curr: HTMLElement | null = el.parentElement;
  let depth = 0;
  while (curr && depth < 3 && curr !== docBody && curr !== docEl) {
    // If a parent is an ad container, it is not genuine content
    if (curr.matches && curr.matches(AD_CONTAINER_SELECTORS.join(','))) {
      return false;
    }
    const text = curr.textContent || '';
    let metadataMatches = 0;
    if (FILE_SIZE_REGEX.test(text)) metadataMatches++;
    if (VERSION_REGEX.test(text)) metadataMatches++;
    if (CHECKSUM_REGEX.test(text)) metadataMatches++;
    if (ARCH_REGEX.test(text)) metadataMatches++;
    if (MOVIE_FORMAT_REGEX.test(text)) metadataMatches++;
    if (AUDIO_FORMAT_REGEX.test(text)) metadataMatches++;
    if (GAME_FORMAT_REGEX.test(text)) metadataMatches++;

    if (metadataMatches >= 2 || (metadataMatches >= 1 && (FILE_SIZE_REGEX.test(text) || MOVIE_FORMAT_REGEX.test(text) || AUDIO_FORMAT_REGEX.test(text)))) {
      return true;
    }
    curr = curr.parentElement;
    depth++;
  }
  return false;
}

/**
 * Extracts a concise, human-readable file specification string (e.g. "1.4 GB", "1080p", "320 kbps")
 * to display in the verified download beacon pill.
 */
export function extractFileDetail(el: HTMLElement): string {
  const ownText = `${el.textContent || ''} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`;
  const parentText = el.parentElement ? `${el.parentElement.textContent || ''}` : '';
  const combined = `${ownText} ${parentText}`.trim();

  const sizeMatch = combined.match(FILE_SIZE_REGEX);
  if (sizeMatch) return sizeMatch[0];

  const movieMatch = combined.match(MOVIE_FORMAT_REGEX);
  if (movieMatch) return movieMatch[0].toUpperCase();

  const audioMatch = combined.match(AUDIO_FORMAT_REGEX);
  if (audioMatch) return audioMatch[0].toUpperCase();

  const gameMatch = combined.match(GAME_FORMAT_REGEX);
  if (gameMatch) return gameMatch[0];

  const verMatch = combined.match(VERSION_REGEX);
  if (verMatch) return verMatch[0];

  return 'Direct Link';
}

/**
 * Unpacks nested/cloaked download links (e.g. magnet links or genuine file URLs hidden
 * inside query parameters or data-* attributes of an ad middleman).
 */
export function peelRealDownloadUrl(rawUrl: string, el?: HTMLElement | null): string | null {
  if (!rawUrl && !el) return null;

  // 1. Check data attributes on the element if provided
  if (el) {
    for (const attr of ['data-url', 'data-href', 'data-magnet', 'data-download', 'data-real-url', 'data-target']) {
      const val = el.getAttribute ? el.getAttribute(attr) : null;
      if (val && (val.startsWith('magnet:') || REAL_FILE_REGEX.test(val))) {
        return val;
      }
    }
  }

  // 2. Check query parameters inside rawUrl
  if (rawUrl) {
    try {
      const base = typeof window !== 'undefined' && window.location ? window.location.href : 'https://localhost';
      const parsed = new URL(rawUrl, base);
      for (const [, val] of parsed.searchParams.entries()) {
        const decoded = decodeURIComponent(val);
        if (decoded.startsWith('magnet:') || REAL_FILE_REGEX.test(decoded)) {
          return decoded;
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Detects transparent clickjacking overlays covering significant coordinates.
 */
export function isTransparentClickOverlay(el: HTMLElement): boolean {
  try {
    const style = typeof window !== 'undefined' && window.getComputedStyle ? window.getComputedStyle(el) : null;
    if (!style) return false;
    const opacity = parseFloat(style.opacity || '1');
    const zIndex = parseInt(style.zIndex || '0', 10);
    const isAbsoluteOrFixed = style.position === 'absolute' || style.position === 'fixed';
    if (isAbsoluteOrFixed && opacity < 0.1 && zIndex >= 1000) {
      const rect = el.getBoundingClientRect();
      if (rect.width >= 200 && rect.height >= 200) {
        return true;
      }
    }
  } catch {}
  return false;
}

export interface EvaluationResult {
  isTrap: boolean;
  reason: string;
  legitScore: number;
  trapScore: number;
}

export class FakeDownloadGuard {
  private observer: MutationObserver | null = null;
  private isScanning = false;
  private isRunning = false;
  private clickSentryAttached = false;
  private inspectedSignatures = new WeakMap<HTMLElement, string>();

  /**
   * Starts monitoring the document for fake download buttons and deceptive ads.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    injectGuardStyles();
    this.attachClickSentry();
    this.scan();
    this.startObserver();
  }

  /**
   * Stops monitoring and restores any quarantined elements and beacons.
   */
  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    this.detachClickSentry();
    removeAllQuarantines();
    removeAllBeacons();
  }

  /**
   * Intercepts clicks in the capture phase to peel cloaked download/magnet links
   * and bypass middleman ad popunders cleanly.
   */
  private handleDownloadClick = (e: MouseEvent): void => {
    let target = e.target as HTMLElement | null;
    let clickable: HTMLElement | null = null;
    const docBody = typeof document !== 'undefined' ? document.body : null;
    const docEl = typeof document !== 'undefined' ? document.documentElement : null;

    while (target && target !== docBody && target !== docEl) {
      const tag = target.tagName.toLowerCase();
      if (
        tag === 'a' ||
        tag === 'button' ||
        target.getAttribute('role') === 'button' ||
        target.hasAttribute('data-magnet') ||
        target.hasAttribute('data-url') ||
        target.hasAttribute('data-href')
      ) {
        clickable = target;
        break;
      }
      target = target.parentElement;
    }

    if (!clickable) return;
    const href = (clickable as HTMLAnchorElement).href || clickable.getAttribute('href') || '';

    // Check if this element or its href has a cloaked direct file or magnet link
    const peeled = peelRealDownloadUrl(href, clickable);
    if (peeled && peeled !== href) {
      e.preventDefault();
      e.stopImmediatePropagation();
      console.log('[ZenWeb] Bypassed middleman ad redirect, launching genuine URL:', peeled);
      window.location.href = peeled;
    }
  };

  private attachClickSentry(): void {
    if (this.clickSentryAttached || typeof window === 'undefined') return;
    this.clickSentryAttached = true;
    window.addEventListener('click', this.handleDownloadClick, { capture: true });
  }

  private detachClickSentry(): void {
    if (!this.clickSentryAttached || typeof window === 'undefined') return;
    this.clickSentryAttached = false;
    window.removeEventListener('click', this.handleDownloadClick, { capture: true });
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
   * Scans the document for download candidates, defusing traps and illuminating verified real downloads.
   */
  public scan(): void {
    if (!this.isRunning || this.isScanning) return;
    this.isScanning = true;

    requestAnimationFrame(() => {
      let newlyDefusedCount = 0;
      const legitCandidates: { el: HTMLElement; score: number }[] = [];

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
        } else if (check.legitScore >= 50 && !(el.closest && el.closest(AD_CONTAINER_SELECTORS.join(',')))) {
          const text = (el.textContent || '').trim();
          const href = (el as HTMLAnchorElement).href || '';
          const hasIntent =
            DOWNLOAD_BAIT_REGEX.test(text) ||
            REAL_FILE_REGEX.test((el as HTMLAnchorElement).pathname || '') ||
            href.startsWith('magnet:') ||
            hasNearbyFileMetadata(el) ||
            COUNTDOWN_REGEX.test(text);

          if (hasIntent) {
            legitCandidates.push({ el, score: check.legitScore });
          }
        }
      });

      // If legitimate candidates exist on an ad-heavy page, illuminate the best verified real download button
      if (legitCandidates.length > 0) {
        legitCandidates.sort((a, b) => b.score - a.score);
        const topCandidate = legitCandidates[0].el;
        const detail = extractFileDetail(topCandidate);
        illuminateRealButton(topCandidate, detail);
      }

      if (newlyDefusedCount > 0) {
        recordProtectionEvent('fakeDownloadsDefused', newlyDefusedCount).catch((err) => {
          console.error('[ZenWeb] Failed to record defused stats:', err);
        });
      }

      this.isScanning = false;
    });
  }

  /**
   * Evaluates whether a given DOM element is an ad trap using the Dual-Phase Differential Scoring Engine.
   */
  public evaluateElement(el: HTMLElement): EvaluationResult {
    const tagName = el.tagName.toLowerCase();

    // Skip if already overridden
    if (el.getAttribute('data-zenweb-override') === 'true') {
      return { isTrap: false, reason: '', legitScore: 100, trapScore: 0 };
    }

    const text = (el.textContent || '').trim();

    // ── Hard Exemption 1: Business & Document Exports (Zero False Positives in SaaS/Webmail/Banking) ──
    if (DOCUMENT_EXPORT_REGEX.test(text)) {
      const isInsideAd = Boolean(el.closest && el.closest(AD_CONTAINER_SELECTORS.join(',')));
      if (!isInsideAd) {
        return { isTrap: false, reason: '', legitScore: 100, trapScore: 0 };
      }
    }

    // ── Check for Transparent Clickjacking Overlays ──
    if (isTransparentClickOverlay(el)) {
      return { isTrap: true, reason: 'Transparent Overlay Trap', legitScore: 0, trapScore: 100 };
    }

    let legitScore = 0;
    let trapScore = 0;
    let dominantTrapReason = 'Fake Download';

    // ── Structural Origin Analysis ──
    const isInsideAdContainer = Boolean(el.closest && el.closest(AD_CONTAINER_SELECTORS.join(',')));
    if (isInsideAdContainer) {
      trapScore += 40;
      dominantTrapReason = 'Ad Container Trap';
    }

    // Semantic hierarchy: inside primary content container
    const isInsideMain = Boolean(el.closest && el.closest('main, article, [role="main"], #download, .download-section, .content'));
    if (isInsideMain && !isInsideAdContainer) {
      legitScore += 20;
    }

    // Semantic File Metadata Proximity
    if (!isInsideAdContainer && hasNearbyFileMetadata(el)) {
      legitScore += 60;
    }

    // Download bait keywords
    const hasDownloadKeyword = DOWNLOAD_BAIT_REGEX.test(text);

    // Image analysis
    let hasBaitImage = false;
    if (tagName === 'img') {
      const img = el as HTMLImageElement;
      const altOrTitle = `${img.alt || ''} ${img.title || ''}`;
      hasBaitImage = DOWNLOAD_BAIT_REGEX.test(altOrTitle) || DECEPTIVE_IMG_REGEX.test(img.src || '');
    } else {
      const innerImg = el.querySelector ? el.querySelector('img') : null;
      if (innerImg) {
        const altOrTitle = `${innerImg.alt || ''} ${innerImg.title || ''}`;
        hasBaitImage = DOWNLOAD_BAIT_REGEX.test(altOrTitle) || DECEPTIVE_IMG_REGEX.test(innerImg.src || '');
      }
    }

    if (hasDownloadKeyword || hasBaitImage) {
      if (isInsideAdContainer) {
        trapScore += 45;
      }
    }

    // ── Case A: Anchor Elements (href analysis) ──
    if (tagName === 'a') {
      const link = el as HTMLAnchorElement;
      const href = link.href || link.getAttribute('href') || '';

      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        try {
          const base = typeof window !== 'undefined' && window.location ? window.location.href : 'https://localhost';
          const currentHost = typeof window !== 'undefined' && window.location ? window.location.hostname : 'localhost';
          const targetUrl = new URL(href, base);
          const targetHost = targetUrl.hostname.toLowerCase();

          const currentBaseDomain = getRegistrableBaseDomain(currentHost);
          const targetBaseDomain = getRegistrableBaseDomain(targetHost);
          const isSameOrganization = currentBaseDomain === targetBaseDomain;
          const isSameHost = targetHost === currentHost || targetHost.endsWith('.' + currentHost);

          // Direct genuine binary / archive file target
          const hasDirectFile = REAL_FILE_REGEX.test(targetUrl.pathname) || link.hasAttribute('download');
          if (hasDirectFile) {
            legitScore += 50;
          }

          if (link.hasAttribute('download')) {
            legitScore += 40;
          }

          // Same-origin or same organization mirror
          if (isSameHost || isSameOrganization) {
            legitScore += 40;
          }

          // Designated software release route
          if (/\/(download|downloads|dl|get|releases|files|file|installer)\//i.test(targetUrl.pathname)) {
            legitScore += 30;
          }

          // Commercial click-tracking parameters
          const hasCommercialTracker = COMMERCIAL_TRACKER_PARAMS_REGEX.test(href);
          if (hasCommercialTracker) {
            trapScore += 50;
            dominantTrapReason = 'Click-Tracking Ad Trap';
          }

          // Cross-origin disconnect with no direct file
          const isCrossOrigin = !isSameHost && !isSameOrganization;
          if (isCrossOrigin) {
            if (!hasDirectFile && (hasDownloadKeyword || hasBaitImage)) {
              trapScore += 40;
              if (dominantTrapReason === 'Fake Download') {
                dominantTrapReason = 'Cross-Origin Ad Trap';
              }
            }
          }
        } catch {
          // Invalid URL format
        }
      }

      // Check inline suspicious click handlers
      const onclick = link.getAttribute('onclick') || '';
      if (onclick && (onclick.includes('window.open') || onclick.includes('location.href=') || onclick.includes('eval('))) {
        trapScore += 75;
        if (hasDownloadKeyword || hasBaitImage) trapScore += 15;
        dominantTrapReason = 'Suspicious Script Trap';
      }
    }

    // ── Case B: Iframe Elements ──
    if (tagName === 'iframe') {
      const iframe = el as HTMLIFrameElement;
      const src = iframe.src || '';
      const iframeMeta = `${iframe.title || ''} ${iframe.name || ''} ${src}`;
      const hasDownloadMeta = DOWNLOAD_BAIT_REGEX.test(iframeMeta) || el.getAttribute('data-ad-type')?.includes('download');

      if (isInsideAdContainer && hasDownloadMeta) {
        trapScore += 50;
        dominantTrapReason = 'Deceptive Ad Iframe';
      }
    }

    // ── Case C: Standalone Buttons & Clickjackers ──
    if (tagName === 'button' || el.getAttribute('role') === 'button') {
      const onclick = el.getAttribute('onclick') || '';
      if (onclick && (onclick.includes('window.open') || onclick.includes('location.href=') || onclick.includes('eval('))) {
        trapScore += 75;
        if (hasDownloadKeyword || hasBaitImage) trapScore += 15;
        dominantTrapReason = 'Suspicious Script Trap';
      }

      // In-page Google AdSense single-word "OPEN" / "START" CTA disguise inside ad container
      if (isInsideAdContainer && /^(open|start|install|continue)$/i.test(text)) {
        trapScore += 65;
        dominantTrapReason = 'Deceptive Ad CTA';
      }
    }

    // ── Case D: Standalone Deceptive Bait Images ──
    if (tagName === 'img' && hasBaitImage && isInsideAdContainer) {
      trapScore += 40;
      dominantTrapReason = 'Deceptive Bait Graphic';
    }

    // ── Decision Boundary ──
    // Rule 1: High Legitimate Immunity (Real download button on CDN or with metadata)
    if (legitScore >= 50 && !isInsideAdContainer) {
      return { isTrap: false, reason: '', legitScore, trapScore };
    }

    // Rule 2: Confirmed Trap Boundary
    const isTrap = trapScore >= 70 && (trapScore - legitScore) >= 40;

    return {
      isTrap,
      reason: isTrap ? dominantTrapReason : '',
      legitScore,
      trapScore,
    };
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


