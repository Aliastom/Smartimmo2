/**
 * Hook pour charger le référentiel Nature + Catégorie pour les formulaires échéance.
 * Réutilise les données admin (natures, catégories, compatibilités).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { getLocalDB } from '@/lib/offline/db';

export interface NatureForSelect {
  key: string;
  label: string;
  flow: string;
  compatibleTypes: string[];
  defaultCategoryId?: string;
}

export interface CategoryForSelect {
  id: string;
  slug: string;
  label: string;
  type: string;
  actif: boolean;
}

export function useEcheanceReferential(mode: 'normal' | 'app-shell' = 'normal') {
  const [natures, setNatures] = useState<NatureForSelect[]>([]);
  const [categories, setCategories] = useState<CategoryForSelect[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (mode === 'app-shell') {
        const db = await getLocalDB();
        const [naturesData, categoriesData] = await Promise.all([
          db.NatureEntity.toArray(),
          db.Category.toArray(),
        ]);
        setNatures(
          (naturesData as any[]).map((n) => ({
            key: n.key,
            label: n.label || n.key,
            flow: n.flow || (n.key?.startsWith('RECETTE') ? 'INCOME' : 'EXPENSE'),
            compatibleTypes: n.compatibleTypes || [],
            defaultCategoryId: n.defaultCategory,
          }))
        );
        setCategories(
          (categoriesData as any[]).filter((c) => c.actif !== false).map((c) => ({
            id: c.id,
            slug: c.slug,
            label: c.label,
            type: c.type,
            actif: c.actif !== false,
          }))
        );
      } else {
        const [naturesRes, categoriesRes] = await Promise.all([
          fetch('/api/admin/natures'),
          fetch('/api/accounting/categories'),
        ]);
        const naturesJson = await naturesRes.json();
        const categoriesJson = await categoriesRes.json();
        const naturesData = naturesJson.data || naturesJson;
        const categoriesData = Array.isArray(categoriesJson) ? categoriesJson : categoriesJson.data || [];
        setNatures(
          (Array.isArray(naturesData) ? naturesData : []).map((n: any) => ({
            key: n.key || n.code,
            label: n.label || n.key || n.code,
            flow: n.flow || (String(n.key || n.code).startsWith('RECETTE') ? 'INCOME' : 'EXPENSE'),
            compatibleTypes: n.compatibleTypes || [],
            defaultCategoryId: n.defaultCategory,
          }))
        );
        setCategories(
          categoriesData.filter((c: any) => c.actif !== false).map((c: any) => ({
            id: c.id,
            slug: c.slug,
            label: c.label,
            type: c.type,
            actif: c.actif !== false,
          }))
        );
      }
    } catch (e) {
      console.error('[useEcheanceReferential]', e);
      setNatures([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    load();
  }, [load]);

  const getCompatibleCategories = useCallback(
    (natureKey: string): CategoryForSelect[] => {
      const nature = natures.find((n) => n.key === natureKey);
      if (!nature || !nature.compatibleTypes?.length) return categories;
      return categories.filter((c) => nature.compatibleTypes!.includes(c.type));
    },
    [natures, categories]
  );

  const getDefaultCategoryId = useCallback(
    (natureKey: string): string | undefined => {
      return natures.find((n) => n.key === natureKey)?.defaultCategoryId;
    },
    [natures]
  );

  const getNatureFlow = useCallback(
    (natureKey: string): string => {
      return natures.find((n) => n.key === natureKey)?.flow || 'EXPENSE';
    },
    [natures]
  );

  return {
    natures,
    categories,
    loading,
    getCompatibleCategories,
    getDefaultCategoryId,
    getNatureFlow,
    reload: load,
  };
}
