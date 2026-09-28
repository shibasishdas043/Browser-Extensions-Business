import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import {
  Shield, ShieldCheck, ShieldAlert,
  Clock, Search, PinOff, VideoOff, ChefHat,
  AlertTriangle, FileText, Lock,
  Sparkles, Check, RotateCcw,
  Heart, Coffee, ExternalLink, Archive, Copy, Trash2, X, CheckCircle2,
  Globe, Download, Upload, Command, Plus, Layers,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  getSettings, updateSetting, saveSettings,
  DEFAULT_SETTINGS, getStats, resetStats, onSettingsChange, onStatsChange,
  addDomainToWhitelist, removeDomainFromWhitelist,
  exportSettingsAndDraftsWithMeta, importSettingsAndDrafts,
} from '@/utils/storage';
import { ZenWebSettings, ProtectionStats, SettingKey } from '@/types';
import { getAllSavedDrafts, deleteSavedDraft, StoredDraft } from '@/features/form-salvager/logic';
import { VaultSearchEngine, HighlightMatches, WebsiteDraftGroup, FormSectionGroup } from './vaultSearch';

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
  { key: 'fakeDownloadGuardEnabled', statKey: 'fakeDownloadsDefused', category: 'security', categoryLabel: 'Security & Privacy', name: 'Deceptive Download Guard',      description: 'Flags and blocks fake "Download" buttons and ad traps.',                                    targetScope: 'File Portals & Mirrors',  icon: AlertTriangle, statUnit: 'trap banners defused'     },
  { key: 'formSalvagerEnabled',      statKey: 'formsBackedUp',        category: 'security', categoryLabel: 'Security & Privacy', name: 'Form Salvager & Crash Guard', description: 'Auto-saves text you type so you never lose drafts if a tab crashes.',                       targetScope: 'Forms & Textareas',       icon: FileText,      statUnit: 'forms autosaved'          },
  { key: 'humanSearchEnabled',       statKey: 'seoSpamFiltered',      category: 'search',   categoryLabel: 'Search & Discovery', name: 'Human Search Bypass',           description: 'Surfaces real forum discussions and filters out AI search spam.',                            targetScope: 'Google & Search Engines', icon: Search,        statUnit: 'spam results bypassed'    },
  { key: 'pinterestBlockerEnabled',  statKey: 'pinterestHidden',      category: 'search',   categoryLabel: 'Search & Discovery', name: 'Pinterest Wall Demolisher',     description: 'Hides Pinterest clutter and forced login walls from search results.',                        targetScope: 'Image & Web Search',      icon: PinOff,        statUnit: 'walled pins hidden'       },
  { key: 'floatingVideoKillerEnabled',statKey: 'videosSuppressed',    category: 'browsing', categoryLabel: 'Reading & Media',    name: 'Sticky Video Suppressor',       description: 'Stops annoying floating video ads that follow you as you scroll.',                           targetScope: 'News & Media Outlets',    icon: VideoOff,      statUnit: 'floating players silenced'},
  { key: 'recipeSkipperEnabled',     statKey: 'recipesSkipped',       category: 'browsing', categoryLabel: 'Reading & Media',    name: 'Recipe Story Fluff Skipper',   description: 'Skips long life stories and jumps straight to the recipe ingredients.',                      targetScope: 'Food & Cooking Sites',    icon: ChefHat,       statUnit: 'stories skipped'          },
  { key: 'recipeReaderEnabled',      statKey: 'recipesSkipped',       category: 'browsing', categoryLabel: 'Reading & Media',    name: 'Recipe Reader View',           description: 'Opens a clean reader with ingredient checklists and clear steps.',                           targetScope: 'Food & Cooking Sites',    icon: ChefHat,       statUnit: 'clean views generated'    },
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

/* ── Saved Drafts Vault Helpers ─────────────────────────── */

function formatReadableName(str: string): string {
  return str
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function parseDraftMetadata(draft: StoredDraft) {
  let domain = 'unknown';
  let path = '';
  try {
    const rawUrl = draft.url || draft.siteUrl || '';
    const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    domain = parsed.hostname.replace(/^www\./, '');
    path = parsed.pathname;
  } catch {
    domain = (draft.url || '').split('/')[0] || 'unknown';
  }

  const formMatch = draft.fieldKey.match(/::form\[([^\]]+)\]/);
  const rawFormId = formMatch ? formMatch[1].trim() : 'no-form';

  let formName = 'Main Form';
  let sectionId = rawFormId;

  if (rawFormId === 'no-form' || rawFormId === 'idx_0' || !rawFormId) {
    if (path && path !== '/') {
      const cleanPath = path.replace(/^\/|\/$/g, '');
      const pathSegment = cleanPath.split('/').pop() || cleanPath;
      formName = formatReadableName(pathSegment) + ' Form';
      sectionId = `path_${cleanPath}`;
    } else {
      formName = 'Default Form';
      sectionId = 'default_form';
    }
  } else if (rawFormId.startsWith('idx_')) {
    const num = parseInt(rawFormId.replace('idx_', ''), 10) + 1;
    formName = `Form Section #${num}`;
    sectionId = rawFormId;
  } else {
    formName = formatReadableName(rawFormId);
    sectionId = rawFormId;
  }

  return { domain, path, formName, sectionId };
}

function WebsiteFavicon({ domain, size = 18 }: { domain: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <Globe style={{ width: size, height: size, color: '#15803d' }} className="flex-shrink-0" />;
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt={domain}
      style={{ width: size, height: size }}
      className="rounded-sm flex-shrink-0"
      onError={() => setFailed(true)}
    />
  );
}

/* ─────────────────────────────────────────────────────────
   Dashboard
   ───────────────────────────────────────────────────────── */
