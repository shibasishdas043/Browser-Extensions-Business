import gsap from 'gsap';
import { openFullSettings, loadSessionStats } from './logic';
import { ProtectionStats } from '../types';

/* r=67: circumference = 2π×67 ≈ 420.97 */
const CIRC = 2 * Math.PI * 67;

interface StatDef {
  id:      string;
  label:   string;
  icon:    string;
  color:   string;
  glow:    string; /* rgba for card inner glow */
  anim:    AnimType;
}

/**
 * Each stat gets a unique entrance animation for the card + number.
 * 'flipX'   — rotateX flip (vertical axis feel)
 * 'flipY'   — rotateY flip (horizontal axis feel)
 * 'slam'    — drops in fast from top
 * 'bounce'  — springs up from below
 * 'spin'    — icon rotates in
 * 'glitch'  — rapid x-jitter then settles
 * 'zoom'    — scales from 0 with overshoot
 */
type AnimType = 'flipX' | 'flipY' | 'slam' | 'bounce' | 'spin' | 'glitch' | 'zoom';

const STATS: StatDef[] = [
  { id:'seo',       label:'SEO Spam Filtered',      icon:'🔍', color:'#00ff87', glow:'rgba(0,255,135,0.09)',   anim:'bounce'  },
  { id:'pinterest', label:'Pinterest Walls Hidden',  icon:'📌', color:'#ff2d78', glow:'rgba(255,45,120,0.09)',  anim:'flipY'   },
  { id:'video',     label:'Videos Killed',           icon:'🎬', color:'#ff3b3b', glow:'rgba(255,59,59,0.09)',   anim:'slam'    },
  { id:'recipe',    label:'Recipe Jumps',            icon:'🍳', color:'#ffcc00', glow:'rgba(255,204,0,0.08)',   anim:'spin'    },
  { id:'overlay',   label:'Overlays Smashed',        icon:'🛡️', color:'#bf5af2', glow:'rgba(191,90,242,0.09)',  anim:'flipX'   },
  { id:'download',  label:'Fakes Defused',           icon:'🛑', color:'#ff6b00', glow:'rgba(255,107,0,0.09)',   anim:'glitch'  },
  { id:'form',      label:'Forms Salvaged',          icon:'✍️', color:'#00cfff', glow:'rgba(0,207,255,0.09)',   anim:'zoom'    },
];

const INTERVAL_MS = 2600;

class ZenWebPopupUI {
  private totalEl!:      HTMLElement;
  private heroLabelEl!:  HTMLElement;
  private heroCenterEl!: HTMLElement;
  private domainEl!:     HTMLElement;
  private timeSavedEl!:  HTMLElement;
  private ringFillEl!:   SVGCircleElement | null;
  private liveDotEl!:    HTMLElement;
  private cardEl!:       HTMLElement;
  private iconEl!:       HTMLElement;
  private labelEl!:      HTMLElement;
  private countEl!:      HTMLElement;
  private dotsEls!:      NodeListOf<HTMLElement>;
  private toggleBtn!:    HTMLButtonElement;
  private toggleTitle!:  HTMLElement;
  private toggleSub!:    HTMLElement;
  private settingsBtn!:  HTMLButtonElement;
  private refreshBtn!:   HTMLButtonElement;
  private toastEl!:      HTMLElement;
  private toastMsgEl!:   HTMLElement;
  private toastTimer:    number | null = null;
  private spotTimer:     number | null = null;
  private heroTimer:     number | null = null;
  private spotIdx     = 0;
  private isOn        = true;
  private heroMode: 'count' | 'status' = 'count';
  private totalBlocked = 74;
  private statVals    = [14, 28, 5, 3, 8, 12, 4];

  constructor() {
    document.readyState === 'loading'
      ? document.addEventListener('DOMContentLoaded', () => this.init())
      : this.init();
  }

  private async init() {
    this.bindRefs();
    this.bindEvents();
    await this.detectDomain();
    await this.loadStats();
    this.renderSpot(0, 'first');
    this.startSpotCycle();
    this.startHeroCycle();
  }

