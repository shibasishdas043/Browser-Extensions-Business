/**
 * Deceptive Download Guard — UI Module
 * Handles Apple-designed non-destructive quarantining with pills floating
 * directly centered over the fake button to ensure zero interference with surrounding UI.
 * Complies with strict XSS prevention: 100% textContent & DOM APIs (no innerHTML).
 */

const STYLE_ID = 'zenweb-download-guard-styles';
const BADGE_CLASS = 'zw-guard-badge';
const QUARANTINE_ATTR = 'data-zenweb-quarantine';
const OVERRIDE_ATTR = 'data-zenweb-override';

interface QuarantinedItem {
  target: HTMLElement;
  badge: HTMLElement;
  originalDisplay?: string;
}

const activeQuarantines: QuarantinedItem[] = [];
let listenersAttached = false;

/**
 * Injects the extension's quarantine CSS into the page head if not already present.
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

    [${QUARANTINE_ATTR}="true"]:not([${OVERRIDE_ATTR}="true"]) {
      opacity: 0.32 !important;
      filter: grayscale(1) contrast(0.85) blur(0.5px) !important;
      outline: 2px dashed #ff9f0a !important;
      outline-offset: 3px !important;
      pointer-events: none !important;
      user-select: none !important;
      transition: opacity 0.3s ease, filter 0.3s ease, outline 0.3s ease !important;
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
 * Creates an Apple SF-style vector shield icon.
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
 * Updates positions of all active pills so they float directly centered over their target button.
 */
export function updatePillPositions(): void {
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;

  for (let i = activeQuarantines.length - 1; i >= 0; i--) {
    const item = activeQuarantines[i];
    const { target, badge } = item;

    if (!document.body.contains(target) || target.getAttribute(OVERRIDE_ATTR) === 'true') {
      badge.remove();
      if (item.originalDisplay !== undefined) {
        target.style.display = item.originalDisplay;
      }
      activeQuarantines.splice(i, 1);
      continue;
    }

    const vRect = getTargetVisualRect(target);
    if (vRect.width === 0 && vRect.height === 0) continue;

    // Centered directly on top of the fake button
    const centerX = vRect.left + scrollX + (vRect.width / 2);
    const centerY = vRect.top + scrollY + (vRect.height / 2);

    badge.style.left = `${centerX}px`;
    badge.style.top = `${centerY}px`;
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

  el.setAttribute(QUARANTINE_ATTR, 'true');

  // If the target is an inline element (like <a> wrapping an <img>), switch to inline-block
  // so the quarantine outline and box model wrap the visual content cleanly
  let originalDisplay: string | undefined;
  if (window.getComputedStyle(el).display === 'inline') {
    originalDisplay = el.style.display;
    el.style.display = 'inline-block';
  }

  const badge = document.createElement('div');
  badge.className = BADGE_CLASS;
  badge.setAttribute('role', 'alert');
  badge.setAttribute('aria-label', 'Fake download button detected by ZenWeb');

  const brandWrap = document.createElement('span');
  brandWrap.className = 'zw-guard-brand';

  const shieldIcon = createShieldIcon();
  const brandText = document.createElement('span');
  brandText.textContent = 'ZenWeb';

  brandWrap.appendChild(shieldIcon);
  brandWrap.appendChild(brandText);

  const dotSep = document.createElement('span');
  dotSep.className = 'zw-guard-sep';

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
    const idx = activeQuarantines.findIndex((q) => q.target === el);
    if (idx !== -1) activeQuarantines.splice(idx, 1);
  });

  badge.appendChild(brandWrap);
  badge.appendChild(dotSep);
  badge.appendChild(subSpan);
  badge.appendChild(revealBtn);

  // Append badge to body so it floats directly over the target without disturbing the page flow
  document.body.appendChild(badge);

  activeQuarantines.push({ target: el, badge, originalDisplay });

  // If there is an image child still loading, update positions once it finishes loading
  const imgChild = el.querySelector('img');
  if (imgChild && !imgChild.complete) {
    imgChild.addEventListener('load', () => updatePillPositions(), { once: true });
  }

  // Initial placement
  requestAnimationFrame(() => updatePillPositions());
}

/**
 * Removes quarantine styling and all injected badges from the document.
 */
export function removeAllQuarantines(): void {
  document.querySelectorAll<HTMLElement>(`[${QUARANTINE_ATTR}]`).forEach((el) => {
    el.removeAttribute(QUARANTINE_ATTR);
    el.removeAttribute(OVERRIDE_ATTR);
  });

  for (const item of activeQuarantines) {
    item.badge.remove();
    if (item.originalDisplay !== undefined) {
      item.target.style.display = item.originalDisplay;
    }
  }
  activeQuarantines.length = 0;

  const style = document.getElementById(STYLE_ID);
  if (style) style.remove();
}
