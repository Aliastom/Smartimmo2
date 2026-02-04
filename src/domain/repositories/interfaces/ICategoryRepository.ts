/**
 * Interface pour le repository de catégories
 */

export interface Category {
  id: string;
  slug?: string;
  label: string;
  type?: string;
  actif?: boolean;
}

export interface ICategoryRepository {
  findUnique(where: { id: string }): Promise<Category | null>;
  findFirst(where: { slug: string; actif: boolean }): Promise<Category | null>;
}