  private bindRefs() {
    this.totalEl      = document.getElementById('hero-blocked-total')!;
    this.heroLabelEl  = document.getElementById('hero-blocked-label')!;
    this.heroCenterEl = document.getElementById('zw-ring-center')!;
    this.domainEl     = document.getElementById('zw-page-domain')!;
    this.timeSavedEl  = document.getElementById('hero-time-saved')!;
    this.ringFillEl   = document.getElementById('zw-ring-fill') as SVGCircleElement | null;
    this.liveDotEl    = document.getElementById('zw-live-dot')!;
    this.cardEl       = document.getElementById('zw-spot-card')!;
    this.iconEl       = document.getElementById('zw-spot-icon')!;
    this.labelEl      = document.getElementById('zw-spot-label')!;
    this.countEl      = document.getElementById('zw-spot-count')!;
    this.dotsEls      = document.querySelectorAll<HTMLElement>('.zw-dot');
    this.toggleBtn    = document.getElementById('zw-master-toggle') as HTMLButtonElement;
    this.toggleTitle  = document.getElementById('zw-toggle-title')!;
    this.toggleSub    = document.getElementById('zw-toggle-sub')!;
    this.settingsBtn  = document.getElementById('zw-btn-settings') as HTMLButtonElement;
    this.refreshBtn   = document.getElementById('zw-btn-refresh') as HTMLButtonElement;
    this.toastEl      = document.getElementById('zw-toast')!;
    this.toastMsgEl   = document.getElementById('zw-toast-message')!;
  }

