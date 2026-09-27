/**
 * Deceptive Download Guard — UI Module
 * Handles Apple-designed non-destructive quarantining with pills floating
 * directly centered over the fake button to ensure zero interference with surrounding UI.
 * Complies with strict XSS prevention: 100% textContent & DOM APIs (no innerHTML).
 */

export const STYLE_ID = 'zenweb-download-guard-styles';
export const BADGE_CLASS = 'zw-guard-badge';
export const BEACON_CLASS = 'zw-beacon-badge';
export const QUARANTINE_ATTR = 'data-zenweb-quarantine';
export const OVERRIDE_ATTR = 'data-zenweb-override';
export const BEACON_ATTR = 'data-zenweb-verified-real';

interface QuarantinedItem {
  target: HTMLElement;
  badge: HTMLElement;
  originalDisplay?: string;
  neutralizedAnchors?: HTMLAnchorElement[];
}

interface BeaconItem {
  target: HTMLElement;
  badge: HTMLElement;
}

const activeQuarantines: QuarantinedItem[] = [];
const activeBeacons: BeaconItem[] = [];
let listenersAttached = false;

/**
 * Injects the extension's quarantine & beacon CSS into the page head if not already present.
 */
export function injectGuardStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes zwApplePillEnter {
      from {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.92);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
    }

    @keyframes zwBeaconPillEnter {
      from {
        opacity: 0;
        transform: translate(-50%, -100%) scale(0.92);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -100%) scale(1);
      }
    }

    [${QUARANTINE_ATTR}="true"]:not([${OVERRIDE_ATTR}="true"]) {
      opacity: 0.32 !important;
      filter: grayscale(1) contrast(0.85) blur(0.5px) !important;
      outline: 2px dashed #ff9f0a !important;
      outline-offset: 3px !important;
      pointer-events: none !important;
      user-select: none !important;
      transition: opacity 0.3s ease, filter 0.3s ease, outline 0.3s ease !important;
    }

    [${BEACON_ATTR}="true"] {
      outline: 2px solid #34c759 !important;
      outline-offset: 3px !important;
      box-shadow: 0 0 16px rgba(52, 199, 89, 0.35) !important;
      transition: outline 0.3s ease, box-shadow 0.3s ease !important;
    }

    .${BEACON_CLASS} {
      all: initial;
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      padding: 4px 10px !important;
      background: rgba(20, 35, 24, 0.96) !important;
      backdrop-filter: saturate(180%) blur(20px) !important;
      -webkit-backdrop-filter: saturate(180%) blur(20px) !important;
      color: #ffffff !important;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif !important;
      font-size: 11px !important;
      font-weight: 500 !important;
      line-height: 1 !important;
      letter-spacing: -0.015em !important;
      border-radius: 9999px !important;
      border: 1px solid rgba(52, 199, 89, 0.45) !important;
      box-shadow: 0 4px 16px rgba(52, 199, 89, 0.25), 0 2px 6px rgba(0, 0, 0, 0.2) !important;
      z-index: 2147483640 !important;
      position: absolute !important;
      box-sizing: border-box !important;
      user-select: none !important;
      pointer-events: none !important;
      transform: translate(-50%, -100%) scale(1) !important;
      animation: zwBeaconPillEnter 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
      white-space: nowrap !important;
    }

    .${BEACON_CLASS} .zw-beacon-brand {
      all: initial;
      display: inline-flex !important;
      align-items: center !important;
      gap: 5px !important;
      font-family: inherit !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      color: #34c759 !important;
      letter-spacing: -0.02em !important;
      line-height: 1 !important;
    }

    .${BEACON_CLASS} .zw-beacon-detail {
      all: initial;
      font-family: inherit !important;
      font-size: 11px !important;
      font-weight: 500 !important;
      color: rgba(255, 255, 255, 0.9) !important;
      letter-spacing: -0.012em !important;
      line-height: 1 !important;
      margin-left: 2px !important;
    }

    .${BADGE_CLASS} {
      all: initial;
      display: inline-flex !important;
      align-items: center !important;
      gap: 8px !important;
      padding: 5px 6px 5px 12px !important;
      background: rgba(29, 29, 31, 0.94) !important;
      backdrop-filter: saturate(180%) blur(20px) !important;
      -webkit-backdrop-filter: saturate(180%) blur(20px) !important;
      color: #ffffff !important;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif !important;
      font-size: 12px !important;
      font-weight: 400 !important;
      line-height: 1 !important;
      letter-spacing: -0.018em !important;
      border-radius: 9999px !important;
      border: 1px solid rgba(255, 255, 255, 0.18) !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.32), 0 2px 6px rgba(0, 0, 0, 0.16) !important;
      z-index: 2147483640 !important;
      position: absolute !important;
      vertical-align: middle !important;
      box-sizing: border-box !important;
      user-select: none !important;
      pointer-events: auto !important;
      transform: translate(-50%, -50%) scale(1) !important;
      animation: zwApplePillEnter 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
      white-space: nowrap !important;
      transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s ease, border-color 0.18s ease !important;
    }

    .${BADGE_CLASS}:hover {
      background: rgba(29, 29, 31, 0.97) !important;
      border-color: rgba(255, 159, 10, 0.45) !important;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2) !important;
      transform: translate(-50%, -50%) scale(1.03) !important;
    }

    .${BADGE_CLASS} .zw-guard-brand {
      all: initial;
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      font-family: inherit !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      color: #ffffff !important;
      letter-spacing: -0.022em !important;
      line-height: 1 !important;
    }

    .${BADGE_CLASS} .zw-guard-brand svg {
      display: block !important;
      flex-shrink: 0 !important;
    }

    .${BADGE_CLASS} .zw-guard-sep {
      all: initial;
      display: inline-block !important;
      width: 3px !important;
      height: 3px !important;
      border-radius: 50% !important;
      background: rgba(255, 255, 255, 0.28) !important;
      margin: 0 1px !important;
    }

    .${BADGE_CLASS} .zw-guard-sub {
      all: initial;
      display: inline !important;
      font-family: inherit !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      color: #ff9f0a !important;
      letter-spacing: -0.015em !important;
      line-height: 1 !important;
      white-space: nowrap !important;
    }

    .${BADGE_CLASS} .zw-guard-btn {
      all: initial;
      cursor: pointer !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      background: rgba(255, 255, 255, 0.12) !important;
      color: #2997ff !important;
      border: 1px solid rgba(255, 255, 255, 0.16) !important;
      border-radius: 9999px !important;
      padding: 4px 10px !important;
      font-family: inherit !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      letter-spacing: -0.014em !important;
      line-height: 1 !important;
      transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.1s ease !important;
    }

    .${BADGE_CLASS} .zw-guard-btn:hover {
      background: rgba(41, 151, 255, 0.24) !important;
      color: #ffffff !important;
      border-color: rgba(41, 151, 255, 0.45) !important;
    }

    .${BADGE_CLASS} .zw-guard-btn:active {
      transform: scale(0.95) !important;
    }
  `;

  (document.head || document.documentElement).appendChild(style);
  attachWindowListeners();
}

/**
 * Creates an Apple SF-style vector shield icon for quarantined items.
 */
function createShieldIcon(): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '13');
  svg.setAttribute('height', '13');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', '#ff9f0a');
  svg.setAttribute('stroke-width', '2.2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z');

  const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line1.setAttribute('x1', '12');
  line1.setAttribute('y1', '8');
  line1.setAttribute('x2', '12');
  line1.setAttribute('y2', '12');

  const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line2.setAttribute('x1', '12');
  line2.setAttribute('y1', '16');
  line2.setAttribute('x2', '12.01');
  line2.setAttribute('y2', '16');

  svg.appendChild(path);
  svg.appendChild(line1);
  svg.appendChild(line2);
  return svg;
}

/**
 * Creates an Apple SF-style vector verified shield icon with a checkmark for legitimate buttons.
 */
function createVerifiedShieldIcon(): SVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '13');
  svg.setAttribute('height', '13');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', '#34c759');
  svg.setAttribute('stroke-width', '2.4');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z');

  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.setAttribute('points', '9 12 11 14 15 10');

  svg.appendChild(path);
  svg.appendChild(polyline);
  return svg;
}

/**
 * Computes the exact visual bounding box for a target element.
 * If the element is an inline wrapper (e.g. <a>) containing a larger visual child
 * (like an <img>, <svg>, or <canvas>), it uses the visual child's bounding box.
 */
function getTargetVisualRect(target: HTMLElement): { left: number; top: number; width: number; height: number } {
  const rect = target.getBoundingClientRect();

  const visualChild = target.querySelector<HTMLElement>('img, svg, canvas, button');
  if (visualChild) {
    const childRect = visualChild.getBoundingClientRect();
    if (childRect.width > 0 && childRect.height > 0) {
      if (childRect.height > rect.height || childRect.width > rect.width) {
        return {
          left: childRect.left,
          top: childRect.top,
          width: childRect.width,
          height: childRect.height,
        };
      }
    }
  }

  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Checks whether an element or any of its parent containers is styled with fixed or sticky positioning.
 */
function isElementFixedOrSticky(el: HTMLElement): boolean {
  let curr: HTMLElement | null = el;
  while (curr && curr !== document.body && curr !== document.documentElement) {
    try {
      const pos = window.getComputedStyle(curr).position;
      if (pos === 'fixed' || pos === 'sticky') {
        return true;
      }
    } catch {
      break;
    }
    curr = curr.parentElement;
  }
  return false;
}

let elementResizeObserver: ResizeObserver | null = null;
if (typeof ResizeObserver !== 'undefined') {
  try {
    elementResizeObserver = new ResizeObserver(() => {
      updatePillPositions();
    });
  } catch {}
}

/**
 * Updates positions of all active warning pills and verified beacons so they float
 * directly anchored to their target button.
 */
export function updatePillPositions(): void {
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;

  // 1. Update Quarantined Ad Badges (centered directly over the fake button)
  for (let i = activeQuarantines.length - 1; i >= 0; i--) {
    const item = activeQuarantines[i];
    const { target, badge } = item;

    if (!document.body.contains(target) || target.getAttribute(OVERRIDE_ATTR) === 'true') {
      badge.remove();
      if (item.originalDisplay !== undefined) {
        target.style.display = item.originalDisplay;
      }
      item.neutralizedAnchors?.forEach((a) => {
        a.removeAttribute(QUARANTINE_ATTR);
        const origHref = a.getAttribute('data-zenweb-orig-href');
        if (origHref !== null) {
          if (origHref) a.setAttribute('href', origHref);
          else a.removeAttribute('href');
          a.removeAttribute('data-zenweb-orig-href');
        }
        const origTarget = a.getAttribute('data-zenweb-orig-target');
        if (origTarget !== null) {
          if (origTarget) a.setAttribute('target', origTarget);
          else a.removeAttribute('target');
          a.removeAttribute('data-zenweb-orig-target');
        }
      });
      elementResizeObserver?.unobserve(target);
      activeQuarantines.splice(i, 1);
      continue;
    }

    const vRect = getTargetVisualRect(target);
    const style = window.getComputedStyle(target);

    if (vRect.width === 0 || vRect.height === 0 || style.display === 'none' || style.visibility === 'hidden') {
      badge.style.display = 'none';
      continue;
    } else {
      badge.style.display = 'inline-flex';
    }

    const isFixed = isElementFixedOrSticky(target);

    if (isFixed) {
      badge.style.position = 'fixed';
      const centerX = vRect.left + (vRect.width / 2);
      const centerY = vRect.top + (vRect.height / 2);
      badge.style.left = `${centerX}px`;
      badge.style.top = `${centerY}px`;
    } else {
      badge.style.position = 'absolute';
      const centerX = vRect.left + scrollX + (vRect.width / 2);
      const centerY = vRect.top + scrollY + (vRect.height / 2);
      badge.style.left = `${centerX}px`;
      badge.style.top = `${centerY}px`;
    }
  }

  // 2. Update Verified Download Beacons (floats directly above the real button without blocking clicks)
  for (let i = activeBeacons.length - 1; i >= 0; i--) {
    const item = activeBeacons[i];
    const { target, badge } = item;

    if (!document.body.contains(target) || target.getAttribute(OVERRIDE_ATTR) === 'true') {
      badge.remove();
      target.removeAttribute(BEACON_ATTR);
      elementResizeObserver?.unobserve(target);
      activeBeacons.splice(i, 1);
      continue;
    }

    const vRect = getTargetVisualRect(target);
    const style = window.getComputedStyle(target);

    if (vRect.width === 0 || vRect.height === 0 || style.display === 'none' || style.visibility === 'hidden') {
      badge.style.display = 'none';
      continue;
    } else {
      badge.style.display = 'inline-flex';
    }

    const isFixed = isElementFixedOrSticky(target);
    const centerX = isFixed ? vRect.left + (vRect.width / 2) : vRect.left + scrollX + (vRect.width / 2);
    const topY = isFixed ? Math.max(12, vRect.top - 6) : Math.max(12, vRect.top + scrollY - 6);

    badge.style.position = isFixed ? 'fixed' : 'absolute';
    badge.style.left = `${centerX}px`;
    badge.style.top = `${topY}px`;
  }
}

function attachWindowListeners(): void {
  if (listenersAttached) return;
  listenersAttached = true;
  window.addEventListener('resize', updatePillPositions, { passive: true });
  window.addEventListener('scroll', updatePillPositions, { passive: true, capture: true });
}

/**
 * Quarantines an element and displays an Apple-designed warning pill floating directly over it.
 */
export function quarantineElement(el: HTMLElement, reason: string): void {
  if (el.hasAttribute(QUARANTINE_ATTR)) return;

  // If this element was previously illuminated, remove the beacon first
  if (el.hasAttribute(BEACON_ATTR)) {
    el.removeAttribute(BEACON_ATTR);
    const bIdx = activeBeacons.findIndex((b) => b.target === el);
    if (bIdx !== -1) {
      activeBeacons[bIdx].badge.remove();
      activeBeacons.splice(bIdx, 1);
    }
  }

  el.setAttribute(QUARANTINE_ATTR, 'true');

  const neutralizedAnchors: HTMLAnchorElement[] = [];
  const directAnchor = el.tagName.toLowerCase() === 'a' ? (el as HTMLAnchorElement) : null;
  const parentAnchor = el.closest('a') as HTMLAnchorElement | null;
  const childAnchors = Array.from(el.querySelectorAll<HTMLAnchorElement>('a'));

  const allAnchors = new Set<HTMLAnchorElement>();
  if (directAnchor) allAnchors.add(directAnchor);
  if (parentAnchor) allAnchors.add(parentAnchor);
  childAnchors.forEach((a) => allAnchors.add(a));

  allAnchors.forEach((a) => {
    a.setAttribute(QUARANTINE_ATTR, 'true');
    if (!a.hasAttribute('data-zenweb-orig-href')) {
      a.setAttribute('data-zenweb-orig-href', a.getAttribute('href') || '');
    }
    if (!a.hasAttribute('data-zenweb-orig-target')) {
      a.setAttribute('data-zenweb-orig-target', a.getAttribute('target') || '');
    }
    a.setAttribute('href', 'javascript:void(0)');
    a.removeAttribute('target');
    neutralizedAnchors.push(a);
  });

  let originalDisplay: string | undefined;
  if (window.getComputedStyle(el).display === 'inline') {
    originalDisplay = el.style.display;
    el.style.display = 'inline-block';
  }

  const badge = document.createElement('div');
  badge.className = BADGE_CLASS;
  badge.setAttribute('role', 'alert');
  badge.setAttribute('aria-label', 'Fake download button detected');

  const brandWrap = document.createElement('span');
  brandWrap.className = 'zw-guard-brand';

  const shieldIcon = createShieldIcon();
  brandWrap.appendChild(shieldIcon);

  const subSpan = document.createElement('span');
  subSpan.className = 'zw-guard-sub';
  subSpan.textContent = reason || 'Fake Download';

  const revealBtn = document.createElement('button');
  revealBtn.className = 'zw-guard-btn';
  revealBtn.type = 'button';
  revealBtn.textContent = 'Reveal';
  revealBtn.title = 'Show and enable this element anyway if you trust it';

  revealBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    el.setAttribute(OVERRIDE_ATTR, 'true');
    badge.remove();
    if (originalDisplay !== undefined) {
      el.style.display = originalDisplay;
    }
    neutralizedAnchors.forEach((a) => {
      a.removeAttribute(QUARANTINE_ATTR);
      a.setAttribute(OVERRIDE_ATTR, 'true');
      const origHref = a.getAttribute('data-zenweb-orig-href');
      if (origHref !== null) {
        if (origHref) a.setAttribute('href', origHref);
        else a.removeAttribute('href');
        a.removeAttribute('data-zenweb-orig-href');
      }
      const origTarget = a.getAttribute('data-zenweb-orig-target');
      if (origTarget !== null) {
        if (origTarget) a.setAttribute('target', origTarget);
        else a.removeAttribute('target');
        a.removeAttribute('data-zenweb-orig-target');
      }
    });
    elementResizeObserver?.unobserve(el);
    const idx = activeQuarantines.findIndex((q) => q.target === el);
    if (idx !== -1) activeQuarantines.splice(idx, 1);
  });

  badge.appendChild(brandWrap);
  badge.appendChild(subSpan);
  badge.appendChild(revealBtn);

  document.body.appendChild(badge);
  activeQuarantines.push({ target: el, badge, originalDisplay, neutralizedAnchors });

  elementResizeObserver?.observe(el);

  const imgChild = el.querySelector('img');
  if (imgChild && !imgChild.complete) {
    imgChild.addEventListener('load', () => updatePillPositions(), { once: true });
  }

  requestAnimationFrame(() => updatePillPositions());
}

/**
 * Illuminates a verified legitimate download button with an Apple-designed beacon badge.
 * This guides the user directly to the real download action on ad-heavy mirror sites.
 */
export function illuminateRealButton(el: HTMLElement, fileDetail?: string): void {
  // If already illuminated or quarantined or overridden, skip
  if (el.hasAttribute(BEACON_ATTR) || el.hasAttribute(QUARANTINE_ATTR) || el.getAttribute(OVERRIDE_ATTR) === 'true') {
    return;
  }

  el.setAttribute(BEACON_ATTR, 'true');

  const badge = document.createElement('div');
  badge.className = BEACON_CLASS;
  badge.setAttribute('role', 'status');
  badge.setAttribute('aria-label', 'Verified genuine download link');

  const brandWrap = document.createElement('span');
  brandWrap.className = 'zw-beacon-brand';

  const shieldIcon = createVerifiedShieldIcon();
  const brandText = document.createElement('span');
  brandText.textContent = 'Verified';

  brandWrap.appendChild(shieldIcon);
  brandWrap.appendChild(brandText);
  badge.appendChild(brandWrap);

  if (fileDetail) {
    const detailSpan = document.createElement('span');
    detailSpan.className = 'zw-beacon-detail';
    detailSpan.textContent = `· ${fileDetail}`;
    badge.appendChild(detailSpan);
  }

  document.body.appendChild(badge);
  activeBeacons.push({ target: el, badge });

  elementResizeObserver?.observe(el);
  requestAnimationFrame(() => updatePillPositions());
}

/**
 * Removes all active verified download beacons from the page.
 */
export function removeAllBeacons(): void {
  document.querySelectorAll<HTMLElement>(`[${BEACON_ATTR}]`).forEach((el) => {
    el.removeAttribute(BEACON_ATTR);
  });

  for (const item of activeBeacons) {
    item.badge.remove();
    elementResizeObserver?.unobserve(item.target);
  }
  activeBeacons.length = 0;
}

/**
 * Removes quarantine styling and all injected badges from the document.
 */
export function removeAllQuarantines(): void {
  document.querySelectorAll<HTMLElement>(`[${QUARANTINE_ATTR}]`).forEach((el) => {
    el.removeAttribute(QUARANTINE_ATTR);
    el.removeAttribute(OVERRIDE_ATTR);
    const origHref = el.getAttribute('data-zenweb-orig-href');
    if (origHref !== null) {
      if (origHref) el.setAttribute('href', origHref);
      else el.removeAttribute('href');
      el.removeAttribute('data-zenweb-orig-href');
    }
    const origTarget = el.getAttribute('data-zenweb-orig-target');
    if (origTarget !== null) {
      if (origTarget) el.setAttribute('target', origTarget);
      else el.removeAttribute('target');
      el.removeAttribute('data-zenweb-orig-target');
    }
  });

  for (const item of activeQuarantines) {
    item.badge.remove();
    if (item.originalDisplay !== undefined) {
      item.target.style.display = item.originalDisplay;
    }
    item.neutralizedAnchors?.forEach((a) => {
      a.removeAttribute(QUARANTINE_ATTR);
      const origHref = a.getAttribute('data-zenweb-orig-href');
      if (origHref !== null) {
        if (origHref) a.setAttribute('href', origHref);
        else a.removeAttribute('href');
        a.removeAttribute('data-zenweb-orig-href');
      }
      const origTarget = a.getAttribute('data-zenweb-orig-target');
      if (origTarget !== null) {
        if (origTarget) a.setAttribute('target', origTarget);
        else a.removeAttribute('target');
        a.removeAttribute('data-zenweb-orig-target');
      }
    });
    elementResizeObserver?.unobserve(item.target);
  }
  activeQuarantines.length = 0;
  removeAllBeacons();
  elementResizeObserver?.disconnect();

  const style = document.getElementById(STYLE_ID);
  if (style) style.remove();
}

