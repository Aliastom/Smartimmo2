export interface Category {
  id: string;
  label: string;
  type: 'REVENU' | 'DEPENSE' | 'NON_DEFINI';
  slug?: string;
  deductible?: boolean;
  capitalizable?: boolean;
  actif?: boolean;
}

export interface Nature {
  code: string;
  label: string;
}

export interface NatureRule {
  id: string;
  natureCode: string;
  allowedType: 'REVENU' | 'DEPENSE' | 'NON_DEFINI';
}

export interface NatureDefault {
  natureCode: string;
  defaultCategoryId: string | null;
  defaultCategory?: Category;
}

export interface MappingResponse {
  allowedCategories: Category[];
  defaultCategoryId: string | null;
  hasRules: boolean;
}
