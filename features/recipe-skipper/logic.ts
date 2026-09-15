/**
 * Recipe Story Fluff Skipper & Reader View 2.0
 * Parses Schema.org Recipe JSON-LD metadata or DOM ingredient containers,
 * extracts ingredients & instructions, and presents a Jump pill and Distraction-Free Reader Card.
 */

import {
  injectRecipeSkipperStyles,
  showJumpToRecipeButton,
  showRecipeReaderModal,
  removeRecipeSkipperUI,
} from './ui';
import { recordProtectionEvent } from '../../content/storage';
import { ExtractedRecipe } from '../../types';

function parseDuration(isoStr?: string): string {
  if (!isoStr || typeof isoStr !== 'string') return '';
  const match = isoStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!match) return isoStr;
  const hours = match[1] ? `${match[1]}h ` : '';
  const mins = match[2] ? `${match[2]}m` : '';
  return `${hours}${mins}`.trim();
}

export class RecipeSkipper {
  private isRunning = false;
  private hasDetectedRecipe = false;
  private currentRecipe: ExtractedRecipe | null = null;
  private recipeTarget: HTMLElement | null = null;

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.detectAndInit();
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.hasDetectedRecipe = false;
    this.currentRecipe = null;
    this.recipeTarget = null;
    removeRecipeSkipperUI();
  }

  public openReaderOrJump(): void {
    if (this.currentRecipe && this.currentRecipe.ingredients.length > 0) {
      showRecipeReaderModal(this.currentRecipe, () => {
        this.scrollToRecipeTarget();
      });
      recordProtectionEvent('recipesSkipped', 1).catch(() => {});
    } else if (this.recipeTarget) {
      this.scrollToRecipeTarget();
      recordProtectionEvent('recipesSkipped', 1).catch(() => {});
    }
  }

  private scrollToRecipeTarget(): void {
    if (this.recipeTarget) {
      this.recipeTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  private detectAndInit(): void {
    this.currentRecipe = this.extractRecipeFromJsonLd();
    this.recipeTarget = this.findRecipeDomTarget();

    if (!this.currentRecipe && !this.recipeTarget) return;

    this.hasDetectedRecipe = true;
    injectRecipeSkipperStyles();

    showJumpToRecipeButton(
      () => {
        this.openReaderOrJump();
      },
      Boolean(this.currentRecipe && this.currentRecipe.ingredients.length > 0)
    );
  }

  private extractRecipeFromJsonLd(): ExtractedRecipe | null {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');

    for (const s of Array.from(scripts)) {
      try {
        const text = s.textContent || '';
        if (!text.includes('Recipe')) continue;

        const data = JSON.parse(text);
        const recipeObj = this.findRecipeObject(data);

        if (recipeObj) {
          return this.formatRecipeObject(recipeObj);
        }
      } catch {}
    }

    return null;
  }

  private findRecipeObject(data: any): any {
    if (!data) return null;

    if (Array.isArray(data)) {
      for (const item of data) {
        const found = this.findRecipeObject(item);
        if (found) return found;
      }
    } else if (typeof data === 'object') {
      const type = data['@type'];
      if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) {
        return data;
      }
      if (data['@graph'] && Array.isArray(data['@graph'])) {
        return this.findRecipeObject(data['@graph']);
      }
    }

    return null;
  }

  private formatRecipeObject(obj: any): ExtractedRecipe {
    const title = obj.name || document.title || 'Recipe';
    const description = typeof obj.description === 'string' ? obj.description : undefined;
    const prepTime = parseDuration(obj.prepTime);
    const cookTime = parseDuration(obj.cookTime);
    const totalTime = parseDuration(obj.totalTime);
    const recipeYield = Array.isArray(obj.recipeYield) ? obj.recipeYield[0] : obj.recipeYield;

    // Ingredients
    const rawIngs = obj.recipeIngredient || obj.ingredients || [];
    const ingredients: string[] = Array.isArray(rawIngs) ? rawIngs.map((i: any) => String(i).trim()) : [];

    // Instructions
    const rawSteps = obj.recipeInstructions || [];
    const instructions: string[] = [];

    if (Array.isArray(rawSteps)) {
      for (const step of rawSteps) {
        if (typeof step === 'string') {
          instructions.push(step.trim());
        } else if (typeof step === 'object' && step) {
          if (step.text) instructions.push(String(step.text).trim());
          else if (step.name) instructions.push(String(step.name).trim());
          else if (Array.isArray(step.itemListElement)) {
            for (const sub of step.itemListElement) {
              if (sub.text) instructions.push(String(sub.text).trim());
            }
          }
        }
      }
    } else if (typeof rawSteps === 'string') {
      instructions.push(rawSteps);
    }

    // Image
    let imageUrl: string | undefined;
    if (typeof obj.image === 'string') {
      imageUrl = obj.image;
    } else if (Array.isArray(obj.image) && typeof obj.image[0] === 'string') {
      imageUrl = obj.image[0];
    } else if (obj.image && typeof obj.image === 'object' && obj.image.url) {
      imageUrl = obj.image.url;
    }

    return {
      title,
      description,
      prepTime,
      cookTime,
      totalTime,
      recipeYield,
      ingredients,
      instructions,
      imageUrl,
      sourceUrl: window.location.href,
    };
  }

  private findRecipeDomTarget(): HTMLElement | null {
    const selectors = [
      '[itemtype*="schema.org/Recipe"]',
      '.wprm-recipe-container',
      '.easyrecipe',
      '.tasty-recipes',
      '.mv-recipe-card',
      '#recipe',
      '.recipe-card',
      '.recipe-content',
      '[class*="recipe-instructions" i]',
      '[class*="recipe-ingredients" i]',
      '#recipe-instructions',
      '#recipe-ingredients',
    ];

    for (const sel of selectors) {
      const el = document.querySelector<HTMLElement>(sel);
      if (el) return el;
    }

    const headings = document.querySelectorAll('h2, h3');
    for (const h of Array.from(headings)) {
      const text = (h.textContent || '').toLowerCase();
      if (text.includes('ingredient') || text.includes('instruction') || text.includes('how to make')) {
        return h as HTMLElement;
      }
    }

    return null;
  }
}

export const recipeSkipper = new RecipeSkipper();
