/**
 * Implémentation in-memory du repository de catégories
 */

import type { ICategoryRepository, Category } from '../interfaces/ICategoryRepository';

export class InMemoryCategoryRepository implements ICategoryRepository {
  private categories: Map<string, Category> = new Map();

  async findUnique(where: { id: string }): Promise<Category | null> {
    return this.categories.get(where.id) || null;
  }

  async findFirst(where: { slug: string; actif: boolean }): Promise<Category | null> {
    for (const category of this.categories.values()) {
      if (category.slug === where.slug && category.actif === where.actif) {
        return category;
      }
    }
    return null;
  }

  // Méthodes utilitaires pour les tests
  clear(): void {
    this.categories.clear();
  }

  seed(categories: Category[]): void {
    for (const category of categories) {
      this.categories.set(category.id, category);
    }
  }

  getAll(): Category[] {
    return Array.from(this.categories.values());
  }
}

