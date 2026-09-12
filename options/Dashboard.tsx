import React, { useEffect, useRef, useState, useTransition } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import {
  Shield, ShieldCheck, ShieldAlert,
  Clock, Search, PinOff, VideoOff, ChefHat,
  Hammer, AlertTriangle, FileText, Lock,
  Sparkles, Check, RotateCcw, Sun, Moon,
  Heart, Coffee, ExternalLink,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  getSettings, updateSetting, saveSettings,
  DEFAULT_SETTINGS, getStats, resetStats, onSettingsChange, onStatsChange,
} from '@/utils/storage';
import { ZenWebSettings, ProtectionStats, SettingKey } from '@/types';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

/* ── Protection registry ─────────────────────────────── */
interface ProtectionItem {
  key: SettingKey;
  statKey: keyof Omit<ProtectionStats, 'totalTimeSavedSeconds'>;
  category: 'search' | 'browsing' | 'security';
  categoryLabel: string;
  name: string;
  description: string;
  targetScope: string;
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  statUnit: string;
}

const PROTECTIONS: ProtectionItem[] = [
  { key: 'fakeDownloadGuardEnabled', statKey: 'fakeDownloadsDefused', category: 'security', categoryLabel: 'Security & Privacy', name: 'Deceptive Download Guard',      description: 'Visibly flags and quarantines deceptive download advertising banners impersonating files.',                                 targetScope: 'File Portals & Mirrors',  icon: AlertTriangle, statUnit: 'trap banners defused'     },
  { key: 'humanSearchEnabled',       statKey: 'seoSpamFiltered',      category: 'search',   categoryLabel: 'Search & Discovery', name: 'Human Search Bypass',           description: 'Injects community discussions and forum filters into search engines to bypass bloated AI content mills.',                    targetScope: 'Google & Search Engines', icon: Search,        statUnit: 'spam results bypassed'    },
  { key: 'pinterestBlockerEnabled',  statKey: 'pinterestHidden',      category: 'search',   categoryLabel: 'Search & Discovery', name: 'Pinterest Wall Demolisher',     description: 'Silently conceals Pinterest boards and forced-signup preview walls from image search results.',                             targetScope: 'Image & Web Search',      icon: PinOff,        statUnit: 'walled pins hidden'       },
  { key: 'floatingVideoKillerEnabled',statKey: 'videosSuppressed',    category: 'browsing', categoryLabel: 'Reading & Media',    name: 'Sticky Video Suppressor',       description: 'Neutralizes picture-in-picture commercial players that float and follow your viewport scroll.',                            targetScope: 'News & Media Outlets',    icon: VideoOff,      statUnit: 'floating players silenced'},
  { key: 'recipeSkipperEnabled',     statKey: 'recipesSkipped',       category: 'browsing', categoryLabel: 'Reading & Media',    name: 'Recipe Story Fluff Skipper',   description: 'Parses recipe JSON-LD schema to auto-surface ingredients and instructions instantly without life stories.',                  targetScope: 'Food & Cooking Sites',    icon: ChefHat,       statUnit: 'stories skipped'          },
  { key: 'autoOverlaySmasherEnabled',statKey: 'overlaysSmashed',      category: 'browsing', categoryLabel: 'Reading & Media',    name: 'Modal & Paywall Smasher',      description: 'Detects screen-darkening newsletter modals, smashing backdrops and restoring scrolling.',                                  targetScope: 'All Webpages',            icon: Hammer,        statUnit: 'modals neutralized'       },
  { key: 'formSalvagerEnabled',      statKey: 'formsBackedUp',        category: 'security', categoryLabel: 'Security & Privacy', name: 'Form Salvager & Crash Guard', description: 'Continuously checkpoints in-progress text inputs into sandboxed storage to safeguard against tab crashes.',                targetScope: 'Forms & Textareas',       icon: FileText,      statUnit: 'forms autosaved'          },
];

const CATEGORY_TABS = [
  { id: 'all'      as const, label: 'All'      },
  { id: 'search'   as const, label: 'Search'   },
  { id: 'browsing' as const, label: 'Reading'  },
  { id: 'security' as const, label: 'Security' },
];

const DONATION_TIERS = [
  { amount: 3,  label: '$3',  perk: 'Coffee' },
  { amount: 5,  label: '$5',  perk: 'Supporter' },
  { amount: 10, label: '$10', perk: 'Patron' },
  { amount: 25, label: '$25', perk: 'Sponsor' },
];

