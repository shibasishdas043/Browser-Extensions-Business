/**
 * Floating Video Killer — Industry-Grade Zero-Hardcoding Logic Engine 3.0
 * Neutralizes commercial outstream video widgets, auto-detaching PiP traps,
 * and floating sticky corner players using pure geometry, DOM structural analysis,
 * and behavioral audio lockdown with 0% website or vendor hardcoding.
 */

import {
  injectVideoKillerStyles,
  removeVideoKillerStyles,
  SUPPRESSED_ATTR,
  SUPPRESSED_CLASS,
} from './ui';
import { recordProtectionEvent } from '../../content/storage';

const MEDIA_CANDIDATE_SELECTORS = [
  'video',
  'iframe[allow*="autoplay" i]',
  'iframe[src]',
  '[data-player]',
  '[data-video]',
];

/**
 * Traverses standard DOM and open Shadow DOM roots to discover all media elements.
 */
function collectMediaCandidates(root: Node, list: HTMLElement[]): void {
  if (!(root instanceof HTMLElement || root instanceof Document || root instanceof ShadowRoot)) {
    return;
  }

  const elements = root.querySelectorAll<HTMLElement>(MEDIA_CANDIDATE_SELECTORS.join(','));
  elements.forEach((el) => {
    // Skip extension UI elements
    if (el.id?.startsWith('zw-') || (typeof el.className === 'string' && el.className.includes('zw-'))) {
      return;
    }
    list.push(el);

    if (el.shadowRoot) {
      collectMediaCandidates(el.shadowRoot, list);
    }
  });

  // Check custom web components with open shadow roots
  const customElements = root.querySelectorAll<HTMLElement>('*');
  customElements.forEach((el) => {
    if (el.shadowRoot && !el.id?.startsWith('zw-')) {
      collectMediaCandidates(el.shadowRoot, list);
    }
  });
}

/**
 * Ascends the DOM from a media element to locate the highest ancestor
 * that enforces fixed or sticky positioning for the floating player widget.
 * Pure DOM traversal with zero vendor strings.
 */
export function findFloatingAncestor(el: HTMLElement): HTMLElement | null {
  const docBody = typeof document !== 'undefined' ? document.body : null;
  const docEl = typeof document !== 'undefined' ? document.documentElement : null;

  let curr: HTMLElement | null = el;
  let highestFloating: HTMLElement | null = null;

  while (curr && curr !== docBody && curr !== docEl) {
    try {
      const style = window.getComputedStyle(curr);
      const isFixed = style.position === 'fixed';
      const isSticky = style.position === 'sticky';

      if (isFixed || isSticky) {
        // Exclude document root wrappers (e.g. #root, #app, main wrappers)
        const id = curr.id?.toLowerCase() || '';
        const tag = curr.tagName.toLowerCase();
        const isAppRoot = id === 'root' || id === 'app' || id === '__next' || tag === 'main';
        if (!isAppRoot) {
          highestFloating = curr;
        }
      }
    } catch {
      break;
    }
    curr = curr.parentElement;
  }

  return highestFloating;
}

/**
 * Evaluates whether a floating container is an intrusive corner video trap
 * using pure geometry, viewport ratios, corner docking, and z-index heuristics.
 */
export function isFloatingVideoTrap(container: HTMLElement): boolean {
  if (container.getAttribute(SUPPRESSED_ATTR) === 'true') {
    return false;
  }

  const style = window.getComputedStyle(container);
  const isFixed = style.position === 'fixed';
  const isSticky = style.position === 'sticky';
  if (!isFixed && !isSticky) {
    return false;
  }

  const rect = container.getBoundingClientRect();
  const vpW = typeof window !== 'undefined' ? window.innerWidth : 800;
  const vpH = typeof window !== 'undefined' ? window.innerHeight : 600;

  // 1. Must have rendered visual dimensions
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  // 2. Immunity check: Fullscreen or primary dominant player
  // If the container covers more than 55% of the viewport width or height, it is an intentional player
  if (rect.width >= vpW * 0.55 || rect.height >= vpH * 0.55) {
    return false;
  }

  // 3. Immunity check: Negative z-index background hero video
  const zIndex = parseInt(style.zIndex || '0', 10);
  if (!isNaN(zIndex) && zIndex < 0) {
    return false;
  }

  // 4. Immunity check: Native dialog or browser fullscreen
  if (container.closest('dialog') || (typeof document !== 'undefined' && document.fullscreenElement)) {
    return false;
  }

  // 5. Size boundaries for floating outstream / PiP video traps (120px-520px wide, 70px-380px high)
  const isPiPSize =
    rect.width >= 120 &&
    rect.width <= 520 &&
    rect.height >= 70 &&
    rect.height <= 380 &&
    rect.width <= vpW * 0.45;

  if (!isPiPSize) {
    return false;
  }

  // 6. Corner and screen edge anchoring heuristic
  // Floating video widgets universally dock within 70px of a viewport corner or screen boundary
  const nearBottom = rect.bottom >= vpH - 70;
  const nearTop = rect.top <= 70;
  const nearRight = rect.right >= vpW - 70;
  const nearLeft = rect.left <= 70;

  const isCornerAnchored = (nearBottom || nearTop) && (nearRight || nearLeft);
  const isBottomDocked = nearBottom && rect.width <= 480;

  // 7. Video aspect ratio check: standard 16:9, 4:3, or square players (0.7 to 2.6)
  const aspectRatio = rect.width / rect.height;
  const isVideoAspectRatio = aspectRatio >= 0.7 && aspectRatio <= 2.6;

  return (isCornerAnchored || isBottomDocked) && isVideoAspectRatio;
}

