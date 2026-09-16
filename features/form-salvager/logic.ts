/**
 * Form Salvager & Crash Guard — Logic Engine 2.0
 * Checkpoints active textareas, inputs, and rich-text editors into persistent sandboxed storage.
 * Multi-revision snapshot history protects against accidental deletions/overwrites.
 * Hands-free Alt+R instant restoration and Form-Level "Restore All" coordination.
 * Strictly guarantees privacy: zero capture of passwords, credit cards, CVVs, or sensitive tokens.
 */

import {
  showRestorePill,
  dismissRestorePill,
  removeAllRestorePills,
  showFormLevelBanner,
  dismissFormLevelBanner,
  showSiteRestorePrompt,
  dismissSiteRestorePrompt,
  flashRestoredGlow,
  DraftMeta,
} from './ui';
import { recordProtectionEvent } from '../../content/storage';

export interface DraftRevision {
  value: string;
  timestamp: number;
  wordCount: number;
}

export interface StoredDraft {
  url: string;
  siteUrl?: string;
  pageTitle?: string;
  fieldKey: string;
  fieldLabel: string;
  value: string;
  timestamp: number;
  wordCount: number;
  isContentEditable: boolean;
  revisions: DraftRevision[];
}

const SENSITIVE_REGEX = /(password|pass|secret|cvv|cvc|ssn|creditcard|cardnumber|card[-_]no|pin|auth|token|otp|security[-_]code)/i;
const SENSITIVE_AUTOCOMPLETE_REGEX = /(password|current-password|new-password|cc-|credit-card|cvc|cvv|security-code|one-time-code)/i;
export const DRAFT_PREFIX = 'zenweb_draft_';
const TTL_MS = 48 * 60 * 60 * 1000; // 48-hour retention

/**
 * Detects whether a URL or hostname belongs to a search engine (Google, Bing, DuckDuckGo, etc.).
 * Search engines are for queries, not persistent form drafts.
 */
export function isSearchEngineSite(urlOrHost: string = typeof window !== 'undefined' ? window.location.href : ''): boolean {
  if (!urlOrHost) return false;
  try {
    const raw = urlOrHost.includes('://') ? new URL(urlOrHost).hostname : urlOrHost;
    const host = raw.toLowerCase().replace(/^www\./, '');

    // Exclude productivity subdomains
    if (
      host.startsWith('mail.google.') ||
      host.startsWith('docs.google.') ||
      host.startsWith('drive.google.') ||
      host.startsWith('calendar.google.') ||
      host.startsWith('meet.google.') ||
      host.startsWith('chat.google.')
    ) {
      return false;
    }

    return (
      host === 'google.com' ||
      host.endsWith('.google.com') ||
      host.includes('google.') ||
      host === 'bing.com' ||
      host.endsWith('.bing.com') ||
      host === 'duckduckgo.com' ||
      host.endsWith('.duckduckgo.com') ||
      host === 'search.brave.com' ||
      host === 'brave.com' ||
      host === 'search.yahoo.com' ||
      host === 'yahoo.com' ||
      host.endsWith('.yahoo.com') ||
      host === 'ecosia.org' ||
      host.endsWith('.ecosia.org') ||
      host === 'startpage.com' ||
      host.endsWith('.startpage.com') ||
      host === 'kagi.com' ||
      host.endsWith('.kagi.com') ||
      host === 'qwant.com' ||
      host.endsWith('.qwant.com') ||
      host.includes('yandex.') ||
      host === 'baidu.com' ||
      host.endsWith('.baidu.com') ||
      host === 'ask.com' ||
      host.endsWith('.ask.com') ||
      host === 'search.aol.com' ||
      host === 'naver.com' ||
      host.endsWith('.naver.com')
    );
  } catch {
    return false;
  }
}

