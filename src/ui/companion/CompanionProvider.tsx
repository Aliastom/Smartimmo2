'use client';

/**
 * CompanionProvider - Context global pour le compagnon IA (V3+)
 * Expose la route courante, l'entité sélectionnée (auto-détectée), les filtres
 */

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { CompanionContext } from './types';

const CompanionContextInstance = createContext<CompanionContext | null>(null);

export function CompanionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);

  // Fermer le panneau lors du changement de route
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Détecter automatiquement l'entité sélectionnée depuis l'URL
  const selectedEntity = useMemo(() => {
    return detectEntityFromUrl(pathname);
  }, [pathname]);

  // Récupérer les filtres depuis les query params
  const filters = useMemo(() => {
    const params: Record<string, any> = {};
    searchParams?.forEach((value, key) => {
      params[key] = value;
    });
    return Object.keys(params).length > 0 ? params : undefined;
  }, [searchParams]);

  const contextValue: CompanionContext = {
    route: pathname || '/',
    selectedEntity,
    filters,
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  };

  return (
    <CompanionContextInstance.Provider value={contextValue}>
      {children}
    </CompanionContextInstance.Provider>
  );
}

/**
 * Hook pour accéder au context du compagnon
 */
export function useCompanion(): CompanionContext {
  const context = useContext(CompanionContextInstance);
  if (!context) {
    throw new Error('useCompanion must be used within CompanionProvider');
  }
  return context;
}

/**
 * Détecte automatiquement l'entité sélectionnée depuis l'URL
 * Patterns supportés :
 * - /biens/:id → property
 * - /baux/:id → lease
 * - /transactions/:id → transaction
 * - /locataires/:id → tenant
 * - /loans/:id → loan
 */
function detectEntityFromUrl(pathname: string): CompanionContext['selectedEntity'] {
  if (!pathname) return undefined;

  // Pattern : /entity/[id]
  const patterns = [
    { regex: /\/biens\/([^\/]+)/, type: 'property' as const, label: 'Bien' },
    { regex: /\/baux\/([^\/]+)/, type: 'lease' as const, label: 'Bail' },
    { regex: /\/transactions\/([^\/]+)/, type: 'transaction' as const, label: 'Transaction' },
    { regex: /\/locataires\/([^\/]+)/, type: 'tenant' as const, label: 'Locataire' },
    { regex: /\/loans\/([^\/]+)/, type: 'loan' as const, label: 'Prêt' },
  ];

  for (const pattern of patterns) {
    const match = pathname.match(pattern.regex);
    if (match && match[1]) {
      return {
        type: pattern.type,
        id: match[1],
        label: pattern.label,
      };
    }
  }

  return undefined;
}