  private bindEvents() {
    this.settingsBtn?.addEventListener('click', () => { this.pressAnim(this.settingsBtn); openFullSettings(); });

    this.refreshBtn?.addEventListener('click', async () => {
      this.pressAnim(this.refreshBtn);
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) { chrome.tabs.reload(tab.id); this.toast('Page rescanned ✓'); }
      }
    });

    this.toggleBtn?.addEventListener('click', () => this.flipToggle());

    document.getElementById('zw-btn-donate')?.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof chrome !== 'undefined' && chrome.tabs) chrome.tabs.create({ url: 'https://ko-fi.com' });
    });

    // Clicking hero ring manually flips view
    this.heroCenterEl?.addEventListener('click', () => {
      this.toggleHeroMode();
    });

    // Clicking a dot jumps to that stat
    this.dotsEls.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        if (i === this.spotIdx) return;
        clearInterval(this.spotTimer!);
        this.renderSpot(i, 'jump');
        this.spotIdx = i;
        this.startSpotCycle();
      });
    });
  }

  private async detectDomain() {
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url) { this.domainEl.textContent = new URL(tab.url).hostname; return; }
      }
    } catch { /* ignore */ }
    this.domainEl.textContent = 'Active session';
  }

  private async loadStats() {
    try {
      const s: ProtectionStats = await loadSessionStats();
      this.statVals = [
        s.seoSpamFiltered, s.pinterestHidden, s.videosSuppressed,
        s.recipesSkipped, s.overlaysSmashed, s.fakeDownloadsDefused, s.formsBackedUp,
      ];

      const total = this.statVals.reduce((a, b) => a + b, 0);
      this.totalBlocked = total;
      this.countUp(this.totalEl, total);
      setTimeout(() => this.animateRing(total / Math.max(total * 1.3, 60)), 100);

      const mins = (s.totalTimeSavedSeconds / 60).toFixed(1);
      if (this.timeSavedEl) this.timeSavedEl.textContent = `~${mins}m saved`;
    } catch (e) {
      console.error('[ZenWeb]', e);
    }
  }

  /* ── SPOTLIGHT CYCLE ─────────────────────── */

  private startSpotCycle() {
    if (this.spotTimer) clearInterval(this.spotTimer);
    this.spotTimer = window.setInterval(() => {
      const next = (this.spotIdx + 1) % STATS.length;
      this.renderSpot(next, 'auto');
      this.spotIdx = next;
    }, INTERVAL_MS);
  }

  /**
   * Render a stat with its unique animation.
   * mode: 'first' = initial entry (no exit), 'auto' = cycled, 'jump' = dot click
   */
  private renderSpot(idx: number, mode: 'first' | 'auto' | 'jump') {
    const def  = STATS[idx];
    const val  = this.statVals[idx] ?? 0;

    // Update dots
    this.dotsEls.forEach((d, i) => {
      d.classList.toggle('zw-dot--active', i === idx);
      d.style.background = i === idx ? def.color : '';
    });

    const doEnter = () => {
      // Update card styling
      this.cardEl.style.setProperty('--spot-glow', def.glow);
      this.cardEl.style.borderColor = `${def.color}30`;
      this.countEl.style.color = def.color;
      this.iconEl.textContent  = def.icon;
      this.labelEl.textContent = def.label;
      this.countEl.textContent = '0';

      // Count up the number
      this.countUp(this.countEl, val);

      // ── Unique per-stat entrance animation ──────────────────────
      switch (def.anim) {

        case 'bounce':
          // Whole card springs up from below
          gsap.fromTo(this.cardEl,
            { y: 30, opacity: 0, scale: 0.92 },
            { y: 0, opacity: 1, scale: 1, duration: 0.55, ease: 'back.out(2.5)' }
          );
          gsap.fromTo(this.countEl,
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.6, delay: 0.08, ease: 'back.out(3)' }
          );
          break;

        case 'flipY':
          // Card flips in on Y axis
          gsap.fromTo(this.cardEl,
            { rotationY: -90, opacity: 0, transformOrigin: 'left center' },
            { rotationY: 0,   opacity: 1, duration: 0.5, ease: 'back.out(1.5)' }
          );
          gsap.fromTo(this.countEl,
            { x: -20, opacity: 0 },
            { x: 0,   opacity: 1, duration: 0.4, delay: 0.12, ease: 'power3.out' }
          );
          break;

        case 'slam':
          // Slams down from top with squash
          gsap.fromTo(this.cardEl,
            { y: -35, opacity: 0, scaleY: 0.7 },
            { y: 0,   opacity: 1, scaleY: 1, duration: 0.38, ease: 'power4.out' }
          );
          gsap.fromTo(this.countEl,
            { y: -15, opacity: 0, scale: 1.4 },
            { y: 0,   opacity: 1, scale: 1, duration: 0.45, delay: 0.06, ease: 'back.out(2)' }
          );
          break;

        case 'spin':
          // Icon does full spin, number zooms
          gsap.fromTo(this.iconEl,
            { rotation: -180, scale: 0 },
            { rotation: 0,    scale: 1, duration: 0.6, ease: 'back.out(1.8)' }
          );
          gsap.fromTo(this.cardEl,
            { opacity: 0, scale: 0.9 },
            { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out' }
          );
          gsap.fromTo(this.countEl,
            { rotation: 15, scale: 0.5, opacity: 0 },
            { rotation: 0,  scale: 1,   opacity: 1, duration: 0.55, delay: 0.1, ease: 'back.out(3)' }
          );
          break;

        case 'flipX':
          // Card flips on X axis (top-to-bottom reveal)
          gsap.fromTo(this.cardEl,
            { rotationX: 60, opacity: 0, transformOrigin: 'top center' },
            { rotationX: 0,  opacity: 1, duration: 0.5, ease: 'back.out(1.4)' }
          );
          gsap.fromTo(this.countEl,
            { y: 20, opacity: 0 },
            { y: 0,  opacity: 1, duration: 0.4, delay: 0.1, ease: 'power3.out' }
          );
          break;

        case 'glitch':
          // Rapid x-jitter before settling
          gsap.fromTo(this.cardEl, { opacity: 0 }, { opacity: 1, duration: 0.15 });
          gsap.timeline()
            .fromTo(this.countEl, { x: -14, opacity: 0 }, { x: 0, opacity: 1, duration: 0.08 })
            .to(this.countEl, { x: 8,  duration: 0.06 })
            .to(this.countEl, { x: -6, duration: 0.05 })
            .to(this.countEl, { x: 4,  duration: 0.05 })
            .to(this.countEl, { x: 0,  duration: 0.12, ease: 'power2.out' });
          gsap.fromTo(this.iconEl,
            { scale: 1.5, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.3, ease: 'power3.out' }
          );
          break;

        case 'zoom':
          // Zooms from center with glow bloom
          gsap.fromTo(this.cardEl,
            { scale: 0.75, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)' }
          );
          gsap.fromTo(this.countEl,
            { scale: 2.5, opacity: 0, filter: 'blur(8px)' },
            { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.5, delay: 0.05, ease: 'power3.out' }
          );
          break;
      }
    };

    if (mode === 'first') {
      // No exit, just enter
      gsap.set(this.cardEl, { opacity: 0 });
      doEnter();
      return;
    }

    // Exit current card first, then enter
    const exitDir = mode === 'jump' ? -1 : 1;
    gsap.to(this.cardEl, {
      x: -28 * exitDir, opacity: 0, scale: 0.94,
      duration: 0.18, ease: 'power2.in',
      onComplete: () => {
        gsap.set(this.cardEl, { x: 0, scale: 1 });
        doEnter();
      },
    });
  }

  /* ── HERO 3D FLIP CYCLE ──────────────────── */

  private startHeroCycle() {
    if (this.heroTimer) clearInterval(this.heroTimer);
    this.heroTimer = window.setInterval(() => {
      this.toggleHeroMode();
    }, 3800);
  }

  private toggleHeroMode() {
    this.heroMode = this.heroMode === 'count' ? 'status' : 'count';
    this.animateHeroFlip();
  }

  private animateHeroFlip() {
    if (!this.heroCenterEl) return;

    // Smooth 3D vertical roll flip
    gsap.to(this.heroCenterEl, {
      rotationX: 90,
      opacity: 0,
      scale: 0.86,
      duration: 0.22,
      ease: 'power2.in',
      onComplete: () => {
        if (this.heroMode === 'count') {
          this.totalEl.classList.remove('zw--text-mode');
          this.heroLabelEl.classList.remove('zw--sub-mode');
          this.totalEl.textContent = String(this.totalBlocked);
          this.heroLabelEl.textContent = 'INTERCEPTED';
          this.heroLabelEl.style.color = '';
        } else {
          this.totalEl.classList.add('zw--text-mode');
          this.heroLabelEl.classList.add('zw--sub-mode');
          this.totalEl.textContent = this.isOn ? 'ACTIVE' : 'PAUSED';
          this.heroLabelEl.textContent = this.isOn ? '7 SHIELDS ACTIVE' : 'PROTECTION OFF';
          this.heroLabelEl.style.color = '';
        }

        gsap.fromTo(
          this.heroCenterEl,
          { rotationX: -90, opacity: 0, scale: 0.86 },
          {
            rotationX: 0,
            opacity: 1,
            scale: 1,
            duration: 0.45,
            ease: 'back.out(2)',
          }
        );
      },
    });
  }

  /* ── UTILITIES ───────────────────────────── */

  private countUp(el: HTMLElement, target: number) {
    const obj = { n: 0 };
    gsap.to(obj, {
      n: target, duration: 0.75, ease: 'power2.out',
      onUpdate: () => { el.textContent = String(Math.round(obj.n)); },
    });
  }

  private animateRing(fraction: number) {
    if (!this.ringFillEl) return;
    this.ringFillEl.style.strokeDashoffset = String(CIRC * (1 - Math.min(1, Math.max(0, fraction))));
  }

  private flipToggle() {
    this.isOn = !this.isOn;
    this.toggleBtn.setAttribute('aria-pressed', String(this.isOn));
    this.liveDotEl.classList.toggle('zw--off', !this.isOn);
    this.toggleTitle.textContent = this.isOn ? 'All Protections ON' : 'All Protections OFF';
    this.toggleTitle.classList.toggle('zw--off', !this.isOn);
    this.toggleSub.textContent   = this.isOn ? '7 shields active' : 'Protection paused';

    if (this.heroMode === 'status') {
      this.totalEl.textContent = this.isOn ? 'ACTIVE' : 'PAUSED';
      this.heroLabelEl.textContent = this.isOn ? '7 SHIELDS ACTIVE' : 'PROTECTION OFF';
    }

    const thumb = this.toggleBtn.querySelector<HTMLElement>('.zw-toggle-thumb');
    if (thumb) {
      gsap.timeline()
        .to(thumb, { scaleX: 1.35, duration: 0.1, ease: 'power2.in' })
        .to(thumb, { scaleX: 1,    duration: 0.25, ease: 'back.out(3)' });
    }
    this.toast(this.isOn ? '✅ Shields reactivated' : '⏸ Protections paused');
  }

  private pressAnim(el: HTMLElement) {
    gsap.timeline()
      .to(el, { scale: 0.88, duration: 0.07 })
      .to(el, { scale: 1,    duration: 0.18, ease: 'back.out(2)' });
  }

  private toast(msg: string) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMsgEl.textContent = msg;
    this.toastEl.classList.add('zw-toast--visible');
    gsap.fromTo(this.toastEl, { scale: 0.85, opacity: 0, y: 20 }, { scale: 1, opacity: 1, y: 0, duration: 0.25, ease: 'back.out(2)' });
    this.toastTimer = window.setTimeout(() => {
      gsap.to(this.toastEl, { opacity: 0, y: 14, scale: 0.93, duration: 0.18, ease: 'power2.in',
        onComplete: () => this.toastEl.classList.remove('zw-toast--visible') });
    }, 2600);
  }
}

new ZenWebPopupUI();
