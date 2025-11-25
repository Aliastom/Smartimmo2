/**
 * useFiscalTabs - Hook pour gérer la navigation entre les 5 onglets fiscaux
 * 
 * Synchronise QueryString (?tab=...), Hash (#...) et localStorage
 * Priority: Hash > Query > localStorage > default
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export type FiscalTab = 'simulation' | 'synthese' | 'details' | 'projections' | 'optimisations';

const STORAGE_KEY = 'fiscal-active-tab';
const DEFAULT_TAB: FiscalTab = 'simulation';

export function useFiscalTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTabState] = useState<FiscalTab>(DEFAULT_TAB);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialiser l'onglet au montage
  useEffect(() => {
    if (isInitialized) return;

    if (typeof window === 'undefined') {
      setActiveTabState(DEFAULT_TAB);
      setIsInitialized(true);
      return;
    }

    // ✅ Vérifier si on arrive directement sur /fiscal (sans paramètres)
    const urlPath = window.location.pathname;
    const urlHash = window.location.hash;
    const urlSearch = window.location.search;
    
    // 1. Lire le hash
    const hash = urlHash.slice(1);
    const hashTab = hash && isValidTab(hash) ? hash as FiscalTab : null;
    
    // 2. Lire le query param
    const queryTab = searchParams.get('tab') as FiscalTab;
    const queryTabValid = queryTab && isValidTab(queryTab) ? queryTab : null;
    
    // ✅ Si l'URL est exactement /fiscal (sans ?tab= ni #), forcer le premier onglet
    // Cela garantit qu'un chargement direct de /fiscal atterrit toujours sur "Simulation"
    const isDirectAccess = urlPath === '/fiscal' && !urlSearch && !urlHash;
    
    let initialTab: FiscalTab;
    
    if (isDirectAccess) {
      // Accès direct à /fiscal : toujours utiliser le premier onglet
      initialTab = DEFAULT_TAB;
      
      // Nettoyer l'URL et localStorage pour un chargement propre
      router.replace(urlPath, { scroll: false });
      localStorage.removeItem(STORAGE_KEY);
    } else {
      // On a des paramètres dans l'URL : les respecter
      const storedTab = localStorage.getItem(STORAGE_KEY) as FiscalTab;
      
      // Priority: hash > query > localStorage > default
      initialTab = 
        hashTab ||
        queryTabValid ||
        (storedTab && isValidTab(storedTab) ? storedTab : null) ||
        DEFAULT_TAB;
      
      // Synchroniser URL et localStorage si nécessaire
      if (initialTab !== DEFAULT_TAB) {
        syncUrlAndStorage(initialTab, false);
      }
    }
    
    setActiveTabState(initialTab);
    setIsInitialized(true);
  }, [isInitialized, searchParams, router]);

  // Changer d'onglet
  const setActiveTab = useCallback((tab: FiscalTab) => {
    setActiveTabState(tab);
    syncUrlAndStorage(tab, true);
  }, []);

  // Synchroniser URL et localStorage
  const syncUrlAndStorage = (tab: FiscalTab, pushState: boolean) => {
    // localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, tab);
    }

    // URL
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    url.hash = tab;

    if (pushState) {
      router.push(url.pathname + url.search + url.hash, { scroll: false });
    } else {
      router.replace(url.pathname + url.search + url.hash, { scroll: false });
    }
  };

  return {
    activeTab,
    setActiveTab,
  };
}

function isValidTab(tab: string): tab is FiscalTab {
  return ['simulation', 'synthese', 'details', 'projections', 'optimisations'].includes(tab);
}

