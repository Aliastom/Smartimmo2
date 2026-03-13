/**
 * Hook unifié pour charger les données des transactions
 * Fonctionne en mode "normal" (online avec fallback offline) et "app-shell" (offline-first)
 */

'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getTransactionRepositoryOffline } from '@/lib/offline/repositories/TransactionRepositoryOffline';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';
import { getLeaseRepositoryOffline } from '@/lib/offline/repositories/LeaseRepositoryOffline';
import { getTenantRepositoryOffline } from '@/lib/offline/repositories/TenantRepositoryOffline';
import { getLocalDB } from '@/lib/offline/db';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import type { LocalTransaction, LocalProperty, LocalLease, LocalTenant, CachedNature } from '@/lib/offline/db';

export interface Transaction {
  id: string;
  date: string;
  label: string;
  Property: {
    id: string;
    name: string;
    address: string;
  };
  lease?: {
    id: string;
    status: string;
  };
  tenant?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  nature: {
    id: string;
    label: string;
    type: 'RECETTE' | 'DEPENSE';
  };
  Category: {
    id: string;
    label: string;
  };
  amount: number;
  reference?: string;
  paymentDate?: string;
  paymentMethod?: string;
  paidAt?: string;
  method?: string;
  notes?: string;
  accountingMonth?: string;
  monthsCovered?: number;
  autoDistribution?: boolean;
  hasDocument: boolean;
  documentsCount: number;
  status: 'rapprochee' | 'nonRapprochee';
  rapprochementStatus?: string;
  dateRapprochement?: string | null;
  bankRef?: string | null;
  createdAt?: string;
  updatedAt?: string;
  documents?: Array<{
    id: string;
    name: string;
    type: string;
    createdAt: string;
  }>;
  parentTransactionId?: string;
  moisIndex?: number;
  moisTotal?: number;
  autoSource?: string | null;
  isAuto?: boolean;
  managementCompanyId?: string | null;
  propertyId?: string;
  leaseId?: string;
  tenantId?: string;
  natureId?: string;
  categoryId?: string;
}

export interface TransactionsFilters {
  search: string;
  propertyId: string;
  leaseId: string;
  tenantId: string;
  natureId: string;
  categoryId: string;
  amountMin: string;
  amountMax: string;
  dateFrom: string;
  dateTo: string;
  paidAtFrom: string;
  paidAtTo: string;
  status: string;
  hasDocument: string;
  includeManagementFees: boolean;
  groupByParent: boolean;
  includeArchived: boolean;
}

export interface UseTransactionsDataOptions {
  mode: 'normal' | 'app-shell';
  filters?: TransactionsFilters;
  activeKpiFilter?: string | null;
  periodStart?: string; // Format: 'YYYY-MM'
  periodEnd?: string; // Format: 'YYYY-MM'
  enabled?: boolean; // ✅ NOUVEAU: Permet de désactiver complètement le hook
  /** Tri côté serveur (mode normal). Appliqué AVANT limit/offset. */
  sortBy?: 'accounting_month' | 'accountingMonth' | 'date' | 'amount' | 'nature';
  sortOrder?: 'asc' | 'desc';
  /** Page courante pour la pagination serveur (mode normal). */
  page?: number;
  /** Nombre d'éléments par page (mode normal). */
  limit?: number;
}

