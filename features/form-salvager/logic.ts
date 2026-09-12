/**
 * Form Salvager & Crash Guard — Logic Engine
 * Checkpoints active textareas and text inputs into local storage (strictly ignoring passwords and sensitive fields).
 * Protects users from tab crashes and accidental navigation data loss.
 */

import { createRestorePill } from './ui';
import { recordProtectionEvent } from '../../content/storage';

const SENSITIVE_FIELD_REGEX = /(password|pass|secret|cvv|cvc|ssn|creditcard|cardnumber|pin|auth)/i;
const DRAFT_PREFIX = 'zenweb_draft_';

export class FormSalvager {
  private isRunning = false;
  private inputHandler: ((e: Event) => void) | null = null;
  private saveDebounceTimers = new Map<string, number>();

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.attachListeners();
    this.checkForRecoverableDrafts();
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.inputHandler) {
      document.removeEventListener('input', this.inputHandler, true);
      this.inputHandler = null;
    }
  }

  private attachListeners(): void {
    this.inputHandler = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && target.type === 'text')) {
        this.handleInput(target);
      }
    };

    document.addEventListener('input', this.inputHandler, true);
  }

  private handleInput(el: HTMLInputElement | HTMLTextAreaElement): void {
    // Strict privacy filter: ignore passwords or sensitive keys
    if (el.type === 'password' || el.type === 'hidden') return;
    const identifier = el.name || el.id || el.getAttribute('placeholder') || '';
    if (SENSITIVE_FIELD_REGEX.test(identifier) || SENSITIVE_FIELD_REGEX.test(el.autocomplete || '')) return;

    const val = el.value;
    if (val.length < 5) return; // Only save meaningful entries

    const key = this.getElementStorageKey(el);

    // Debounce save to 1 second
    const existing = this.saveDebounceTimers.get(key);
    if (existing) clearTimeout(existing);

    const timer = window.setTimeout(() => {
      try {
        sessionStorage.setItem(`${DRAFT_PREFIX}${key}`, val);
        recordProtectionEvent('formsBackedUp', 1).catch(() => {});
      } catch {}
      this.saveDebounceTimers.delete(key);
    }, 1000);

    this.saveDebounceTimers.set(key, timer);
  }

  private checkForRecoverableDrafts(): void {
    const fields = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('textarea, input[type="text"]');

    fields.forEach((field) => {
      if (field.type === 'password' || field.type === 'hidden') return;
      const identifier = field.name || field.id || '';
      if (SENSITIVE_FIELD_REGEX.test(identifier)) return;

      const key = this.getElementStorageKey(field);
      const saved = sessionStorage.getItem(`${DRAFT_PREFIX}${key}`);

      if (saved && !field.value) {
        // Field is empty but we have a saved draft
        const pill = createRestorePill(() => {
          field.value = saved;
          field.dispatchEvent(new Event('input', { bubbles: true }));
        });
        field.insertAdjacentElement('afterend', pill);
      }
    });
  }

  private getElementStorageKey(el: HTMLElement): string {
    const path = window.location.pathname;
    const name = el.getAttribute('name') || el.id || 'field';
    return `${path}_${name}`;
  }
}

export const formSalvager = new FormSalvager();
