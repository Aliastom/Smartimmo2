import { useState, useEffect, useRef } from 'react';
import { getLoanRepositoryOffline } from '@/lib/offline/repositories/LoanRepositoryOffline';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { buildSchedule, crdAtDate } from '@/lib/finance/amortization';
import type { LocalLoan, LocalProperty } from '@/lib/offline/db';

interface LoansChartsParams {
  from?: string;
  to?: string;
  propertyId?: string;
  scope?: 'global' | 'property'; // ✅ Scope : 'global' pour page globale, 'property' pour tab property
  mode?: 'normal' | 'app-shell';
}

export interface LoansChartsData {
  crdTimeline: { month: string; crd: number }[];
  crdByProperty: { propertyName: string; crd: number; propertyId: string }[];
  topCostlyLoans: { loanId: string; label: string; totalInterest: number; borrowers?: Array<{ name: string; pct: number | null }> }[];
}

// ✅ OFFLINE-FIRST: Données vides par défaut
const EMPTY_CHARTS_DATA: LoansChartsData = {
  crdTimeline: [],
  crdByProperty: [],
  topCostlyLoans: [],
};

export function useLoansCharts(params: LoansChartsParams = {}) {
  const { mode = 'normal', from, to, propertyId, scope: scopeParam } = params;
  const { organizationId } = useCurrentOrganization();
  
  // ✅ OFFLINE-FIRST: Détecter explicitement offline/app-shell
  // ⚠️ DURCISSEMENT: Utiliser UNIQUEMENT le paramètre mode, pas window.location
  // ✅ OFFLINE-FIRST : Pas d'API en offline/app-shell
  const isAppShell = mode === 'app-shell';
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  const shouldUseLocalData = isAppShell || isOffline;
  
  // ✅ Déterminer le scope : 'property' si propertyId est défini, sinon 'global'
  const scope = scopeParam || (propertyId ? 'property' : 'global');
  
  const [data, setData] = useState<LoansChartsData>(EMPTY_CHARTS_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // ✅ Anti-loop pour les events
  const lastRefreshRef = useRef<{ propertyId?: string; timestamp: number } | null>(null);
  
  // ✅ Mémoriser la période calculée pour éviter qu'elle change à chaque re-render
  const calculatedPeriodRef = useRef<{ from: string; to: string; loansHash: string } | null>(null);
  
  // ✅ Anti-spam : Guard inFlight pour ignorer les réponses obsolètes
  const requestTokenRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // ✅ Stabilité : Dépendances strictes (from, to, propertyId, organizationId, mode, isOffline, scope)
    let cancelled = false;
    
    const calculateCharts = async () => {
      // ✅ Anti-spam : Incrémenter le token pour ignorer les réponses obsolètes
      const currentToken = ++requestTokenRef.current;
      
      setIsLoading(true);
      setError(null);

      try {
        if (shouldUseLocalData && organizationId) {
          // ✅ APP-SHELL/OFFLINE: Calculer depuis IndexedDB uniquement
          const loanRepo = getLoanRepositoryOffline();
          const propRepo = getPropertyRepositoryOffline();
          
          // Charger les prêts et propriétés
          const [allLoans, allProperties] = await Promise.all([
            loanRepo.getAll(organizationId, {}),
            propRepo.getAll(organizationId, {}),
          ]);
          
          // ✅ Anti-spam : Vérifier que la requête n'est pas obsolète
          if (currentToken !== requestTokenRef.current || cancelled) {
            return;
          }
          
          // Créer un map des propriétés pour accès rapide
          const propertiesLookup = new Map<string, LocalProperty>();
          allProperties.forEach(prop => {
            propertiesLookup.set(prop.id, prop);
          });
          
          // ✅ Calculer la période AVANT de filtrer par isActive
          // Utiliser TOUS les prêts (actifs et inactifs) pour déterminer la période
          // pour éviter que la période change si les prêts ne sont pas encore chargés
          let loansForPeriod = allLoans;
          if (propertyId) {
            loansForPeriod = loansForPeriod.filter(loan => loan.propertyId === propertyId);
          }
          
          // Calculer la période : si from/to non spécifiés, utiliser la date de début du prêt le plus ancien
          let calculatedFrom = from;
          let calculatedTo = to;
          
          // ✅ Si la période est explicitement fournie, l'utiliser et ne pas la mettre en cache
          // ✅ Sinon, calculer depuis le prêt le plus ancien
          if (!calculatedFrom || !calculatedTo) {
            // ✅ Si on a déjà une période en cache ET que les prêts n'ont pas changé, la réutiliser
            const cachedPeriod = calculatedPeriodRef.current;
            const loansHash = loansForPeriod.map(l => `${l.id}-${l.startDate}`).join('|');
            
            if (cachedPeriod && cachedPeriod.loansHash === loansHash && loansForPeriod.length > 0) {
              // Réutiliser la période calculée précédemment
              if (!calculatedFrom) calculatedFrom = cachedPeriod.from;
              if (!calculatedTo) calculatedTo = cachedPeriod.to;
              
              if (process.env.NODE_ENV === 'development') {
                console.log('[useLoansCharts] ✅ Période réutilisée depuis le cache:', { from: calculatedFrom, to: calculatedTo, loansCount: loansForPeriod.length });
              }
            } else if (loansForPeriod.length > 0) {
              // Calculer une nouvelle période seulement si on a des prêts
              // Trouver la date de début la plus ancienne parmi TOUS les prêts (pas seulement actifs)
              const oldestStartDate = loansForPeriod.reduce((oldest, loan) => {
                const loanStart = new Date(loan.startDate);
                return loanStart < oldest ? loanStart : oldest;
              }, new Date(loansForPeriod[0].startDate));
              
              // Si from n'est pas spécifié, commencer au mois de début du prêt le plus ancien
              if (!calculatedFrom) {
                calculatedFrom = `${oldestStartDate.getFullYear()}-${String(oldestStartDate.getMonth() + 1).padStart(2, '0')}`;
              }
              
              // Si to n'est pas spécifié, utiliser le mois actuel
              if (!calculatedTo) {
                calculatedTo = new Date().toISOString().substring(0, 7);
              }
              
              // ✅ Mémoriser la période calculée
              calculatedPeriodRef.current = { from: calculatedFrom, to: calculatedTo, loansHash };
              
              if (process.env.NODE_ENV === 'development') {
                console.log('[useLoansCharts] 📅 Nouvelle période calculée:', { from: calculatedFrom, to: calculatedTo, oldestStartDate: oldestStartDate.toISOString(), loansCount: loansForPeriod.length });
              }
            } else {
              // Pas de prêts : utiliser une période par défaut (année en cours)
              if (!calculatedFrom) {
                calculatedFrom = `${new Date().getFullYear()}-01`;
              }
              if (!calculatedTo) {
                calculatedTo = new Date().toISOString().substring(0, 7);
              }
              
              if (process.env.NODE_ENV === 'development') {
                console.log('[useLoansCharts] ⚠️ Aucun prêt trouvé, période par défaut:', { from: calculatedFrom, to: calculatedTo });
              }
            }
          }
          
          // Maintenant filtrer par isActive pour les calculs de CRD
          let filteredLoans = allLoans.filter(loan => loan.isActive);
          if (propertyId) {
            filteredLoans = filteredLoans.filter(loan => loan.propertyId === propertyId);
          }
          
          const startDate = new Date(calculatedFrom + '-01');
          const endDate = new Date(calculatedTo + '-01');
          
          const months: string[] = [];
          const currentDate = new Date(startDate);
          while (currentDate <= endDate) {
            const month = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
            months.push(month);
            currentDate.setMonth(currentDate.getMonth() + 1);
          }

          // 1. CRD global vs temps (Line chart)
          const crdTimeline: { month: string; crd: number }[] = [];
          
          if (process.env.NODE_ENV === 'development') {
            console.log('[useLoansCharts] 📊 Calcul du CRD timeline:', { 
              monthsCount: months.length, 
              filteredLoansCount: filteredLoans.length,
              period: { from: calculatedFrom, to: calculatedTo }
            });
          }
          
          for (const month of months) {
            let totalCRD = 0;
            
            for (const loan of filteredLoans) {
              // Vérifier si le prêt est actif à cette date
              const loanStartDate = new Date(loan.startDate);
              const loanStartMonth = `${loanStartDate.getFullYear()}-${String(loanStartDate.getMonth() + 1).padStart(2, '0')}`;
              const loanEndMonth = loan.endDate 
                ? `${new Date(loan.endDate).getFullYear()}-${String(new Date(loan.endDate).getMonth() + 1).padStart(2, '0')}`
                : null;
              
              if (month >= loanStartMonth && (!loanEndMonth || month <= loanEndMonth)) {
                const schedule = buildSchedule({
                  principal: Number(loan.principal),
                  annualRatePct: Number(loan.annualRatePct),
                  durationMonths: loan.durationMonths,
                  defermentMonths: loan.defermentMonths || 0,
                  insurancePct: loan.insurancePct ? Number(loan.insurancePct) : 0,
                  startDate: loanStartDate,
                  paymentDay: loan.paymentDay || undefined,
                });
                
                const crd = crdAtDate(schedule, month);
                totalCRD += crd;
              }
            }
            
            crdTimeline.push({
              month,
              crd: Math.round(totalCRD * 100) / 100,
            });
          }
          
          if (process.env.NODE_ENV === 'development') {
            console.log('[useLoansCharts] ✅ CRD timeline calculé:', { 
              dataPoints: crdTimeline.length,
              firstMonth: crdTimeline[0]?.month,
              lastMonth: crdTimeline[crdTimeline.length - 1]?.month,
              firstCRD: crdTimeline[0]?.crd,
              lastCRD: crdTimeline[crdTimeline.length - 1]?.crd
            });
          }

          // 2. Répartition par bien (Donut chart) - CRD au mois 'to'
          const crdByProperty: { propertyName: string; crd: number; propertyId: string }[] = [];
          
          const propertiesMap = new Map<string, { name: string; crd: number }>();
          
          for (const loan of filteredLoans) {
            const loanStartDate = new Date(loan.startDate);
            const schedule = buildSchedule({
              principal: Number(loan.principal),
              annualRatePct: Number(loan.annualRatePct),
              durationMonths: loan.durationMonths,
              defermentMonths: loan.defermentMonths || 0,
              insurancePct: loan.insurancePct ? Number(loan.insurancePct) : 0,
              startDate: loanStartDate,
              paymentDay: loan.paymentDay || undefined,
            });
            
            const crd = crdAtDate(schedule, calculatedTo);
            
            if (crd > 0) {
              const propertyName = propertiesLookup.get(loan.propertyId)?.name || loan.propertyName || 'Bien inconnu';
              const existing = propertiesMap.get(loan.propertyId);
              
              if (existing) {
                existing.crd += crd;
              } else {
                propertiesMap.set(loan.propertyId, {
                  name: propertyName,
                  crd,
                });
              }
            }
          }
          
          for (const [propertyIdKey, data] of propertiesMap.entries()) {
            crdByProperty.push({
              propertyId: propertyIdKey,
              propertyName: data.name,
              crd: Math.round(data.crd * 100) / 100,
            });
          }
          
          // Trier par CRD décroissant
          crdByProperty.sort((a, b) => b.crd - a.crd);

          // 3. Classement par coût d'intérêts (top 5)
          const loanCosts: { loanId: string; label: string; totalInterest: number; borrowers?: Array<{ name: string; pct: number | null }> }[] = [];
          
          for (const loan of filteredLoans) {
            const loanStartDate = new Date(loan.startDate);
            const schedule = buildSchedule({
              principal: Number(loan.principal),
              annualRatePct: Number(loan.annualRatePct),
              durationMonths: loan.durationMonths,
              defermentMonths: loan.defermentMonths || 0,
              insurancePct: loan.insurancePct ? Number(loan.insurancePct) : 0,
              startDate: loanStartDate,
              paymentDay: loan.paymentDay || undefined,
            });
            
            const totalInterest = schedule.length > 0
              ? schedule[schedule.length - 1].cumulativeInterest
              : 0;
            
            if (totalInterest > 0) {
              // Note: En app-shell, on ne charge pas les co-emprunteurs pour l'instant
              // (nécessiterait un repository LoanBorrower offline)
              loanCosts.push({
                loanId: loan.id,
                label: loan.label,
                totalInterest: Math.round(totalInterest * 100) / 100,
                borrowers: undefined, // TODO: Charger depuis IndexedDB si nécessaire
              });
            }
          }
          
          // Trier par coût décroissant et prendre le top 5
          loanCosts.sort((a, b) => b.totalInterest - a.totalInterest);
          const topCostlyLoans = loanCosts.slice(0, 5);

          // ✅ Anti-spam : Vérifier que la requête n'est pas obsolète avant setState
          if (currentToken !== requestTokenRef.current || cancelled) {
            return;
          }

          setData({
            crdTimeline,
            crdByProperty,
            topCostlyLoans,
          });
        } else if (!shouldUseLocalData) {
          // ✅ MODE NORMAL: Utiliser l'API uniquement si online et mode normal
          if (typeof navigator !== 'undefined' && !navigator.onLine) {
            // Si on passe en offline, utiliser les données locales
            if (currentToken === requestTokenRef.current && !cancelled) {
              setData(EMPTY_CHARTS_DATA);
              setIsLoading(false);
            }
            return;
          }

          // ✅ AbortController : Créer un nouveau controller pour cette requête
          abortControllerRef.current?.abort();
          const controller = new AbortController();
          abortControllerRef.current = controller;

          const searchParams = new URLSearchParams();
          if (from) searchParams.append('from', from);
          if (to) searchParams.append('to', to);
          if (propertyId) searchParams.append('propertyId', propertyId);
          
          const response = await fetch(`/api/loans/charts?${searchParams.toString()}`, {
            signal: controller.signal,
          });
          
          // ✅ Anti-spam : Vérifier que la requête n'est pas obsolète
          if (currentToken !== requestTokenRef.current || cancelled) {
            return;
          }
          
          if (!response.ok) {
            throw new Error('Erreur lors du chargement des graphiques');
          }

          const responseData = await response.json();
          
          // ✅ Anti-spam : Vérifier que la requête n'est pas obsolète avant setState
          if (currentToken !== requestTokenRef.current || cancelled) {
            return;
          }
          
          setData(responseData);
        } else {
          // Pas d'organizationId ou conditions non remplies
          if (currentToken === requestTokenRef.current && !cancelled) {
            setData(EMPTY_CHARTS_DATA);
            setIsLoading(false);
          }
        }
      } catch (err) {
        // ✅ Ne pas logguer si la requête a été abortée (comportement attendu)
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        
        // ✅ Anti-spam : Vérifier que la requête n'est pas obsolète avant setState
        if (currentToken !== requestTokenRef.current || cancelled) {
          return;
        }
        
        // ✅ OFFLINE-FIRST: En offline/app-shell, pas d'erreur console (comportement attendu)
        // Utiliser console.warn en DEV uniquement pour le debug
        if (shouldUseLocalData) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[useLoansCharts] Erreur calcul local (offline/app-shell):', err);
          }
        } else {
          console.error('Erreur lors du chargement des graphiques des prêts:', err);
        }
        
        setError(err as Error);
        setData(EMPTY_CHARTS_DATA);
      } finally {
        // ✅ Anti-spam : Vérifier que la requête n'est pas obsolète avant setState
        if (currentToken === requestTokenRef.current && !cancelled) {
          setIsLoading(false);
        }
      }
    };

    calculateCharts();
    
    // ✅ APP-SHELL: Écouter les events de refresh
    if (shouldUseLocalData) {
      const handleRefresh = (event: Event) => {
        if (!(event instanceof CustomEvent) || !event.detail) return;
        
        const detail = event.detail as { scope?: string; propertyId?: string; reason?: string };
        
        // ✅ FILTRE STRICT : Filtrer par scope
        if (scope === 'global') {
          // Scope 'global' : écouter uniquement les événements avec scope === 'global'
          if (detail.scope !== 'global') {
            if (process.env.NODE_ENV === 'development') {
              console.log('[useLoansCharts] ⚠️ Event ignoré (filtre strict global):', {
                scope: detail.scope,
                eventPropertyId: detail.propertyId
              });
            }
            return; // Ignorer les events scope 'property'
          }
        } else if (scope === 'property') {
          // Scope 'property' : écouter uniquement les événements avec scope === 'property' ET propertyId correspondant
          if (detail.scope !== 'property') {
            if (process.env.NODE_ENV === 'development') {
              console.log('[useLoansCharts] ⚠️ Event ignoré (filtre strict property - scope différent):', {
                scope: detail.scope,
                eventPropertyId: detail.propertyId,
                hookPropertyId: propertyId
              });
            }
            return; // Ignorer les events scope 'global'
          }
          if (propertyId && detail.propertyId && detail.propertyId !== propertyId) {
            if (process.env.NODE_ENV === 'development') {
              console.log('[useLoansCharts] ⚠️ Event ignoré (filtre strict property - propertyId différent):', {
                scope: detail.scope,
                eventPropertyId: detail.propertyId,
                hookPropertyId: propertyId
              });
            }
            return; // Ignorer les events avec propertyId différent
          }
        }
        
        // Anti-loop : ignorer les refresh identiques < 300ms
        const now = Date.now();
        const lastRefresh = lastRefreshRef.current;
        if (lastRefresh && 
            lastRefresh.propertyId === detail.propertyId &&
            now - lastRefresh.timestamp < 300) {
          return;
        }
        
        lastRefreshRef.current = {
          propertyId: detail.propertyId,
          timestamp: now,
        };
        
        // ✅ Réinitialiser le cache de période pour forcer un recalcul
        calculatedPeriodRef.current = null;
        calculateCharts();
      };
      
      window.addEventListener('loans:refresh', handleRefresh);
      return () => {
        cancelled = true;
        window.removeEventListener('loans:refresh', handleRefresh);
        // ✅ Cleanup : Abort les requêtes en cours lors du unmount
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    } else {
      return () => {
        cancelled = true;
        // ✅ Cleanup : Abort les requêtes en cours lors du unmount
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }
  }, [
    // ✅ Stabilité : Dépendances strictes uniquement (pas d'objets/func instables)
    from,
    to,
    propertyId,
    organizationId,
    mode,
    isOffline,
    scope,
    shouldUseLocalData,
  ]);

  return { data, isLoading, error };
}
