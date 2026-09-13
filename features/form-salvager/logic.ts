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

    // Keyboard shortcut: Alt+R / ⌥R for instant hands-free restoration
    this.keydownListener = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'r' || e.key === 'R' || e.code === 'KeyR')) {
        const active = document.activeElement as HTMLElement | null;
        if (active && this.isSalvagableField(active)) {
          const val = this.getElementValue(active);
          if (val.trim().length <= 2) {
            const key = this.getElementStorageKey(active);
            this.getStoredDraft(key).then((draft) => {
              if (draft && draft.value.trim().length >= 5) {
                e.preventDefault();
                e.stopPropagation();
                this.setElementValue(active, draft.value, draft.isContentEditable);
                flashRestoredGlow(active);
                dismissRestorePill(active);
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
   * Evaluates whether an element is an eligible text input while strictly enforcing privacy blacklists.
   */
  public isSalvagableField(el: HTMLElement): boolean {
    if (el instanceof HTMLInputElement) {
      const type = (el.type || 'text').toLowerCase();
      const allowedTypes = ['text', 'search', 'url', 'email', 'tel'];
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

      const draft: StoredDraft = {
        url: window.location.origin + window.location.pathname,
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
   * Coordinates form-level "Restore All" banners when 2+ fields in a form have drafts.
   */
  public async checkForRecoverableDrafts(): Promise<void> {
    const candidates = document.querySelectorAll<HTMLElement>(
      'textarea, input, [contenteditable="true"], [role="textbox"]'
    );

    const formRecoverableMap = new Map<HTMLFormElement, Array<{ el: HTMLElement; draft: StoredDraft }>>();

    for (const el of Array.from(candidates)) {
      if (!this.isSalvagableField(el)) continue;

      const currentVal = this.getElementValue(el);
      if (currentVal.trim().length > 2) continue;

      const key = this.getElementStorageKey(el);
      const draft = await this.getStoredDraft(key);

      if (draft && draft.value.trim().length >= 5) {
        // Snippet preview (up to 75 characters)
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

        // Group by form for consolidated banner
        const form = el.closest('form');
        if (form) {
          const list = formRecoverableMap.get(form) || [];
          list.push({ el, draft });
          formRecoverableMap.set(form, list);
        }
      }
    }

    // Form-Level "Restore All" Banner
    for (const [form, items] of formRecoverableMap.entries()) {
      if (items.length >= 2) {
        showFormLevelBanner(
          form,
          items.length,
          () => {
            // Restore all fields in this form
            items.forEach(({ el, draft }) => {
              this.setElementValue(el, draft.value, draft.isContentEditable);
              flashRestoredGlow(el);
              dismissRestorePill(el);
            });
            recordProtectionEvent('formsBackedUp', items.length).catch(() => {});
          },
          () => {
            // Dismiss all
            items.forEach(({ el, draft }) => {
              this.removeStoredDraft(draft.fieldKey);
              dismissRestorePill(el);
            });
          }
        );
      }
    }
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
  }

  /**
   * Generates a deterministic, collision-free storage key for a given input element.
   */
  public getElementStorageKey(el: HTMLElement): string {
    const origin = window.location.origin;
    const path = window.location.pathname;

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

    return `${DRAFT_PREFIX}${origin}${path}::form[${formId}]::${descriptor}`;
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
        return res[key] ? (res[key] as StoredDraft) : null;
      }
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as StoredDraft) : null;
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
          if (k.startsWith(DRAFT_PREFIX) && v && typeof v === 'object' && 'timestamp' in v) {
            const draft = v as StoredDraft;
            if (now - draft.timestamp > TTL_MS) {
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
            if (draft.timestamp && now - draft.timestamp > TTL_MS) {
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
          drafts.push(v as StoredDraft);
        }
      }
    } else {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(DRAFT_PREFIX)) {
          try {
            drafts.push(JSON.parse(localStorage.getItem(k) || '{}') as StoredDraft);
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


