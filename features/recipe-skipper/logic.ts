/**
 * Recipe Story Fluff Skipper — Logic Engine
 * Scans web pages for Schema.org Recipe JSON-LD metadata or ingredient containers,
 * surfaces a "Jump to Recipe" button, and records skipped stories.
 */

import { injectRecipeSkipperStyles, showJumpToRecipeButton, removeRecipeSkipperUI } from './ui';
import { recordProtectionEvent } from '../../content/storage';

export class RecipeSkipper {
  private isRunning = false;
  private hasDetectedRecipe = false;

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.detectAndInit();
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.hasDetectedRecipe = false;
    removeRecipeSkipperUI();
  }

  private detectAndInit(): void {
    const recipeTarget = this.findRecipeTarget();
    if (!recipeTarget) return;

    this.hasDetectedRecipe = true;
    injectRecipeSkipperStyles();
    showJumpToRecipeButton(() => {
      recipeTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
      recordProtectionEvent('recipesSkipped', 1).catch(() => {});
    });
  }

  private findRecipeTarget(): HTMLElement | null {
    // 1. Inspect JSON-LD for Recipe schema
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    let hasRecipeJsonLd = false;

    for (const s of Array.from(scripts)) {
      try {
        const text = s.textContent || '';
        if (text.includes('"Recipe"') || text.includes('"@type":"Recipe"')) {
          hasRecipeJsonLd = true;
          break;
        }
      } catch {}
    }

    // 2. Search for common recipe containers in the DOM
    const selectors = [
      '[itemtype*="schema.org/Recipe"]',
      '.wprm-recipe-container',
      '.easyrecipe',
      '.tasty-recipes',
      '.mv-recipe-card',
      '#recipe',
      '.recipe-card',
      '.recipe-content',
      '[class*="recipe-instructions"]',
      '[class*="recipe-ingredients"]',
    ];

    for (const sel of selectors) {
      const el = document.querySelector<HTMLElement>(sel);
      if (el) return el;
    }

    if (hasRecipeJsonLd) {
      // Return first h2 / section that looks like ingredients or instructions
      const headings = document.querySelectorAll('h2, h3');
      for (const h of Array.from(headings)) {
        const text = (h.textContent || '').toLowerCase();
        if (text.includes('ingredient') || text.includes('instruction') || text.includes('how to make')) {
          return h as HTMLElement;
        }
      }
    }

    return null;
  }
}

export const recipeSkipper = new RecipeSkipper();