export function Dashboard() {
  /* state */
  const [settings, setSettings]         = useState<ZenWebSettings>(DEFAULT_SETTINGS);
  const [stats,    setStats]            = useState<ProtectionStats>({ seoSpamFiltered:0, pinterestHidden:0, videosSuppressed:0, recipesSkipped:0, fakeDownloadsDefused:0, formsBackedUp:0, totalTimeSavedSeconds:0 });
  const [activeCategory, setActiveCategory] = useState<'all'|'search'|'browsing'|'security'>('all');
  const [toastMsg, setToastMsg]         = useState<string|null>(null);
  const [donationTier, setDonationTier] = useState<number>(5);
  const [vaultOpen, setVaultOpen]       = useState(false);
  const [vaultDrafts, setVaultDrafts]   = useState<StoredDraft[]>([]);
  const [copiedKey, setCopiedKey]       = useState<string | null>(null);
  const [newDomain, setNewDomain]       = useState('');
  const [isImporting, setIsImporting]   = useState(false);
  const [isDraggingBackup, setIsDraggingBackup] = useState(false);
  const fileInputRef                    = useRef<HTMLInputElement>(null);
  const [, startTransition]             = useTransition();
  const isMacClient                     = typeof navigator !== 'undefined' && (
    /Mac/i.test((navigator as any).userAgentData?.platform || '') ||
    /Mac|iPhone|iPad|iPod/i.test(navigator.platform || '') ||
    /Macintosh|Mac OS X/i.test(navigator.userAgent || '')
  );
  const [shortcutOS, setShortcutOS]     = useState<'mac' | 'win'>(() => (isMacClient ? 'mac' : 'win'));

  const handleOpenVault = useCallback(async () => {
    const drafts = await getAllSavedDrafts();
    setVaultDrafts(drafts);
    setVaultOpen(true);
    if (window.location.hash !== '#vault') {
      history.replaceState(null, '', '#vault');
    }
  }, []);

  const handleCloseVault = useCallback(() => {
    setVaultOpen(false);
    if (window.location.hash === '#vault') {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  /* ── Hash routing for #vault ────────────────────────── */
  useEffect(() => {
    const checkHash = () => {
      if (window.location.hash === '#vault') {
        handleOpenVault();
      } else {
        setVaultOpen(false);
      }
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => {
      window.removeEventListener('hashchange', checkHash);
    };
  }, [handleOpenVault]);

  /* ── Escape key closes vault ────────────────────────── */
  useEffect(() => {
    if (!vaultOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseVault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [vaultOpen, handleCloseVault]);

  const handleCopyDraft = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    showToast('Copied draft to clipboard');
  };

  const handleDeleteDraft = async (key: string) => {
    await deleteSavedDraft(key);
    setVaultDrafts((prev) => prev.filter((d) => d.fieldKey !== key));
    showToast('Draft removed from storage');
  };

  const [selectedWebsite, setSelectedWebsite] = useState<string | null>(null);
  const [vaultSearchQuery, setVaultSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(vaultSearchQuery);

  const groupedWebsites = useMemo(() => {
    const map = new Map<string, WebsiteDraftGroup>();

    for (const draft of vaultDrafts) {
      const { domain, formName, sectionId } = parseDraftMetadata(draft);

      if (!map.has(domain)) {
        map.set(domain, {
          domain,
          displayUrl: draft.url,
          drafts: [],
          sections: [],
          totalWords: 0,
          lastUpdated: 0,
        });
      }

      const siteGroup = map.get(domain)!;
      siteGroup.drafts.push(draft);
      siteGroup.totalWords += draft.wordCount || 0;
      if (draft.timestamp > siteGroup.lastUpdated) {
        siteGroup.lastUpdated = draft.timestamp;
      }

      let section = siteGroup.sections.find((s) => s.sectionId === sectionId);
      if (!section) {
        section = {
          sectionId,
          formName,
          url: draft.url,
          drafts: [],
        };
        siteGroup.sections.push(section);
      }
      section.drafts.push(draft);
    }

    return Array.from(map.values()).sort((a, b) => b.lastUpdated - a.lastUpdated);
  }, [vaultDrafts]);

  // High-performance pre-indexed search engine instance
  const searchEngine = useMemo(() => {
    return new VaultSearchEngine(groupedWebsites);
  }, [groupedWebsites]);

  const filteredWebsites = useMemo(() => {
    return searchEngine.search(deferredSearchQuery);
  }, [searchEngine, deferredSearchQuery]);

  const activeWebsiteDomain = useMemo(() => {
    if (selectedWebsite && filteredWebsites.some((g) => g.domain === selectedWebsite)) {
      return selectedWebsite;
    }
    return filteredWebsites[0]?.domain || null;
  }, [selectedWebsite, filteredWebsites]);

  const activeSiteGroup = useMemo(() => {
    return filteredWebsites.find((g) => g.domain === activeWebsiteDomain) || null;
  }, [filteredWebsites, activeWebsiteDomain]);

  const handleCopyWebsiteDrafts = (site: WebsiteDraftGroup) => {
    const formatted = site.sections
      .map((sec) => `## ${sec.formName} (${sec.url})\n` + sec.drafts.map((d) => `${d.fieldLabel || 'Field'}: ${d.value}`).join('\n'))
      .join('\n\n');
    navigator.clipboard.writeText(formatted);
    setCopiedKey('website_' + site.domain);
    setTimeout(() => setCopiedKey(null), 2000);
    showToast(`Copied all drafts for ${site.domain}`);
  };

  const handleDeleteWebsiteDrafts = async (site: WebsiteDraftGroup) => {
    for (const d of site.drafts) {
      await deleteSavedDraft(d.fieldKey);
    }
    const keysToRemove = new Set(site.drafts.map((d) => d.fieldKey));
    setVaultDrafts((prev) => prev.filter((d) => !keysToRemove.has(d.fieldKey)));
    showToast(`Removed all drafts for ${site.domain}`);
  };

  const handleAddDomain = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let clean = newDomain.trim().toLowerCase();
    clean = clean.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0];
    if (!clean) return;

    if (settings.whitelistedDomains?.includes(clean)) {
      showToast(`${clean} is already excluded`);
      setNewDomain('');
      return;
    }

    const updated = await addDomainToWhitelist(clean);
    setSettings((prev) => ({ ...prev, whitelistedDomains: updated }));
    setNewDomain('');
    showToast(`Added ${clean} to exclusions`);
  };

  const handleRemoveDomain = async (domain: string) => {
    const updated = await removeDomainFromWhitelist(domain);
    setSettings((prev) => ({ ...prev, whitelistedDomains: updated }));
    showToast(`Removed ${domain} from exclusions`);
  };

  const handleExportBackup = async () => {
    try {
      const meta = await exportSettingsAndDraftsWithMeta();
      const blob = new Blob([meta.jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
      a.href = url;
      a.download = `zenweb-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const itemsDesc = meta.totalDrafts > 0 ? `${meta.totalDrafts} drafts` : 'settings';
      showToast(`Exported snapshot (${itemsDesc}, ${meta.totalExclusions} exclusions)`);
    } catch (err) {
      console.error('Export failed:', err);
      showToast('Failed to export backup');
    }
  };

  const processImportFile = async (file: File) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json') && file.type && !file.type.includes('json')) {
      showToast('Please select a valid JSON backup file (.json)');
      return;
    }

    setIsImporting(true);
    try {
      const content = await file.text();
      const res = await importSettingsAndDrafts(content);

      if (res.success) {
        const [freshSettings, freshStats, freshDrafts] = await Promise.all([
          getSettings(),
          getStats(),
          getAllSavedDrafts(),
        ]);

        setSettings(freshSettings);
        setStats(freshStats);
        setVaultDrafts(freshDrafts);

        const parts: string[] = [];
        if (res.draftsRestoredCount > 0) parts.push(`${res.draftsRestoredCount} drafts`);
        if (res.whitelistedDomainsCount > 0) parts.push(`${res.whitelistedDomainsCount} exclusions`);
        if (res.settingsRestored) parts.push('shields');

        showToast(
          parts.length > 0
            ? `Restored: ${parts.join(', ')}!`
            : 'Backup restored successfully!'
        );
      } else {
        showToast(res.error || 'Invalid backup file format');
      }
    } catch (err: any) {
      console.error('Import error:', err);
      showToast(err?.message || 'Error reading backup file');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processImportFile(file);
    }
  };

  /* refs for GSAP */
  const rootRef          = useRef<HTMLDivElement>(null);
  const gridRef          = useRef<HTMLDivElement>(null);
  const toastRef         = useRef<HTMLDivElement>(null);
  const isFilterAnim     = useRef(false);
  // BUG FIX: Safety valve — if animation is still "in progress"
  // after 600ms (e.g. rapid clicks), force-unlock the guard.
  const filterAnimTimer  = useRef<number | null>(null);
  const hasMounted       = useRef(false);  // guards category useEffect on initial mount
  const toastTween       = useRef<gsap.core.Timeline|null>(null);
  const toastTimer       = useRef<number|null>(null);

  /* ── load ── */
  useEffect(() => {
    document.body.style.backgroundColor = '#000000';

    async function load() {
      const [s, st, d] = await Promise.all([getSettings(), getStats(), getAllSavedDrafts()]);
      startTransition(() => {
        setSettings(s);
        setStats(st);
        setVaultDrafts(d);
      });
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
                stats.recipesSkipped + stats.fakeDownloadsDefused +
                stats.formsBackedUp;

  /* ── render ── */
  return (
    <div
      ref={rootRef}
      data-theme="dark"
      style={{ minHeight: '100vh', backgroundColor: cv('--zw-bg-page'), color: cv('--zw-text-primary') }}
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
              style={{ width: 32, height: 32, backgroundColor: cv('--zw-text-primary'), color: cv('--zw-bg-page') }}
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
              {settings.masterEnabled ? `${activeCount} of ${PROTECTIONS.length} Active` : 'Paused'}
            </div>

            <button onClick={handleResetDefaults} className="apple-press apple-link hidden items-center gap-1 sm:flex" style={{ fontSize: 12 }}>
              <RotateCcw style={{ width: 11, height: 11 }} />
              Defaults
            </button>

            <button onClick={handleResetStats} className="apple-press apple-link" style={{ fontSize: 12 }}>
              Clear Stats
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
            <StatCard label="Intrusions Blocked"  value={null} rawValue={stats.fakeDownloadsDefused + stats.videosSuppressed}                             sub={`${stats.fakeDownloadsDefused} traps · ${stats.videosSuppressed} videos`}     icon={<ShieldAlert style={{ width: 15, height: 15, color: cv('--zw-text-link') }} />} />
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
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="flex shrink-0 items-center justify-center rounded-[10px]"
                          style={{
                            width: 36,
                            height: 36,
                            backgroundColor: cv('--zw-bg-icon'),
                            border: `1px solid ${cv('--zw-border-card')}`,
                          }}
                        >
                          <Icon style={{ width: 17, height: 17, strokeWidth: 2, color: cv('--zw-text-primary') } as React.CSSProperties} />
                        </div>
                        <h3 className="apple-body-strong truncate" style={{ margin: 0, color: cv('--zw-text-primary') }}>
                          {item.name}
                        </h3>
                      </div>
                      <span
                        className="shrink-0 rounded-full px-2.5 py-0.5"
                        style={{
                          fontSize: 11,
                          color: cv('--zw-text-muted-badge'),
                          backgroundColor: cv('--zw-bg-scope'),
                          border: `1px solid ${cv('--zw-border-scope')}`,
                        }}
                      >
                        {item.targetScope}
                      </span>
                    </div>

                    <p style={{ fontSize: 14, color: cv('--zw-text-secondary'), lineHeight: 1.43, margin: 0 }}>
                      {item.description}
                    </p>

                    {item.key === 'formSalvagerEnabled' && (
                      <div className="flex items-center gap-2.5 mt-1">
                        <button
                          type="button"
                          onClick={handleOpenVault}
                          className="apple-press inline-flex items-center gap-1.5 text-xs sm:text-[13px] font-semibold text-[#15803d] hover:text-[#4ade80] transition-colors"
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                          }}
                        >
                          <Archive style={{ width: 13, height: 13 }} />
                          <span>Saved Drafts Vault</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleOpenVault}
                          className="apple-press inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold text-white transition-opacity hover:opacity-90"
                          style={{
                            backgroundColor: '#15803d',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                          title="Open Saved Drafts Vault"
                          aria-label="Open Saved Drafts Vault"
                        >
                          <span>Open</span>
                          <ExternalLink style={{ width: 10, height: 10 }} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4" style={{ borderTop: `1px solid ${cv('--zw-border-divider')}` }}>
                    <div className="flex items-center gap-1.5" style={{ fontSize: 12, color: cv('--zw-text-tertiary') }}>
                      <span
                        className="inline-block rounded-full transition-colors duration-200"
                        style={{
                          width: 6,
                          height: 6,
                          backgroundColor: isActive ? '#34c759' : '#ef4444',
                        }}
                      />
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

        {/* ── Excluded Websites (Whitelist Manager) ──────── */}
        <section data-block>
          <div className="mb-4 flex flex-col gap-1 px-1">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="apple-display-lg" style={{ fontSize: 21, margin: 0, color: cv('--zw-text-primary') }}>
                  Excluded Websites
                </h2>
                <p style={{ fontSize: 14, color: cv('--zw-text-secondary'), margin: '4px 0 0', lineHeight: 1.43 }}>
                  Shields are completely bypassed on these domains to preserve compatibility with internal tools or web apps.
                </p>
              </div>
              <span
                className="rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: cv('--zw-bg-chip'),
                  color: cv('--zw-text-tertiary'),
                }}
              >
                {settings.whitelistedDomains?.length || 0} Excluded
              </span>
            </div>
          </div>

          <div className="apple-card p-6 flex flex-col gap-5">
            {/* Input row */}
            <form onSubmit={handleAddDomain} className="flex flex-col sm:flex-row gap-2.5 items-stretch">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none" style={{ color: cv('--zw-text-tertiary') }}>
                  <Globe style={{ width: 16, height: 16 }} />
                </div>
                <input
                  type="text"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="e.g. github.com, internal.company.net"
                  className="w-full pl-9 pr-4 py-2 rounded-[10px] text-sm outline-none transition-colors"
                  style={{
                    backgroundColor: cv('--zw-bg-scope'),
                    border: `1px solid ${cv('--zw-border-scope')}`,
                    color: cv('--zw-text-primary'),
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={!newDomain.trim()}
                className="apple-press inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-[10px] text-sm font-semibold text-white transition-opacity"
                style={{
                  backgroundColor: cv('--zw-text-link'),
                  opacity: newDomain.trim() ? 1 : 0.5,
                  cursor: newDomain.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                <Plus style={{ width: 15, height: 15, strokeWidth: 2.5 }} />
                <span>Add Domain</span>
              </button>
            </form>

            {/* Domains chips */}
            <div
              className="p-4 rounded-[12px] flex flex-wrap gap-2 min-h-[64px] items-center"
              style={{
                backgroundColor: cv('--zw-bg-scope'),
                border: `1px solid ${cv('--zw-border-scope')}`,
              }}
            >
              {(!settings.whitelistedDomains || settings.whitelistedDomains.length === 0) ? (
                <span className="text-xs" style={{ color: cv('--zw-text-tertiary') }}>
                  No domains excluded yet. All ZenWeb protections are currently guarding your browsing across every site.
                </span>
              ) : (
                settings.whitelistedDomains.map((domain) => (
                  <span
                    key={domain}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: cv('--zw-bg-card'),
                      border: `1px solid ${cv('--zw-border-card')}`,
                      color: cv('--zw-text-primary'),
                      boxShadow: cv('--zw-chip-sel-shadow'),
                    }}
                  >
                    <Globe style={{ width: 12, height: 12, color: cv('--zw-text-link') }} />
                    <span>{domain}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDomain(domain)}
                      className="apple-press hover:text-red-500 rounded-full p-0.5"
                      style={{ color: cv('--zw-text-tertiary') }}
                      title={`Remove ${domain}`}
                      aria-label={`Remove ${domain} from whitelist`}
                    >
                      <X style={{ width: 12, height: 12, strokeWidth: 2.5 }} />
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        </section>

        {/* ── Backup & Shortcuts ────────────────────────── */}
        <section data-block className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Backup & Migration */}
          <div
            className={`apple-card p-6 flex flex-col justify-between gap-5 transition-all duration-200 ${
              isDraggingBackup
                ? 'border-dashed border-2 !border-[#15803d] !bg-[rgba(21,128,61,0.08)]'
                : ''
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingBackup(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDraggingBackup(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingBackup(false);
              const file = e.dataTransfer.files?.[0];
              if (file) {
                processImportFile(file);
              }
            }}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="flex shrink-0 items-center justify-center rounded-[10px]"
                    style={{
                      width: 36,
                      height: 36,
                      backgroundColor: cv('--zw-bg-icon'),
                      border: `1px solid ${cv('--zw-border-card')}`,
                    }}
                  >
                    <Archive style={{ width: 17, height: 17, color: '#15803d' }} />
                  </div>
                  <h3 className="apple-body-strong truncate" style={{ margin: 0, color: cv('--zw-text-primary') }}>
                    Backup &amp; Migration
                  </h3>
                </div>
                <span
                  className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{
                    color: '#15803d',
                    backgroundColor: 'rgba(21, 128, 61, 0.15)',
                  }}
                >
                  JSON Backup
                </span>
              </div>
              <p style={{ fontSize: 14, color: cv('--zw-text-secondary'), lineHeight: 1.43, margin: 0 }}>
                Export your complete settings, domain exclusion lists, and saved form drafts into an offline JSON snapshot.
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-4" style={{ borderTop: `1px solid ${cv('--zw-border-divider')}` }}>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="apple-press inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-xs font-semibold text-white"
                  style={{ backgroundColor: cv('--zw-text-link'), border: 'none', cursor: 'pointer' }}
                >
                  <Download style={{ width: 14, height: 14 }} />
                  <span>Export Backup</span>
                </button>

                <label
                  className={`apple-press inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-xs font-medium cursor-pointer transition-opacity ${
                    isImporting ? 'opacity-60 pointer-events-none' : ''
                  }`}
                  style={{
                    backgroundColor: cv('--zw-bg-scope'),
                    border: `1px solid ${cv('--zw-border-card')}`,
                    color: cv('--zw-text-primary'),
                  }}
                >
                  <Upload style={{ width: 14, height: 14, color: cv('--zw-text-secondary') }} />
                  <span>{isImporting ? 'Restoring...' : 'Import Backup'}</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportBackup}
                    disabled={isImporting}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="text-[11px] font-medium flex items-center gap-1.5" style={{ color: cv('--zw-text-tertiary') }}>
                <span>Stored:</span>
                <span className="text-[#4ade80] font-semibold">{vaultDrafts.length} checkpoints</span>
                <span>·</span>
                <span>{settings.whitelistedDomains?.length || 0} exclusions</span>
                <span>·</span>
                <span>Drop JSON file to restore</span>
              </div>
            </div>
          </div>

          {/* Card 2: Keyboard Shortcuts Guide */}
          <div className="apple-card p-6 flex flex-col justify-between gap-5">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="flex shrink-0 items-center justify-center rounded-[10px]"
                    style={{
                      width: 36,
                      height: 36,
                      backgroundColor: cv('--zw-bg-icon'),
                      border: `1px solid ${cv('--zw-border-card')}`,
                    }}
                  >
                    <Command style={{ width: 17, height: 17, color: cv('--zw-text-primary') }} />
                  </div>
                  <h3 className="apple-body-strong truncate" style={{ margin: 0, color: cv('--zw-text-primary') }}>
                    Keyboard Shortcuts
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div
                    className="relative inline-flex items-center rounded-full p-0.5 select-none w-36"
                    style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.45)',
                      border: `1px solid ${cv('--zw-border-scope')}`,
                    }}
                  >
                    {/* Animated Slider Indicator */}
                    <div
                      className="absolute top-0.5 bottom-0.5 rounded-full transition-transform duration-200 ease-out pointer-events-none"
                      style={{
                        width: 'calc(50% - 2px)',
                        left: 2,
                        transform: shortcutOS === 'mac' ? 'translateX(0%)' : 'translateX(100%)',
                        backgroundColor: cv('--zw-bg-chip-sel'),
                        boxShadow: '0 1px 3px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)',
                      }}
                    />

                    <button
                      type="button"
                      onClick={() => setShortcutOS('mac')}
                      className="relative z-10 flex-1 text-center py-1 rounded-full text-[11px] font-semibold transition-colors duration-150 cursor-pointer outline-none focus:outline-none"
                      style={{
                        color: shortcutOS === 'mac' ? cv('--zw-text-primary') : cv('--zw-text-tertiary'),
                      }}
                      title="Display keyboard shortcuts formatted for macOS keyboards"
                    >
                      macOS
                    </button>
                    <button
                      type="button"
                      onClick={() => setShortcutOS('win')}
                      className="relative z-10 flex-1 text-center py-1 rounded-full text-[11px] font-semibold transition-colors duration-150 cursor-pointer outline-none focus:outline-none"
                      style={{
                        color: shortcutOS === 'win' ? cv('--zw-text-primary') : cv('--zw-text-tertiary'),
                      }}
                      title="Display keyboard shortcuts formatted for Windows & Linux keyboards"
                    >
                      Win / Linux
                    </button>
                  </div>
                  <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ color: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.12)' }}>
                    Hotkeys
                  </span>
                </div>
              </div>
              <p style={{ fontSize: 14, color: cv('--zw-text-secondary'), lineHeight: 1.43, margin: 0 }}>
                Trigger instant shields, open clean reading modes, and recover form drafts from anywhere.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-4" style={{ borderTop: `1px solid ${cv('--zw-border-divider')}` }}>
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: cv('--zw-text-secondary') }}>Recipe Reader View</span>
                <kbd className="px-2 py-1 rounded-[6px] font-mono text-[11px] font-semibold" style={{ backgroundColor: cv('--zw-bg-scope'), border: `1px solid ${cv('--zw-border-scope')}`, color: cv('--zw-text-primary') }}>
                  {shortcutOS === 'mac' ? '⌥ Option + ⇧ Shift + J' : 'Alt + Shift + J'}
                </kbd>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: cv('--zw-text-secondary') }}>Restore Form Drafts</span>
                <kbd className="px-2 py-1 rounded-[6px] font-mono text-[11px] font-semibold" style={{ backgroundColor: cv('--zw-bg-scope'), border: `1px solid ${cv('--zw-border-scope')}`, color: cv('--zw-text-primary') }}>
                  {shortcutOS === 'mac' ? '⌥ Option + R' : 'Alt + R'}
                </kbd>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: cv('--zw-text-secondary') }}>Quick Panic Escape</span>
                <kbd className="px-2 py-1 rounded-[6px] font-mono text-[11px] font-semibold" style={{ backgroundColor: cv('--zw-bg-scope'), border: `1px solid ${cv('--zw-border-scope')}`, color: cv('--zw-text-primary') }}>
                  Double Esc
                </kbd>
              </div>
              <div className="flex items-center justify-between text-[11px] pt-2" style={{ borderTop: `1px solid ${cv('--zw-border-divider')}`, color: cv('--zw-text-secondary') }}>
                <span>{shortcutOS === 'mac' ? 'Native Mac Apple layout (⌥ Option)' : 'Native PC layout (Windows & Linux Alt)'}</span>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
                        chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
                      }
                    } catch {}
                  }}
                  className="hover:underline flex items-center gap-1 cursor-pointer font-medium"
                  style={{ color: cv('--zw-text-link') }}
                  title="Configure custom keys directly in Chrome extensions settings"
                >
                  Configure in Chrome ↗
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Privacy notice ── */}
        <div data-scroll-reveal className="apple-card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex shrink-0 items-center justify-center" style={{ color: '#15803d' }}>
              <Lock style={{ width: 22, height: 22, strokeWidth: 2.2 }} />
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
          <span
            className="shrink-0 self-start sm:self-auto font-semibold"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#15803d',
              letterSpacing: '0.01em',
            }}
          >
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
              <div className="flex items-start gap-3">
                <div className="flex shrink-0 items-center justify-center mt-0.5">
                  <Heart style={{ width: 20, height: 20, strokeWidth: 2, color: '#ff2d55', fill: '#ff2d55' }} />
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

      {/* ── Saved Drafts Vault Modal (16:9 Widescreen) ──── */}
      {vaultOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md"
          onClick={handleCloseVault}
        >
          <div
            className="apple-card flex flex-col rounded-[24px] shadow-2xl overflow-hidden border"
            style={{
              width: 'min(96vw, calc((94vh - 20px) * 16 / 9), 1460px)',
              aspectRatio: '16 / 9',
              maxHeight: '94vh',
              backgroundColor: cv('--zw-bg-card'),
              borderColor: cv('--zw-border-card'),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Modal Header Bar ── */}
            <div
              className="flex items-center justify-between px-7 py-4.5 flex-shrink-0"
              style={{ borderBottom: `1px solid ${cv('--zw-border-divider')}` }}
            >
              <div className="flex items-center gap-4">
                <Archive style={{ width: 26, height: 26, color: '#15803d' }} />
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight" style={{ color: cv('--zw-text-primary'), margin: 0 }}>
                      Saved Drafts Vault
                    </h2>
                    <span className="text-sm font-medium" style={{ color: cv('--zw-text-tertiary') }}>
                      ({groupedWebsites.length} {groupedWebsites.length === 1 ? 'website' : 'websites'} · {vaultDrafts.length} {vaultDrafts.length === 1 ? 'draft' : 'drafts'})
                    </span>
                  </div>
                  <p className="text-sm sm:text-[14px] mt-0.5" style={{ color: cv('--zw-text-secondary'), margin: 0 }}>
                    Recover unsubmitted form checkpoints organized by website and form section
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-5">
                {vaultDrafts.length > 0 && (
                  <div className="relative flex items-center">
                    <Search
                      style={{ width: 17, height: 17, color: cv('--zw-text-tertiary') }}
                      className="absolute left-3.5 pointer-events-none"
                    />
                    <input
                      type="text"
                      value={vaultSearchQuery}
                      onChange={(e) => setVaultSearchQuery(e.target.value)}
                      placeholder="Search websites or fields..."
                      className="pl-10 pr-9 py-2 text-sm sm:text-[15px] rounded-full outline-none transition-colors border"
                      style={{
                        backgroundColor: cv('--zw-bg-scope'),
                        borderColor: cv('--zw-border-card'),
                        color: cv('--zw-text-primary'),
                        width: 290,
                      }}
                    />
                    {vaultSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setVaultSearchQuery('')}
                        className="absolute right-3 text-xs rounded-full p-1 hover:bg-white/10"
                        style={{ color: cv('--zw-text-tertiary') }}
                      >
                        <X style={{ width: 15, height: 15 }} />
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCloseVault}
                  className="apple-press rounded-full p-2.5 hover:bg-white/10 transition-colors"
                  style={{ color: cv('--zw-text-tertiary') }}
                  aria-label="Close vault"
                >
                  <X style={{ width: 22, height: 22 }} />
                </button>
              </div>
            </div>

            {/* ── Modal Body (Split Layout in 16:9) ── */}
            {vaultDrafts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[#15803d]/10 text-[#15803d] mb-4 border border-[#15803d]/20">
                  <Archive style={{ width: 32, height: 32 }} />
                </div>
                <h3 className="text-lg font-semibold" style={{ color: cv('--zw-text-primary') }}>
                  No Saved Drafts in Storage
                </h3>
                <p className="text-sm max-w-sm mt-1.5" style={{ color: cv('--zw-text-secondary') }}>
                  ZenWeb automatically checkpoints your text, textareas, and form selections across any website in real-time as you type.
                </p>
                <button
                  type="button"
                  onClick={handleCloseVault}
                  className="apple-press mt-5 text-sm font-medium px-5 py-2.5 rounded-full"
                  style={{ backgroundColor: cv('--zw-bg-chip'), color: cv('--zw-text-primary') }}
                >
                  Close Vault
                </button>
              </div>
            ) : (
              <div className="flex-1 flex min-h-0 overflow-hidden">
                {/* ── Left Sidebar: Websites List ── */}
                <div
                  className="w-[320px] lg:w-[360px] flex-shrink-0 flex flex-col border-r h-full overflow-hidden"
                  style={{
                    borderColor: cv('--zw-border-divider'),
                    backgroundColor: 'rgba(0, 0, 0, 0.25)',
                  }}
                >
                  <div
                    className="px-5 py-3 text-[13px] font-semibold uppercase tracking-wider flex items-center justify-between"
                    style={{ color: cv('--zw-text-tertiary'), borderBottom: `1px solid ${cv('--zw-border-divider')}` }}
                  >
                    <span>Websites ({filteredWebsites.length})</span>
                    <span>Checkpoints</span>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
                    {filteredWebsites.length === 0 ? (
                      <div className="p-5 text-center text-sm" style={{ color: cv('--zw-text-tertiary') }}>
                        No websites match "{vaultSearchQuery}"
                      </div>
                    ) : (
                      filteredWebsites.map((site) => {
                        const isSelected = site.domain === activeWebsiteDomain;
                        return (
                          <button
                            key={site.domain}
                            type="button"
                            onClick={() => setSelectedWebsite(site.domain)}
                            className="apple-press w-full text-left p-3.5 rounded-[16px] flex items-center justify-between transition-all outline-none focus:outline-none focus:ring-0 group"
                            style={{
                              backgroundColor: isSelected ? 'rgba(5, 46, 22, 0.75)' : 'transparent',
                            }}
                          >
                            <div className="flex items-center gap-3.5 min-w-0 flex-1 mr-2.5">
                              <WebsiteFavicon domain={site.domain} size={24} />
                              <div className="min-w-0 flex-1">
                                <div
                                  className="text-[15px] sm:text-base font-semibold truncate"
                                  style={{ color: isSelected ? '#4ade80' : cv('--zw-text-primary') }}
                                >
                                  <HighlightMatches text={site.domain} query={vaultSearchQuery} />
                                </div>
                                <div className="text-[13px] truncate mt-0.5" style={{ color: cv('--zw-text-tertiary') }}>
                                  {site.sections.length} {site.sections.length === 1 ? 'section' : 'sections'} · {site.totalWords} words
                                </div>
                              </div>
                            </div>

                            <span
                              className="px-3 py-1 rounded-full text-xs sm:text-[13px] font-bold flex-shrink-0"
                              style={{
                                backgroundColor: isSelected ? 'rgba(21, 128, 61, 0.28)' : cv('--zw-bg-scope'),
                                color: isSelected ? '#4ade80' : cv('--zw-text-secondary'),
                              }}
                            >
                              {site.drafts.length}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* ── Right Content Area: Form Sections & Fields ── */}
                <div className="flex-1 h-full flex flex-col min-w-0 overflow-hidden">
                  {activeSiteGroup ? (
                    <>
                      {/* Website Header Bar */}
                      <div
                        className="px-7 py-4 border-b flex items-center justify-between flex-shrink-0"
                        style={{
                          borderColor: cv('--zw-border-divider'),
                          backgroundColor: 'rgba(255, 255, 255, 0.015)',
                        }}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <WebsiteFavicon domain={activeSiteGroup.domain} size={26} />
                          <div className="min-w-0 flex flex-col">
                            <a
                              href={activeSiteGroup.displayUrl?.startsWith('http') ? activeSiteGroup.displayUrl : `https://${activeSiteGroup.displayUrl || activeSiteGroup.domain}`}
                              target="_blank"
                              rel="noreferrer"
                              className="group inline-flex items-center gap-2 max-w-full hover:opacity-85 transition-opacity"
                              title={`Open ${activeSiteGroup.domain}`}
                            >
                              <h3 className="text-lg sm:text-xl font-bold truncate group-hover:underline" style={{ color: cv('--zw-text-primary'), margin: 0 }}>
                                <HighlightMatches text={activeSiteGroup.domain} query={vaultSearchQuery} />
                              </h3>
                              <ExternalLink style={{ width: 16, height: 16, color: '#15803d' }} className="flex-shrink-0" />
                            </a>
                            <span className="text-[13px] sm:text-sm block mt-0.5 font-medium" style={{ color: cv('--zw-text-tertiary') }}>
                              {activeSiteGroup.sections.length} form {activeSiteGroup.sections.length === 1 ? 'section' : 'sections'} · {activeSiteGroup.drafts.length} saved fields
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-5">
                          <button
                            type="button"
                            onClick={() => handleCopyWebsiteDrafts(activeSiteGroup)}
                            className={`apple-press inline-flex items-center gap-2.5 text-[15px] sm:text-base font-semibold transition-colors duration-150 ${
                              copiedKey === 'website_' + activeSiteGroup.domain
                                ? 'text-[#34c759]'
                                : 'text-[#15803d] hover:text-[#4ade80]'
                            }`}
                            title="Copy all form data"
                            aria-label="Copy all form data"
                          >
                            {copiedKey === 'website_' + activeSiteGroup.domain ? (
                              <>
                                <Check style={{ width: 17, height: 17 }} />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy style={{ width: 17, height: 17 }} />
                                <span>Copy All</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteWebsiteDrafts(activeSiteGroup)}
                            className="apple-press p-2.5 rounded-full text-[#b91c1c] hover:text-red-400 transition-colors"
                            title="Delete all drafts for this website"
                            aria-label="Delete all drafts for this website"
                          >
                            <Trash2 style={{ width: 18, height: 18 }} />
                          </button>
                        </div>
                      </div>

                      {/* Scrollable Form Sections List */}
                      <div className="flex-1 overflow-y-auto p-7 flex flex-col gap-6">
                        {activeSiteGroup.sections.map((section) => (
                          <div
                            key={section.sectionId}
                            className="rounded-[20px] border p-6 flex flex-col gap-5"
                            style={{
                              backgroundColor: cv('--zw-bg-scope'),
                              borderColor: cv('--zw-border-scope'),
                            }}
                          >
                            {/* Section Header */}
                            <div className="flex items-center justify-between pb-3.5 border-b" style={{ borderColor: cv('--zw-border-divider') }}>
                              <div className="flex items-center gap-3">
                                <Layers style={{ width: 18, height: 18, color: '#15803d' }} />
                                <span className="text-base sm:text-lg font-bold text-[#15803d]">
                                  <HighlightMatches text={section.formName} query={vaultSearchQuery} />
                                </span>
                                <span className="text-xs sm:text-[13px] px-3 py-1 rounded-full font-semibold" style={{ backgroundColor: cv('--zw-bg-card'), color: cv('--zw-text-tertiary') }}>
                                  {section.drafts.length} {section.drafts.length === 1 ? 'field' : 'fields'}
                                </span>
                              </div>
                            </div>

                            {/* Section Fields Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5">
                              {section.drafts.map((d) => (
                                <div
                                  key={d.fieldKey}
                                  className="p-5 rounded-[16px] flex flex-col justify-between gap-3.5 border"
                                  style={{
                                    backgroundColor: cv('--zw-bg-card'),
                                    borderColor: cv('--zw-border-card'),
                                  }}
                                >
                                  <div className="flex items-center justify-between text-[15px] sm:text-base">
                                    <span className="font-bold text-[#15803d] truncate max-w-[240px]">
                                      <HighlightMatches text={d.fieldLabel || 'Input Field'} query={vaultSearchQuery} />
                                    </span>
                                    <span className="text-xs sm:text-[13px] font-medium" style={{ color: cv('--zw-text-tertiary') }}>
                                      {d.wordCount} words
                                    </span>
                                  </div>

                                  <div
                                    className="p-3.5 sm:p-4 rounded-[10px] text-[15px] sm:text-base font-mono max-h-36 overflow-y-auto break-words whitespace-pre-wrap select-all"
                                    style={{
                                      backgroundColor: 'rgba(0, 0, 0, 0.45)',
                                      color: cv('--zw-text-primary'),
                                      border: `1px solid ${cv('--zw-border-divider')}`,
                                      lineHeight: 1.55,
                                    }}
                                  >
                                    <HighlightMatches text={d.value} query={vaultSearchQuery} />
                                  </div>

                                  <div className="flex items-center justify-between pt-1">
                                    <span className="text-xs sm:text-[13px] font-medium" style={{ color: cv('--zw-text-tertiary') }}>
                                      {new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      {d.revisions && d.revisions.length > 0 && ` · rev ${d.revisions.length + 1}`}
                                    </span>

                                    <div className="flex items-center gap-2.5">
                                      <button
                                        type="button"
                                        onClick={() => handleCopyDraft(d.fieldKey, d.value)}
                                        className="apple-press p-2 rounded-full hover:bg-white/10 transition-colors"
                                        style={{ color: copiedKey === d.fieldKey ? '#34c759' : cv('--zw-text-secondary') }}
                                        title="Copy text"
                                        aria-label="Copy text"
                                      >
                                        {copiedKey === d.fieldKey ? (
                                          <Check style={{ width: 16, height: 16, color: '#34c759' }} />
                                        ) : (
                                          <Copy style={{ width: 16, height: 16 }} />
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteDraft(d.fieldKey)}
                                        className="apple-press p-2 rounded-full text-[#b91c1c] hover:text-red-400 transition-colors"
                                        title="Delete field draft"
                                        aria-label="Delete field draft"
                                      >
                                        <Trash2 style={{ width: 16, height: 16 }} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                      {vaultSearchQuery.trim() ? (
                        <>
                          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/5 text-[#15803d] mb-3">
                            <Search style={{ width: 22, height: 22 }} />
                          </div>
                          <h4 className="text-base font-semibold" style={{ color: cv('--zw-text-primary') }}>
                            No Checkpoints Found
                          </h4>
                          <p className="text-sm mt-1 max-w-sm" style={{ color: cv('--zw-text-secondary') }}>
                            No saved drafts match &ldquo;<span className="text-[#4ade80] font-medium">{vaultSearchQuery}</span>&rdquo;. Try searching for a different website, form section, or field value.
                          </p>
                          <button
                            type="button"
                            onClick={() => setVaultSearchQuery('')}
                            className="apple-press mt-4 text-xs sm:text-sm font-semibold px-4 py-2 rounded-full"
                            style={{ backgroundColor: cv('--zw-bg-chip'), color: cv('--zw-text-primary') }}
                          >
                            Clear Search
                          </button>
                        </>
                      ) : (
                        <p className="text-base" style={{ color: cv('--zw-text-tertiary') }}>
                          Select a website from the sidebar to view saved drafts.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Modal Footer Bar ── */}
            <div
              className="px-7 py-4 border-t flex items-center justify-between flex-shrink-0"
              style={{
                borderColor: cv('--zw-border-divider'),
                backgroundColor: 'rgba(0, 0, 0, 0.25)',
              }}
            >
              <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium" style={{ color: cv('--zw-text-tertiary') }}>
                <Lock style={{ width: 16, height: 16, color: '#34c759' }} />
                <span>Zero Server Uploads · 100% Client-Side Local Checkpoints</span>
              </div>

              <button
                type="button"
                onClick={handleCloseVault}
                className="apple-press text-sm sm:text-base font-semibold px-6 py-2.5 rounded-full transition-all"
                style={{ backgroundColor: cv('--zw-bg-chip'), color: cv('--zw-text-primary') }}
              >
                Close Vault
              </button>
            </div>
          </div>
        </div>
      )}

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
