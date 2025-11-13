/**
 * useResultsRouting - Hook pour gérer la navigation entre onglets
 * 
 * Synchronise QueryString (?tab=...), Hash (#...) et localStorage
 * Priority: Hash > Query > localStorage > default
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export type ResultsTab = 'synthese' | 'details' | 'projections' | 'optimisations';

const STORAGE_KEY = 'fiscal-results-tab';
const DEFAULT_TAB: ResultsTab = 'synthese';

export function useResultsRouting() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTabState] = useState<ResultsTab>(DEFAULT_TAB);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialiser l'onglet au montage (priority: hash > query > localStorage > default)
  useEffect(() => {
    if (isInitialized) return;

    // 1. Lire le hash (#synthese, #details...)
    const hash = window.location.hash.slice(1) as ResultsTab;
    
    // 2. Lire le query param (?tab=...)
    const queryTab = searchParams.get('tab') as ResultsTab;
    
    // 3. Lire localStorage
    const storedTab = (typeof window !== 'undefined' 
      ? localStorage.getItem(STORAGE_KEY)
      : null) as ResultsTab;
    
    // Priority: hash > query > localStorage > default
    const initialTab = 
      (hash && isValidTab(hash)) ? hash :
      (queryTab && isValidTab(queryTab)) ? queryTab :
      (storedTab && isValidTab(storedTab)) ? storedTab :
      DEFAULT_TAB;
    
    setActiveTabState(initialTab);
    setIsInitialized(true);

    // Synchroniser URL et localStorage avec l'onglet initial
    if (initialTab !== DEFAULT_TAB) {
      syncUrlAndStorage(initialTab, false);
    }
  }, [isInitialized, searchParams]);

  // Fonction pour changer d'onglet
  const setActiveTab = useCallback((tab: ResultsTab) => {
    setActiveTabState(tab);
    syncUrlAndStorage(tab, true);
  }, []);

  // Synchroniser URL (query + hash) et localStorage
  const syncUrlAndStorage = (tab: ResultsTab, pushState: boolean) => {
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

function isValidTab(tab: string): tab is ResultsTab {
  return ['synthese', 'details', 'projections', 'optimisations'].includes(tab);
}

