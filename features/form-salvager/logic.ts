/**
 * Form Salvager & Crash Guard — Universal Logic Engine 3.2
 * Bulletproof checkpointing and restoration for:
 * - Radio button groups (DOM-native name group resolution, label fallback, auto-sibling uncheck)
 * - Dropdown menus (<select>, Select2, Choices.js, split hour/min selectors)
 * - Date & Time selection modals (jQuery UI Datepicker, Flatpickr, native date/time pickers)
 * - Checkbox arrays & standalone checkboxes
 * - Textareas, inputs, and rich-text editors
 *
 * SPA Reactivity Support: Invokes native prototype property setters for React, Vue, & Angular.
 * Strictly guarantees privacy: zero capture of passwords, credit cards, CVVs, or sensitive tokens.
 */

import {
  showSiteRestorePrompt,
  dismissSiteRestorePrompt,
  flashRestoredGlow,
  removeAllRestorePills,
} from './ui';
import { recordProtectionEvent } from '../../content/storage';

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'contenteditable'
  | 'radio'
  | 'checkbox'
  | 'select-one'
  | 'select-multiple'
  | 'temporal'
  | 'range'
  | 'color';

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
  fieldKind?: FieldKind;
  value: string;
  checked?: boolean;
  selectedValues?: string[];
  timestamp: number;
  wordCount: number;
  isContentEditable: boolean;
  revisions: DraftRevision[];
}

interface ExtractedFieldState {
  kind: FieldKind;
  value: string;
  checked?: boolean;
  selectedValues?: string[];
  isEmpty: boolean;
  wordCount: number;
}

const SENSITIVE_REGEX = /(password|pass(?!port|enger)|secret|cvv|cvc|ssn|creditcard|cardnumber|card[-_]no|pin\b|auth\b|token\b|otp\b|security[-_]code)/i;
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

/* ── Custom Dropdown & React-Select Automation Helpers ── */

export function getCustomDropdownContainer(el: HTMLElement): HTMLElement | null {
  if (!el) return null;

  // 1. Direct match on known custom containers or wrappers
  if (
    el.id === 'subjectsContainer' ||
    el.id === 'state' ||
    el.id === 'city' ||
    el.classList.contains('subjects-auto-complete__control') ||
    /select2-container|choices/i.test(el.className)
  ) {
    return el;
  }

  // 2. If element is inside known custom containers, return the container immediately
  const known = el.closest<HTMLElement>(
    '#subjectsContainer, #state, #city, .subjects-auto-complete__control, .select2-container, .choices'
  );
  if (known) return known;

  // 3. For generic React-Select or custom tag/dropdown components:
  // Walk up to find the control/wrapper that contains the value container or pills,
  // strictly skipping inner input wrappers like .__input-container
  let curr: HTMLElement | null = el.parentElement;
  let candidate: HTMLElement | null = null;

  while (curr && curr !== document.body) {
    const cls = curr.className || '';
    const isInputWrapper = /input-container|input_container/i.test(cls);

    if (!isInputWrapper) {
      if (
        curr.id === 'subjectsContainer' ||
        curr.id === 'state' ||
        curr.id === 'city' ||
        /control|select2|choices/i.test(cls) ||
        ((cls.includes('-container') || cls.includes('__container')) && !cls.includes('input-container'))
      ) {
        if (
          curr.querySelector(
            '[class*="value-container"], [class*="valueContainer"], [class*="singleValue"], [class*="multiValue"], [class*="single-value"], [class*="multi-value"], [class*="placeholder"], input[id^="react-select"], input#subjectsInput'
          )
        ) {
          candidate = curr;
        }
      }
    }
    curr = curr.parentElement;
  }

  return candidate;
}

export async function selectReactOption(inputElement: HTMLElement, textValue: string): Promise<boolean> {
  if (!textValue) return false;
  let targetInput: HTMLInputElement | null = null;
  if (inputElement instanceof HTMLInputElement) {
    targetInput = inputElement;
  } else {
    targetInput = inputElement.querySelector('input');
  }

  if (!targetInput) return false;

  try {
    targetInput.focus();
  } catch {}

  try {
    targetInput.value = '';
    document.execCommand('insertText', false, textValue);
  } catch {
    applyNativeInputValue(targetInput, textValue);
    dispatchChangeEvents(targetInput);
  }

  await new Promise((r) => setTimeout(r, 60));

  try {
    targetInput.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      })
    );
  } catch {}

  await new Promise((r) => setTimeout(r, 60));
  const openOption = Array.from(
    document.querySelectorAll('[class*="-option"], [class*="__option"], [role="option"]')
  ).find((opt) => opt.textContent?.trim().toLowerCase() === textValue.toLowerCase());

  if (openOption instanceof HTMLElement) {
    openOption.click();
  }

  return true;
}

export async function selectReactMultiOptions(inputElement: HTMLElement, values: string[]): Promise<void> {
  for (const val of values) {
    if (!val) continue;
    await selectReactOption(inputElement, val);
    await new Promise((r) => setTimeout(r, 120));
  }
}

/**
 * Universal field classifier: Maps an element to its canonical FieldKind.
 */
