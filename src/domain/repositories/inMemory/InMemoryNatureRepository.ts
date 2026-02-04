/**
 * Implémentation in-memory du repository de natures
 */

import type { INatureRepository, NatureEntity } from '../interfaces/INatureRepository';

export class InMemoryNatureRepository implements INatureRepository {
  private natures: Map<string, NatureEntity> = new Map();

  async findMany(): Promise<NatureEntity[]> {
    return Array.from(this.natures.values());
  }

  // Méthodes utilitaires pour les tests
  clear(): void {
    this.natures.clear();
  }

  seed(natures: NatureEntity[]): void {
    for (const nature of natures) {
      this.natures.set(nature.code, nature);
    }
  }

  getAll(): NatureEntity[] {
    return Array.from(this.natures.values());
  }
}