export class FormSalvager {
  private isRunning = false;
  private inputListener: ((e: Event) => void) | null = null;
  private submitListener: ((e: Event) => void) | null = null;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private observer: MutationObserver | null = null;
  private saveDebounceTimers = new Map<string, number>();

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.purgeExpiredDrafts().catch(() => {});

    // Search engines (Google, Bing, DuckDuckGo, etc.) must NEVER salvage drafts or show restore prompts
    if (isSearchEngineSite()) {
      this.purgeSearchEngineDrafts().catch(() => {});
      removeAllRestorePills();
      return;
    }

    this.attachListeners();
    this.checkForRecoverableDrafts();
    this.startObserver();
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.inputListener) {
      document.removeEventListener('input', this.inputListener, true);
      this.inputListener = null;
    }

    if (this.submitListener) {
      document.removeEventListener('submit', this.submitListener, true);
      this.submitListener = null;
    }

    if (this.keydownListener) {
      document.removeEventListener('keydown', this.keydownListener, true);
      this.keydownListener = null;
    }

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    for (const timer of this.saveDebounceTimers.values()) {
      clearTimeout(timer);
    }
    this.saveDebounceTimers.clear();

    removeAllRestorePills();
  }

  /**
   * Attaches typing listener, form submit listener, and Alt+R shortcut listener.
   */
  private attachListeners(): void {
    this.inputListener = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (this.isSalvagableField(target)) {
        this.handleInput(target);
      }
    };

    this.submitListener = (e: Event) => {
      const target = e.target as HTMLElement | null;
      const form = target instanceof HTMLFormElement ? target : target?.closest('form');
      if (form) {
        this.handleFormSubmitted(form);
      }
    };

    // Keyboard shortcut: Alt+R (Windows/Linux) or ⌥R / Option+R (macOS) for instant hands-free restoration
    this.keydownListener = (e: KeyboardEvent) => {
      // Cross-OS validation:
      // - Alt / Option must be pressed
      // - Neither Ctrl nor Meta (Cmd/Win) must be pressed to avoid OS conflicts:
      //   (prevents collision with AltGr on European keyboards, Cmd+R browser reload on Mac, Win+Alt+R Game Bar on Windows)
      // - Key matches 'KeyR', 'r', 'R', or '®' (Option+R generates '®' on macOS keyboards)
      const isAltOnly = e.altKey && !e.ctrlKey && !e.metaKey;
      const isR = e.code === 'KeyR' || e.key === 'r' || e.key === 'R' || e.key === '®';

      if (isAltOnly && isR) {
        let active = document.activeElement as HTMLElement | null;
        if (active && (active as any).shadowRoot && (active as any).shadowRoot.activeElement) {
          active = (active as any).shadowRoot.activeElement as HTMLElement;
        }

        if (active && this.isSalvagableField(active)) {
          const val = this.getElementValue(active);
          if (val.trim().length <= 2) {
            const key = this.getElementStorageKey(active);
            this.getStoredDraft(key).then((draft) => {
              if (draft && draft.value.trim().length >= 5) {
                e.preventDefault();
                e.stopPropagation();
                this.setElementValue(active!, draft.value, draft.isContentEditable);
                flashRestoredGlow(active!);
                dismissRestorePill(active!);
                recordProtectionEvent('formsBackedUp', 1).catch(() => {});
              }
            });
          }
        }
      }
    };

    document.addEventListener('input', this.inputListener, true);
    document.addEventListener('submit', this.submitListener, true);
    document.addEventListener('keydown', this.keydownListener, true);
  }

  /**
   * Detects whether an element is a search bar or search query input.
   * Search queries must never be treated as unsubmitted form drafts.
   */
  public isSearchField(el: HTMLElement): boolean {
    if (el instanceof HTMLInputElement && (el.type || '').toLowerCase() === 'search') {
      return true;
    }

    const role = (el.getAttribute('role') || '').toLowerCase();
    if (role === 'searchbox' || role === 'search') {
      return true;
    }

    const name = (el.getAttribute('name') || '').toLowerCase();
    const searchNames = [
      'q',
      'query',
      'search',
      'search_query',
      'searchterm',
      'search_term',
      'keyword',
      'keywords',
      's',
      'field-keywords',
    ];
    if (searchNames.includes(name)) {
      return true;
    }

    const id = (el.id || '').toLowerCase();
    const searchIds = [
      'search',
      'searchbox',
      'search-box',
      'search_form_input',
      'search_form_input_homepage',
      'sb_form_q',
      'twotabsearchtextbox',
      'nav-search-keywords',
    ];
    if (searchIds.includes(id) || id.includes('searchbox')) {
      return true;
    }

    if (
      el.closest(
        'form[role="search"], [role="search"], form#sb_form, form#tsf, form#search_form, form.header__form, form.search-form, form.searchbox, .b_searchboxForm, .RNNXgb, .searchbox, #searchform, form[action*="/search"], form[action*="/results"]'
      )
    ) {
      return true;
    }

    const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
    const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    if (
      placeholder.startsWith('search') ||
      placeholder.includes('search...') ||
      placeholder.includes('search here') ||
      ariaLabel.includes('search query') ||
      ariaLabel.includes('search the web') ||
      ariaLabel.startsWith('search')
    ) {
      if (
        el instanceof HTMLInputElement ||
        el.tagName === 'INPUT' ||
        (el instanceof HTMLTextAreaElement && (name === 'q' || ariaLabel.includes('search')))
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Evaluates whether an element is an eligible text input while strictly enforcing privacy blacklists.
   */
  public isSalvagableField(el: HTMLElement): boolean {
    // 0. Search engine sites and search inputs are NEVER salvagable forms
    if (isSearchEngineSite()) {
      return false;
    }

    if (this.isSearchField(el)) {
      return false;
    }

    if (el instanceof HTMLInputElement) {
      const type = (el.type || 'text').toLowerCase();
      const allowedTypes = ['text', 'url', 'email', 'tel'];
      if (!allowedTypes.includes(type)) return false;
    } else if (el instanceof HTMLTextAreaElement) {
      // Allowed
    } else if (el.isContentEditable || el.getAttribute('role') === 'textbox') {
      // Modern rich-text editors (Notion, Gmail, Medium, Reddit, etc.)
    } else {
      return false;
    }

    // Strict Privacy Blacklist
    if (el instanceof HTMLInputElement && (el.type === 'password' || el.type === 'hidden')) {
      return false;
    }

    const autocomplete = (el.getAttribute('autocomplete') || '').toLowerCase();
    if (SENSITIVE_AUTOCOMPLETE_REGEX.test(autocomplete)) {
      return false;
    }

    const identifier = `${el.id} ${el.getAttribute('name') || ''} ${el.getAttribute('placeholder') || ''} ${el.getAttribute('aria-label') || ''} ${el.className}`;
    if (SENSITIVE_REGEX.test(identifier)) {
      return false;
    }

    if (el.hasAttribute('data-private') || el.hasAttribute('data-secret') || el.hasAttribute('data-no-salvage')) {
      return false;
    }

    return true;
  }

  /**
   * Debounces and saves user text input to persistent local storage with multi-revision tracking.
   */
  private handleInput(el: HTMLElement): void {
    if (isSearchEngineSite() || this.isSearchField(el)) return;

    const val = this.getElementValue(el);
    const key = this.getElementStorageKey(el);

    dismissRestorePill(el);

    const existingTimer = this.saveDebounceTimers.get(key);
    if (existingTimer) clearTimeout(existingTimer);

    if (val.trim().length < 5) {
      if (val.trim().length === 0) {
        this.removeStoredDraft(key);
      }
      return;
    }

    const timer = window.setTimeout(async () => {
      const words = val.trim().split(/\s+/).filter(Boolean).length;
      const now = Date.now();
      const label = this.getElementHumanLabel(el);

      // Load existing draft to maintain sliding revisions
      const existing = await this.getStoredDraft(key);
      let revisions: DraftRevision[] = existing?.revisions ? [...existing.revisions] : [];

      if (existing && existing.value && existing.value !== val) {
        // Add previous value as a historical revision if not already present
        const lastRev = revisions[revisions.length - 1];
        if (!lastRev || Math.abs(lastRev.value.length - existing.value.length) > 5) {
          revisions.push({
            value: existing.value,
            timestamp: existing.timestamp || now - 5000,
            wordCount: existing.wordCount || existing.value.split(/\s+/).filter(Boolean).length,
          });
        }
      }

      // Limit to 3 most recent revisions
      if (revisions.length > 3) {
        revisions = revisions.slice(revisions.length - 3);
      }

      const { fullUrl, siteUrl, pageTitle } = this.getCurrentUrls();

      const draft: StoredDraft = {
        url: fullUrl,
        siteUrl,
        pageTitle,
        fieldKey: key,
        fieldLabel: label,
        value: val,
        timestamp: now,
        wordCount: words,
        isContentEditable: el.isContentEditable,
        revisions,
      };

      await this.saveStoredDraft(key, draft);
      this.saveDebounceTimers.delete(key);
    }, 1000);

    this.saveDebounceTimers.set(key, timer);
  }

  /**
   * Checks the document for empty fields that have saved recoverable drafts in storage.
   * Coordinates form-level "Restore All" banners and floating site-level reload prompts.
   */
  public async checkForRecoverableDrafts(): Promise<void> {
    if (isSearchEngineSite()) {
      removeAllRestorePills();
      return;
    }

    const candidates = document.querySelectorAll<HTMLElement>(
      'textarea, input, [contenteditable="true"], [role="textbox"]'
    );

    const formRecoverableMap = new Map<HTMLFormElement, Array<{ el: HTMLElement; draft: StoredDraft; key: string }>>();
    const standaloneRecoverable: Array<{ el: HTMLElement; draft: StoredDraft; key: string }> = [];
    const allRecoverable: Array<{ el: HTMLElement; draft: StoredDraft; key: string }> = [];

    for (const el of Array.from(candidates)) {
      if (!this.isSalvagableField(el)) continue;

      const currentVal = this.getElementValue(el);
      if (currentVal.trim().length > 2) continue;

      const key = this.getElementStorageKey(el);
      const draft = await this.getStoredDraft(key);

      if (draft && draft.value.trim().length >= 5) {
        const item = { el, draft, key };
        allRecoverable.push(item);

        const form = el.closest('form');
        if (form) {
          const list = formRecoverableMap.get(form) || [];
          list.push(item);
          formRecoverableMap.set(form, list);
        } else {
          standaloneRecoverable.push(item);
        }
      }
    }

    // 1. Form-Level Coordinated Restore Banner (Prevents overlapping badges in multi-field forms)
    for (const [form, items] of formRecoverableMap.entries()) {
      if (items.length >= 2) {
        showFormLevelBanner(
          form,
          items.length,
          () => {
            items.forEach(({ el, draft }) => {
              this.setElementValue(el, draft.value, draft.isContentEditable);
              flashRestoredGlow(el);
              dismissRestorePill(el);
            });
            recordProtectionEvent('formsBackedUp', items.length).catch(() => {});
          },
          () => {
            items.forEach(({ el, draft }) => {
              this.removeStoredDraft(draft.fieldKey);
              dismissRestorePill(el);
            });
          }
        );
      } else if (items.length === 1) {
        this.renderFieldPill(items[0].el, items[0].draft, items[0].key);
      }
    }

    // 2. Standalone fields outside forms get discreet nested pills
    for (const { el, draft, key } of standaloneRecoverable) {
      this.renderFieldPill(el, draft, key);
    }

    // 3. Site-Level Floating Restore Prompt in the corner
    if (allRecoverable.length > 0) {
      const { siteUrl } = this.getCurrentUrls();
      const totalWords = allRecoverable.reduce((sum, item) => sum + (item.draft.wordCount || 0), 0);
      const latestTimestamp = Math.max(...allRecoverable.map((item) => item.draft.timestamp || 0));
      const longestItem = [...allRecoverable].sort(
        (a, b) => (b.draft.value?.length || 0) - (a.draft.value?.length || 0)
      )[0];
      const longestSnippet = longestItem?.draft?.value
        ? longestItem.draft.value.replace(/\s+/g, ' ').trim().slice(0, 75) +
          (longestItem.draft.value.length > 75 ? '...' : '')
        : undefined;

      showSiteRestorePrompt({
        fieldCount: allRecoverable.length,
        wordCount: totalWords,
        timeAgo: this.formatTimeAgo(latestTimestamp),
        snippet: longestSnippet,
        siteUrl,
        onReload: () => {
          allRecoverable.forEach(({ el, draft }) => {
            this.setElementValue(el, draft.value, draft.isContentEditable);
            flashRestoredGlow(el);
            dismissRestorePill(el);
          });
          recordProtectionEvent('formsBackedUp', allRecoverable.length).catch(() => {});
        },
        onDiscard: () => {
          allRecoverable.forEach(({ el, draft }) => {
            this.removeStoredDraft(draft.fieldKey);
            dismissRestorePill(el);
          });
          dismissFormLevelBanner(document.querySelector('form') as HTMLFormElement);
        },
      });
    }
  }

  /**
   * Renders a discreet restore pill nested inside a specific field.
   */
  private renderFieldPill(el: HTMLElement, draft: StoredDraft, key: string): void {
    const cleanSnippet = draft.value.replace(/\s+/g, ' ').trim();
    const snippet = cleanSnippet.length > 75 ? `${cleanSnippet.slice(0, 72)}...` : cleanSnippet;

    const meta: DraftMeta = {
      wordCount: draft.wordCount,
      timeAgo: this.formatTimeAgo(draft.timestamp),
      snippet,
      revisionsCount: (draft.revisions?.length || 0) + 1,
    };

    showRestorePill(
      el,
      meta,
      () => {
        this.setElementValue(el, draft.value, draft.isContentEditable);
        flashRestoredGlow(el);
        recordProtectionEvent('formsBackedUp', 1).catch(() => {});
      },
      () => {
        this.removeStoredDraft(key);
      }
    );
  }

  /**
   * Cleans up all saved drafts associated with a successfully submitted form.
   */
  private async handleFormSubmitted(form: HTMLFormElement): Promise<void> {
    dismissFormLevelBanner(form);
    const fields = form.querySelectorAll<HTMLElement>(
      'textarea, input, [contenteditable="true"], [role="textbox"]'
    );

    for (const field of Array.from(fields)) {
      if (this.isSalvagableField(field)) {
        const key = this.getElementStorageKey(field);
        await this.removeStoredDraft(key);
        dismissRestorePill(field);
      }
    }

    // Dismiss floating prompt if no unsubmitted drafts remain
    dismissSiteRestorePrompt();
  }

  /**
   * Safely extracts current URL metrics including full page URL, site origin, and document title.
   */
  public getCurrentUrls(): { fullUrl: string; siteUrl: string; pageTitle: string } {
    const fullUrl = window.location.href.split('#')[0];
    let siteUrl = '';
    try {
      if (window.location.origin && window.location.origin !== 'null') {
        siteUrl = window.location.origin;
      } else if (window.location.protocol === 'file:') {
        siteUrl = 'file://';
      } else {
        siteUrl = window.location.host || fullUrl;
      }
    } catch {
      siteUrl = fullUrl;
    }
    return {
      fullUrl,
      siteUrl,
      pageTitle: document.title || '',
    };
  }

  /**
   * Generates a deterministic, collision-free storage key for a given input element.
   */
  public getElementStorageKey(el: HTMLElement): string {
    const { fullUrl } = this.getCurrentUrls();

    const form = el.closest('form');
    let formId = 'no-form';
    if (form) {
      formId = form.id || form.getAttribute('name') || `idx_${Array.from(document.forms).indexOf(form)}`;
    }

    const id = el.id ? `#${el.id}` : '';
    const name = el.getAttribute('name') ? `[name="${el.getAttribute('name')}"]` : '';
    const placeholder = el.getAttribute('placeholder') ? `[ph="${el.getAttribute('placeholder')?.slice(0, 24)}"]` : '';
    const aria = el.getAttribute('aria-label') ? `[aria="${el.getAttribute('aria-label')?.slice(0, 24)}"]` : '';

    let descriptor = `${id}${name}${placeholder}${aria}`.trim();
    if (!descriptor) {
      const tag = el.tagName.toLowerCase();
      const allSame = Array.from(document.querySelectorAll(tag));
      descriptor = `${tag}[${allSame.indexOf(el)}]`;
    }

    return `${DRAFT_PREFIX}${fullUrl}::form[${formId}]::${descriptor}`;
  }

  /**
   * Derives human-friendly label for display in vault / preview.
   */
  private getElementHumanLabel(el: HTMLElement): string {
    const labelEl = el.id ? document.querySelector(`label[for="${el.id}"]`) : el.closest('label');
    if (labelEl && labelEl.textContent) {
      return labelEl.textContent.trim().slice(0, 30);
    }
    const placeholder = el.getAttribute('placeholder');
    if (placeholder) return placeholder.slice(0, 30);
    const name = el.getAttribute('name') || el.id;
    if (name) return name.slice(0, 30);
    return el.tagName.toLowerCase();
  }

  private getElementValue(el: HTMLElement): string {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      return el.value || '';
    }
    if (el.isContentEditable || el.getAttribute('role') === 'textbox') {
      return el.innerText || el.textContent || '';
    }
    return '';
  }

  private setElementValue(el: HTMLElement, val: string, isContentEditable: boolean): void {
    if (isContentEditable) {
      el.innerText = val;
    } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.value = val;
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));

    try {
      el.focus();
    } catch {}
  }

  /* ── Storage Primitives ── */

  private async saveStoredDraft(key: string, draft: StoredDraft): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ [key]: draft });
        return;
      }
      localStorage.setItem(key, JSON.stringify(draft));
    } catch (err) {
      console.warn('[ZenWeb FormSalvager] Failed to save draft:', err);
    }
  }

  public async getStoredDraft(key: string): Promise<StoredDraft | null> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const res = await chrome.storage.local.get(key);
        if (res[key]) return res[key] as StoredDraft;
      } else {
        const item = localStorage.getItem(key);
        if (item) return JSON.parse(item) as StoredDraft;
      }

      // Backward-compatible fallback for legacy storage keys
      const legacyKey = key.replace(
        window.location.href.split('#')[0],
        window.location.origin + window.location.pathname
      );
      if (legacyKey !== key) {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          const res = await chrome.storage.local.get(legacyKey);
          if (res[legacyKey]) return res[legacyKey] as StoredDraft;
        } else {
          const item = localStorage.getItem(legacyKey);
          if (item) return JSON.parse(item) as StoredDraft;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private async removeStoredDraft(key: string): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.remove(key);
        return;
      }
      localStorage.removeItem(key);
    } catch {}
  }

  private async purgeExpiredDrafts(): Promise<void> {
    const now = Date.now();
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const all = await chrome.storage.local.get(null);
        const keysToRemove: string[] = [];
        for (const [k, v] of Object.entries(all)) {
          if (k.startsWith(DRAFT_PREFIX) && v && typeof v === 'object') {
            const draft = v as StoredDraft;
            const isExpired = draft.timestamp && now - draft.timestamp > TTL_MS;
            const isSearch = isSearchEngineSite(draft.url || draft.siteUrl || '');
            if (isExpired || isSearch) {
              keysToRemove.push(k);
            }
          }
        }
        if (keysToRemove.length > 0) {
          await chrome.storage.local.remove(keysToRemove);
        }
        return;
      }

      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(DRAFT_PREFIX)) {
          try {
            const draft = JSON.parse(localStorage.getItem(k) || '{}') as StoredDraft;
            const isExpired = draft.timestamp && now - draft.timestamp > TTL_MS;
            const isSearch = isSearchEngineSite(draft.url || draft.siteUrl || '');
            if (isExpired || isSearch) {
              toRemove.push(k);
            }
          } catch {}
        }
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
    } catch {}
  }

  /**
   * Purges all drafts saved for search engines from local storage.
   */
  public async purgeSearchEngineDrafts(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const all = await chrome.storage.local.get(null);
        const keysToRemove: string[] = [];
        for (const [k, v] of Object.entries(all)) {
          if (k.startsWith(DRAFT_PREFIX) && v && typeof v === 'object') {
            const draft = v as StoredDraft;
            if (isSearchEngineSite(draft.url || draft.siteUrl || '')) {
              keysToRemove.push(k);
            }
          }
        }
        if (keysToRemove.length > 0) {
          await chrome.storage.local.remove(keysToRemove);
        }
        return;
      }

      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(DRAFT_PREFIX)) {
          try {
            const draft = JSON.parse(localStorage.getItem(k) || '{}') as StoredDraft;
            if (isSearchEngineSite(draft.url || draft.siteUrl || '')) {
              toRemove.push(k);
            }
          } catch {}
        }
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
    } catch {}
  }

  private formatTimeAgo(timestamp: number): string {
    const diffSec = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
    if (diffSec < 60) return 'just now';
    const mins = Math.floor(diffSec / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  private startObserver(): void {
    if (this.observer) return;

    let debounceScan: number | null = null;
    this.observer = new MutationObserver((mutations) => {
      let hasAddedInputs = false;
      for (const m of mutations) {
        for (const node of Array.from(m.addedNodes)) {
          if (node instanceof HTMLElement) {
            if (
              node.matches('textarea, input, [contenteditable="true"], [role="textbox"]') ||
              node.querySelector('textarea, input, [contenteditable="true"], [role="textbox"]')
            ) {
              hasAddedInputs = true;
              break;
            }
          }
        }
        if (hasAddedInputs) break;
      }

      if (hasAddedInputs) {
        if (debounceScan) clearTimeout(debounceScan);
        debounceScan = window.setTimeout(() => {
          this.checkForRecoverableDrafts();
        }, 400);
      }
    });

    this.observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
}

export const formSalvager = new FormSalvager();

/**
 * Global Vault API: Retrieves all saved drafts across any website.
 */
export async function getAllSavedDrafts(): Promise<StoredDraft[]> {
  const drafts: StoredDraft[] = [];
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const all = await chrome.storage.local.get(null);
      for (const [k, v] of Object.entries(all)) {
        if (k.startsWith(DRAFT_PREFIX) && v && typeof v === 'object' && 'value' in v) {
          const draft = v as StoredDraft;
          if (!isSearchEngineSite(draft.url || draft.siteUrl || '')) {
            drafts.push(draft);
          }
        }
      }
    } else {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(DRAFT_PREFIX)) {
          try {
            const draft = JSON.parse(localStorage.getItem(k) || '{}') as StoredDraft;
            if (!isSearchEngineSite(draft.url || draft.siteUrl || '')) {
              drafts.push(draft);
            }
          } catch {}
        }
      }
    }
  } catch (err) {
    console.error('Failed to load saved drafts:', err);
  }

  return drafts.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Global Vault API: Deletes a specific draft by key.
 */
export async function deleteSavedDraft(key: string): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.remove(key);
      return;
    }
    localStorage.removeItem(key);
  } catch {}
}