export function classifyField(el: HTMLElement): FieldKind | null {
  if (el.isContentEditable || el.getAttribute('role') === 'textbox') {
    return 'contenteditable';
  }
  if (el instanceof HTMLTextAreaElement) {
    return 'textarea';
  }
  if (el instanceof HTMLSelectElement) {
    return el.multiple ? 'select-multiple' : 'select-one';
  }

  const customDropdown = getCustomDropdownContainer(el);
  if (customDropdown) {
    if (
      customDropdown.classList.contains('subjects-auto-complete__control') ||
      customDropdown.id === 'subjectsContainer' ||
      customDropdown.querySelector('[class*="multiValue"], [class*="multi-value"], [class*="__multi-value"], .select2-selection--multiple') ||
      el.id === 'subjectsInput'
    ) {
      return 'select-multiple';
    }
    return 'select-one';
  }

  if (el instanceof HTMLInputElement) {
    const type = (el.type || 'text').toLowerCase();
    if (type === 'radio') return 'radio';
    if (type === 'checkbox') return 'checkbox';
    if (
      ['date', 'time', 'datetime-local', 'month', 'week'].includes(type) ||
      el.classList.contains('hasDatepicker') ||
      /datepicker|timepicker|datetimepicker/i.test(el.className) ||
      el.getAttribute('data-provide') === 'datepicker' ||
      (el.id && /date|dob|birth|calendar/i.test(el.id)) ||
      el.closest('.react-datepicker-wrapper, [class*="datepicker"], [class*="date-picker"]') !== null
    ) {
      return 'temporal';
    }
    if (type === 'range') return 'range';
    if (type === 'color') return 'color';
    if (['text', 'url', 'email', 'tel', 'number', 'search'].includes(type)) return 'text';
  }
  return null;
}

/* ── SPA Reactivity Helpers: Native Prototype Property Setters ── */

function applyNativeInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  try {
    const tracker = (input as any)._valueTracker;
    if (tracker) {
      tracker.setValue('');
    }
    const proto = input instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) {
      desc.set.call(input, value);
    } else {
      input.value = value;
    }
  } catch {
    input.value = value;
  }
}

function applyNativeChecked(input: HTMLInputElement, checked: boolean): void {
  try {
    const tracker = (input as any)._valueTracker;
    if (tracker) {
      tracker.setValue(!checked);
    }
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
    if (desc && desc.set) {
      desc.set.call(input, checked);
    } else {
      input.checked = checked;
    }
  } catch {
    input.checked = checked;
  }
}

function applyNativeSelectValue(select: HTMLSelectElement, value: string): void {
  try {
    const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    if (desc && desc.set) {
      desc.set.call(select, value);
    } else {
      select.value = value;
    }
  } catch {
    select.value = value;
  }
}

function dispatchChangeEvents(el: HTMLElement): void {
  try {
    el.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  } catch {
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }
  el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
}

export class FormSalvager {
  private isRunning = false;
  private inputListener: ((e: Event) => void) | null = null;
  private changeListener: ((e: Event) => void) | null = null;
  private clickListener: ((e: MouseEvent) => void) | null = null;
  private blurListener: ((e: FocusEvent) => void) | null = null;
  private submitListener: ((e: Event) => void) | null = null;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private observer: MutationObserver | null = null;
  private saveDebounceTimers = new Map<string, number>();
  private widgetSyncInterval: number | null = null;
  private lastTrackedValues = new Map<HTMLElement, string>();

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

