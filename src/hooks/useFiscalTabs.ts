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

    // 1. Lire le hash
    const hash = window.location.hash.slice(1) as FiscalTab;
    
    // 2. Lire le query param
    const queryTab = searchParams.get('tab') as FiscalTab;
    
    // 3. Lire localStorage
    const storedTab = (typeof window !== 'undefined' 
      ? localStorage.getItem(STORAGE_KEY)
      : null) as FiscalTab;
    
    // Priority: hash > query > localStorage > default
    const initialTab = 
      (hash && isValidTab(hash)) ? hash :
      (queryTab && isValidTab(queryTab)) ? queryTab :
      (storedTab && isValidTab(storedTab)) ? storedTab :
      DEFAULT_TAB;
    
    setActiveTabState(initialTab);
    setIsInitialized(true);

    // Synchroniser URL et localStorage
    if (initialTab !== DEFAULT_TAB) {
      syncUrlAndStorage(initialTab, false);
    }
  }, [isInitialized, searchParams]);

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

