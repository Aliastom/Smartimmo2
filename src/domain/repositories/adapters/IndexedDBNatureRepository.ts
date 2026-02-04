/**
 * Adapter IndexedDB pour INatureRepository
 */

import { getLocalDB } from '@/lib/offline/db';
import type { INatureRepository, NatureEntity } from '../interfaces/INatureRepository';

export class IndexedDBNatureRepository implements INatureRepository {
  private _dbPromise: Promise<any> | null = null;

  private async getDb() {
    if (!this._dbPromise) {
      this._dbPromise = getLocalDB();
    }
    return this._dbPromise;
  }

  async findMany(): Promise<NatureEntity[]> {
    const db = await this.getDb();
    const natures = await db.NatureEntity.toArray();
    
    return natures.map((nature: any) => ({
      code: nature.key, // IndexedDB utilise 'key' au lieu de 'code'
      label: nature.label,
      flow: nature.flow,
    }));
  }
}