    // Proactive background widget scanner: captures programmatic updates from custom datepickers, Select2, and sliders
    this.widgetSyncInterval = window.setInterval(() => {
      this.scanActiveWidgets();
    }, 1000);
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.inputListener) {
      document.removeEventListener('input', this.inputListener, true);
      this.inputListener = null;
    }

    if (this.changeListener) {
      document.removeEventListener('change', this.changeListener, true);
      this.changeListener = null;
    }

    if (this.clickListener) {
      document.removeEventListener('click', this.clickListener, true);
      this.clickListener = null;
    }

    if (this.blurListener) {
      document.removeEventListener('focusout', this.blurListener, true);
      this.blurListener = null;
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

    if (this.widgetSyncInterval) {
      clearInterval(this.widgetSyncInterval);
      this.widgetSyncInterval = null;
    }

    for (const timer of this.saveDebounceTimers.values()) {
      clearTimeout(timer);
    }
    this.saveDebounceTimers.clear();
    this.lastTrackedValues.clear();

    removeAllRestorePills();
  }

  /**
   * Attaches typing, selection change, radio click, modal click delegation, blur, form submit, and Alt+R shortcut listeners.
   */
  private attachListeners(): void {
    this.inputListener = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (this.isSalvagableField(target)) {
        this.handleFieldUpdate(target, 'input');
      }
    };

    this.changeListener = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (this.isSalvagableField(target)) {
        this.handleFieldUpdate(target, 'change');
      }
    };

    // Click listener handles radio/checkbox clicks, label clicks, tag removes, and dropdown option clicks
    this.clickListener = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // 1. Direct click on radio or checkbox input
      if (target instanceof HTMLInputElement && (target.type === 'radio' || target.type === 'checkbox')) {
        if (this.isSalvagableField(target)) {
          this.handleFieldUpdate(target, 'click');
        }
        return;
      }

      // 2. Click on label associated with radio or checkbox (e.g. Bootstrap custom-control or form-check)
      const label = target instanceof HTMLLabelElement ? target : target.closest('label');
      if (label) {
        const forId = label.getAttribute('for');
        let associatedInput: HTMLInputElement | null = null;
        if (forId) {
          const el = document.getElementById(forId);
          if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) {
            associatedInput = el;
          }
        } else {
          associatedInput = label.querySelector('input[type="radio"], input[type="checkbox"]');
        }

        if (associatedInput && this.isSalvagableField(associatedInput)) {
          window.setTimeout(() => {
            if (associatedInput) {
              this.handleFieldUpdate(associatedInput, 'label_click');
            }
          }, 40);
        }
      }

      // 3. Detect clicks inside datepicker calendar popups or custom dropdown option lists or tag remove pills
      const isWidgetOrTagClick = Boolean(
        target.closest(
          '#ui-datepicker-div, .ui-datepicker, .flatpickr-calendar, .datepicker, .pika-single, .vanilla-calendar, [class*="datepicker"], [class*="calendar"], .select2-results__option, .select2-selection, .select2-container, .choices__list, .choices__item, [role="listbox"], [role="option"], [class*="-option"], [class*="__option"], [class*="multi-value"], [class*="multiValue"], [class*="remove"], [class*="indicator"], [class*="badge"]'
        )
      );

      if (isWidgetOrTagClick) {
        window.setTimeout(() => {
          this.scanActiveWidgets();
        }, 50);
        window.setTimeout(() => {
          this.scanActiveWidgets();
        }, 220);
      }
    };

    // Focusout captures values when user finishes interacting with a popup or field
    this.blurListener = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (this.isSalvagableField(target)) {
        this.handleFieldUpdate(target, 'blur');
      }
      this.scanActiveWidgets();
    };

    this.submitListener = (e: Event) => {
      const target = e.target as HTMLElement | null;
      const form = target instanceof HTMLFormElement ? target : target?.closest('form');
      if (form) {
        this.handleFormSubmitted(form);
      }
    };

    // Keyboard shortcut: Alt+R for restoration; Enter or comma in custom tag inputs triggers immediate widget sync
    this.keydownListener = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ',') {
        const custom = getCustomDropdownContainer(e.target as HTMLElement);
        if (custom) {
          window.setTimeout(() => this.scanActiveWidgets(), 60);
          window.setTimeout(() => this.scanActiveWidgets(), 220);
        }
      }

      const isAltOnly = e.altKey && !e.ctrlKey && !e.metaKey;
      const isR = e.code === 'KeyR' || e.key === 'r' || e.key === 'R' || e.key === '®';

      if (isAltOnly && isR) {
        let active = document.activeElement as HTMLElement | null;
        if (active && (active as any).shadowRoot && (active as any).shadowRoot.activeElement) {
          active = (active as any).shadowRoot.activeElement as HTMLElement;
        }

        if (active && this.isSalvagableField(active)) {
          const key = this.getElementStorageKey(active);
          this.getStoredDraft(key).then((draft) => {
            if (draft) {
              e.preventDefault();
              e.stopPropagation();
              this.applyFieldState(active!, draft);
              recordProtectionEvent('formsBackedUp', 1).catch(() => {});
            }
          });
        }
      }
    };

    document.addEventListener('input', this.inputListener, true);
    document.addEventListener('change', this.changeListener, true);
    document.addEventListener('click', this.clickListener, true);
    document.addEventListener('focusout', this.blurListener, true);
    document.addEventListener('submit', this.submitListener, true);
    document.addEventListener('keydown', this.keydownListener, true);
  }

  /**
   * Scans active form widgets (datepickers, Select2 dropdowns, sliders, React-Select) for programmatic value changes.
   */
  private scanActiveWidgets(): void {
    if (!this.isRunning || isSearchEngineSite()) return;

    const candidates = document.querySelectorAll<HTMLElement>(
      'input, select, textarea, [contenteditable="true"], #state, #city, #subjectsContainer, [class*="-container"], [class*="__container"], [class*="select2-container"], .choices'
    );

    for (const el of Array.from(candidates)) {
      if (!this.isSalvagableField(el)) continue;

      const state = this.extractFieldState(el);
      if (!state) continue;

      const currentVal = state.value;
      const lastVal = this.lastTrackedValues.get(el);

      if (lastVal === undefined) {
        this.lastTrackedValues.set(el, currentVal);
        continue;
      }

      if (currentVal !== lastVal) {
        this.lastTrackedValues.set(el, currentVal);
        this.handleFieldUpdate(el, 'widget_sync');
      }
    }
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
   * Evaluates whether an element is an eligible form field while strictly enforcing privacy blacklists.
   */
  public isSalvagableField(el: HTMLElement): boolean {
    if (isSearchEngineSite()) return false;
    if (this.isSearchField(el)) return false;

    const kind = classifyField(el);
    if (!kind) return false;

    // Strict Privacy Blacklist
    if (el instanceof HTMLInputElement) {
      const type = (el.type || 'text').toLowerCase();
      if (['password', 'hidden', 'submit', 'button', 'reset', 'image', 'file'].includes(type)) {
        return false;
      }
    }

    const autocomplete = (el.getAttribute('autocomplete') || '').toLowerCase();
    if (SENSITIVE_AUTOCOMPLETE_REGEX.test(autocomplete)) {
      return false;
    }

    const identifier = `${el.id} ${el.getAttribute('name') || ''} ${el.getAttribute('placeholder') || ''} ${el.getAttribute('aria-label') || ''}`;
    if (SENSITIVE_REGEX.test(identifier)) {
      return false;
    }

    if (el.hasAttribute('data-private') || el.hasAttribute('data-secret') || el.hasAttribute('data-no-salvage')) {
      return false;
    }

    return true;
  }

  /**
   * Safely extracts current value, checked state, or multi-select array from any form element.
   * Uses DOM-native name collections (document.getElementsByName) to avoid CSS selector escaping bugs.
   */
  public extractFieldState(el: HTMLElement): ExtractedFieldState | null {
    const kind = classifyField(el);
    if (!kind) return null;

    switch (kind) {
      case 'radio': {
        const radio = el as HTMLInputElement;
        const groupName = radio.name;
        if (groupName) {
          const groupRadios = Array.from(document.getElementsByName(groupName)).filter(
            (r): r is HTMLInputElement => r instanceof HTMLInputElement && r.type === 'radio'
          );
          const checkedRadio = groupRadios.find((r) => r.checked);
          if (checkedRadio) {
            return {
              kind: 'radio',
              value: checkedRadio.value,
              checked: true,
              isEmpty: false,
              wordCount: 1,
            };
          }
          return {
            kind: 'radio',
            value: '',
            checked: false,
            isEmpty: true,
            wordCount: 0,
          };
        }
        return {
          kind: 'radio',
          value: radio.value,
          checked: radio.checked,
          isEmpty: !radio.checked,
          wordCount: radio.checked ? 1 : 0,
        };
      }

      case 'checkbox': {
        const cb = el as HTMLInputElement;
        const groupName = cb.name;
        if (groupName) {
          const matching = Array.from(document.getElementsByName(groupName)).filter(
            (c): c is HTMLInputElement => c instanceof HTMLInputElement && c.type === 'checkbox'
          );
          if (matching.length > 1 || groupName.endsWith('[]')) {
            const checkedCbs = matching.filter((c) => c.checked);
            const selectedValues = checkedCbs.map((c) => c.value);
            return {
              kind: 'checkbox',
              value: selectedValues.join(', '),
              selectedValues,
              isEmpty: selectedValues.length === 0,
              wordCount: selectedValues.length,
            };
          }
        }
        return {
          kind: 'checkbox',
          value: cb.checked ? (cb.value || 'true') : '',
          checked: cb.checked,
          isEmpty: !cb.checked,
          wordCount: cb.checked ? 1 : 0,
        };
      }

      case 'select-one': {
        if (el instanceof HTMLSelectElement) {
          const select = el;
          const val = select.value;
          const selectedOpt = select.options[select.selectedIndex];
          const selectedText = selectedOpt?.text?.trim() || '';

          // An option is a placeholder only if value is blank or text explicitly matches placeholder keywords
          const isPlaceholder =
            !val ||
            (select.selectedIndex <= 0 &&
              /^(select|choose|--|please\s+select)/i.test(selectedText));

          return {
            kind: 'select-one',
            value: val || selectedText,
            isEmpty: isPlaceholder,
            wordCount: isPlaceholder ? 0 : 1,
          };
        }

        // Custom dropdown / React-Select single-select
        const customContainer = getCustomDropdownContainer(el) || el;
        const singleValEl = customContainer.querySelector(
          '[class*="singleValue"], [class*="single-value"], [class*="__single-value"], .select2-selection__rendered'
        );
        const text = (singleValEl?.textContent || '').trim();

        if (text) {
          return {
            kind: 'select-one',
            value: text,
            isEmpty: false,
            wordCount: 1,
          };
        }

        return {
          kind: 'select-one',
          value: '',
          isEmpty: true,
          wordCount: 0,
        };
      }

      case 'select-multiple': {
        if (el instanceof HTMLSelectElement) {
          const select = el;
          const selected = Array.from(select.selectedOptions)
            .map((o) => o.value || o.text.trim())
            .filter(Boolean);
          return {
            kind: 'select-multiple',
            value: selected.join(', '),
            selectedValues: selected,
            isEmpty: selected.length === 0,
            wordCount: selected.length,
          };
        }

        // Custom dropdown / React-Select multi-select
        const customContainer = getCustomDropdownContainer(el) || el;
        const pillElements = Array.from(
          customContainer.querySelectorAll(
            '.subjects-auto-complete__multi-value, [class*="multiValue"], [class*="multi-value"], [class*="__multi-value"], .select2-selection__choice, .tagify__tag, .bootstrap-tagsinput .tag'
          )
        );

        const multiLabels: string[] = [];
        for (const pill of pillElements) {
          const labelChild = pill.querySelector(
            '[class*="label"], [class*="Label"], .subjects-auto-complete__multi-value__label, span'
          );
          if (labelChild && labelChild.textContent) {
            const t = labelChild.textContent.trim();
            if (t && !multiLabels.includes(t)) multiLabels.push(t);
          } else {
            const clone = pill.cloneNode(true) as HTMLElement;
            clone.querySelectorAll('[role="button"], button, [class*="remove"], [class*="close"]').forEach((btn) => btn.remove());
            const t = clone.textContent?.trim() || '';
            if (t && !multiLabels.includes(t)) multiLabels.push(t);
          }
        }

        return {
          kind: 'select-multiple',
          value: multiLabels.join(', '),
          selectedValues: multiLabels,
          isEmpty: multiLabels.length === 0,
          wordCount: multiLabels.length,
        };
      }

      case 'temporal':
      case 'range':
      case 'color': {
        const input = el as HTMLInputElement;
        const val = (input.value || '').trim();
        return {
          kind,
          value: val,
          isEmpty: val.length === 0,
          wordCount: val.length > 0 ? 1 : 0,
        };
      }

      case 'contenteditable': {
        const text = (el.innerText || el.textContent || '').trim();
        const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
        return {
          kind: 'contenteditable',
          value: text,
          isEmpty: text.length === 0,
          wordCount: words,
        };
      }

      case 'textarea':
      case 'text':
      default: {
        const val = ((el as HTMLInputElement | HTMLTextAreaElement).value || '').trim();
        const words = val ? val.split(/\s+/).filter(Boolean).length : 0;
        return {
          kind: kind || 'text',
          value: val,
          isEmpty: val.length === 0,
          wordCount: words,
        };
      }
    }
  }

  /**
   * Two-tier debounced state checkpointing:
   * - Selection controls (radio, checkbox, select, date/time): 25ms debounce.
   * - Text typing (textarea, text, contenteditable): 350ms debounce.
   */
  private handleFieldUpdate(el: HTMLElement, _eventType: string): void {
    if (isSearchEngineSite() || this.isSearchField(el)) return;

    const state = this.extractFieldState(el);
    if (!state) return;

    const key = this.getElementStorageKey(el);

    const existingTimer = this.saveDebounceTimers.get(key);
    if (existingTimer) clearTimeout(existingTimer);

    if (state.isEmpty) {
      this.removeStoredDraft(key);
      return;
    }

    // For free-text typing, require at least 3 characters before saving
    if ((state.kind === 'text' || state.kind === 'textarea' || state.kind === 'contenteditable') && state.value.length < 3) {
      return;
    }

    // Adaptive debounce duration based on control type
    const isSelection =
      state.kind === 'radio' ||
      state.kind === 'checkbox' ||
      state.kind === 'select-one' ||
      state.kind === 'select-multiple' ||
      state.kind === 'color' ||
      state.kind === 'temporal';
    const debounceMs = isSelection ? 25 : 350;

    const timer = window.setTimeout(async () => {
      const now = Date.now();
      const label = this.getElementHumanLabel(el);

      const existing = await this.getStoredDraft(key);
      let revisions: DraftRevision[] = existing?.revisions ? [...existing.revisions] : [];

      if (existing && existing.value && existing.value !== state.value) {
        const lastRev = revisions[revisions.length - 1];
        if (!lastRev || Math.abs(lastRev.value.length - existing.value.length) > 2) {
          revisions.push({
            value: existing.value,
            timestamp: existing.timestamp || now - 5000,
            wordCount: existing.wordCount || 1,
          });
        }
      }

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
        fieldKind: state.kind,
        value: state.value,
        checked: state.checked,
        selectedValues: state.selectedValues,
        timestamp: now,
        wordCount: state.wordCount,
        isContentEditable: el.isContentEditable,
        revisions,
      };

      await this.saveStoredDraft(key, draft);
      this.saveDebounceTimers.delete(key);
    }, debounceMs);

    this.saveDebounceTimers.set(key, timer);
  }

  /**
   * Applies a stored draft back to any element or group, dispatching synthetic events,
   * setting prototype properties for React/Vue/Angular, and synchronizing Select2 / React-Select wrappers.
   */
  public async applyFieldState(el: HTMLElement, draft: StoredDraft): Promise<void> {
    const kind = draft.fieldKind || classifyField(el) || 'text';

    switch (kind) {
      case 'radio': {
        const radio = el as HTMLInputElement;
        const groupName = radio.name;
        const radios = groupName
          ? Array.from(document.getElementsByName(groupName)).filter(
              (r): r is HTMLInputElement => r instanceof HTMLInputElement && r.type === 'radio'
            )
          : [radio];

        // 1. Match by value attribute
        let targetRadio = radios.find(
          (r) => r.value === draft.value || r.value.toLowerCase() === draft.value.toLowerCase()
        );

        // 2. Fallback: match by label text (for cases where value is an autogenerated index or 'on')
        if (!targetRadio) {
          targetRadio = radios.find((r) => {
            const label = r.id ? document.querySelector(`label[for="${r.id}"]`) : r.closest('label');
            const text = label?.textContent?.trim() || '';
            return text.toLowerCase() === draft.value.toLowerCase();
          });
        }

        if (targetRadio) {
          // Uncheck siblings first
          radios.forEach((r) => {
            if (r !== targetRadio) {
              applyNativeChecked(r, false);
              r.checked = false;
            }
          });

          // Check target radio
          applyNativeChecked(targetRadio, true);
          targetRadio.checked = true;

          // Dispatch events
          try {
            targetRadio.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          } catch {}
          dispatchChangeEvents(targetRadio);

          // Click associated label if available (handles visually hidden Bootstrap radios)
          const assocLabel = targetRadio.id
            ? document.querySelector<HTMLElement>(`label[for="${targetRadio.id}"]`)
            : targetRadio.closest('label');
          if (assocLabel) {
            try {
              assocLabel.click();
            } catch {}
          }

          flashRestoredGlow(targetRadio);
        }
        break;
      }

      case 'checkbox': {
        const cb = el as HTMLInputElement;
        const groupName = cb.name;

        if (draft.selectedValues && draft.selectedValues.length > 0 && groupName) {
          const checkboxes = Array.from(document.getElementsByName(groupName)).filter(
            (c): c is HTMLInputElement => c instanceof HTMLInputElement && c.type === 'checkbox'
          );

          checkboxes.forEach((item) => {
            const label = item.id ? document.querySelector<HTMLElement>(`label[for="${item.id}"]`) : item.closest('label');
            const labelText = label?.textContent?.trim() || '';
            const shouldCheck =
              draft.selectedValues!.includes(item.value) ||
              draft.selectedValues!.includes(labelText);

            applyNativeChecked(item, shouldCheck);
            item.checked = shouldCheck;
            dispatchChangeEvents(item);
            if (shouldCheck) flashRestoredGlow(item);
          });
          return;
        }

        const shouldCheck = draft.checked !== undefined ? draft.checked : Boolean(draft.value);
        applyNativeChecked(cb, shouldCheck);
        cb.checked = shouldCheck;
        dispatchChangeEvents(cb);
        if (shouldCheck) flashRestoredGlow(cb);
        break;
      }

      case 'select-one': {
        const customContainer = getCustomDropdownContainer(el);
        if (customContainer && !(el instanceof HTMLSelectElement)) {
          const targetInput = el instanceof HTMLInputElement ? el : customContainer.querySelector('input');
          if (targetInput && draft.value) {
            await selectReactOption(targetInput, draft.value);
            flashRestoredGlow(customContainer);
            if (targetInput !== customContainer) flashRestoredGlow(targetInput);
          }
          break;
        }

        const select = el as HTMLSelectElement;
        let matchedIndex = -1;

        // Find option matching draft.value by value or text
        for (let i = 0; i < select.options.length; i++) {
          const opt = select.options[i];
          if (
            opt.value === draft.value ||
            opt.text.trim() === draft.value ||
            opt.value.toLowerCase() === draft.value.toLowerCase() ||
            opt.text.trim().toLowerCase() === draft.value.toLowerCase()
          ) {
            matchedIndex = i;
            break;
          }
        }

        if (matchedIndex !== -1) {
          for (let i = 0; i < select.options.length; i++) {
            select.options[i].selected = i === matchedIndex;
          }
          select.selectedIndex = matchedIndex;
          applyNativeSelectValue(select, select.options[matchedIndex].value);
          select.value = select.options[matchedIndex].value;

          dispatchChangeEvents(select);

          // Synchronize Select2 visible container if wrapped
          const selectedText = select.options[matchedIndex].text;
          const container =
            (select.nextElementSibling?.classList.contains('select2') ? select.nextElementSibling : null) ||
            select.parentElement?.querySelector('.select2-container') ||
            document.querySelector(`[aria-labelledby*="${select.id}"]`);

          const renderedSpan =
            container?.querySelector('.select2-selection__rendered') ||
            document.getElementById(`select2-${select.id}-container`);

          if (renderedSpan) {
            renderedSpan.textContent = selectedText;
            renderedSpan.setAttribute('title', selectedText);
          }

          flashRestoredGlow(select);
          if (container instanceof HTMLElement) {
            flashRestoredGlow(container);
          }
        }
        break;
      }

      case 'select-multiple': {
        const customContainer = getCustomDropdownContainer(el);
        if (customContainer && !(el instanceof HTMLSelectElement)) {
          const targetInput = el instanceof HTMLInputElement ? el : customContainer.querySelector('input');
          const targetVals = draft.selectedValues || draft.value.split(',').map((s) => s.trim()).filter(Boolean);
          if (targetInput && targetVals.length > 0) {
            await selectReactMultiOptions(targetInput, targetVals);
            flashRestoredGlow(customContainer);
            if (targetInput !== customContainer) flashRestoredGlow(targetInput);
          }
          break;
        }

        const select = el as HTMLSelectElement;
        const targetVals = draft.selectedValues || draft.value.split(',').map((s) => s.trim());
        for (let i = 0; i < select.options.length; i++) {
          const opt = select.options[i];
          opt.selected = targetVals.includes(opt.value) || targetVals.includes(opt.text.trim());
        }
        dispatchChangeEvents(select);
        flashRestoredGlow(select);
        break;
      }

      case 'temporal': {
        const input = el as HTMLInputElement;
        applyNativeInputValue(input, draft.value);
        input.value = draft.value;
        dispatchChangeEvents(input);
        flashRestoredGlow(input);
        break;
      }

      case 'contenteditable': {
        el.innerText = draft.value;
        dispatchChangeEvents(el);
        flashRestoredGlow(el);
        break;
      }

      case 'range':
      case 'color':
      case 'textarea':
      case 'text':
      default: {
        applyNativeInputValue(el as HTMLInputElement | HTMLTextAreaElement, draft.value);
        dispatchChangeEvents(el);
        flashRestoredGlow(el);
        break;
      }
    }
  }

  /**
   * Checks the document for fields that have unapplied saved drafts in storage.
   * Correctly compares current DOM state vs draft state (handles default dropdown values like '00').
   * Displays the SINGLE floating corner restore prompt offering to reload all saved data.
   */
  public async checkForRecoverableDrafts(): Promise<void> {
    if (isSearchEngineSite()) {
      dismissSiteRestorePrompt();
      return;
    }

    const candidates = document.querySelectorAll<HTMLElement>(
      'textarea, input, select, [contenteditable="true"], [role="textbox"]'
    );

    const allRecoverable: Array<{ el: HTMLElement; draft: StoredDraft; key: string }> = [];
    const processedKeys = new Set<string>();

    for (const el of Array.from(candidates)) {
      if (!this.isSalvagableField(el)) continue;

      const key = this.getElementStorageKey(el);
      if (processedKeys.has(key)) continue;

      const draft = await this.getStoredDraft(key);
      if (!draft) continue;

      const kind = draft.fieldKind || classifyField(el);
      let isRecoverable = false;

      switch (kind) {
        case 'radio': {
          const radio = el as HTMLInputElement;
          const groupRadios = radio.name
            ? Array.from(document.getElementsByName(radio.name)).filter(
                (r): r is HTMLInputElement => r instanceof HTMLInputElement && r.type === 'radio'
              )
            : [radio];

          const checkedRadio = groupRadios.find((r) => r.checked);
          const currentVal = checkedRadio ? checkedRadio.value : '';

          // If none is checked, or currently checked radio does not match draft value
          if (!checkedRadio || (currentVal !== draft.value && currentVal.toLowerCase() !== draft.value.toLowerCase())) {
            isRecoverable = Boolean(draft.value);
          }
          break;
        }

        case 'checkbox': {
          const cb = el as HTMLInputElement;
          if (draft.selectedValues && draft.selectedValues.length > 0) {
            const groupCbs = cb.name
              ? Array.from(document.getElementsByName(cb.name)).filter(
                  (c): c is HTMLInputElement => c instanceof HTMLInputElement && c.type === 'checkbox'
                )
              : [cb];
            const currentCheckedVals = groupCbs.filter((c) => c.checked).map((c) => c.value);
            const isSame =
              currentCheckedVals.length === draft.selectedValues.length &&
              currentCheckedVals.every((v) => draft.selectedValues!.includes(v));
            if (!isSame) {
              isRecoverable = true;
            }
          } else {
            if (cb.checked !== Boolean(draft.checked)) {
              isRecoverable = Boolean(draft.checked);
            }
          }
          break;
        }

        case 'select-one': {
          let currentVal = '';
          if (el instanceof HTMLSelectElement) {
            currentVal = el.value || el.options[el.selectedIndex]?.text?.trim() || '';
          } else {
            const container = getCustomDropdownContainer(el) || el;
            const single = container.querySelector(
              '[class*="singleValue"], [class*="single-value"], [class*="__single-value"], .select2-selection__rendered'
            );
            currentVal = (single?.textContent || '').trim();
          }

          const matchesDraft =
            currentVal === draft.value ||
            currentVal.toLowerCase() === draft.value.toLowerCase();

          // Recoverable if current selection does not match draft
          if (!matchesDraft && draft.value) {
            isRecoverable = true;
          }
          break;
        }

        case 'select-multiple': {
          let currentVals: string[] = [];
          if (el instanceof HTMLSelectElement) {
            currentVals = Array.from(el.selectedOptions).map((o) => o.value || o.text.trim());
          } else {
            const container = getCustomDropdownContainer(el) || el;
            currentVals = Array.from(
              container.querySelectorAll(
                '[class*="multiValue__label"], [class*="multi-value__label"], [class*="__multi-value__label"], .subjects-auto-complete__multi-value__label, .select2-selection__choice'
              )
            ).map((e) => (e.textContent || '').trim()).filter(Boolean);
          }

          const targetVals = draft.selectedValues || draft.value.split(',').map((s) => s.trim()).filter(Boolean);
          const isSame =
            currentVals.length === targetVals.length &&
            currentVals.every((v) => targetVals.includes(v));
          if (!isSame && targetVals.length > 0) {
            isRecoverable = true;
          }
          break;
        }

        case 'temporal': {
          const input = el as HTMLInputElement;
          const currentVal = (input.value || '').trim();
          if (currentVal !== draft.value && draft.value.length > 0) {
            isRecoverable = true;
          }
          break;
        }

        case 'range':
        case 'color': {
          const input = el as HTMLInputElement;
          const currentVal = (input.value || '').trim();
          if (currentVal !== draft.value && draft.value.length > 0) {
            isRecoverable = true;
          }
          break;
        }

        case 'contenteditable': {
          const currentVal = (el.innerText || el.textContent || '').trim();
          if (currentVal.length <= 2 && draft.value.trim().length >= 3) {
            isRecoverable = true;
          }
          break;
        }

        case 'textarea':
        case 'text':
        default: {
          const currentVal = ((el as HTMLInputElement | HTMLTextAreaElement).value || '').trim();
          if (currentVal.length <= 2 && draft.value.trim().length >= 3) {
            isRecoverable = true;
          }
          break;
        }
      }

      if (isRecoverable) {
        processedKeys.add(key);
        allRecoverable.push({ el, draft, key });
      }
    }

    if (allRecoverable.length > 0) {
      const { siteUrl } = this.getCurrentUrls();
      const totalWords = allRecoverable.reduce((sum, item) => sum + (item.draft.wordCount || 1), 0);
      const latestTimestamp = Math.max(...allRecoverable.map((item) => item.draft.timestamp || 0));

      showSiteRestorePrompt({
        fieldCount: allRecoverable.length,
        wordCount: totalWords,
        timeAgo: this.formatTimeAgo(latestTimestamp),
        siteUrl,
        onReload: async () => {
          await this.restoreAllRecoverableDrafts(allRecoverable);
          recordProtectionEvent('formsBackedUp', allRecoverable.length).catch(() => {});
        },
        onDiscard: () => {
          allRecoverable.forEach(({ draft }) => {
            this.removeStoredDraft(draft.fieldKey);
          });
        },
      });
    } else {
      dismissSiteRestorePrompt();
    }
  }

  /**
   * Evaluates whether an element is currently disabled or waiting for a parent selection.
   */
  public isFieldDisabledOrDependent(el: HTMLElement, draft?: StoredDraft): boolean {
    if ((el as HTMLInputElement | HTMLSelectElement).disabled) return true;
    if (el.getAttribute('aria-disabled') === 'true') return true;

    const disabledAncestor = el.closest('[aria-disabled="true"], [disabled], .disabled, [class*="-isDisabled"], [class*="--is-disabled"]');
    if (disabledAncestor) return true;

    const container = getCustomDropdownContainer(el);
    if (container) {
      if (container.getAttribute('aria-disabled') === 'true') return true;
      if (/isDisabled|disabled/i.test(container.className)) return true;
      const innerInput = container.querySelector('input');
      if (innerInput && (innerInput.disabled || innerInput.getAttribute('aria-disabled') === 'true')) {
        return true;
      }
    }

    if (el instanceof HTMLSelectElement && draft && draft.value) {
      let hasTarget = false;
      for (let i = 0; i < el.options.length; i++) {
        const opt = el.options[i];
        if (opt.value === draft.value || opt.text.trim() === draft.value) {
          hasTarget = true;
          break;
        }
      }
      if (!hasTarget && el.options.length <= 1) {
        return true;
      }
    }

    return false;
  }

  /**
   * Polls until a dependent field is enabled by parent reactive updates or AJAX options.
   */
  private async waitForFieldReady(el: HTMLElement, draft: StoredDraft, maxWaitMs = 1200): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      if (!this.isFieldDisabledOrDependent(el, draft)) {
        return true;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    return false;
  }

  /**
   * Cascading restoration pipeline:
   * Restores parent and independent fields first, waits for DOM reactivity,
   * then restores dependent child dropdowns in cascading tiers.
   */
  public async restoreAllRecoverableDrafts(
    items: Array<{ el: HTMLElement; draft: StoredDraft; key: string }>
  ): Promise<void> {
    const independent: typeof items = [];
    const dependent: typeof items = [];

    for (const item of items) {
      if (this.isFieldDisabledOrDependent(item.el, item.draft)) {
        dependent.push(item);
      } else {
        independent.push(item);
      }
    }

    // Pass 1: Restore all non-dependent fields (inputs, radios, parent dropdowns, checkboxes)
    for (const { el, draft } of independent) {
      await this.applyFieldState(el, draft);
    }

    if (dependent.length === 0) return;

    // Pass 2 & 3: Cascading restoration for dependent child fields
    let pending = [...dependent];
    let tier = 0;
    const maxTiers = 3;

    while (pending.length > 0 && tier < maxTiers) {
      tier++;
      await new Promise((r) => setTimeout(r, 180));

      const readyThisRound: typeof items = [];
      const stillBlocked: typeof items = [];

      for (const item of pending) {
        const isReady = await this.waitForFieldReady(item.el, item.draft, 700);
        if (isReady) {
          readyThisRound.push(item);
        } else {
          stillBlocked.push(item);
        }
      }

      if (readyThisRound.length === 0 && stillBlocked.length > 0) {
        readyThisRound.push(stillBlocked.shift()!);
      }

      for (const { el, draft } of readyThisRound) {
        await this.applyFieldState(el, draft);
        await new Promise((r) => setTimeout(r, 80));
      }

      pending = stillBlocked;
    }
  }

  /**
   * Cleans up all saved drafts associated with a successfully submitted form.
   */
  private async handleFormSubmitted(form: HTMLFormElement): Promise<void> {
    const fields = form.querySelectorAll<HTMLElement>(
      'textarea, input, select, [contenteditable="true"], [role="textbox"]'
    );

    const clearedKeys = new Set<string>();
    for (const field of Array.from(fields)) {
      if (this.isSalvagableField(field)) {
        const key = this.getElementStorageKey(field);
        if (!clearedKeys.has(key)) {
          clearedKeys.add(key);
          await this.removeStoredDraft(key);
        }
      }
    }

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
   * Generates a deterministic, collision-free storage key for a given input element or input group.
   */
  public getElementStorageKey(el: HTMLElement): string {
    const { fullUrl } = this.getCurrentUrls();

    const form = el.closest('form');
    let formId = 'no-form';
    if (form) {
      formId = form.id || form.getAttribute('name') || `idx_${Array.from(document.forms).indexOf(form)}`;
    }

    const kind = classifyField(el);

    // Grouped radio buttons: key by group name so clicking any option updates the single canonical group draft
    if (kind === 'radio' && (el as HTMLInputElement).name) {
      const radioName = (el as HTMLInputElement).name;
      return `${DRAFT_PREFIX}${fullUrl}::form[${formId}]::radio_group[name="${radioName}"]`;
    }

    // Checkbox group / array (e.g. name="vfb-20[]" or multiple checkboxes with identical name)
    if (kind === 'checkbox' && (el as HTMLInputElement).name) {
      const cbName = (el as HTMLInputElement).name;
      const sameNameCount = document.getElementsByName(cbName).length;
      if (cbName.endsWith('[]') || sameNameCount > 1) {
        return `${DRAFT_PREFIX}${fullUrl}::form[${formId}]::checkbox_group[name="${cbName}"]`;
      }
    }

    // Custom dropdown / React-Select (e.g. #state, #city, #subjectsContainer)
    const customContainer = getCustomDropdownContainer(el);
    if (customContainer) {
      const containerId = customContainer.id || (el.id && el.id !== 'subjectsInput' ? el.id : '');
      if (containerId) {
        return `${DRAFT_PREFIX}${fullUrl}::form[${formId}]::custom_dropdown[#${containerId}]`;
      }
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
   * Walks up to parent form-group or item container for radio/checkbox groups.
   */
  private getElementHumanLabel(el: HTMLElement): string {
    const customContainer = getCustomDropdownContainer(el);
    if (customContainer) {
      if (customContainer.id === 'state') return 'State';
      if (customContainer.id === 'city') return 'City';
      if (customContainer.id === 'subjectsContainer') return 'Subjects';
    }

    const labelEl = el.id ? document.querySelector(`label[for="${el.id}"]`) : el.closest('label');
    if (labelEl && labelEl.textContent) {
      const text = labelEl.textContent.trim().replace(/\s*\*\s*$/, '');
      if (text) return text.slice(0, 30);
    }

    // Check parent field container (e.g. vfb-item, form-group, fieldset)
    const container = el.closest('.vfb-item, .form-group, fieldset, .field, li, tr');
    if (container) {
      const groupLabel = container.querySelector('label.vfb-desc, label.control-label, legend, .form-label, label');
      if (groupLabel && groupLabel.textContent) {
        const text = groupLabel.textContent.trim().replace(/\s*\*\s*$/, '');
        if (text) return text.slice(0, 30);
      }
    }

    const placeholder = el.getAttribute('placeholder');
    if (placeholder) return placeholder.slice(0, 30);
    const name = el.getAttribute('name') || el.id;
    if (name) return name.slice(0, 30);
    return el.tagName.toLowerCase();
  }

  private getElementValue(el: HTMLElement): string {
    const state = this.extractFieldState(el);
    return state ? state.value : '';
  }

  private setElementValue(el: HTMLElement, val: string, isContentEditable: boolean): void {
    const draft: StoredDraft = {
      url: window.location.href,
      fieldKey: '',
      fieldLabel: '',
      value: val,
      timestamp: Date.now(),
      wordCount: val.split(/\s+/).filter(Boolean).length,
      isContentEditable,
      revisions: [],
    };
    this.applyFieldState(el, draft);
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
              node.matches('textarea, input, select, [contenteditable="true"], [role="textbox"], [class*="multi-value"], [class*="multiValue"], [class*="singleValue"], [class*="single-value"]') ||
              node.querySelector('textarea, input, select, [contenteditable="true"], [role="textbox"], [class*="multi-value"], [class*="multiValue"], [class*="singleValue"], [class*="single-value"]')
            ) {
              hasAddedInputs = true;
              break;
            }
          }
        }
        if (hasAddedInputs) break;

        for (const node of Array.from(m.removedNodes)) {
          if (node instanceof HTMLElement) {
            if (
              node.matches('[class*="multi-value"], [class*="multiValue"], [class*="singleValue"], [class*="single-value"]') ||
              node.querySelector('[class*="multi-value"], [class*="multiValue"], [class*="singleValue"], [class*="single-value"]')
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
          this.scanActiveWidgets();
        }, 300);
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