/* ── cv() helper — reads a CSS var at runtime ────────── */
const cv = (name: string) => `var(${name})`;

/* ── formatTimeSaved ─────────────────────────────────── */
function formatTimeSaved(s: number) {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), r = s % 60;
  return r > 0 ? `${m}m ${r}s` : `${m}m`;
}

/* ─────────────────────────────────────────────────────────
   AnimatedNumber — counts up with GSAP when value changes
   BUG FIX: prevRef started at 0, so the first real value
   change (0 → N) was correctly detected, but if the
   component unmounted and remounted the animation skipped
   because prevRef.current === value after clearProps.
   Fixed by initialising prevRef to -1 (sentinel) so the
   very first render always sets the textContent correctly
   and the first non-zero value always animates.
   ───────────────────────────────────────────────────────── */
function AnimatedNumber({ value, style }: { value: number; style?: React.CSSProperties }) {
  const elRef   = useRef<HTMLSpanElement>(null);
  const prevRef = useRef<number>(-1);           // -1 sentinel: "not yet rendered"
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    if (!elRef.current) return;

    // First render: just set text, no animation
    if (prevRef.current === -1) {
      elRef.current.textContent = String(value);
      prevRef.current = value;
      return;
    }

    if (value === prevRef.current) return;

    tweenRef.current?.kill();
    const from = prevRef.current;
    prevRef.current = value;
    const obj = { val: from };
    tweenRef.current = gsap.to(obj, {
      val: value,
      duration: 1.6,
      ease: 'power3.out',
      onUpdate() { if (elRef.current) elRef.current.textContent = String(Math.round(obj.val)); },
    });
    return () => { tweenRef.current?.kill(); };
  }, [value]);

  return <span ref={elRef} style={style}>{value}</span>;
}

/* ─────────────────────────────────────────────────────────
   Dashboard
   ───────────────────────────────────────────────────────── */
