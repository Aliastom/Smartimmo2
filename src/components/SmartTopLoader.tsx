/**
 * SmartTopLoader - Barre de progression simple pour la page /biens
 * 
 * Solution ciblée pour la page /biens uniquement :
 * - Détecte le clic sur le lien vers /biens
 * - Démarre la barre immédiatement
 * - Attend que le contenu soit rendu (tableau, StatCards, graphiques)
 * - Termine la barre quand tout est prêt
 */

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useLoading } from '@/contexts/LoadingContext';
import { useIsFetching } from '@tanstack/react-query';

interface SmartTopLoaderProps {
  color?: string;
  height?: number;
  shadowColor?: string;
  initialProgress?: number;
  zIndex?: number;
}

export function SmartTopLoader({
  color = '#0ea5e9',
  height = 5,
  shadowColor = 'rgba(14, 165, 233, 0.5)',
  initialProgress = 20,
  zIndex = 9999,
}: SmartTopLoaderProps) {
  const pathname = usePathname();
  const isFetching = useIsFetching();
  const { setLoading, loadingPaths, loadingPathsArray } = useLoading();
  const [isLoading, setIsLoading] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const pathnameRef = useRef<string | null>(pathname);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const activeFetchRequestsRef = useRef<Set<string>>(new Set());
  const isFetchingRef = useRef<number>(0);
  const clickedPathRef = useRef<string | null>(null); // Pour suivre le pathname sur lequel on a cliqué
  const clickedPropertyRowRef = useRef<HTMLElement | null>(null); // Pour suivre la ligne du tableau cliquée

  // Mettre à jour la ref pour React Query
  useEffect(() => {
    isFetchingRef.current = isFetching;
  }, [isFetching]);

  // Vérifier si le contenu de la page /biens est rendu ET que les données sont chargées
  const checkBiensContentRendered = useCallback((): boolean => {
    if (pathname !== '/biens') return true;
    
    // 1. Vérifier qu'il n'y a plus de requêtes fetch actives ET que React Query n'est pas en train de charger
    if (activeFetchRequestsRef.current.size > 0 || isFetchingRef.current > 0) {
      return false; // Il y a encore des requêtes en cours
    }
    
    // 2. Vérifier le tableau principal - doit avoir des données ou un état vide
    const table = document.querySelector('table');
    if (table) {
      const tbody = table.querySelector('tbody');
      if (tbody) {
        // Vérifier qu'il n'y a pas de skeleton/loading dans le tableau
        const hasSkeleton = tbody.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]');
        if (hasSkeleton) {
          return false; // Le tableau est encore en chargement
        }
        
        // Si le tableau a des lignes de données, c'est bon
        if (tbody.children.length > 0) {
          // Vérifier que ce ne sont pas des lignes de skeleton
          const firstRow = tbody.children[0];
          const hasRealData = firstRow.textContent && firstRow.textContent.trim().length > 0;
          if (hasRealData) {
            return true; // Tableau avec données réelles
          }
        }
        
        // Vérifier si c'est un état vide (pas de skeleton)
        const hasEmptyState = document.querySelector('[class*="empty"], [class*="Empty"]') !== null;
        if (hasEmptyState) {
          return true;
        }
      }
    }
    
    // 3. Vérifier les StatCards - doivent avoir des valeurs (pas juste "0" ou des valeurs par défaut)
    const statCards = document.querySelectorAll('[class*="stat-card"], [class*="StatCard"]');
    if (statCards.length > 0) {
      // Vérifier qu'au moins une StatCard a une valeur chargée (pas de skeleton)
      let hasLoadedCard = false;
      statCards.forEach((card) => {
        // Vérifier qu'il n'y a pas de skeleton dans la carte
        const hasSkeleton = card.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]');
        if (!hasSkeleton) {
          // Vérifier que la carte a une valeur affichée
          const valueElement = card.querySelector('[class*="value"], [class*="Value"]');
          if (valueElement && valueElement.textContent && valueElement.textContent.trim() !== '0' && valueElement.textContent.trim() !== '') {
            hasLoadedCard = true;
          }
        }
      });
      if (hasLoadedCard) {
        return true; // Au moins une StatCard a des données
      }
    }
    
    // 4. Vérifier les graphiques - doivent être présents
    const hasCharts = document.querySelector('[class*="chart"], [class*="Chart"]') !== null;
    if (hasCharts) {
      // Vérifier qu'il n'y a pas de skeleton dans les graphiques
      const chartSkeleton = document.querySelector('[class*="chart"] [class*="skeleton"], [class*="Chart"] [class*="Skeleton"]');
      if (!chartSkeleton) {
        return true; // Graphiques chargés
      }
    }
    
    return false; // Le contenu n'est pas encore complètement chargé
  }, [pathname]);

  // Vérifier si le contenu de la page /dashboard est rendu ET que les données sont chargées
  // Même logique que pour /biens mais adaptée au dashboard
  const checkDashboardContentRendered = useCallback((): boolean => {
    if (pathname !== '/dashboard') return true;
    
    // 1. Vérifier qu'il n'y a plus de requêtes fetch actives ET que React Query n'est pas en train de charger
    if (activeFetchRequestsRef.current.size > 0 || isFetchingRef.current > 0) {
      return false; // Il y a encore des requêtes en cours
    }
    
    // 2. Vérifier les KPIs - doivent avoir des valeurs chargées (même logique que StatCards pour /biens)
    const kpiBars = document.querySelectorAll('[class*="kpi"], [class*="Kpi"], [class*="KPI"], [class*="MonthlyKpiBar"]');
    if (kpiBars.length > 0) {
      // Vérifier qu'au moins un KPI a une valeur chargée (pas de skeleton)
      let hasLoadedKpi = false;
      kpiBars.forEach((kpiBar) => {
        // Vérifier qu'il n'y a pas de skeleton dans le KPI
        const hasSkeleton = kpiBar.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]');
        if (!hasSkeleton) {
          // Vérifier que le KPI a une valeur affichée (pas vide, pas juste "0")
          const hasValues = kpiBar.textContent && kpiBar.textContent.trim().length > 0 && !kpiBar.textContent.includes('€0') && !kpiBar.textContent.includes('0€');
          if (hasValues) {
            hasLoadedKpi = true;
          }
        }
      });
      if (hasLoadedKpi) {
        return true; // Au moins un KPI a des données
      }
    }
    
    // 3. Vérifier les graphiques - doivent être présents (même logique que pour /biens)
    const hasCharts = document.querySelector('[class*="chart"], [class*="Chart"], [class*="MonthlyGraphs"]') !== null;
    if (hasCharts) {
      // Vérifier qu'il n'y a pas de skeleton dans les graphiques
      const chartSkeleton = document.querySelector('[class*="chart"] [class*="skeleton"], [class*="Chart"] [class*="Skeleton"]');
      if (!chartSkeleton) {
        return true; // Graphiques chargés
      }
    }
    
    // 4. Vérifier les cartes/tasks - doivent être présents et chargés
    const cards = document.querySelectorAll('[class*="card"], [class*="Card"], [class*="TasksPanel"]');
    if (cards.length > 0) {
      // Vérifier qu'au moins une carte est chargée (pas de skeleton)
      let hasLoadedCard = false;
      cards.forEach((card) => {
        const hasSkeleton = card.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]');
        if (!hasSkeleton && card.textContent && card.textContent.trim().length > 0) {
          hasLoadedCard = true;
        }
      });
      if (hasLoadedCard) {
        return true; // Au moins une carte est chargée
      }
    }
    
    return false; // Le contenu n'est pas encore complètement chargé
  }, [pathname]);

  // Vérifier si le contenu de la page /dashboard/patrimoine est rendu ET que les données sont chargées
  // Même logique que pour /biens et /dashboard mais adaptée au patrimoine
  const checkPatrimoineContentRendered = useCallback((): boolean => {
    if (pathname !== '/dashboard/patrimoine') return true;
    
    // 1. Vérifier qu'il n'y a plus de requêtes fetch actives ET que React Query n'est pas en train de charger
    if (activeFetchRequestsRef.current.size > 0 || isFetchingRef.current > 0) {
      return false; // Il y a encore des requêtes en cours
    }
    
    // 2. Vérifier les KPIs - doivent avoir des valeurs chargées (même logique que pour /dashboard)
    const kpiBars = document.querySelectorAll('[class*="kpi"], [class*="Kpi"], [class*="KPI"], [class*="PatrimoineKPIs"]');
    if (kpiBars.length > 0) {
      // Vérifier qu'au moins un KPI a une valeur chargée (pas de skeleton)
      let hasLoadedKpi = false;
      kpiBars.forEach((kpiBar) => {
        // Vérifier qu'il n'y a pas de skeleton dans le KPI
        const hasSkeleton = kpiBar.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]');
        if (!hasSkeleton) {
          // Vérifier que le KPI a une valeur affichée (pas vide, pas juste "0")
          const hasValues = kpiBar.textContent && kpiBar.textContent.trim().length > 0 && !kpiBar.textContent.includes('€0') && !kpiBar.textContent.includes('0€');
          if (hasValues) {
            hasLoadedKpi = true;
          }
        }
      });
      if (hasLoadedKpi) {
        return true; // Au moins un KPI a des données
      }
    }
    
    // 3. Vérifier les graphiques - doivent être présents (même logique que pour /biens)
    const hasCharts = document.querySelector('[class*="chart"], [class*="Chart"], [class*="PatrimoineCharts"]') !== null;
    if (hasCharts) {
      // Vérifier qu'il n'y a pas de skeleton dans les graphiques
      const chartSkeleton = document.querySelector('[class*="chart"] [class*="skeleton"], [class*="Chart"] [class*="Skeleton"]');
      if (!chartSkeleton) {
        return true; // Graphiques chargés
      }
    }
    
    // 4. Vérifier l'agenda - doit être présent et chargé
    const agenda = document.querySelector('[class*="agenda"], [class*="Agenda"], [class*="GlobalAgenda"]');
    if (agenda) {
      const hasSkeleton = agenda.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]');
      if (!hasSkeleton && agenda.textContent && agenda.textContent.trim().length > 0) {
        return true; // Agenda chargé
      }
    }
    
    // 5. Vérifier les insights - doivent être présents
    const insights = document.querySelector('[class*="insight"], [class*="Insight"], [class*="PatrimoineInsights"]');
    if (insights) {
      const hasSkeleton = insights.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]');
      if (!hasSkeleton && insights.textContent && insights.textContent.trim().length > 0) {
        return true; // Insights chargés
      }
    }
    
    return false; // Le contenu n'est pas encore complètement chargé
  }, [pathname]);

  // Vérifier si le contenu de la page /locataires est rendu ET que les données sont chargées
  const checkLocatairesContentRendered = useCallback((): boolean => {
    if (pathname !== '/locataires') return true;
    
    // 1. Vérifier qu'il n'y a plus de requêtes fetch actives ET que React Query n'est pas en train de charger
    if (activeFetchRequestsRef.current.size > 0 || isFetchingRef.current > 0) {
      return false; // Il y a encore des requêtes en cours
    }
    
    // 2. Vérifier le tableau principal - doit avoir des données ou un état vide
    const table = document.querySelector('table');
    if (table) {
      const tbody = table.querySelector('tbody');
      if (tbody) {
        // Vérifier qu'il n'y a pas de skeleton/loading dans le tableau
        const hasSkeleton = tbody.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]');
        if (hasSkeleton) {
          return false; // Le tableau est encore en chargement
        }
        
        // Si le tableau a des lignes de données, c'est bon
        if (tbody.children.length > 0) {
          // Vérifier que ce ne sont pas des lignes de skeleton
          const firstRow = tbody.children[0];
          const hasRealData = firstRow.textContent && firstRow.textContent.trim().length > 0;
          if (hasRealData) {
            return true; // Tableau avec données réelles
          }
        }
        
        // Vérifier si c'est un état vide (pas de skeleton)
        const hasEmptyState = document.querySelector('[class*="empty"], [class*="Empty"]') !== null;
        if (hasEmptyState) {
          return true;
        }
      }
    }
    
    // 3. Vérifier les StatCards - doivent avoir des valeurs (pas juste "0" ou des valeurs par défaut)
    const statCards = document.querySelectorAll('[class*="stat-card"], [class*="StatCard"]');
    if (statCards.length > 0) {
      // Vérifier qu'au moins une StatCard a une valeur chargée (pas de skeleton)
      let hasLoadedCard = false;
      statCards.forEach((card) => {
        // Vérifier qu'il n'y a pas de skeleton dans la carte
        const hasSkeleton = card.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]');
        if (!hasSkeleton) {
          // Vérifier que la carte a une valeur affichée
          const valueElement = card.querySelector('[class*="value"], [class*="Value"]');
          if (valueElement && valueElement.textContent && valueElement.textContent.trim() !== '0' && valueElement.textContent.trim() !== '') {
            hasLoadedCard = true;
          }
        }
      });
      if (hasLoadedCard) {
        return true; // Au moins une StatCard a des données
      }
    }
    
    return false; // Le contenu n'est pas encore complètement chargé
  }, [pathname]);

  // Vérifier si le contenu de la page /baux est rendu ET que les données sont chargées
  const checkBauxContentRendered = useCallback((): boolean => {
    if (pathname !== '/baux') return true;
    
    // 1. Vérifier qu'il n'y a plus de requêtes fetch actives ET que React Query n'est pas en train de charger
    if (activeFetchRequestsRef.current.size > 0 || isFetchingRef.current > 0) {
      return false; // Il y a encore des requêtes en cours
    }
    
    // 2. Vérifier les KPIs - doivent avoir des valeurs chargées
    const kpiCards = document.querySelectorAll('[class*="kpi"], [class*="Kpi"], [class*="KPI"], [class*="LeasesKPICards"]');
    if (kpiCards.length > 0) {
      // Vérifier qu'au moins un KPI a une valeur chargée (pas de skeleton)
      let hasLoadedKpi = false;
      kpiCards.forEach((kpiCard) => {
        // Vérifier qu'il n'y a pas de skeleton dans le KPI
        const hasSkeleton = kpiCard.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]');
        if (!hasSkeleton) {
          // Vérifier que le KPI a une valeur affichée (pas vide, pas juste "0")
          const hasValues = kpiCard.textContent && kpiCard.textContent.trim().length > 0 && !kpiCard.textContent.includes('€0') && !kpiCard.textContent.includes('0€');
          if (hasValues) {
            hasLoadedKpi = true;
          }
        }
      });
      if (hasLoadedKpi) {
        return true; // Au moins un KPI a des données
      }
    }
    
    // 3. Vérifier le tableau principal - doit avoir des données ou un état vide
    const table = document.querySelector('table');
    if (table) {
      const tbody = table.querySelector('tbody');
      if (tbody) {
        // Vérifier qu'il n'y a pas de skeleton/loading dans le tableau
        const hasSkeleton = tbody.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]');
        if (hasSkeleton) {
          return false; // Le tableau est encore en chargement
        }
        
        // Si le tableau a des lignes de données, c'est bon
        if (tbody.children.length > 0) {
          // Vérifier que ce ne sont pas des lignes de skeleton
          const firstRow = tbody.children[0];
          const hasRealData = firstRow.textContent && firstRow.textContent.trim().length > 0;
          if (hasRealData) {
            return true; // Tableau avec données réelles
          }
        }
        
        // Vérifier si c'est un état vide (pas de skeleton)
        const hasEmptyState = document.querySelector('[class*="empty"], [class*="Empty"]') !== null;
        if (hasEmptyState) {
          return true;
        }
      }
    }
    
    return false; // Le contenu n'est pas encore complètement chargé
  }, [pathname]);

  // Vérifier si le contenu de la page /transactions est rendu ET que les données sont chargées
  const checkTransactionsContentRendered = useCallback((): boolean => {
    if (pathname !== '/transactions') return true;
    
    // 1. Vérifier qu'il n'y a plus de requêtes fetch actives ET que React Query n'est pas en train de charger
    if (activeFetchRequestsRef.current.size > 0 || isFetchingRef.current > 0) {
      return false; // Il y a encore des requêtes en cours
    }
    
    // 2. Vérifier les KPIs - doivent avoir des valeurs chargées
    const kpiCards = document.querySelectorAll('[class*="kpi"], [class*="Kpi"], [class*="KPI"]');
    if (kpiCards.length > 0) {
      let hasLoadedKpi = false;
      kpiCards.forEach((kpiCard) => {
        const hasSkeleton = kpiCard.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]');
        if (!hasSkeleton) {
          const hasValues = kpiCard.textContent && kpiCard.textContent.trim().length > 0 && !kpiCard.textContent.includes('€0') && !kpiCard.textContent.includes('0€');
          if (hasValues) {
            hasLoadedKpi = true;
          }
        }
      });
      if (hasLoadedKpi) {
        return true;
      }
    }
    
    // 3. Vérifier le tableau principal
    const table = document.querySelector('table');
    if (table) {
      const tbody = table.querySelector('tbody');
      if (tbody) {
        const hasSkeleton = tbody.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]');
        if (hasSkeleton) {
          return false;
        }
        if (tbody.children.length > 0) {
          const firstRow = tbody.children[0];
          const hasRealData = firstRow.textContent && firstRow.textContent.trim().length > 0;
          if (hasRealData) {
            return true;
          }
        }
        const hasEmptyState = document.querySelector('[class*="empty"], [class*="Empty"]') !== null;
        if (hasEmptyState) {
          return true;
        }
      }
    }
    
    return false;
  }, [pathname]);

  // Vérifier si le contenu de la page /documents est rendu ET que les données sont chargées
  const checkDocumentsContentRendered = useCallback((): boolean => {
    if (pathname !== '/documents') return true;
    
    // 1. Vérifier qu'il n'y a plus de requêtes fetch actives ET que React Query n'est pas en train de charger
    if (activeFetchRequestsRef.current.size > 0 || isFetchingRef.current > 0) {
      return false;
    }
    
    // 2. Vérifier les KPIs - doivent avoir des valeurs chargées
    const kpiCards = document.querySelectorAll('[class*="kpi"], [class*="Kpi"], [class*="KPI"]');
    if (kpiCards.length > 0) {
      let hasLoadedKpi = false;
      kpiCards.forEach((kpiCard) => {
        const hasSkeleton = kpiCard.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]');
        if (!hasSkeleton) {
          const hasValues = kpiCard.textContent && kpiCard.textContent.trim().length > 0 && !kpiCard.textContent.includes('€0') && !kpiCard.textContent.includes('0€');
          if (hasValues) {
            hasLoadedKpi = true;
          }
        }
      });
      if (hasLoadedKpi) {
        return true;
      }
    }
    
    // 3. Vérifier le tableau principal
    const table = document.querySelector('table');
    if (table) {
      const tbody = table.querySelector('tbody');
      if (tbody) {
        const hasSkeleton = tbody.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]');
        if (hasSkeleton) {
          return false;
        }
        if (tbody.children.length > 0) {
          const firstRow = tbody.children[0];
          const hasRealData = firstRow.textContent && firstRow.textContent.trim().length > 0;
          if (hasRealData) {
            return true;
          }
        }
        const hasEmptyState = document.querySelector('[class*="empty"], [class*="Empty"]') !== null;
        if (hasEmptyState) {
          return true;
        }
      }
    }
    
    return false;
  }, [pathname]);

  // Vérifier si le contenu de la page /echeances est rendu ET que les données sont chargées
  const checkEcheancesContentRendered = useCallback((): boolean => {
    if (pathname !== '/echeances') return true;
    
    // 1. Vérifier qu'il n'y a plus de requêtes fetch actives ET que React Query n'est pas en train de charger
    if (activeFetchRequestsRef.current.size > 0 || isFetchingRef.current > 0) {
      return false;
    }
    
    // 2. Vérifier les KPIs - doivent avoir des valeurs chargées
    const kpiCards = document.querySelectorAll('[class*="kpi"], [class*="Kpi"], [class*="KPI"]');
    if (kpiCards.length > 0) {
      let hasLoadedKpi = false;
      kpiCards.forEach((kpiCard) => {
        const hasSkeleton = kpiCard.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]');
        if (!hasSkeleton) {
          const hasValues = kpiCard.textContent && kpiCard.textContent.trim().length > 0 && !kpiCard.textContent.includes('€0') && !kpiCard.textContent.includes('0€');
          if (hasValues) {
            hasLoadedKpi = true;
          }
        }
      });
      if (hasLoadedKpi) {
        return true;
      }
    }
    
    // 3. Vérifier le tableau principal
    const table = document.querySelector('table');
    if (table) {
      const tbody = table.querySelector('tbody');
      if (tbody) {
        const hasSkeleton = tbody.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]');
        if (hasSkeleton) {
          return false;
        }
        if (tbody.children.length > 0) {
          const firstRow = tbody.children[0];
          const hasRealData = firstRow.textContent && firstRow.textContent.trim().length > 0;
          if (hasRealData) {
            return true;
          }
        }
        const hasEmptyState = document.querySelector('[class*="empty"], [class*="Empty"]') !== null;
        if (hasEmptyState) {
          return true;
        }
      }
    }
    
    // 4. Vérifier les graphiques
    const hasCharts = document.querySelector('[class*="chart"], [class*="Chart"]') !== null;
    if (hasCharts) {
      const chartSkeleton = document.querySelector('[class*="chart"] [class*="skeleton"], [class*="Chart"] [class*="Skeleton"]');
      if (!chartSkeleton) {
        return true;
      }
    }
    
    return false;
  }, [pathname]);

  // Vérifier si le contenu de la page /loans est rendu ET que les données sont chargées
  const checkLoansContentRendered = useCallback((): boolean => {
    if (pathname !== '/loans') return true;
    
    // 1. Vérifier qu'il n'y a plus de requêtes fetch actives ET que React Query n'est pas en train de charger
    if (activeFetchRequestsRef.current.size > 0 || isFetchingRef.current > 0) {
      return false;
    }
    
    // 2. Vérifier les KPIs - doivent avoir des valeurs chargées
    const kpiCards = document.querySelectorAll('[class*="kpi"], [class*="Kpi"], [class*="KPI"], [class*="LoansKpiBar"]');
    if (kpiCards.length > 0) {
      let hasLoadedKpi = false;
      kpiCards.forEach((kpiCard) => {
        const hasSkeleton = kpiCard.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]');
        if (!hasSkeleton) {
          const hasValues = kpiCard.textContent && kpiCard.textContent.trim().length > 0 && !kpiCard.textContent.includes('€0') && !kpiCard.textContent.includes('0€');
          if (hasValues) {
            hasLoadedKpi = true;
          }
        }
      });
      if (hasLoadedKpi) {
        return true;
      }
    }
    
    // 3. Vérifier le tableau principal
    const table = document.querySelector('table');
    if (table) {
      const tbody = table.querySelector('tbody');
      if (tbody) {
        const hasSkeleton = tbody.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]');
        if (hasSkeleton) {
          return false;
        }
        if (tbody.children.length > 0) {
          const firstRow = tbody.children[0];
          const hasRealData = firstRow.textContent && firstRow.textContent.trim().length > 0;
          if (hasRealData) {
            return true;
          }
        }
        const hasEmptyState = document.querySelector('[class*="empty"], [class*="Empty"]') !== null;
        if (hasEmptyState) {
          return true;
        }
      }
    }
    
    // 4. Vérifier les graphiques
    const hasCharts = document.querySelector('[class*="chart"], [class*="Chart"], [class*="LoansCRDTimelineChart"]') !== null;
    if (hasCharts) {
      const chartSkeleton = document.querySelector('[class*="chart"] [class*="skeleton"], [class*="Chart"] [class*="Skeleton"]');
      if (!chartSkeleton) {
        return true;
      }
    }
    
    return false;
  }, [pathname]);

  // Vérifier si le contenu de la page /fiscal est rendu ET que les données sont chargées
  const checkFiscalContentRendered = useCallback((): boolean => {
    if (pathname !== '/fiscal') return true;
    
    // 1. Vérifier qu'il n'y a plus de requêtes fetch actives ET que React Query n'est pas en train de charger
    if (activeFetchRequestsRef.current.size > 0 || isFetchingRef.current > 0) {
      return false;
    }
    
    // 2. Vérifier que le contenu principal est présent (tabs, formulaire, etc.)
    const hasMainContent = document.querySelector('[class*="FiscalTabs"], [class*="fiscal"], [class*="Fiscal"]') !== null;
    if (hasMainContent) {
      // Vérifier qu'il n'y a pas de skeleton
      const hasSkeleton = document.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]');
      if (!hasSkeleton) {
        return true;
      }
    }
    
    return false;
  }, [pathname]);

  // Vérifier si le contenu de la page /admin est rendu ET que les données sont chargées
  const checkAdminContentRendered = useCallback((): boolean => {
    if (pathname !== '/admin') return true;
    
    // 1. Vérifier qu'il n'y a plus de requêtes fetch actives ET que React Query n'est pas en train de charger
    if (activeFetchRequestsRef.current.size > 0 || isFetchingRef.current > 0) {
      return false;
    }
    
    // 2. Vérifier que le contenu principal est présent (cartes admin, tableaux, etc.)
    const hasMainContent = document.querySelector('[class*="admin"], [class*="Admin"], [class*="card"], [class*="Card"], table') !== null;
    if (hasMainContent) {
      // Vérifier qu'il n'y a pas de skeleton
      const hasSkeleton = document.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]');
      if (!hasSkeleton) {
        return true;
      }
    }
    
    return false;
  }, [pathname]);

  // Vérifier si le contenu de la page /parametres est rendu ET que les données sont chargées
  const checkParametresContentRendered = useCallback((): boolean => {
    if (pathname !== '/parametres') return true;
    
    // 1. Vérifier qu'il n'y a plus de requêtes fetch actives ET que React Query n'est pas en train de charger
    if (activeFetchRequestsRef.current.size > 0 || isFetchingRef.current > 0) {
      return false;
    }
    
    // 2. Vérifier que le contenu principal est présent (formulaires, sections, etc.)
    const hasMainContent = document.querySelector('[class*="parametres"], [class*="Parametres"], [class*="settings"], [class*="Settings"], form, [class*="section"]') !== null;
    if (hasMainContent) {
      // Vérifier qu'il n'y a pas de skeleton
      const hasSkeleton = document.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]');
      if (!hasSkeleton) {
        return true;
      }
    }
    
    return false;
  }, [pathname]);

  // Vérifier si le contenu d'une page /biens/[id]/* est rendu ET que les données sont chargées
  const checkPropertyDetailContentRendered = useCallback((): boolean => {
    // Vérifier si on est sur une page /biens/[id]/*
    const propertyDetailMatch = pathname?.match(/^\/biens\/([^/]+)\/(.+)$/);
    if (!propertyDetailMatch) return true; // Pas une page de détail de bien
    
    // 1. Vérifier qu'il n'y a plus de requêtes fetch actives ET que React Query n'est pas en train de charger
    if (activeFetchRequestsRef.current.size > 0 || isFetchingRef.current > 0) {
      return false;
    }
    
    const subPage = propertyDetailMatch[2]; // transactions, documents, leases, echeances, loans, photos
    
    // 2. Vérifier les KPIs si présents (pour toutes les pages sauf photos)
    let kpisLoaded = true; // Par défaut, on considère qu'il n'y a pas de KPIs à vérifier
    if (subPage !== 'photos') {
      const kpiCards = document.querySelectorAll('[class*="kpi"], [class*="Kpi"], [class*="KPI"], [class*="KpiBar"]');
      if (kpiCards.length > 0) {
        kpisLoaded = false; // Il y a des KPIs, on doit vérifier qu'ils sont chargés
        kpiCards.forEach((kpiCard) => {
          const hasSkeleton = kpiCard.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]');
          if (!hasSkeleton) {
            // Pour les KPIs, vérifier qu'ils ont des valeurs (même si c'est 0, c'est une valeur chargée)
            const hasContent = kpiCard.textContent && kpiCard.textContent.trim().length > 0;
            if (hasContent) {
              kpisLoaded = true; // Au moins un KPI est chargé
            }
          }
        });
      }
    }
    
    // 3. Vérifier les graphiques/charts (pour toutes les pages sauf photos)
    let chartsLoaded = true; // Par défaut, on considère qu'il n'y a pas de graphiques à vérifier
    if (subPage !== 'photos') {
      const charts = document.querySelectorAll('[class*="chart"], [class*="Chart"], canvas, svg[class*="recharts"]');
      if (charts.length > 0) {
        chartsLoaded = false; // Il y a des graphiques, on doit vérifier qu'ils sont chargés
        charts.forEach((chart) => {
          const hasSkeleton = chart.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]');
          if (!hasSkeleton) {
            // Vérifier que le graphique a du contenu (éléments SVG, canvas avec contenu, etc.)
            const hasContent = chart.querySelector('svg path, svg line, svg rect, canvas') !== null || 
                              (chart.textContent && chart.textContent.trim().length > 0);
            if (hasContent) {
              chartsLoaded = true; // Au moins un graphique est chargé
            }
          }
        });
      }
    }
    
    // 4. Vérifier le tableau principal (pour transactions, documents, leases, echeances, loans)
    let tableLoaded = true; // Par défaut, on considère qu'il n'y a pas de tableau à vérifier
    if (subPage !== 'photos') {
      const table = document.querySelector('table');
      if (table) {
        tableLoaded = false; // Il y a un tableau, on doit vérifier qu'il est chargé
        const tbody = table.querySelector('tbody');
        if (tbody) {
          const hasSkeleton = tbody.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]');
          if (hasSkeleton) {
            return false; // Le tableau a encore un skeleton, pas encore chargé
          }
          if (tbody.children.length > 0) {
            const firstRow = tbody.children[0];
            const hasRealData = firstRow.textContent && firstRow.textContent.trim().length > 0;
            if (hasRealData) {
              tableLoaded = true; // Le tableau a des données
            }
          } else {
            // Le tableau est vide, vérifier s'il y a un état vide affiché
            const hasEmptyState = document.querySelector('[class*="empty"], [class*="Empty"], [class*="empty-state"]') !== null;
            if (hasEmptyState) {
              tableLoaded = true; // L'état vide est affiché, le tableau est chargé
            }
          }
        }
      }
    }
    
    // 5. Pour la page photos, vérifier qu'il y a du contenu
    if (subPage === 'photos') {
      const hasContent = document.querySelector('h1, [class*="photo"], [class*="Photo"], img') !== null;
      if (hasContent) {
        const hasSkeleton = document.querySelector('[class*="skeleton"], [class*="Skeleton"], [class*="animate-pulse"]');
        if (!hasSkeleton) {
          return true;
        }
      }
    }
    
    // 6. Pour que la page soit considérée comme chargée, TOUS les éléments présents doivent être chargés
    // Si aucun élément n'est présent (pas de KPIs, pas de graphiques, pas de tableau), on considère que c'est chargé
    if (kpisLoaded && chartsLoaded && tableLoaded) {
      return true;
    }
    
    // Si on arrive ici, certains éléments ne sont pas encore chargés
    return false;
  }, [pathname]);

  // Vérifier si le contenu de la page est rendu ET que les données sont chargées
  const checkContentRendered = useCallback((): boolean => {
    // Page /biens
    if (pathname === '/biens') {
      return checkBiensContentRendered();
    }
    
    // Page /dashboard
    if (pathname === '/dashboard') {
      return checkDashboardContentRendered();
    }
    
    // Page /dashboard/patrimoine
    if (pathname === '/dashboard/patrimoine') {
      return checkPatrimoineContentRendered();
    }
    
    // Page /locataires
    if (pathname === '/locataires') {
      return checkLocatairesContentRendered();
    }
    
    // Page /baux
    if (pathname === '/baux') {
      return checkBauxContentRendered();
    }
    
    // Page /transactions
    if (pathname === '/transactions') {
      return checkTransactionsContentRendered();
    }
    
    // Page /documents
    if (pathname === '/documents') {
      return checkDocumentsContentRendered();
    }
    
    // Page /echeances
    if (pathname === '/echeances') {
      return checkEcheancesContentRendered();
    }
    
    // Page /loans
    if (pathname === '/loans') {
      return checkLoansContentRendered();
    }
    
    // Page /fiscal
    if (pathname === '/fiscal') {
      return checkFiscalContentRendered();
    }
    
    // Page /admin
    if (pathname === '/admin') {
      return checkAdminContentRendered();
    }
    
    // Page /parametres
    if (pathname === '/parametres') {
      return checkParametresContentRendered();
    }
    
    // Pages /biens/[id]/* (sous-pages de bien)
    if (pathname?.match(/^\/biens\/([^/]+)\/(.+)$/)) {
      return checkPropertyDetailContentRendered();
    }
    
    // Pour les autres pages, considérer comme rendu
    return true;
  }, [pathname, checkBiensContentRendered, checkDashboardContentRendered, checkPatrimoineContentRendered, checkLocatairesContentRendered, checkBauxContentRendered, checkTransactionsContentRendered, checkDocumentsContentRendered, checkEcheancesContentRendered, checkLoansContentRendered, checkFiscalContentRendered, checkAdminContentRendered, checkParametresContentRendered, checkPropertyDetailContentRendered]);

  // Intercepter les requêtes fetch pour détecter le chargement des données
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Vérifier si on est sur une page supportée
    const isSupportedPage = pathname === '/biens' || 
      pathname === '/dashboard' || 
      pathname === '/dashboard/patrimoine' || 
      pathname === '/locataires' || 
      pathname === '/baux' || 
      pathname === '/transactions' || 
      pathname === '/documents' || 
      pathname === '/echeances' || 
      pathname === '/loans' || 
      pathname === '/fiscal' || 
      pathname === '/admin' || 
      pathname === '/parametres' ||
      pathname?.match(/^\/biens\/([^/]+)\//);
    
    if (!isSupportedPage) return;
    
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      
      // Ignorer les requêtes Next.js internes
      if (url.includes('/_next/') || url.includes('/_rsc') || url.includes('__nextjs')) {
        return originalFetch(...args);
      }
      
      // Pour la page /biens, suivre les requêtes vers /api/insights
      if (url.includes('/api/insights') && pathname === '/biens') {
        const requestId = `${Date.now()}-${Math.random()}`;
        activeFetchRequestsRef.current.add(requestId);
        
        try {
          const response = await originalFetch(...args);
          return response;
        } finally {
          activeFetchRequestsRef.current.delete(requestId);
        }
      }
      
      // Pour la page /dashboard, suivre les requêtes vers /api/dashboard/monthly
      if (url.includes('/api/dashboard/monthly') && pathname === '/dashboard') {
        const requestId = `${Date.now()}-${Math.random()}`;
        activeFetchRequestsRef.current.add(requestId);
        
        try {
          const response = await originalFetch(...args);
          return response;
        } finally {
          activeFetchRequestsRef.current.delete(requestId);
        }
      }
      
      // Pour la page /dashboard/patrimoine, suivre les requêtes vers /api/dashboard/patrimoine
      if (url.includes('/api/dashboard/patrimoine') && pathname === '/dashboard/patrimoine') {
        const requestId = `${Date.now()}-${Math.random()}`;
        activeFetchRequestsRef.current.add(requestId);
        
        try {
          const response = await originalFetch(...args);
          return response;
        } finally {
          activeFetchRequestsRef.current.delete(requestId);
        }
      }
      
      // Pour la page /locataires, suivre les requêtes vers /api/tenants
      if (url.includes('/api/tenants') && pathname === '/locataires') {
        const requestId = `${Date.now()}-${Math.random()}`;
        activeFetchRequestsRef.current.add(requestId);
        
        try {
          const response = await originalFetch(...args);
          return response;
        } finally {
          activeFetchRequestsRef.current.delete(requestId);
        }
      }
      
      // Pour la page /baux, suivre les requêtes vers /api/leases
      if (url.includes('/api/leases') && pathname === '/baux') {
        const requestId = `${Date.now()}-${Math.random()}`;
        activeFetchRequestsRef.current.add(requestId);
        
        try {
          const response = await originalFetch(...args);
          return response;
        } finally {
          activeFetchRequestsRef.current.delete(requestId);
        }
      }
      
      // Pour la page /transactions, suivre les requêtes vers /api/transactions
      if (url.includes('/api/transactions') && pathname === '/transactions') {
        const requestId = `${Date.now()}-${Math.random()}`;
        activeFetchRequestsRef.current.add(requestId);
        
        try {
          const response = await originalFetch(...args);
          return response;
        } finally {
          activeFetchRequestsRef.current.delete(requestId);
        }
      }
      
      // Pour la page /documents, suivre les requêtes vers /api/documents
      if (url.includes('/api/documents') && pathname === '/documents') {
        const requestId = `${Date.now()}-${Math.random()}`;
        activeFetchRequestsRef.current.add(requestId);
        
        try {
          const response = await originalFetch(...args);
          return response;
        } finally {
          activeFetchRequestsRef.current.delete(requestId);
        }
      }
      
      // Pour la page /echeances, suivre les requêtes vers /api/echeances
      if (url.includes('/api/echeances') && pathname === '/echeances') {
        const requestId = `${Date.now()}-${Math.random()}`;
        activeFetchRequestsRef.current.add(requestId);
        
        try {
          const response = await originalFetch(...args);
          return response;
        } finally {
          activeFetchRequestsRef.current.delete(requestId);
        }
      }
      
      // Pour la page /loans, suivre les requêtes vers /api/loans
      if (url.includes('/api/loans') && pathname === '/loans') {
        const requestId = `${Date.now()}-${Math.random()}`;
        activeFetchRequestsRef.current.add(requestId);
        
        try {
          const response = await originalFetch(...args);
          return response;
        } finally {
          activeFetchRequestsRef.current.delete(requestId);
        }
      }
      
      // Pour la page /fiscal, suivre les requêtes vers /api/fiscal
      if (url.includes('/api/fiscal') && pathname === '/fiscal') {
        const requestId = `${Date.now()}-${Math.random()}`;
        activeFetchRequestsRef.current.add(requestId);
        
        try {
          const response = await originalFetch(...args);
          return response;
        } finally {
          activeFetchRequestsRef.current.delete(requestId);
        }
      }
      
      // Pour la page /admin, suivre les requêtes vers /api/admin
      if (url.includes('/api/admin') && pathname === '/admin') {
        const requestId = `${Date.now()}-${Math.random()}`;
        activeFetchRequestsRef.current.add(requestId);
        
        try {
          const response = await originalFetch(...args);
          return response;
        } finally {
          activeFetchRequestsRef.current.delete(requestId);
        }
      }
      
      // Pour la page /parametres, suivre les requêtes vers /api/settings
      if (url.includes('/api/settings') && pathname === '/parametres') {
        const requestId = `${Date.now()}-${Math.random()}`;
        activeFetchRequestsRef.current.add(requestId);
        
        try {
          const response = await originalFetch(...args);
          return response;
        } finally {
          activeFetchRequestsRef.current.delete(requestId);
        }
      }
      
      // Pour les pages /biens/[id]/*, suivre les requêtes vers /api/transactions, /api/documents, /api/leases, etc.
      if (pathname?.match(/^\/biens\/([^/]+)\//)) {
        // Suivre les requêtes vers les APIs utilisées par les sous-pages
        if (url.includes('/api/transactions') || 
            url.includes('/api/documents') || 
            url.includes('/api/leases') || 
            url.includes('/api/echeances') || 
            url.includes('/api/loans') ||
            url.includes('/api/properties/')) {
          const requestId = `${Date.now()}-${Math.random()}`;
          activeFetchRequestsRef.current.add(requestId);
          
          try {
            const response = await originalFetch(...args);
            return response;
          } finally {
            activeFetchRequestsRef.current.delete(requestId);
          }
        }
      }
      
      return originalFetch(...args);
    };
    
    return () => {
      window.fetch = originalFetch;
    };
  }, [pathname, checkContentRendered]);

  // Détecter les clics sur les liens et les lignes du tableau
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Utiliser pointerdown pour détecter plus tôt que click
    const handlePointerDown = (e: PointerEvent) => {
      // Ignorer les clics non-primaires
      if (e.button !== 0) return;
      
      const target = e.target as HTMLElement;
      
      // Détecter les clics sur les lignes du tableau des biens (qui ont data-property-id)
      const tableRow = target.closest('tr[data-property-id]');
      if (tableRow) {
        // Vérifier qu'on est bien sur la page /biens
        const currentPath = window.location.pathname;
        if (currentPath === '/biens' || currentPath.startsWith('/biens?')) {
          // Ignorer les clics sur les boutons d'action
          const isActionButton = target.closest('button') || target.closest('[role="button"]');
          if (isActionButton) {
            return;
          }
          
          // Extraire l'ID du bien depuis le data-attribute
          const propertyId = (tableRow as HTMLElement).dataset.propertyId;
          if (propertyId) {
            const targetPath = `/biens/${propertyId}/transactions`;
            
            // Réinitialiser les requêtes actives
            activeFetchRequestsRef.current.clear();
            clickedPathRef.current = targetPath;
            
            // Démarrer la barre immédiatement au clic (AVANT setLoading)
            setIsLoading(true);
            setShowBar(true);
            setProgress(initialProgress);
            
            // Marquer dans le contexte pour la synchronisation avec le menu
            setLoading(targetPath, true);
          }
        }
      }
    };
    
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      const link = target.closest('a[href]');
      
      if (link) {
        const href = link.getAttribute('href');
        
        // Vérifier si c'est un lien vers une sous-page de bien (menu PropertySubNav)
        // IMPORTANT: Vérifier en premier pour éviter les conflits avec les autres patterns
        if (href?.match(/^\/biens\/([^/]+)\/(transactions|documents|photos|leases|echeances|loans)$/)) {
          // Ne pas empêcher la navigation Next.js, juste démarrer le loader
          // Réinitialiser les requêtes actives
          activeFetchRequestsRef.current.clear();
          clickedPathRef.current = href;
          
          // Démarrer la barre immédiatement au clic
          setIsLoading(true);
          setShowBar(true);
          setProgress(initialProgress);
          setLoading(href, true);
          
          // Ne pas return ici pour laisser Next.js gérer la navigation
          // Mais éviter que le bloc suivant ne s'exécute
          return;
        }
        
        if (href === '/biens' || href?.startsWith('/biens?')) {
          // Réinitialiser les requêtes actives
          activeFetchRequestsRef.current.clear();
          clickedPathRef.current = '/biens';
          // Démarrer la barre immédiatement
          setIsLoading(true);
          setShowBar(true);
          setProgress(initialProgress);
          setLoading('/biens', true);
        } else if (href === '/dashboard' || href?.startsWith('/dashboard?')) {
          // Réinitialiser les requêtes actives
          activeFetchRequestsRef.current.clear();
          clickedPathRef.current = '/dashboard';
          // Démarrer la barre immédiatement
          setIsLoading(true);
          setShowBar(true);
          setProgress(initialProgress);
          setLoading('/dashboard', true);
        } else if (href === '/dashboard/patrimoine' || href?.startsWith('/dashboard/patrimoine')) {
          // Réinitialiser les requêtes actives
          activeFetchRequestsRef.current.clear();
          clickedPathRef.current = '/dashboard/patrimoine';
          // Démarrer la barre immédiatement
          setIsLoading(true);
          setShowBar(true);
          setProgress(initialProgress);
          setLoading('/dashboard/patrimoine', true);
        } else if (href === '/locataires' || href?.startsWith('/locataires')) {
          // Réinitialiser les requêtes actives
          activeFetchRequestsRef.current.clear();
          clickedPathRef.current = '/locataires';
          // Démarrer la barre immédiatement
          setIsLoading(true);
          setShowBar(true);
          setProgress(initialProgress);
          setLoading('/locataires', true);
        } else if (href === '/baux' || href?.startsWith('/baux')) {
          // Réinitialiser les requêtes actives
          activeFetchRequestsRef.current.clear();
          clickedPathRef.current = '/baux';
          // Démarrer la barre immédiatement
          setIsLoading(true);
          setShowBar(true);
          setProgress(initialProgress);
          setLoading('/baux', true);
        } else if (href === '/transactions' || href?.startsWith('/transactions')) {
          // Réinitialiser les requêtes actives
          activeFetchRequestsRef.current.clear();
          clickedPathRef.current = '/transactions';
          // Démarrer la barre immédiatement
          setIsLoading(true);
          setShowBar(true);
          setProgress(initialProgress);
          setLoading('/transactions', true);
        } else if (href === '/documents' || href?.startsWith('/documents')) {
          // Réinitialiser les requêtes actives
          activeFetchRequestsRef.current.clear();
          clickedPathRef.current = '/documents';
          // Démarrer la barre immédiatement
          setIsLoading(true);
          setShowBar(true);
          setProgress(initialProgress);
          setLoading('/documents', true);
        } else if (href === '/echeances' || href?.startsWith('/echeances')) {
          // Réinitialiser les requêtes actives
          activeFetchRequestsRef.current.clear();
          clickedPathRef.current = '/echeances';
          // Démarrer la barre immédiatement
          setIsLoading(true);
          setShowBar(true);
          setProgress(initialProgress);
          setLoading('/echeances', true);
        } else if (href === '/loans' || href?.startsWith('/loans')) {
          // Réinitialiser les requêtes actives
          activeFetchRequestsRef.current.clear();
          clickedPathRef.current = '/loans';
          // Démarrer la barre immédiatement
          setIsLoading(true);
          setShowBar(true);
          setProgress(initialProgress);
          setLoading('/loans', true);
        } else if (href === '/fiscal' || href?.startsWith('/fiscal')) {
          // Réinitialiser les requêtes actives
          activeFetchRequestsRef.current.clear();
          clickedPathRef.current = '/fiscal';
          // Démarrer la barre immédiatement
          setIsLoading(true);
          setShowBar(true);
          setProgress(initialProgress);
          setLoading('/fiscal', true);
        } else if (href === '/admin' || href?.startsWith('/admin')) {
          // Réinitialiser les requêtes actives
          activeFetchRequestsRef.current.clear();
          clickedPathRef.current = '/admin';
          // Démarrer la barre immédiatement
          setIsLoading(true);
          setShowBar(true);
          setProgress(initialProgress);
          setLoading('/admin', true);
        } else if (href === '/parametres' || href?.startsWith('/parametres')) {
          // Réinitialiser les requêtes actives
          activeFetchRequestsRef.current.clear();
          clickedPathRef.current = '/parametres';
          // Démarrer la barre immédiatement
          setIsLoading(true);
          setShowBar(true);
          setProgress(initialProgress);
          setLoading('/parametres', true);
        } else if (href?.match(/^\/biens\/([^/]+)\//) && !href.match(/^\/biens\/([^/]+)\/(transactions|documents|photos|leases|echeances|loans)$/)) {
          // Navigation vers une sous-page de bien qui n'est pas dans le menu PropertySubNav
          // (pour éviter les doubles déclenchements)
          const propertyId = href.match(/^\/biens\/([^/]+)\//)?.[1];
          activeFetchRequestsRef.current.clear();
          clickedPathRef.current = href;
          // Démarrer la barre immédiatement
          setIsLoading(true);
          setShowBar(true);
          setProgress(initialProgress);
          setLoading(href, true);
        }
      }
    };
    
    // Utiliser pointerdown avec capture pour détecter plus tôt
    document.addEventListener('pointerdown', handlePointerDown, { capture: true });
    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      document.removeEventListener('click', handleClick, true);
    };
  }, [initialProgress, setLoading]);

  // Nettoyer le loader de la ligne du tableau quand on quitte /biens ou quand le chargement est terminé
  useEffect(() => {
    if (pathname !== '/biens' && clickedPropertyRowRef.current) {
      clickedPropertyRowRef.current = null;
    }
    
    // Nettoyer aussi quand le chargement est terminé
    if (!isLoading && clickedPropertyRowRef.current && pathname?.match(/^\/biens\/([^/]+)\//)) {
      clickedPropertyRowRef.current = null;
    }
  }, [pathname, isLoading]);

  // Surveiller les changements de pathname pour toutes les pages supportées
  useEffect(() => {
    const isSupportedPage = pathname === '/biens' || 
      pathname === '/dashboard' || 
      pathname === '/dashboard/patrimoine' || 
      pathname === '/locataires' || 
      pathname === '/baux' || 
      pathname === '/transactions' || 
      pathname === '/documents' || 
      pathname === '/echeances' || 
      pathname === '/loans' || 
      pathname === '/fiscal' || 
      pathname === '/admin' || 
      pathname === '/parametres' ||
      pathname?.match(/^\/biens\/([^/]+)\//);
    
    if (isSupportedPage && pathnameRef.current !== pathname) {
      // On vient d'arriver sur la page
      // Si on avait cliqué sur cette page, le loader est déjà démarré, on ne fait rien
      if (clickedPathRef.current === pathname) {
        // Le pathname a changé vers la page sur laquelle on a cliqué, c'est bon
        // Le loader est déjà démarré par le clic, on ne fait rien
      } else if (pathname?.match(/^\/biens\/([^/]+)\//)) {
        // Navigation vers une sous-page de bien
        // Si on a déjà cliqué sur cette page, ne pas redémarrer le loader
        if (clickedPathRef.current === pathname && isLoading) {
          // Le loader est déjà démarré par le clic, on ne fait rien
          // Mais on met quand même à jour le contexte pour la synchronisation
          setLoading(pathname, true);
          return;
        }
        // Si le loader n'est pas encore démarré (via LoadingContext), le démarrer
        if (!isLoading) {
          setIsLoading(true);
          setShowBar(true);
          setProgress(initialProgress);
        }
        // Mettre à jour le pathname dans le contexte
        setLoading(pathname, true);
        clickedPathRef.current = pathname;
      } else if (!isLoading) {
        // Navigation directe (refresh, lien externe, etc.) - démarrer le loader
        setIsLoading(true);
        setShowBar(true);
        setProgress(initialProgress);
        setLoading(pathname, true);
      }
    }
    
    pathnameRef.current = pathname;
  }, [pathname, initialProgress, isLoading, setLoading]);

  // Surveiller LoadingContext pour démarrer la barre quand un path est marqué comme chargement
  // Utiliser loadingPathsArray pour forcer les re-renders
  useEffect(() => {
    // Vérifier si le pathname actuel ou un path vers lequel on navigue est en cours de chargement
    const currentPathLoading = loadingPaths.has(pathname);
    const clickedPathLoading = clickedPathRef.current && loadingPaths.has(clickedPathRef.current);
    
    if ((currentPathLoading || clickedPathLoading) && !isLoading) {
      // Un path est en cours de chargement, démarrer la barre immédiatement
      setIsLoading(true);
      setShowBar(true);
      setProgress(initialProgress);
      if (clickedPathRef.current) {
        // Ne pas changer clickedPathRef, il est déjà défini
      } else {
        clickedPathRef.current = pathname;
      }
    } else if ((currentPathLoading || clickedPathLoading) && isLoading) {
      // Le loader est déjà actif, s'assurer que la barre est visible
      setShowBar(true);
    }
  }, [loadingPathsArray, loadingPaths, pathname, isLoading, initialProgress]);

  // Surveiller React Query pour démarrer le loader si nécessaire (pour les pages qui utilisent React Query)
  useEffect(() => {
    if ((pathname === '/dashboard' || pathname === '/dashboard/patrimoine' || pathname === '/locataires' || pathname === '/documents' || pathname === '/echeances' || pathname === '/loans' || pathname === '/parametres') && isFetching > 0 && !isLoading) {
      // React Query charge, démarrer le loader
      setIsLoading(true);
      setShowBar(true);
      setProgress(initialProgress);
      setLoading(pathname, true);
    } else if ((pathname === '/dashboard' || pathname === '/dashboard/patrimoine' || pathname === '/locataires' || pathname === '/documents' || pathname === '/echeances' || pathname === '/loans' || pathname === '/parametres') && isFetching > 0 && isLoading) {
      // React Query charge et le loader est déjà actif, s'assurer que la barre est visible
      setShowBar(true);
    }
    
    // Pour les pages /biens/[id]/*, si React Query charge et que le loader est actif, s'assurer que la barre est visible
    if (pathname?.match(/^\/biens\/([^/]+)\//) && isFetching > 0 && isLoading) {
      setShowBar(true);
    }
  }, [isFetching, pathname, isLoading, initialProgress, setLoading]);

  // Vérifier périodiquement si le contenu est rendu (pour toutes les pages supportées)
  useEffect(() => {
    const isSupportedPage = pathname === '/biens' || 
      pathname === '/dashboard' || 
      pathname === '/dashboard/patrimoine' || 
      pathname === '/locataires' || 
      pathname === '/baux' || 
      pathname === '/transactions' || 
      pathname === '/documents' || 
      pathname === '/echeances' || 
      pathname === '/loans' || 
      pathname === '/fiscal' || 
      pathname === '/admin' || 
      pathname === '/parametres' ||
      pathname?.match(/^\/biens\/([^/]+)\//);
    
    if (!isLoading || !isSupportedPage) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      return;
    }

    // Vérifier toutes les 100ms si le contenu est rendu
    checkIntervalRef.current = setInterval(() => {
      // IMPORTANT : Ne pas terminer la barre si on a cliqué mais que le pathname n'a pas encore changé
      // Cela évite que la barre se termine trop tôt au premier chargement
      const clickedPath = clickedPathRef.current;
      if (clickedPath && pathname !== clickedPath) {
        // On a cliqué mais on n'est pas encore sur la bonne page, attendre
        return;
      }
      
      // Vérifier que toutes les requêtes sont terminées (fetch + React Query)
      const hasActiveRequests = activeFetchRequestsRef.current.size > 0;
      const hasReactQueryRequests = isFetchingRef.current > 0;
      const contentRendered = checkContentRendered();
      
      if (!hasActiveRequests && !hasReactQueryRequests && contentRendered) {
        // Le contenu est rendu, terminer la barre
        setProgress(100);
        setTimeout(() => {
          setIsLoading(false);
          setShowBar(false);
          setProgress(0);
          setLoading(pathname, false);
          // Réinitialiser clickedPathRef quand le chargement est terminé
          if (clickedPathRef.current === pathname) {
            clickedPathRef.current = null;
          }
        }, 200);
      }
    }, 100);

    // Timeout de sécurité : forcer la fin après 5 secondes
    const timeout = setTimeout(() => {
      setIsLoading(false);
      setShowBar(false);
      setProgress(0);
      setLoading(pathname, false);
    }, 5000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      clearTimeout(timeout);
    };
  }, [isLoading, pathname, checkContentRendered, setLoading]);

  // Animer la progression
  useEffect(() => {
    const isSupportedPage = pathname === '/biens' || 
      pathname === '/dashboard' || 
      pathname === '/dashboard/patrimoine' || 
      pathname === '/locataires' || 
      pathname === '/baux' || 
      pathname === '/transactions' || 
      pathname === '/documents' || 
      pathname === '/echeances' || 
      pathname === '/loans' || 
      pathname === '/fiscal' || 
      pathname === '/admin' || 
      pathname === '/parametres' ||
      pathname?.match(/^\/biens\/([^/]+)\//);
    
    if (!isLoading || !showBar || !isSupportedPage) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      return;
    }

    progressIntervalRef.current = setInterval(() => {
      setProgress((prev) => {
        // Ne pas dépasser 90% tant que le contenu n'est pas rendu ET que React Query charge
        const hasActiveRequests = activeFetchRequestsRef.current.size > 0;
        const hasReactQueryRequests = isFetchingRef.current > 0;
        const contentRendered = checkContentRendered();
        const maxProgress = (!hasActiveRequests && !hasReactQueryRequests && contentRendered) ? 100 : 90;
        return Math.min(prev + Math.random() * 3, maxProgress);
      });
    }, 200);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [isLoading, showBar, pathname, checkContentRendered]);

  if (!showBar) return null;

  return (
    <div
      className="smart-top-loader"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: `${height}px`,
        zIndex,
        pointerEvents: 'none',
      }}
    >
      <div
        className="smart-top-loader-bar"
        style={{
          height: '100%',
          width: `${progress}%`,
          backgroundColor: color,
          boxShadow: `0 0 10px ${shadowColor}`,
          transition: progress === 100 ? 'width 0.3s ease-out' : 'width 0.1s linear',
        }}
      />
    </div>
  );
}
