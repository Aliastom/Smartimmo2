/**
 * Interface pour le repository de natures
 */

export interface NatureEntity {
  code: string;
  label: string;
  flow?: string | null;
}

export interface INatureRepository {
  findMany(): Promise<NatureEntity[]>;
}