export function Dashboard() {
  /* state */
  const [settings, setSettings]         = useState<ZenWebSettings>(DEFAULT_SETTINGS);
  const [stats,    setStats]            = useState<ProtectionStats>({ seoSpamFiltered:0, pinterestHidden:0, videosSuppressed:0, recipesSkipped:0, overlaysSmashed:0, fakeDownloadsDefused:0, formsBackedUp:0, totalTimeSavedSeconds:0 });
  const [activeCategory, setActiveCategory] = useState<'all'|'search'|'browsing'|'security'>('all');
  const [darkMode, setDarkMode]         = useState(false);
  const [toastMsg, setToastMsg]         = useState<string|null>(null);
  const [donationTier, setDonationTier] = useState<number>(5);
  const [, startTransition]             = useTransition();

  /* refs for GSAP */
  const rootRef          = useRef<HTMLDivElement>(null);
  const gridRef          = useRef<HTMLDivElement>(null);
  const toastRef         = useRef<HTMLDivElement>(null);
  // BUG FIX: Lucide icons don't forward refs to SVG elements.
  // We animate the wrapper <span> instead.
  const themeIconWrapRef = useRef<HTMLSpanElement>(null);
  const isFilterAnim     = useRef(false);
  // BUG FIX: Safety valve — if animation is still "in progress"
  // after 600ms (e.g. rapid clicks), force-unlock the guard.
  const filterAnimTimer  = useRef<number | null>(null);
  const hasMounted       = useRef(false);  // guards category useEffect on initial mount
  const toastTween       = useRef<gsap.core.Timeline|null>(null);
  const toastTimer       = useRef<number|null>(null);

  /* ── load ── */
  useEffect(() => {
    const saved = localStorage.getItem('zw-theme');
    const prefersDark = saved === 'dark' ? true : saved === 'light' ? false : window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(prefersDark);
    // BUG FIX: body background doesn't inherit data-theme from child div,
    // so overscroll (bounce on macOS / momentum scroll) shows the wrong body bg.
    // Sync body background directly whenever theme changes.
    document.body.style.backgroundColor = prefersDark ? '#000000' : '#f5f5f7';

    async function load() {
      const [s, st] = await Promise.all([getSettings(), getStats()]);
      startTransition(() => { setSettings(s); setStats(st); });
    }
    load();
    onSettingsChange(setSettings);
    onStatsChange((newStats) => {
      startTransition(() => { setStats(newStats); });
    });
  }, []);

  /* ── PAGE ENTRANCE ANIMATION ──────────────────────────
     Runs once on mount. Each block slides up + fades in
     with a stagger. data-gsap-hidden prevents FOUC.
  ─────────────────────────────────────────────────────── */
  useEffect(() => {
    const ctx = gsap.context(() => {
      /* Main blocks stagger */
      gsap.fromTo(
        '[data-block]',
        { y: 28, opacity: 0, filter: 'blur(4px)' },
        {
          y: 0, opacity: 1, filter: 'blur(0px)',
          duration: 0.72,
          stagger: 0.09,
          ease: 'power3.out',
          delay: 0.05,
          clearProps: 'filter',   // GPU-heavy — remove after done
        }
      );

      /* Protection cards stagger (delayed after blocks) */
      gsap.fromTo(
        '[data-card]',
        { y: 20, opacity: 0 },
        {
          y: 0, opacity: 1,
          duration: 0.55,
          stagger: 0.07,
          ease: 'power3.out',
          delay: 0.55,
          // NOTE: clearProps intentionally omitted so GSAP
          // can re-animate on category switch cleanly.
          onComplete() {
            // Give React back control of opacity (for active/inactive dimming)
            gsap.set('[data-card]', { clearProps: 'opacity,transform' });
          },
        }
      );

      /* Header slides down from slightly above */
      gsap.fromTo(
        '[data-header]',
        { y: -12, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.55, ease: 'power3.out', delay: 0 }
      );

      /* ScrollTrigger reveals for below-fold sections */
      gsap.utils.toArray<HTMLElement>('[data-scroll-reveal]').forEach((el) => {
        gsap.from(el, {
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
            toggleActions: 'play none none none',
          },
          y: 20,
          opacity: 0,
          duration: 0.6,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
        });
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  /* ── CATEGORY FILTER ANIMATION ────────────────────────
     Exit current cards → update state → enter new cards
  ─────────────────────────────────────────────────────── */
  const handleCategoryChange = (cat: typeof activeCategory) => {
    if (cat === activeCategory || isFilterAnim.current) return;

    const cards = gridRef.current?.querySelectorAll<HTMLElement>('[data-card]');
    if (!cards || cards.length === 0) { setActiveCategory(cat); return; }

    isFilterAnim.current = true;

    // BUG FIX: safety valve — force-unlock after 600ms so rapid
    // clicks don't permanently deadlock the filter tabs.
    if (filterAnimTimer.current) clearTimeout(filterAnimTimer.current);
    filterAnimTimer.current = window.setTimeout(() => {
      isFilterAnim.current = false;
    }, 600);

    gsap.to(Array.from(cards), {
      opacity: 0,
      y: -10,
      duration: 0.18,
      stagger: 0.025,
      ease: 'power2.in',
      onComplete: () => setActiveCategory(cat),
    });
  };

  /* BUG FIX: hasMounted guard prevents the enter animation
     from firing on initial mount, which would double-animate
     on top of the page entrance stagger. */
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    const cards = gridRef.current?.querySelectorAll<HTMLElement>('[data-card]');
    if (!cards || cards.length === 0) return;

    gsap.fromTo(
      Array.from(cards),
      { opacity: 0, y: 18 },
      {
        opacity: 1,
        y: 0,
        duration: 0.42,
        stagger: 0.065,
        ease: 'power3.out',
        onComplete() {
          gsap.set(Array.from(cards), { clearProps: 'opacity,transform' });
          isFilterAnim.current = false;
          if (filterAnimTimer.current) {
            clearTimeout(filterAnimTimer.current);
            filterAnimTimer.current = null;
          }
        },
      }
    );
  }, [activeCategory]);

  /* ── THEME TOGGLE ANIMATION ───────────────────────────
     BUG FIX: Lucide icons don't forward refs to their SVG
     elements. We animate the wrapper <span> instead.
  ─────────────────────────────────────────────────────── */
  const toggleTheme = () => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('zw-theme', next ? 'dark' : 'light');
      // Sync body background to prevent overscroll flash
      document.body.style.backgroundColor = next ? '#000000' : '#f5f5f7';
      return next;
    });
    // Animate the wrapper span (Lucide doesn't forward ref to SVG)
    if (themeIconWrapRef.current) {
      gsap.fromTo(
        themeIconWrapRef.current,
        { rotate: 0, scale: 1 },
        { rotate: 25, scale: 1.25, duration: 0.16, ease: 'power2.out',
          yoyo: true, repeat: 1,
          onComplete: () => gsap.set(themeIconWrapRef.current!, { clearProps: 'all' }) }
      );
    }
  };

  /* ── TOAST ANIMATION ──────────────────────────────────
     GSAP timeline so enter/exit are sequenced properly
  ─────────────────────────────────────────────────────── */
  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTween.current?.kill();

    setToastMsg(msg);

    // Brief delay so React mounts the toast element first
    requestAnimationFrame(() => {
      if (!toastRef.current) return;
      const tl = gsap.timeline();
      tl.fromTo(
        toastRef.current,
        { y: 16, opacity: 0, scale: 0.92 },
        { y: 0, opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(1.6)' }
      );
      toastTween.current = tl;
    });

    toastTimer.current = window.setTimeout(() => {
      if (!toastRef.current) { setToastMsg(null); return; }
      const tl = gsap.timeline({ onComplete: () => setToastMsg(null) });
      tl.to(toastRef.current, { y: 10, opacity: 0, scale: 0.94, duration: 0.22, ease: 'power2.in' });
      toastTween.current = tl;
    }, 2200);
  };

  /* ── handlers ── */
  const handleToggleMaster = async (checked: boolean) => {
    const u = await updateSetting('masterEnabled', checked);
    setSettings(u);
    showToast(checked ? 'All ZenWeb shields activated' : 'Master protection paused');
  };

  const handleToggleSetting = async (key: SettingKey, checked: boolean, name: string) => {
    const u = await updateSetting(key, checked);
    setSettings(u);
    showToast(`${name} ${checked ? 'enabled' : 'disabled'}`);

    /* Pulse the card that was toggled */
    const card = gridRef.current?.querySelector<HTMLElement>(`[data-key="${key}"]`);
    if (card) {
      gsap.fromTo(
        card,
        { scale: 1 },
        { scale: 1.018, duration: 0.14, ease: 'power2.out', yoyo: true, repeat: 1,
          onComplete: () => gsap.set(card, { clearProps: 'scale' }) }
      );
    }
  };

  const handleResetDefaults = async () => {
    await saveSettings(DEFAULT_SETTINGS);
    setSettings(DEFAULT_SETTINGS);
    showToast('Settings restored to defaults');
  };

  const handleResetStats = async () => {
    const f = await resetStats();
    setStats(f);
    showToast('Stats cleared');
  };

  /* ── derived ── */
  const filteredProtections = PROTECTIONS.filter(
    (p) => activeCategory === 'all' || p.category === activeCategory
  );
  const activeCount = PROTECTIONS.filter(
    (p) => settings.masterEnabled && settings[p.key] === true
  ).length;
  const total = stats.seoSpamFiltered + stats.pinterestHidden + stats.videosSuppressed +
                stats.recipesSkipped + stats.overlaysSmashed + stats.fakeDownloadsDefused +
                stats.formsBackedUp;

  /* ── render ── */
  return (
    <div
      ref={rootRef}
      data-theme={darkMode ? 'dark' : 'light'}
      style={{ minHeight: '100vh', backgroundColor: cv('--zw-bg-page'), color: cv('--zw-text-primary'), transition: 'background-color 0.35s ease, color 0.25s ease' }}
      className="antialiased"
    >

      {/* ── Frosted header ────────────────────────────── */}
      <header
        data-header
        className="apple-subnav-frosted sticky top-0 z-40 w-full"
        style={{ borderBottom: `1px solid ${cv('--zw-border-nav')}`, height: 56 }}
      >
        <div className="mx-auto flex h-full items-center justify-between px-6 sm:px-10" style={{ maxWidth: 1040 }}>
          {/* Wordmark */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-[10px]"
              style={{ width: 32, height: 32, backgroundColor: cv('--zw-text-primary'), color: cv('--zw-bg-page'), transition: 'background-color 0.35s, color 0.35s' }}
            >
              <Shield style={{ width: 16, height: 16, strokeWidth: 2.2 }} />
            </div>
            <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.022em', color: cv('--zw-text-primary') }}>
              ZenWeb
            </span>
            <span
              className="rounded-full px-2 py-0.5"
              style={{ fontSize: 11, fontWeight: 500, backgroundColor: cv('--zw-bg-chip'), color: cv('--zw-text-tertiary') }}
            >
              v1.0
            </span>
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-4">
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1"
              style={{ fontSize: 12, fontWeight: 500, backgroundColor: cv('--zw-bg-status'), color: cv('--zw-text-primary'), border: `1px solid ${cv('--zw-border-status')}` }}
            >
              <span className="inline-block rounded-full" style={{ width: 7, height: 7, backgroundColor: settings.masterEnabled ? '#34c759' : '#ff9500', transition: 'background-color 0.3s' }} />
              {settings.masterEnabled ? `${activeCount} of 7 Active` : 'Paused'}
            </div>

            <button onClick={handleResetDefaults} className="apple-press apple-link hidden items-center gap-1 sm:flex" style={{ fontSize: 12 }}>
              <RotateCcw style={{ width: 11, height: 11 }} />
              Defaults
            </button>

            <button onClick={handleResetStats} className="apple-press apple-link" style={{ fontSize: 12 }}>
              Clear Stats
            </button>

            {/* Theme toggle — BUG FIX: icon wrapped in span so GSAP
                can animate the wrapper (Lucide icons don't forward refs) */}
            <button onClick={toggleTheme} className="theme-toggle" aria-label={darkMode ? 'Light mode' : 'Dark mode'}>
              <span ref={themeIconWrapRef} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {darkMode ? <Sun style={{ width: 14, height: 14 }} /> : <Moon style={{ width: 14, height: 14 }} />}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main content ──────────────────────────────── */}
      <main className="mx-auto flex flex-col gap-8 px-6 py-10 sm:px-10" style={{ maxWidth: 1040 }}>

        {/* ── Master card ────── */}
        <div data-block className="apple-card p-6 sm:p-7">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div
                className="flex shrink-0 items-center justify-center rounded-full"
                style={{ width: 48, height: 48, backgroundColor: settings.masterEnabled ? cv('--zw-bg-master-icon-on') : cv('--zw-bg-master-icon-off'), color: settings.masterEnabled ? '#34c759' : cv('--zw-text-tertiary'), transition: 'background-color 0.3s, color 0.3s' }}
              >
                {settings.masterEnabled
                  ? <ShieldCheck style={{ width: 24, height: 24, strokeWidth: 2.2 }} />
                  : <ShieldAlert  style={{ width: 24, height: 24, strokeWidth: 2.2 }} />
                }
              </div>

              <div>
                <div className="flex items-center gap-2.5" style={{ marginBottom: 6 }}>
                  <h1 className="apple-display-lg" style={{ fontSize: 19, margin: 0, color: cv('--zw-text-primary') }}>
                    Master Protection Suite
                  </h1>
                  <span
                    className="rounded-full px-2 py-0.5"
                    style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', backgroundColor: settings.masterEnabled ? 'rgba(52,199,89,0.14)' : cv('--zw-bg-chip'), color: settings.masterEnabled ? '#34c759' : cv('--zw-text-tertiary'), transition: 'background-color 0.3s, color 0.3s' }}
                  >
                    {settings.masterEnabled ? 'Active' : 'Paused'}
                  </span>
                </div>
                <p style={{ fontSize: 14, color: cv('--zw-text-secondary'), lineHeight: 1.43, margin: 0, maxWidth: 480 }}>
                  {settings.masterEnabled
                    ? 'All active shields are monitoring webpages, suppressing distractions, and defusing traps.'
                    : 'Master suite is paused. No scripts will alter webpages until re-enabled.'}
                </p>
              </div>
            </div>

            <div className="shrink-0 self-end sm:self-center">
              <Switch checked={settings.masterEnabled} onCheckedChange={handleToggleMaster} aria-label="Master protection toggle" className="scale-110" />
            </div>
          </div>
        </div>

        {/* ── Stats ────────── */}
        <section data-block>
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="apple-section-label">Session Activity</span>
            <span style={{ fontSize: 11, color: cv('--zw-text-tertiary') }}>Stored locally</span>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Time Saved"          value={formatTimeSaved(stats.totalTimeSavedSeconds)} rawValue={stats.totalTimeSavedSeconds} sub="~15s avg per block"                                           icon={<Clock      style={{ width: 15, height: 15, color: cv('--zw-text-link') }} />} isTime />
            <StatCard label="Search Cleaned"      value={null} rawValue={stats.seoSpamFiltered + stats.pinterestHidden}                                   sub={`${stats.seoSpamFiltered} SEO · ${stats.pinterestHidden} Pinterest`}           icon={<Search     style={{ width: 15, height: 15, color: cv('--zw-text-link') }} />} />
            <StatCard label="Intrusions Blocked"  value={null} rawValue={stats.overlaysSmashed + stats.videosSuppressed}                                  sub={`${stats.overlaysSmashed} modals · ${stats.videosSuppressed} videos`}          icon={<Hammer     style={{ width: 15, height: 15, color: cv('--zw-text-link') }} />} />
            <StatCard label="Total Events"        value={null} rawValue={total}                                                                           sub={`${stats.recipesSkipped} recipes · ${stats.formsBackedUp} forms`}             icon={<Sparkles   style={{ width: 15, height: 15, color: cv('--zw-text-link') }} />} />
          </div>
        </section>

        {/* ── Shields ──────── */}
        <section data-block>
          {/* Header + filter */}
          <div className="mb-4 flex flex-col gap-3 px-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="apple-display-lg" style={{ fontSize: 21, margin: 0, color: cv('--zw-text-primary') }}>
                Individual Shields
              </h2>
              <p style={{ fontSize: 14, color: cv('--zw-text-secondary'), margin: '4px 0 0', lineHeight: 1.43 }}>
                Toggles apply immediately across all active tabs.
              </p>
            </div>

            {/* Segmented control */}
            <div className="inline-flex self-start rounded-full p-[3px] sm:self-auto" style={{ backgroundColor: cv('--zw-bg-chip'), gap: 2 }}>
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleCategoryChange(tab.id)}
                  className="apple-press rounded-full"
                  style={{
                    padding: '4px 12px', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
                    backgroundColor: activeCategory === tab.id ? cv('--zw-bg-chip-sel') : 'transparent',
                    color: activeCategory === tab.id ? cv('--zw-text-primary') : cv('--zw-text-tertiary'),
                    boxShadow: activeCategory === tab.id ? cv('--zw-chip-sel-shadow') : 'none',
                    transition: 'background-color 0.15s, color 0.15s',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cards grid */}
          <div ref={gridRef} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredProtections.map((item) => {
              const isEnabled = Boolean(settings[item.key]);
              const isActive  = settings.masterEnabled && isEnabled;
              const Icon      = item.icon;

              return (
                <div
                  key={item.key}
                  data-card
                  data-key={item.key}
                  className="apple-card flex flex-col justify-between gap-5 p-6"
                  style={{ opacity: isActive ? 1 : 0.56, transition: 'opacity 0.25s ease, background-color 0.35s, border-color 0.35s' }}
                >
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: cv('--zw-text-link') }}>
                        {item.categoryLabel}
                      </span>
                      <span className="rounded-full px-2 py-0.5" style={{ fontSize: 11, color: cv('--zw-text-muted-badge'), backgroundColor: cv('--zw-bg-scope'), border: `1px solid ${cv('--zw-border-scope')}` }}>
                        {item.targetScope}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex shrink-0 items-center justify-center rounded-[10px]" style={{ width: 36, height: 36, backgroundColor: cv('--zw-bg-icon'), border: `1px solid ${cv('--zw-border-card')}` }}>
                        <Icon style={{ width: 17, height: 17, strokeWidth: 2, color: cv('--zw-text-primary') } as React.CSSProperties} />
                      </div>
                      <h3 className="apple-body-strong" style={{ margin: 0, color: cv('--zw-text-primary') }}>
                        {item.name}
                      </h3>
                    </div>

                    <p style={{ fontSize: 14, color: cv('--zw-text-secondary'), lineHeight: 1.43, margin: 0 }}>
                      {item.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4" style={{ borderTop: `1px solid ${cv('--zw-border-divider')}` }}>
                    <div className="flex items-center gap-1.5" style={{ fontSize: 12, color: cv('--zw-text-tertiary') }}>
                      <span className="inline-block rounded-full bg-[#34c759]" style={{ width: 6, height: 6 }} />
                      <strong style={{ fontWeight: 600, color: cv('--zw-text-primary') }}>
                        <AnimatedNumber value={stats[item.statKey]} />
                      </strong>
                      &nbsp;{item.statUnit}
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span style={{ fontSize: 11, color: cv('--zw-text-tertiary'), fontWeight: 500 }}>
                        {isActive ? 'On' : 'Off'}
                      </span>
                      <Switch
                        checked={isEnabled}
                        disabled={!settings.masterEnabled}
                        onCheckedChange={(v) => handleToggleSetting(item.key, v, item.name)}
                        aria-label={`Toggle ${item.name}`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Privacy notice ── */}
        <div data-scroll-reveal className="apple-card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex shrink-0 items-center justify-center rounded-full" style={{ width: 40, height: 40, backgroundColor: cv('--zw-bg-privacy'), color: cv('--zw-text-privacy') }}>
              <Lock style={{ width: 18, height: 18, strokeWidth: 2 }} />
            </div>
            <div>
              <p className="apple-body-strong" style={{ margin: 0, fontSize: 15, color: cv('--zw-text-primary') }}>
                Zero Telemetry Architecture
              </p>
              <p style={{ fontSize: 13, color: cv('--zw-text-secondary'), margin: '3px 0 0', lineHeight: 1.43 }}>
                All processing happens locally. No URLs, queries, or history ever leave your device.
              </p>
            </div>
          </div>
          <span className="shrink-0 self-start rounded-full sm:self-auto" style={{ fontSize: 11, fontWeight: 600, color: cv('--zw-text-badge-privacy'), backgroundColor: cv('--zw-bg-privacy'), padding: '4px 12px' }}>
            Local Only
          </span>
        </div>

        {/* ── Footer ─────── */}
        <footer
          data-scroll-reveal
          className="flex flex-col gap-6 pb-12 pt-6"
          style={{ borderTop: `1px solid ${cv('--zw-border-footer')}` }}
        >
          {/* Donation / Support Card */}
          <div
            className="apple-card flex flex-col gap-5 p-6"
            style={{
              backgroundColor: cv('--zw-bg-card'),
              border: `1px solid ${cv('--zw-border-card')}`,
            }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3.5">
                <div
                  className="flex shrink-0 items-center justify-center rounded-[10px]"
                  style={{
                    width: 40,
                    height: 40,
                    backgroundColor: cv('--zw-bg-privacy'),
                    border: `1px solid ${cv('--zw-border-card')}`,
                  }}
                >
                  <Heart style={{ width: 18, height: 18, strokeWidth: 2, color: '#ff2d55', fill: '#ff2d55' }} />
                </div>
                <div>
                  <h3
                    className="apple-body-strong"
                    style={{ margin: 0, fontSize: 16, color: cv('--zw-text-primary') }}
                  >
                    Support ZenWeb Development
                  </h3>
                  <p
                    style={{
                      fontSize: 13,
                      color: cv('--zw-text-secondary'),
                      margin: '4px 0 0',
                      lineHeight: 1.43,
                      maxWidth: 560,
                    }}
                  >
                    ZenWeb is free and built without ads, telemetry, or venture funding.
                    If it saves your sanity and cleans up your browsing, consider supporting ongoing independent maintenance.
                  </p>
                </div>
              </div>

              <span
                className="shrink-0 self-start rounded-full sm:self-auto"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: cv('--zw-text-tertiary'),
                  backgroundColor: cv('--zw-bg-scope'),
                  border: `1px solid ${cv('--zw-border-scope')}`,
                  padding: '3px 10px',
                }}
              >
                Community Funded
              </span>
            </div>

            {/* Donation tiers and quick actions */}
            <div
              className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-between"
              style={{ borderTop: `1px solid ${cv('--zw-border-divider')}` }}
            >
              {/* Preset tier pills */}
              <div className="flex flex-wrap items-center gap-2">
                <span style={{ fontSize: 12, fontWeight: 500, color: cv('--zw-text-tertiary'), marginRight: 2 }}>
                  Tip Jar:
                </span>
                {DONATION_TIERS.map((tier) => {
                  const isSelected = donationTier === tier.amount;
                  return (
                    <button
                      key={tier.amount}
                      type="button"
                      onClick={() => setDonationTier(tier.amount)}
                      className="apple-press rounded-full"
                      style={{
                        padding: '4px 12px',
                        fontSize: 12,
                        fontWeight: isSelected ? 600 : 500,
                        cursor: 'pointer',
                        border: isSelected
                          ? `1px solid ${cv('--zw-text-link')}`
                          : `1px solid ${cv('--zw-border-scope')}`,
                        backgroundColor: isSelected
                          ? cv('--zw-bg-privacy')
                          : cv('--zw-bg-scope'),
                        color: isSelected
                          ? cv('--zw-text-link')
                          : cv('--zw-text-secondary'),
                        transition: 'border-color 0.15s, background-color 0.15s, color 0.15s',
                      }}
                    >
                      <span>{tier.label}</span>
                      <span style={{ opacity: 0.75, marginLeft: 4, fontSize: 10 }}>{tier.perk}</span>
                    </button>
                  );
                })}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                <a
                  href="https://github.com/sponsors/shibasishdas043"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => showToast(`Thank you for sponsoring $${donationTier}! ❤️`)}
                  className="apple-press inline-flex items-center gap-1.5 rounded-full"
                  style={{
                    backgroundColor: cv('--zw-text-link'),
                    color: '#ffffff',
                    padding: '6px 16px',
                    fontSize: 12,
                    fontWeight: 600,
                    textDecoration: 'none',
                    border: 'none',
                  }}
                >
                  <Heart style={{ width: 12, height: 12, fill: '#ffffff', stroke: '#ffffff' }} />
                  <span>Sponsor ${donationTier}</span>
                  <ExternalLink style={{ width: 11, height: 11, opacity: 0.8 }} />
                </a>

                <a
                  href="https://buymeacoffee.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => showToast('Thank you for buying us a coffee! ☕')}
                  className="apple-press inline-flex items-center gap-1.5 rounded-full"
                  style={{
                    backgroundColor: cv('--zw-bg-scope'),
                    border: `1px solid ${cv('--zw-border-card')}`,
                    color: cv('--zw-text-primary'),
                    padding: '6px 14px',
                    fontSize: 12,
                    fontWeight: 500,
                    textDecoration: 'none',
                  }}
                >
                  <Coffee style={{ width: 13, height: 13, color: cv('--zw-text-secondary') }} />
                  <span>Buy a Coffee</span>
                </a>
              </div>
            </div>
          </div>

          {/* Bottom metadata row */}
          <div
            className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between"
            style={{ color: cv('--zw-text-tertiary') }}
          >
            <span>ZenWeb Digital Peace Suite · Manifest V3</span>
            <span>Zero Tracking · 100% Client-Side Privacy</span>
          </div>
        </footer>
      </main>

      {/* ── Toast ─────────────────────────────────────── */}
      {/* BUG FIX: border was hardcoded rgba(255,255,255,0.08) —
          invisible on light mode (white pill on white bg).
          Now uses --zw-toast-border token which is opaque in light. */}
      {toastMsg && (
        <div ref={toastRef} className="fixed bottom-6 right-6 z-50" style={{ opacity: 0 }}>
          <div
            className="flex items-center gap-2 rounded-full"
            style={{
              backgroundColor: cv('--zw-toast-bg'),
              color: cv('--zw-toast-text'),
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              border: `1px solid ${cv('--zw-toast-border')}`,
            }}
          >
            <Check style={{ width: 14, height: 14, color: '#34c759', strokeWidth: 2.5 }} />
            <span>{toastMsg}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── StatCard ─────────────────────────────────────────── */
function StatCard({ label, value, rawValue, sub, icon, isTime }: {
  label: string;
  value: string | null;   // pass pre-formatted string for time, null for numbers
  rawValue: number;
  sub: string;
  icon: React.ReactNode;
  isTime?: boolean;
}) {
  return (
    <div className="apple-card flex flex-col justify-between gap-3 p-5">
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--zw-text-secondary)' }}>{label}</span>
        {icon}
      </div>
      <div>
        <div className="apple-display-lg" style={{ fontSize: 34, lineHeight: 1, letterSpacing: '-0.03em', fontWeight: 600, color: 'var(--zw-text-primary)' }}>
          {isTime
            ? value                          // time string e.g. "3m 12s" — no counter animation
            : <AnimatedNumber value={rawValue} />
          }
        </div>
        <p style={{ fontSize: 11, color: 'var(--zw-text-tertiary)', marginTop: 6, lineHeight: 1.3 }}>{sub}</p>
      </div>
    </div>
  );
}
