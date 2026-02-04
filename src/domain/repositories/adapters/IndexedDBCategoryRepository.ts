/**
 * Adapter IndexedDB pour ICategoryRepository
 */

import { getLocalDB } from '@/lib/offline/db';
import type { ICategoryRepository, Category } from '../interfaces/ICategoryRepository';

export class IndexedDBCategoryRepository implements ICategoryRepository {
  private _dbPromise: Promise<any> | null = null;

  private async getDb() {
    if (!this._dbPromise) {
      this._dbPromise = getLocalDB();
    }
    return this._dbPromise;
  }

  async findUnique(where: { id: string }): Promise<Category | null> {
    const db = await this.getDb();
    const category = await db.Category.get(where.id);
    if (!category) return null;
    
    return {
      id: category.id,
      slug: category.slug,
      label: category.label,
      type: category.type,
      actif: category.actif,
    };
  }

  async findFirst(where: { slug: string; actif: boolean }): Promise<Category | null> {
    const db = await this.getDb();
    
    // ⚠️ IMPORTANT : Le schéma IndexedDB n'a pas d'index sur 'slug'
    // Utiliser toArray() + filter au lieu de where('slug')
    const allCategories = await db.Category.toArray();
    const category = allCategories.find((c: any) => 
      c.slug === where.slug && c.actif === where.actif
    );
    
    if (!category) return null;
    
    return {
      id: category.id,
      slug: category.slug,
      label: category.label,
      type: category.type,
      actif: category.actif,
    };
  }
}