/**
 * Fully neutralizes a floating video trap: silences audio, locks playback,
 * disarms autoplay restart loops, and applies CSS suppression with zero layout shift.
 */
export function neutralizePlayer(container: HTMLElement): void {
  container.setAttribute(SUPPRESSED_ATTR, 'true');
  container.classList.add(SUPPRESSED_CLASS);

  // 1. Neutralize all <video> elements inside container
  const videos = container.querySelectorAll<HTMLVideoElement>('video');
  const allVideos: HTMLVideoElement[] = Array.from(videos);
  if (container instanceof HTMLVideoElement) {
    allVideos.push(container);
  }

  allVideos.forEach((v) => {
    try {
      v.pause();
      v.muted = true;
      v.volume = 0;
      v.removeAttribute('autoplay');
      v.removeAttribute('loop');

      // Prevent scripts from calling play() in an infinite loop
      v.addEventListener(
        'play',
        (e) => {
          v.pause();
          v.muted = true;
          v.volume = 0;
          e.preventDefault();
          e.stopImmediatePropagation();
        },
        { capture: true }
      );
    } catch {}
  });

  // 2. Neutralize all <iframe> elements inside container
  const iframes = container.querySelectorAll<HTMLIFrameElement>('iframe');
  const allIframes: HTMLIFrameElement[] = Array.from(iframes);
  if (container instanceof HTMLIFrameElement) {
    allIframes.push(container);
  }

  allIframes.forEach((ifr) => {
    try {
      ifr.removeAttribute('allow');
      ifr.setAttribute('allow', "autoplay 'none'; microphone 'none'; camera 'none'");
      // If the iframe is purely an outstream player widget, blank out its source cleanly
      if (ifr.src && ifr.src !== 'about:blank') {
        ifr.setAttribute('data-zenweb-orig-src', ifr.src);
        ifr.src = 'about:blank';
      }
    } catch {}
  });
}

export class VideoKiller {
  private isRunning = false;
  private observer: MutationObserver | null = null;
  private scrollHandler: (() => void) | null = null;
  private throttledRafId: number | null = null;
  private suppressedContainers = new WeakSet<HTMLElement>();

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    injectVideoKillerStyles();
    this.scan();

    // High-performance passive scroll listener throttled to animation frames
    this.scrollHandler = () => {
      if (this.throttledRafId !== null) return;
      this.throttledRafId = window.requestAnimationFrame(() => {
        this.throttledRafId = null;
        this.scan();
      });
    };

    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    this.startObserver();
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
      this.scrollHandler = null;
    }

    if (this.throttledRafId !== null) {
      window.cancelAnimationFrame(this.throttledRafId);
      this.throttledRafId = null;
    }

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    removeVideoKillerStyles();
  }

  /**
   * Scans for candidate media elements and evaluates their true floating container hierarchy.
   */
  public scan(): void {
    if (!this.isRunning) return;

    let newlySuppressed = 0;
    const candidates: HTMLElement[] = [];

    // Collect candidates from regular DOM and open Shadow DOMs
    const docBody = typeof document !== 'undefined' ? document.body : null;
    if (docBody) {
      collectMediaCandidates(docBody, candidates);
    }

    for (const el of candidates) {
      // Find the highest floating ancestor (or the element itself if it has position fixed/sticky)
      const container = findFloatingAncestor(el) || el;

      if (this.suppressedContainers.has(container)) {
        continue;
      }

      if (isFloatingVideoTrap(container)) {
        this.suppressedContainers.add(container);
        neutralizePlayer(container);
        newlySuppressed++;
      }
    }

    if (newlySuppressed > 0) {
      recordProtectionEvent('videosSuppressed', newlySuppressed).catch(() => {});
    }
  }

  private startObserver(): void {
    if (this.observer) return;

    let scanTimer: number | null = null;
    this.observer = new MutationObserver(() => {
      if (scanTimer) clearTimeout(scanTimer);
      scanTimer = window.setTimeout(() => {
        this.scan();
      }, 250);
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

export const videoKiller = new VideoKiller();