export function useTransactionsData(options: UseTransactionsDataOptions) {
  const { mode, filters: filtersProp, activeKpiFilter, periodStart, periodEnd, enabled = true, sortBy = 'accountingMonth', sortOrder = 'desc', page = 1, limit = 50 } = options;
  const { organizationId } = useCurrentOrganization();
  const router = mode === 'normal' ? useRouter() : null;
  const searchParams = mode === 'normal' ? useSearchParams() : null;

  const [transactions, setTransactions] = useState<LocalTransaction[]>([]);
  const [properties, setProperties] = useState<LocalProperty[]>([]);
  const [leases, setLeases] = useState<LocalLease[]>([]);
  const [tenants, setTenants] = useState<LocalTenant[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [natures, setNatures] = useState<Map<string, CachedNature>>(new Map());
  const [loading, setLoading] = useState(mode === 'app-shell' && enabled);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [amountsSummary, setAmountsSummary] = useState({ positiveSum: 0, negativeSum: 0 });
  const [paginationTotal, setPaginationTotal] = useState(0);

  // ⚙️ Utiliser une ref pour accéder aux valeurs actuelles des filtres dans l'event listener
  // sans créer de dépendances qui causent des remounts
  const filtersRef = useRef(filtersProp);
  filtersRef.current = filtersProp;
  
  // ⚠️ DIAGNOSTIC: Ref pour éviter de logger plusieurs fois le warning sur natureMap vide
  const warnedAboutEmptyNatureMap = useRef(false);

  // ⚙️ OPTIMISATION: Charger les données de référence (qui ne changent pas) dans un useEffect séparé
  // Ces données ne doivent être chargées qu'une seule fois au montage ou quand organizationId change
  useEffect(() => {
    if (!enabled || mode !== 'app-shell' || !organizationId) {
      return;
    }
    
    let cancelled = false;

    async function loadReferenceData() {
      try {
        const db = await getLocalDB();
        const propRepo = getPropertyRepositoryOffline();
        const leaseRepo = getLeaseRepositoryOffline();
        const tenantRepo = getTenantRepositoryOffline();

        // ⚙️ OPTIMISATION: Charger les données de référence une seule fois
        // Ces données ne dépendent pas des filtres (sauf includeArchived pour properties)
        const [propertiesData, leasesData, tenantsData, categoriesData, naturesData] = await Promise.all([
          propRepo.getAll(organizationId, { includeArchived: filtersProp?.includeArchived || false }),
          leaseRepo.getAll(organizationId, {}),
          tenantRepo.getAll(organizationId, {}),
          db.Category.toArray(),
          db.NatureEntity.toArray(),
        ]);

        const natureMap = new Map<string, CachedNature>();
        naturesData.forEach(nature => {
          if (nature && nature.key) {
            natureMap.set(nature.key, nature);
          }
        });

        // ⚠️ DIAGNOSTIC: Logger si aucune nature n'est chargée
        if (natureMap.size === 0 && naturesData.length > 0) {
          console.warn('[useTransactionsData] ⚠️ Aucune nature valide trouvée dans IndexedDB. Natures chargées:', naturesData.length, 'Natures mappées:', natureMap.size);
        } else if (natureMap.size === 0) {
          console.warn('[useTransactionsData] ⚠️ Aucune nature dans IndexedDB. Vérifiez la synchronisation des natures.');
        }

        if (!cancelled) {
          setProperties(propertiesData);
          setLeases(leasesData);
          setTenants(tenantsData);
          setCategories(categoriesData);
          setNatures(natureMap);
          // Réinitialiser le flag de warning quand les natures sont rechargées
          warnedAboutEmptyNatureMap.current = false;
        }
      } catch (e: any) {
        console.error('[useTransactionsData] Erreur chargement données de référence:', e);
      }
    }

    loadReferenceData();

    return () => {
      cancelled = true;
    };
  }, [mode, organizationId, enabled, filtersProp?.includeArchived]);

  // ✅ CORRECTION: Charger les transactions (qui dépendent des filtres) dans un useEffect séparé
  useEffect(() => {
    if (!enabled) {
      return; // Ne rien faire si le hook est désactivé
    }
    
    let cancelled = false;

    async function loadTransactions() {
      if (mode === 'app-shell') {
        // Mode app-shell : charger UNIQUEMENT depuis IndexedDB
        if (!organizationId) {
          setError('OrganizationId requis');
          setLoading(false);
          return;
        }

        try {
          // ⚙️ OPTIMISATION: Ne pas mettre loading à true si on recharge juste les transactions
          // (les données de référence sont déjà chargées dans l'autre useEffect)
          const isFirstLoad = transactions.length === 0;
          if (isFirstLoad) {
            setLoading(true);
          }
          setError(null);

          const transRepo = getTransactionRepositoryOffline();

          // ⚙️ OPTIMISATION: Utiliser les filtres du repository pour éviter de charger toutes les transactions
          // si on a un propertyId dans les filtres, on charge directement les transactions filtrées
          const transactionFilters: { propertyId?: string; leaseId?: string; dateFrom?: string; dateTo?: string; nature?: string } = {};
          if (filtersProp?.propertyId) {
            transactionFilters.propertyId = filtersProp.propertyId;
          }
          if (filtersProp?.leaseId) {
            transactionFilters.leaseId = filtersProp.leaseId;
          }
          if (filtersProp?.dateFrom) {
            transactionFilters.dateFrom = filtersProp.dateFrom;
          }
          if (filtersProp?.dateTo) {
            transactionFilters.dateTo = filtersProp.dateTo;
          }
          if (filtersProp?.natureId) {
            transactionFilters.nature = filtersProp.natureId;
          }

          // ⚙️ OPTIMISATION: Charger uniquement les transactions (les données de référence sont déjà chargées)
          const transactionsData = await transRepo.getAll(organizationId, transactionFilters);

          if (!cancelled) {
            setTransactions(transactionsData);
            if (isFirstLoad) {
              setLoading(false);
            }
          }
        } catch (e: any) {
          if (!cancelled) {
            // Erreur silencieuse
            setError('Impossible de charger les transactions.');
            setLoading(false);
          }
        }
      } else {
        // Mode normal : charger depuis l'API
        try {
          // ⚙️ OPTIMISATION: Ne pas mettre loading à true si on recharge juste les transactions
          const isFirstLoad = transactions.length === 0;
          if (isFirstLoad) {
            setLoading(true);
          }
          setError(null);

          const params = new URLSearchParams();
          
          // Construire les paramètres depuis searchParams ou filtersProp
          const filters = filtersProp || {};
          
          Object.entries(filters).forEach(([key, value]) => {
            if (key === 'includeManagementFees') {
              params.append(key, value.toString());
            } else if (value && key !== 'status') {
              params.append(key, value);
            }
          });

          // Appliquer le filtre KPI actif
          if (activeKpiFilter === 'recettes') {
            params.append('flow', 'INCOME');
          } else if (activeKpiFilter === 'depenses') {
            params.append('flow', 'EXPENSE');
          } else if (activeKpiFilter === 'nonRapprochees') {
            params.append('status', 'non_rapprochee');
          }

          // Ajouter la période au format comptable
          if (periodStart) params.append('accountingMonthStart', periodStart);
          if (periodEnd) params.append('accountingMonthEnd', periodEnd);

          // Tri global (appliqué côté serveur avant limit/offset)
          params.append('sortBy', sortBy === 'accountingMonth' ? 'accounting_month' : sortBy);
          params.append('sortOrder', sortOrder);

          // Pagination
          params.append('page', String(page));
          params.append('limit', String(limit));

          // ⚙️ OPTIMISATION: Charger les données de référence seulement au premier chargement
          const needsReferenceData = properties.length === 0 || leases.length === 0;
          
          // Toujours charger les transactions
          const transactionsResponse = await fetch(`/api/transactions?${params.toString()}`);
          
          if (!transactionsResponse.ok) {
            throw new Error('Erreur lors du chargement des transactions');
          }

          const transactionsData = await transactionsResponse.json();
          
          // Charger les données de référence seulement si nécessaire
          if (needsReferenceData) {
            const [propertiesResponse, leasesResponse, tenantsResponse, categoriesResponse, naturesResponse] = await Promise.all([
              fetch(`/api/properties?${filters.includeArchived ? 'includeArchived=true' : ''}`),
              fetch('/api/leases'),
              fetch('/api/tenants'),
              fetch('/api/accounting/categories'),
              fetch('/api/admin/natures')
            ]);
            
            const propertiesData = await propertiesResponse.json();
            const leasesData = await leasesResponse.json();
            const tenantsData = await tenantsResponse.json();
            const categoriesData = await categoriesResponse.json();
            const naturesData = await naturesResponse.json();
            
            if (!cancelled) {
              setProperties(Array.isArray(propertiesData) ? propertiesData : (propertiesData.data || []));
              setLeases(Array.isArray(leasesData) ? leasesData : (leasesData.items || leasesData.data || []));
              setTenants(Array.isArray(tenantsData) ? tenantsData : (tenantsData.data || []));
              setCategories(categoriesData);
              setNatures(new Map());
            }
          }
          
          if (!cancelled) {
            setTransactions(transactionsData.data || []);
            setAmountsSummary(transactionsData.sums || { positiveSum: 0, negativeSum: 0 });
            setPaginationTotal(transactionsData.pagination?.total ?? 0);

            if (isFirstLoad) {
              setLoading(false);
            }
          }
        } catch (e: any) {
          if (!cancelled) {
            // Erreur silencieuse
            // En cas d'erreur, essayer de charger depuis IndexedDB
            if (organizationId) {
              try {
                const db = await getLocalDB();
                const transRepo = getTransactionRepositoryOffline();
                const propRepo = getPropertyRepositoryOffline();
                const leaseRepo = getLeaseRepositoryOffline();
                const tenantRepo = getTenantRepositoryOffline();
                
                // Utiliser les mêmes filtres que pour le mode app-shell
                const transactionFilters: { propertyId?: string; leaseId?: string; dateFrom?: string; dateTo?: string; nature?: string } = {};
                if (filtersProp?.propertyId) {
                  transactionFilters.propertyId = filtersProp.propertyId;
                }
                if (filtersProp?.leaseId) {
                  transactionFilters.leaseId = filtersProp.leaseId;
                }
                if (filtersProp?.dateFrom) {
                  transactionFilters.dateFrom = filtersProp.dateFrom;
                }
                if (filtersProp?.dateTo) {
                  transactionFilters.dateTo = filtersProp.dateTo;
                }
                if (filtersProp?.natureId) {
                  transactionFilters.nature = filtersProp.natureId;
                }

                const [transactionsData, propertiesData, leasesData, tenantsData, categoriesData, naturesData] = await Promise.all([
                  transRepo.getAll(organizationId, transactionFilters),
                  propRepo.getAll(organizationId, { includeArchived: filtersProp?.includeArchived || false }),
                  leaseRepo.getAll(organizationId, {}),
                  tenantRepo.getAll(organizationId, {}),
                  db.Category.toArray(),
                  db.NatureEntity.toArray(),
                ]);

                const natureMap = new Map<string, CachedNature>();
                naturesData.forEach(nature => {
                  if (nature && nature.key) {
                  natureMap.set(nature.key, nature);
                  }
                });

                if (!cancelled) {
                  // 🔍 DIAGNOSTIC: Vérifier method dans les transactions chargées après transactions:refresh (offline fallback)
                  if (transactionsData.length > 0) {
                    const { logToServer } = await import('@/lib/utils/logger');
                    const sample = transactionsData.find(t => t.id) || transactionsData[0];
                    await logToServer(`[useTransactionsData] 🔍 Après transactions:refresh (offline fallback) - Transaction chargée: id=${sample.id}, method=${sample.method}, method type=${typeof sample.method}`);
                  }
                  setTransactions(transactionsData);
                  setProperties(propertiesData);
                  setLeases(leasesData);
                  setTenants(tenantsData);
                  setCategories(categoriesData);
                  setNatures(natureMap);
                  setLoading(false);
                }
              } catch (offlineError) {
                if (!cancelled) {
                  setError('Impossible de charger les transactions.');
                  setLoading(false);
                }
              }
            } else {
              setError('Impossible de charger les transactions.');
              setLoading(false);
            }
          }
        }
      }
    }

    loadTransactions();

    return () => {
      cancelled = true;
    };
    // ⚙️ OPTIMISATION: refreshKey retiré des dépendances pour éviter les rechargements complets
    // Les refreshes sont gérés par l'event listener séparé ci-dessous qui met à jour directement les données
    // ⚠️ CRITIQUE: Inclure filtersProp?.propertyId dans les dépendances pour déclencher le rechargement quand propertyId change
    // sortBy, sortOrder, page : tri et pagination côté serveur
  }, [mode, organizationId, filtersProp?.propertyId, filtersProp?.leaseId, filtersProp?.dateFrom, filtersProp?.dateTo, filtersProp?.natureId, activeKpiFilter, periodStart, periodEnd, enabled, sortBy, sortOrder, page, limit]);

  // Écouter les événements de refresh en mode app-shell
  // ⚙️ OPTIMISATION: Au lieu d'utiliser refreshKey (qui déclenche un rechargement complet),
  // mettre à jour directement les données depuis IndexedDB pour éviter un remount complet
  // ✅ FILTRE STRICT : Filtrer les events par propertyId si spécifié
  // ✅ Anti-loop : ignorer les refresh identiques trop rapprochés
  const lastRefreshRef = useRef<{ propertyId?: string; reason?: string; timestamp: number } | null>(null);
  
  useEffect(() => {
    if (mode === 'app-shell' && enabled && organizationId) {
      const handleRefresh = async (event?: Event) => {
        // ⚙️ OPTIMISATION: Recharger uniquement les transactions depuis IndexedDB
        // sans déclencher un remount complet via refreshKey
        
        // ✅ FILTRE STRICT : Si propertyId est défini dans les filtres, accepter UNIQUEMENT les events avec scope='property' ET propertyId correspondant
        const currentFilters = filtersRef.current;
        if (event instanceof CustomEvent && event.detail) {
          const detail = event.detail as { scope?: string; propertyId?: string; reason?: string };
          
          if (currentFilters?.propertyId) {
            if (detail.scope !== 'property' || !detail.propertyId || detail.propertyId !== currentFilters.propertyId) {
              return; // Ignorer les events sans scope, scope différent, ou propertyId différent/absent
            }
          }
          
          // Anti-loop : ignorer les refresh identiques < 300ms
          const now = Date.now();
          const lastRefresh = lastRefreshRef.current;
          if (lastRefresh && 
              lastRefresh.propertyId === detail.propertyId && 
              lastRefresh.reason === detail.reason &&
              now - lastRefresh.timestamp < 300) {
            return;
          }
          
          lastRefreshRef.current = {
            propertyId: detail.propertyId,
            reason: detail.reason,
            timestamp: now,
          };
        }
        
        try {
          const transRepo = getTransactionRepositoryOffline();
          
          // Utiliser les filtres actuels depuis la ref (pas depuis les dépendances)
          const transactionFilters: { propertyId?: string; leaseId?: string; dateFrom?: string; dateTo?: string; nature?: string } = {};
          if (currentFilters?.propertyId) {
            transactionFilters.propertyId = currentFilters.propertyId;
          }
          if (currentFilters?.leaseId) {
            transactionFilters.leaseId = currentFilters.leaseId;
          }
          if (currentFilters?.dateFrom) {
            transactionFilters.dateFrom = currentFilters.dateFrom;
          }
          if (currentFilters?.dateTo) {
            transactionFilters.dateTo = currentFilters.dateTo;
          }
          if (currentFilters?.natureId) {
            transactionFilters.nature = currentFilters.natureId;
          }

          // Recharger uniquement les transactions (les autres données changent rarement)
          const transactionsData = await transRepo.getAll(organizationId, transactionFilters);
          
          // Mettre à jour l'état directement sans recharger tout
          setTransactions(transactionsData);
        } catch (error) {
          console.error('[useTransactionsData] Erreur lors du refresh:', error);
          // En cas d'erreur critique, ne rien faire (les données restent telles quelles)
          // On ne veut pas déclencher un remount complet avec refreshKey
        }
      };
      
      // ⚠️ CRITIQUE: Ne pas écouter sync:refresh (événement global qui déclencherait des recalculs inutiles)
      // Utiliser uniquement transactions:refresh avec filtrage par propertyId
      window.addEventListener('transactions:refresh', handleRefresh);
      return () => {
        window.removeEventListener('transactions:refresh', handleRefresh);
      };
    }
    // ⚙️ OPTIMISATION: Ne pas inclure filtersProp dans les dépendances pour éviter de recréer le listener
    // On utilise une ref pour accéder aux valeurs actuelles
  }, [mode, enabled, organizationId]);

  // État pour les compteurs de documents (calculés via documentLinks)
  const [documentCounts, setDocumentCounts] = useState<Map<string, number>>(new Map());
  
  // Charger les compteurs de documents en mode app-shell
  useEffect(() => {
    if (mode === 'app-shell' && organizationId && transactions.length > 0) {
      let cancelled = false;
      
      async function loadDocumentCounts() {
        try {
          const { getDocumentCountsForTransactions } = await import('@/lib/offline/services/documentLinksService');
          const transactionIds = transactions.map(t => t.id);
          const counts = await getDocumentCountsForTransactions(transactionIds, organizationId!);
          
          if (!cancelled) {
            setDocumentCounts(counts);
          }
        } catch (error) {
          console.error('Error loading document counts:', error);
        }
      }
      
      loadDocumentCounts();
      
      return () => {
        cancelled = true;
      };
    }
  }, [mode, organizationId, transactions.map(t => t.id).join(',')]);
  
  // Écouter les événements de refresh pour mettre à jour les compteurs
  useEffect(() => {
    if (mode === 'app-shell' && organizationId && transactions.length > 0) {
      const handleRefresh = async () => {
        try {
          const { getDocumentCountsForTransactions } = await import('@/lib/offline/services/documentLinksService');
          const transactionIds = transactions.map(t => t.id);
          const counts = await getDocumentCountsForTransactions(transactionIds, organizationId!);
          setDocumentCounts(counts);
        } catch (error) {
          console.error('Error refreshing document counts:', error);
        }
      };
      
      window.addEventListener('sync:refresh', handleRefresh);
      window.addEventListener('documents:refresh', handleRefresh);
      window.addEventListener('transactions:refresh', handleRefresh);
      
      return () => {
        window.removeEventListener('sync:refresh', handleRefresh);
        window.removeEventListener('documents:refresh', handleRefresh);
        window.removeEventListener('transactions:refresh', handleRefresh);
      };
    }
  }, [mode, organizationId, transactions.map(t => t.id).join(',')]);

  // Convertir LocalTransaction vers Transaction pour compatibilité
  const convertedTransactions: Transaction[] = useMemo(() => {
    if (mode === 'app-shell') {
      // En mode app-shell, construire Transaction depuis les données locales
      return transactions.map(trans => {
        const property = properties.find(p => p.id === trans.propertyId);
        const lease = trans.leaseId ? leases.find(l => l.id === trans.leaseId) : null;
        const tenant = trans.tenantId ? tenants.find(t => t.id === trans.tenantId) : null;
        const nature = trans.nature ? natures.get(trans.nature) : null;
        const category = categories.find(c => c.id === trans.categoryId);

        // Debug: vérifier si la nature est trouvée
        if (trans.nature && !nature) {
          // ⚠️ DIAGNOSTIC: Logger seulement si le natureMap n'est pas vide (pour éviter le spam)
          // Si le natureMap est vide, c'est un problème de chargement des natures depuis IndexedDB
          if (natures.size > 0) {
            console.warn('[useTransactionsData] ⚠️ Nature non trouvée dans natureMap:', {
              transactionId: trans.id,
              natureKey: trans.nature,
              availableKeys: Array.from(natures.keys()).slice(0, 10),
              totalNatures: natures.size
            });
          } else {
            // ⚠️ CRITIQUE: Le natureMap est vide - les natures ne sont pas chargées depuis IndexedDB
            // Logger seulement une fois pour éviter le spam
            if (!warnedAboutEmptyNatureMap.current) {
              console.warn('[useTransactionsData] ⚠️ CRITIQUE: natureMap est vide - les natures ne sont pas chargées depuis IndexedDB. Vérifiez la synchronisation des natures.');
              warnedAboutEmptyNatureMap.current = true;
            }
          }
        }

        // Déterminer le type de nature
        const natureType = nature?.flow === 'INCOME' || nature?.flow === 'RECETTE' ? 'RECETTE' : 'DEPENSE';

        // Calculer les documents liés à cette transaction via documentLinks
        const documentsCount = documentCounts.get(trans.id) || 0;
        const hasDocument = documentsCount > 0;

        return {
          id: trans.id,
          date: trans.date,
          label: trans.label || '',
          Property: property ? {
            id: property.id,
            name: property.name,
            address: property.address || '',
          } : {
            id: trans.propertyId || '',
            name: 'Bien inconnu',
            address: '',
          },
          lease: lease ? {
            id: lease.id,
            status: lease.status,
          } : undefined,
          tenant: tenant ? {
            id: tenant.id,
            firstName: tenant.firstName,
            lastName: tenant.lastName,
          } : undefined,
          nature: {
            id: trans.nature || '',
            label: nature?.label || 'Nature inconnue',
            type: natureType,
          },
          Category: category ? {
            id: category.id,
            label: category.label || '',
          } : {
            id: trans.categoryId || '',
            label: 'Catégorie inconnue',
          },
          amount: trans.amount || 0,
          reference: trans.reference || undefined,
          paymentDate: trans.paymentDate || undefined,
          paymentMethod: trans.paymentMethod || undefined,
          paidAt: trans.paidAt || undefined,
          method: trans.method || undefined,
          notes: trans.notes || undefined,
          accountingMonth: (trans as any).accounting_month || (trans as any).accountingMonth || undefined,
          monthsCovered: trans.monthsCovered || undefined,
          autoDistribution: trans.autoDistribution || false,
          hasDocument,
          documentsCount,
          status: trans.status === 'rapprochee' ? 'rapprochee' : 'nonRapprochee',
          rapprochementStatus: trans.rapprochementStatus || undefined,
          dateRapprochement: trans.dateRapprochement || null,
          bankRef: trans.bankRef || null,
          createdAt: trans.createdAt || new Date().toISOString(),
          updatedAt: trans.updatedAt || new Date().toISOString(),
          parentTransactionId: trans.parentTransactionId || undefined,
          moisIndex: trans.moisIndex || undefined,
          moisTotal: trans.moisTotal || undefined,
          autoSource: trans.autoSource || null,
          isAuto: trans.isAuto || false,
          managementCompanyId: trans.managementCompanyId || null,
          propertyId: trans.propertyId,
          leaseId: trans.leaseId,
          tenantId: trans.tenantId,
          natureId: trans.nature,
          categoryId: trans.categoryId,
        };
      });
    }
    // En mode normal, utiliser directement les données de l'API
    return transactions as any;
  }, [mode, transactions, properties, leases, tenants, categories, natures, documentCounts]);

  // Filtrer les transactions selon les filtres (en mode app-shell)
  const filteredTransactions = useMemo(() => {
    if (mode === 'normal') {
      // En mode normal, les données sont déjà filtrées par le serveur
      return convertedTransactions;
    }
    
    // Mode app-shell : filtrer côté client
    let filtered = [...convertedTransactions];

    const filters = filtersProp || {};

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(t => 
        t.label.toLowerCase().includes(searchLower) ||
        t.Property.name.toLowerCase().includes(searchLower) ||
        (t.reference && t.reference.toLowerCase().includes(searchLower))
      );
    }

    if (filters.propertyId) {
      filtered = filtered.filter(t => t.propertyId === filters.propertyId);
    }

    if (filters.leaseId) {
      filtered = filtered.filter(t => t.leaseId === filters.leaseId);
    }

    if (filters.tenantId) {
      filtered = filtered.filter(t => t.tenantId === filters.tenantId);
    }

    if (filters.natureId) {
      filtered = filtered.filter(t => t.natureId === filters.natureId);
    }

    if (filters.categoryId) {
      filtered = filtered.filter(t => t.categoryId === filters.categoryId);
    }

    if (filters.amountMin) {
      const min = parseFloat(filters.amountMin);
      filtered = filtered.filter(t => Math.abs(t.amount) >= min);
    }

    if (filters.amountMax) {
      const max = parseFloat(filters.amountMax);
      filtered = filtered.filter(t => Math.abs(t.amount) <= max);
    }

    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      filtered = filtered.filter(t => new Date(t.date) >= from);
    }

    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      filtered = filtered.filter(t => new Date(t.date) <= to);
    }

    // Filtre par date d'encaissement (paidAt, fallback date si non renseigné)
    if (filters.paidAtFrom) {
      const from = new Date(filters.paidAtFrom);
      filtered = filtered.filter(t => {
        const encaissementDate = t.paidAt ?? t.date;
        return encaissementDate && new Date(encaissementDate) >= from;
      });
    }
    if (filters.paidAtTo) {
      const to = new Date(filters.paidAtTo);
      filtered = filtered.filter(t => {
        const encaissementDate = t.paidAt ?? t.date;
        return encaissementDate && new Date(encaissementDate) <= to;
      });
    }

    if (filters.status) {
      filtered = filtered.filter(t => t.status === filters.status);
    }

    if (filters.hasDocument === 'yes') {
      filtered = filtered.filter(t => t.hasDocument);
    } else if (filters.hasDocument === 'no') {
      filtered = filtered.filter(t => !t.hasDocument);
    }

    // Appliquer le filtre KPI actif
    if (activeKpiFilter === 'recettes') {
      filtered = filtered.filter(t => t.nature.type === 'RECETTE');
    } else if (activeKpiFilter === 'depenses') {
      filtered = filtered.filter(t => t.nature.type === 'DEPENSE');
    } else if (activeKpiFilter === 'nonRapprochees') {
      filtered = filtered.filter(t => t.status === 'nonRapprochee');
    }

    // Filtrer par période comptable si fournie
    if (periodStart && periodEnd) {
      filtered = filtered.filter(t => {
        const accountingMonth = (t as any).accounting_month || (t as any).accountingMonth;
        
        // ⚠️ CORRECTION: Si accountingMonth n'est pas défini, utiliser la date de la transaction comme fallback
        if (!accountingMonth) {
          // Extraire YYYY-MM de la date de la transaction
          if (t.date) {
            const transactionDate = new Date(t.date);
            const transactionMonth = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, '0')}`;
            return transactionMonth >= periodStart && transactionMonth <= periodEnd;
          }
          // Si pas de date non plus, exclure la transaction
          return false;
        }
        
        return accountingMonth >= periodStart && accountingMonth <= periodEnd;
      });
    }

    // Filtrer les frais de gestion si nécessaire
    if (!filters.includeManagementFees) {
      filtered = filtered.filter(t => t.autoSource !== 'gestion');
    }

    return filtered;
  }, [mode, convertedTransactions, filtersProp, activeKpiFilter, periodStart, periodEnd]);

  // Filtrer les données de référence en fonction des sélections (interdépendance)
  const filteredProperties = useMemo(() => {
    if (!filtersProp?.tenantId && !filtersProp?.leaseId) return properties;
    
    if (filtersProp.tenantId) {
      const relatedLeases = leases.filter(l => l.tenantId === filtersProp.tenantId);
      const propertyIds = relatedLeases.map(l => l.propertyId);
      return properties.filter(p => propertyIds.includes(p.id));
    }
    
    if (filtersProp.leaseId) {
      const lease = leases.find(l => l.id === filtersProp.leaseId);
      if (lease) {
        return properties.filter(p => p.id === lease.propertyId);
      }
    }
    
    return properties;
  }, [properties, leases, filtersProp?.tenantId, filtersProp?.leaseId]);

  const filteredLeases = useMemo(() => {
    if (!filtersProp?.propertyId && !filtersProp?.tenantId) return leases;
    
    let filtered = leases;
    
    if (filtersProp.propertyId) {
      filtered = filtered.filter(l => l.propertyId === filtersProp.propertyId);
    }
    
    if (filtersProp.tenantId) {
      filtered = filtered.filter(l => l.tenantId === filtersProp.tenantId);
    }
    
    return filtered;
  }, [leases, filtersProp?.propertyId, filtersProp?.tenantId]);

  const filteredTenants = useMemo(() => {
    if (!filtersProp?.propertyId && !filtersProp?.leaseId) return tenants;
    
    if (filtersProp.propertyId) {
      const relatedLeases = leases.filter(l => l.propertyId === filtersProp.propertyId);
      const tenantIds = relatedLeases.map(l => l.tenantId);
      return tenants.filter(t => tenantIds.includes(t.id));
    }
    
    if (filtersProp.leaseId) {
      const lease = leases.find(l => l.id === filtersProp.leaseId);
      if (lease) {
        return tenants.filter(t => t.id === lease.tenantId);
      }
    }
    
    return tenants;
  }, [tenants, leases, filtersProp?.propertyId, filtersProp?.leaseId]);

  // Calculer le résumé des montants en mode app-shell
  const calculatedAmountsSummary = useMemo(() => {
    if (mode === 'app-shell') {
      const positiveSum = filteredTransactions
        .filter(t => t.nature.type === 'RECETTE')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const negativeSum = filteredTransactions
        .filter(t => t.nature.type === 'DEPENSE')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      return { positiveSum, negativeSum };
    }
    return amountsSummary;
  }, [mode, filteredTransactions, amountsSummary]);

  return {
    transactions: filteredTransactions,
    properties: filteredProperties as any[],
    leases: filteredLeases as any[],
    tenants: filteredTenants as any[],
    categories: categories as any[],
    natures: Array.from(natures.values()) as any[],
    totalCount: mode === 'normal' && paginationTotal > 0 ? paginationTotal : filteredTransactions.length,
    amountsSummary: calculatedAmountsSummary,
    loading,
    error,
    // Utilitaires pour le mode normal
    router: router || null,
    searchParams: searchParams || null,
  };
}
