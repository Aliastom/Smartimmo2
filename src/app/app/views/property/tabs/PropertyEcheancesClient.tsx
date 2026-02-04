'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { notify2 } from '@/lib/notify2';
import { Plus, Edit, Trash2, CheckCircle, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { Pagination } from '@/components/ui/Pagination';
import { usePropertyHeaderActions } from '@/app/biens/[id]/PropertyHeaderActionsContext';
import { EcheancesKpiBar } from '@/components/echeances/EcheancesKpiBar';
import { EcheancesCumulativeChart } from '@/components/echeances/EcheancesCumulativeChart';
import { EcheancesByTypeChart } from '@/components/echeances/EcheancesByTypeChart';
import { EcheancesRecuperablesChart } from '@/components/echeances/EcheancesRecuperablesChart';
import EcheancesFilters from '@/components/echeances/EcheancesFilters';
import { EcheanceModal } from '@/components/echeances/EcheanceModal';
import { EcheanceDrawer } from '@/components/echeances/EcheanceDrawer';
import { ConfirmDeleteEcheanceModal } from '@/components/echeances/ConfirmDeleteEcheanceModal';
import { ConfirmDeleteMultipleEcheancesModal } from '@/components/echeances/ConfirmDeleteMultipleEcheancesModal';
import { useEcheancesData } from '@/features/echeances/hooks/useEcheancesData';
import { useEcheancesKpis } from '@/features/echeances/hooks/useEcheancesKpis';
import { useEcheancesCharts } from '@/features/echeances/hooks/useEcheancesCharts';
import { getLeaseRepositoryOffline } from '@/lib/offline/repositories/LeaseRepositoryOffline';
import { getTenantRepositoryOffline } from '@/lib/offline/repositories/TenantRepositoryOffline';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { navigateToView } from '@/utils/appShellNavigation';
import { createEcheanceServiceWithMode } from '@/domain/services/echeanceServiceFactory';
import {
  EcheanceRecurrente,
  ECHEANCE_TYPE_LABELS,
  PERIODICITE_LABELS,
  SENS_LABELS,
  TYPE_COLORS,
} from '@/types/echeance';
import { EcheanceFormSchema } from '@/lib/validations/echeance';
import Link from 'next/link';

interface PropertyEcheancesClientProps {
  propertyId: string;
  propertyName: string;
}

interface Filters {
  search: string;
  type: string;
  sens: string;
  periodicite: string;
  leaseId: string;
  recuperable: string;
  isActive: string; // ✅ Ajouter le filtre actif/inactif
}

export default function PropertyEcheancesClient({ propertyId, propertyName }: PropertyEcheancesClientProps) {
  const { organizationId } = useCurrentOrganization();
  
  // ✅ CORRECTION: Mémoriser les propriétés pour la modale pour éviter les re-renders inutiles
  // et s'assurer que le nom est toujours à jour (même si propertyName change après le mount)
  const propertiesForModal = useMemo(() => {
    // Ne pas créer l'option si le nom n'est pas encore chargé
    if (!propertyName || propertyName === 'Chargement...') {
      return [];
    }
    return [{ id: propertyId, name: propertyName }];
  }, [propertyId, propertyName]);

  // États des modals et drawer
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedEcheance, setSelectedEcheance] = useState<EcheanceRecurrente | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'duplicate'>('create');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [echeanceToDelete, setEcheanceToDelete] = useState<EcheanceRecurrente | null>(null);

  // États pour la sélection multiple
  const [selectedEcheanceIds, setSelectedEcheanceIds] = useState<string[]>([]);
  const [showDeleteMultipleModal, setShowDeleteMultipleModal] = useState(false);

  // États pour la période (format YYYY) - Par défaut : 5 années à venir
  const now = new Date();
  const currentYear = now.getFullYear();
  const [periodStart, setPeriodStart] = useState(currentYear.toString());
  const [periodEnd, setPeriodEnd] = useState((currentYear + 4).toString());
  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('yearly');

  // État pour le filtre KPI actif
  const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>(null);

  // États des filtres (sans propertyId car fixe)
  const [filters, setFilters] = useState<Filters>({
    search: '',
    type: '',
    sens: '',
    periodicite: '',
    leaseId: '',
    recuperable: '',
    isActive: '', // ✅ Ajouter le filtre actif/inactif
  });

  // État pour la pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 30, // ✅ Desktop: 30 items par page (comme Transactions et Documents)
  });

  // État pour la limite mobile (cards)
  const [mobileLimit, setMobileLimit] = useState(3);

  // ✅ Mémoriser les filters pour éviter les re-renders infinis
  const filtersForHook = useMemo(() => ({
    propertyId, // ✅ Filtrer par bien
    search: '',
    type: '',
    sens: '',
    periodicite: '',
    leaseId: '',
    recuperable: '',
  }), [propertyId]);

  // ✅ APP-SHELL: Charger les échéances depuis IndexedDB avec filtre propertyId
  const {
    allEcheances, // ✅ Toutes les échéances non filtrées (pour filtrage en mémoire)
    properties,
    leases: allLeases,
    totalCount,
    pagination: dataPagination,
    loading: isLoading,
  } = useEcheancesData({
    mode: 'app-shell',
    scope: 'property', // ✅ Scope property pour filtrer les events
    propertyId, // ✅ Passer propertyId pour filtrer les events
    filters: filtersForHook,
    activeKpiFilter: null, // ✅ Ne pas appliquer le filtre KPI ici, on le fait en mémoire
    page: 1, // ✅ Pas de pagination côté hook, on fait tout en mémoire
    pageSize: 10000, // ✅ Charger toutes les échéances
  });

  // ✅ APP-SHELL: Filtrer les échéances en mémoire selon les filtres UI
  const filteredEcheances = useMemo(() => {
    // ✅ Note: allEcheances est déjà filtré par propertyId au niveau IndexedDB
    if (!allEcheances || allEcheances.length === 0) {
      return [];
    }
    let filtered = allEcheances.filter(echeance => {
      // ⚠️ CORRECTION: Ne plus exclure les échéances désactivées par défaut
      // Le toggle "Actif" sert à désactiver/activer une échéance, pas à la supprimer
      // Les échéances désactivées (isActive: false) doivent être visibles si le filtre est sur "Toutes"
      // 
      // Note: Le soft delete réel devrait utiliser un autre mécanisme (ex: champ deletedAt ou méthode deleteEcheance)
      // Pour l'instant, on affiche toutes les échéances (actives et inactives) quand le filtre est sur "Toutes"

      // Filtre de recherche
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        if (!echeance.label.toLowerCase().includes(searchLower)) return false;
      }

      // Filtre de type
      if (filters.type && echeance.type !== filters.type) return false;

      // Filtre de sens
      if (filters.sens && echeance.sens !== filters.sens) return false;

      // Filtre de périodicité
      if (filters.periodicite && echeance.periodicite !== filters.periodicite) return false;

      // Filtre de bail
      if (filters.leaseId && echeance.Lease?.id !== filters.leaseId) return false;

      // Filtre récupérable
      if (filters.recuperable === 'true' && !echeance.recuperable) return false;
      if (filters.recuperable === 'false' && echeance.recuperable) return false;

      // ✅ Filtre actif/inactif (explicite uniquement)
      // Par défaut, on affiche TOUTES les échéances (actives ET inactives)
      if (filters.isActive === 'active' && !echeance.isActive) return false;
      if (filters.isActive === 'inactive' && echeance.isActive) return false;

      return true;
    });

    // Appliquer le filtre KPI actif
    if (activeKpiFilter === 'revenus') {
      filtered = filtered.filter(e => e.sens === 'CREDIT');
    } else if (activeKpiFilter === 'charges') {
      filtered = filtered.filter(e => e.sens === 'DEBIT');
    } else if (activeKpiFilter === 'actives') {
      filtered = filtered.filter(e => e.isActive);
    }

    return filtered;
  }, [allEcheances, filters, activeKpiFilter]);

  // ✅ APP-SHELL: Charger les baux depuis IndexedDB avec les informations des locataires
  const [leases, setLeases] = useState<Array<{ id: string; propertyId: string; type: string; status: string; tenantName?: string }>>([]);
  useEffect(() => {
    if (!organizationId) return;
    
    const loadLeases = async () => {
      try {
        const leaseRepo = getLeaseRepositoryOffline();
        const tenantRepo = getTenantRepositoryOffline();
        const allLeasesData = await leaseRepo.getAll(organizationId, {});
        // Filtrer par propertyId
        const propertyLeases = allLeasesData.filter(lease => lease.propertyId === propertyId);
        
        // Charger les locataires pour chaque bail
        const leasesWithTenants = await Promise.all(
          propertyLeases.map(async (lease) => {
            try {
              const tenant = await tenantRepo.getById(lease.tenantId, organizationId);
              const tenantName = tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : undefined;
              return {
                id: lease.id,
                propertyId: lease.propertyId,
                type: lease.type,
                status: lease.status,
                tenantName,
              };
            } catch (error) {
              console.error(`Erreur lors du chargement du locataire pour le bail ${lease.id}:`, error);
              return {
                id: lease.id,
                propertyId: lease.propertyId,
                type: lease.type,
                status: lease.status,
              };
            }
          })
        );
        
        setLeases(leasesWithTenants);
      } catch (error) {
        console.error('Erreur lors du chargement des baux:', error);
      }
    };

    loadLeases();
  }, [organizationId, propertyId]); // ✅ Chargé une seule fois, pas rechargé à chaque filtre

  // ✅ APP-SHELL: Charger les KPIs en mode app-shell (filtrés par propertyId)
  const { data: kpisData, isLoading: kpisLoading } = useEcheancesKpis({ 
    mode: 'app-shell',
    scope: 'property', // ✅ Scope property pour filtrer les events
    propertyId, // Filtré par bien
  });

  // ✅ APP-SHELL: Charger les graphiques en mode app-shell (filtrés par propertyId)
  const { data: chartsData, isLoading: chartsLoading } = useEcheancesCharts({
    mode: 'app-shell',
    scope: 'property', // ✅ Scope property pour filtrer les events
    periodStart,
    periodEnd,
    viewMode,
    propertyId, // Filtré par bien
  });

  const kpis = kpisData || { revenusAnnuels: 0, chargesAnnuelles: 0, totalEcheances: 0, echeancesActives: 0 };
  const charts = chartsData || { cumulative: [], byType: [], recuperables: { recuperables: 0, nonRecuperables: 0 } };

  // ✅ Synchroniser la pagination (sans créer de boucle)
  useEffect(() => {
    if (dataPagination) {
      setPagination(prev => {
        const newTotal = dataPagination.total || filteredEcheances.length;
        const newPages = dataPagination.pages || Math.ceil(filteredEcheances.length / prev.limit);
        // Ne mettre à jour que si les valeurs ont vraiment changé
        if (prev.total === newTotal && prev.pages === newPages) {
          return prev;
        }
        return {
          ...prev,
          total: newTotal,
          pages: newPages,
        };
      });
    }
  }, [dataPagination?.total, dataPagination?.pages, filteredEcheances.length]);

  // ✅ APP-SHELL: Gestion des filtres (en mémoire uniquement, pas de fetch)
  const handleFiltersChange = useCallback((newFilters: Filters) => {
    setFilters(newFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  // ✅ APP-SHELL: Gestion du filtre KPI (en mémoire uniquement)
  const handleKpiFilterChange = useCallback((filterKey: string | null) => {
    if (filterKey === activeKpiFilter) {
      setActiveKpiFilter(null);
    } else {
      setActiveKpiFilter(filterKey);
    }
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [activeKpiFilter]);

  const handleResetFilters = useCallback(() => {
    setFilters({
      search: '',
      type: '',
      sens: '',
      periodicite: '',
      leaseId: '',
      recuperable: '',
      isActive: '', // ✅ Réinitialiser le filtre actif/inactif
    });
    setActiveKpiFilter(null);
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, []);

  // Handlers de période
  const handlePeriodChange = (start: string, end: string) => {
    setPeriodStart(start);
    setPeriodEnd(end);
  };

  // CRUD Handlers
  const handleCreate = useCallback(() => {
    setSelectedEcheance(null);
    setModalMode('create');
    setIsModalOpen(true);
  }, []);

  const handleEdit = (echeance: EcheanceRecurrente) => {
    setSelectedEcheance(echeance);
    setModalMode('edit');
    setIsModalOpen(true);
    setIsDrawerOpen(false);
  };

  const handleDuplicate = (echeance: EcheanceRecurrente) => {
    setSelectedEcheance(echeance);
    setModalMode('duplicate');
    setIsModalOpen(true);
    setIsDrawerOpen(false);
  };

  const handleDelete = (echeance: EcheanceRecurrente) => {
    setEcheanceToDelete(echeance);
    setShowDeleteModal(true);
    setIsDrawerOpen(false);
  };

  const handleRowClick = (echeance: EcheanceRecurrente) => {
    setSelectedEcheance(echeance);
    setIsDrawerOpen(true);
  };

  // ✅ APP-SHELL: Soumission via Domain Service (local-first)
  const handleFormSubmit = async (data: EcheanceFormSchema) => {
    if (!organizationId) {
      notify2.error('OrganizationId manquant');
      return;
    }

    try {
      const echeanceService = createEcheanceServiceWithMode('app-shell');
      
      if (modalMode === 'edit' && selectedEcheance?.id) {
        // Mise à jour
        await echeanceService.updateEcheance(selectedEcheance.id, organizationId, {
          label: data.label,
          type: data.type,
          periodicite: data.periodicite,
          montant: data.montant,
          sens: data.sens,
          recuperable: data.recuperable,
          propertyId: data.propertyId || propertyId,
          leaseId: data.leaseId || null,
          startAt: new Date(data.startAt),
          endAt: data.endAt ? new Date(data.endAt) : null,
          isActive: data.isActive,
        });
      } else {
        // Création ou duplication
        await echeanceService.createEcheance({
          organizationId,
        label: data.label,
        type: data.type,
        periodicite: data.periodicite,
        montant: data.montant,
        sens: data.sens,
        recuperable: data.recuperable,
          propertyId: data.propertyId || propertyId,
        leaseId: data.leaseId || null,
          startAt: new Date(data.startAt),
          endAt: data.endAt ? new Date(data.endAt) : null,
        isActive: data.isActive,
        });
      }
      
      // ✅ Émettre UNIQUEMENT un événement ciblé (pas de sync immédiate, pas de fetch bloquant)
      window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
        detail: { scope: 'property', propertyId, reason: 'crud' } 
      }));
      
      setIsModalOpen(false);
      notify2.success(modalMode === 'edit' ? 'Échéance modifiée avec succès' : 'Échéance créée avec succès');
    } catch (error: any) {
      console.error('Erreur lors de la création/modification de l\'échéance:', error);
      notify2.error('Erreur', error.message || 'Erreur lors de la sauvegarde');
    }
  };

  // ✅ APP-SHELL: Désactivation ou Suppression via Domain Service (local-first)
  const handleConfirmDelete = async (action: 'deactivate' | 'delete') => {
    if (!organizationId || !echeanceToDelete) {
      notify2.error('Données manquantes pour l\'opération');
      return;
    }

    try {
      const echeanceService = createEcheanceServiceWithMode('app-shell');
      
      if (action === 'deactivate') {
        // ✅ APP-SHELL: Désactiver via service (même processus que le toggle)
        await echeanceService.updateEcheance(echeanceToDelete.id, organizationId, {
          isActive: false,
        });
        
        notify2.success('Échéance désactivée avec succès');
      } else {
        // ✅ APP-SHELL: Supprimer définitivement via service (hard delete, supprime de IndexedDB + crée pendingOp delete)
        await echeanceService.deleteEcheance(echeanceToDelete.id, organizationId, 'hard');
        
        notify2.success('Échéance supprimée avec succès');
      }
      
      // ✅ Émettre UNIQUEMENT un événement ciblé (pas de sync immédiate, pas de fetch bloquant)
      window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
        detail: { scope: 'property', propertyId, reason: action === 'delete' ? 'delete' : 'update' } 
      }));
      
      setShowDeleteModal(false);
      setEcheanceToDelete(null);
    } catch (error: any) {
      console.error('Erreur lors de l\'opération:', error);
      notify2.error('Erreur', error.message || 'Erreur lors de l\'opération');
    }
  };

  // Calculer l'état des échéances sélectionnées pour afficher le bon bouton
  const selectedEcheancesState = useMemo(() => {
    if (selectedEcheanceIds.length === 0) return null;
    
    const selected = filteredEcheances.filter(e => selectedEcheanceIds.includes(e.id));
    const activeCount = selected.filter(e => e.isActive).length;
    const inactiveCount = selected.filter(e => !e.isActive).length;
    
    if (activeCount === selected.length) return 'all-active';
    if (inactiveCount === selected.length) return 'all-inactive';
    return 'mixed';
  }, [selectedEcheanceIds, filteredEcheances]);

  const handleActivateMultiple = async () => {
    if (!organizationId || selectedEcheanceIds.length === 0) {
      notify2.error('Aucune échéance sélectionnée');
      return;
    }

    const count = selectedEcheanceIds.length;

    try {
      const echeanceService = await createEcheanceServiceWithMode('app-shell');
      
      await Promise.all(
        selectedEcheanceIds.map(id => 
          echeanceService.updateEcheance(id, organizationId, {
            isActive: true,
          })
        )
      );
      
      window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
        detail: { scope: 'property', propertyId, reason: 'update_multiple' } 
      }));
      
      setSelectedEcheanceIds([]);
      notify2.success(`${count} échéance(s) activée(s) avec succès`);
    } catch (error: any) {
      console.error('Erreur lors de l\'activation:', error);
      notify2.error('Erreur', error.message || 'Erreur lors de l\'activation');
    }
  };

  const handleDeactivateMultiple = async () => {
    if (!organizationId || selectedEcheanceIds.length === 0) {
      notify2.error('Aucune échéance sélectionnée');
      return;
    }

    const count = selectedEcheanceIds.length;

    try {
      const echeanceService = await createEcheanceServiceWithMode('app-shell');
      
      await Promise.all(
        selectedEcheanceIds.map(id => 
          echeanceService.updateEcheance(id, organizationId, {
            isActive: false,
          })
        )
      );
      
      // ✅ Émettre UNIQUEMENT un événement ciblé (pas de sync immédiate, pas de fetch bloquant)
      window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
        detail: { scope: 'property', propertyId, reason: 'update_multiple' } 
      }));
      
      setSelectedEcheanceIds([]);
      notify2.success(`${count} échéance(s) désactivée(s) avec succès`);
    } catch (error: any) {
      console.error('Erreur lors de la désactivation multiple:', error);
      notify2.error('Erreur', error.message || 'Erreur lors de la désactivation');
    }
  };

  const handleConfirmDeleteMultiple = async (action: 'deactivate' | 'delete') => {
    if (!organizationId || selectedEcheanceIds.length === 0) {
      notify2.error('Aucune échéance sélectionnée');
      return;
    }

    const count = selectedEcheanceIds.length;

    try {
      const echeanceService = await createEcheanceServiceWithMode('app-shell');
      
      if (action === 'deactivate') {
        // ✅ APP-SHELL: Désactiver toutes les échéances sélectionnées
        await Promise.all(
          selectedEcheanceIds.map(id => 
            echeanceService.updateEcheance(id, organizationId, {
              isActive: false,
            })
          )
        );
        
        window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
          detail: { scope: 'property', propertyId, reason: 'update_multiple' } 
        }));
        
        setShowDeleteMultipleModal(false);
        setSelectedEcheanceIds([]);
        notify2.success(`${count} échéance(s) désactivée(s) avec succès`);
      } else {
        // ✅ APP-SHELL: Supprimer définitivement toutes les échéances sélectionnées (hard delete)
        // La sync serveur est découplée et se fera plus tard (auto ou manuel)
        await Promise.all(
          selectedEcheanceIds.map(id => 
            echeanceService.deleteEcheance(id, organizationId, 'hard')
          )
        );
        
        // ✅ Émettre UNIQUEMENT un événement ciblé (pas de sync immédiate, pas de fetch bloquant)
        window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
          detail: { scope: 'property', propertyId, reason: 'delete_multiple' } 
        }));
        
        setShowDeleteMultipleModal(false);
        setSelectedEcheanceIds([]);
        notify2.success(`${count} échéance(s) supprimée(s) avec succès`);
      }
    } catch (error: any) {
      console.error('Erreur lors de l\'opération multiple:', error);
      notify2.error('Erreur', error.message || 'Erreur lors de l\'opération');
    }
  };

  const handleDeleteMultiple = () => {
    if (selectedEcheanceIds.length === 0) {
      notify2.warning('Aucune échéance sélectionnée');
      return;
    }
    setShowDeleteMultipleModal(true);
  };

  // Sélection
  const handleSelectEcheance = (id: string) => {
    setSelectedEcheanceIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedEcheanceIds(checked ? filteredEcheances.map((e) => e.id) : []);
  };

  // Formatage
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return '—';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const { setActions } = usePropertyHeaderActions();

  // ✅ Utiliser useRef pour stabiliser setActions et éviter les boucles infinies
  const setActionsRef = React.useRef(setActions);
  setActionsRef.current = setActions;

  // Mémoriser les actions pour éviter les re-renders inutiles
  const headerActions = useMemo(() => (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCreate}
        className="inline-flex items-center justify-center h-8 w-8 text-orange-600 border border-orange-200 rounded-lg bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white transition-all duration-300 ease-out focus:outline-none"
        aria-label="Nouvelle échéance"
      >
        <Plus className="h-4 w-4" />
      </button>
      <button
        onClick={() => {
          // ✅ Utiliser navigateToView pour nettoyer les params property-scoped
          navigateToView('biens');
        }}
        className="inline-flex items-center justify-center h-8 w-8 text-orange-600 border border-orange-200 rounded-lg bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white transition-all duration-300 ease-out focus:outline-none"
        aria-label="Liste des biens"
      >
        <Home className="h-4 w-4" />
      </button>
    </div>
  ), [handleCreate]);

  // Définir les actions dans le header
  // ✅ Utiliser setActionsRef pour éviter les re-renders causés par setActions qui change
  React.useEffect(() => {
    setActionsRef.current(headerActions);
    
    return () => {
      setActionsRef.current(null);
    };
  }, [headerActions]); // ✅ Seulement headerActions comme dépendance

  return (
    <div className="space-y-6">

      <div className="space-y-6">
        {/* Graphiques - Ligne 1 : 2+1+1 colonnes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="min-w-0 lg:col-span-2">
          <EcheancesCumulativeChart
            data={charts.cumulative}
            isLoading={chartsLoading}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
          </div>
          <div className="min-w-0">
          <EcheancesByTypeChart
            data={charts.byType}
            isLoading={chartsLoading}
          />
          </div>
          <div className="min-w-0">
          <EcheancesRecuperablesChart
            data={charts.recuperables}
            isLoading={chartsLoading}
          />
          </div>
        </div>

        {/* KPIs - Cartes filtrantes */}
        <EcheancesKpiBar
          kpis={kpis}
          activeFilter={activeKpiFilter}
          onFilterChange={handleKpiFilterChange}
          isLoading={kpisLoading}
        />

        {/* Filtres - Tout dans le même panel (sans filtre Bien car déjà fixé) */}
        <EcheancesFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onResetFilters={handleResetFilters}
          properties={[]}
          leases={leases}
          periodStart={periodStart}
          periodEnd={periodEnd}
          onPeriodChange={handlePeriodChange}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          hidePropertyFilter={true} // Masquer le filtre Bien
        />

        {/* Tableau */}
        <div className="bg-white rounded-xl border border-gray-200">
          {/* Header du tableau */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Échéances de ce bien</h3>
              <div className="text-sm text-gray-600">
                {filteredEcheances.length} échéance{filteredEcheances.length > 1 ? 's' : ''}
              </div>
            </div>

            {/* Sélection multiple */}
            {selectedEcheanceIds.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <CheckCircle className="h-5 w-5 text-orange-600" />
                <span className="text-sm font-medium text-orange-900">
                  {selectedEcheanceIds.length} échéance(s) sélectionnée(s)
                </span>
                <div className="flex gap-2 ml-auto">
                  {selectedEcheancesState === 'all-inactive' || selectedEcheancesState === 'mixed' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleActivateMultiple}
                      className="border-orange-200 text-orange-700 hover:bg-orange-100"
                    >
                      Activer la sélection
                    </Button>
                  ) : null}
                  {selectedEcheancesState === 'all-active' || selectedEcheancesState === 'mixed' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeactivateMultiple}
                      className="border-orange-200 text-orange-700 hover:bg-orange-100"
                    >
                      Désactiver la sélection
                    </Button>
                  ) : null}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteMultiple}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer la sélection
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Vue mobile : Cards */}
          <div className="lg:hidden space-y-3 p-4">
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="bg-white border rounded-lg p-4 shadow-sm">
                  <div className="h-12 bg-gray-100 rounded animate-pulse"></div>
                </div>
              ))
            ) : filteredEcheances.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                Aucune échéance pour ce bien
              </div>
            ) : (
              <>
                {filteredEcheances.slice(0, mobileLimit).map((echeance) => (
                  <div
                    key={echeance.id}
                    onClick={() => handleRowClick(echeance)}
                    className="bg-white border rounded-lg p-4 shadow-sm transition-all hover:shadow-md cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <input
                            type="checkbox"
                            checked={selectedEcheanceIds.includes(echeance.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleSelectEcheance(echeance.id);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-gray-300 flex-shrink-0"
                          />
                          <h4 className="text-sm font-semibold text-gray-900 truncate">{echeance.label}</h4>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Badge className={TYPE_COLORS[echeance.type]}>
                            {ECHEANCE_TYPE_LABELS[echeance.type]}
                          </Badge>
                          <Badge
                            className={
                              echeance.sens === 'DEBIT'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-green-100 text-green-800'
                            }
                          >
                            {SENS_LABELS[echeance.sens]}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {PERIODICITE_LABELS[echeance.periodicite]}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-gray-900 mb-1">
                          {formatCurrency(echeance.montant)}
                        </div>
                        <div className="text-xs text-gray-600">
                          {formatDate(echeance.startAt)}
                          {echeance.endAt && ` → ${formatDate(echeance.endAt)}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={echeance.isActive}
                          onCheckedChange={async (checked) => {
                            if (!organizationId) {
                              notify2.error('OrganizationId manquant');
                              return;
                            }

                            try {
                              const echeanceService = createEcheanceServiceWithMode('app-shell');
                              await echeanceService.updateEcheance(echeance.id, organizationId, {
                                isActive: checked,
                              });
                              window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
                                detail: { scope: 'property', propertyId, reason: 'update' } 
                              }));
                              notify2.success(checked ? 'Échéance activée' : 'Échéance désactivée');
                            } catch (error: any) {
                              console.error('Erreur lors de la mise à jour de l\'échéance:', error);
                              notify2.error('Erreur', error.message || 'Erreur lors de la mise à jour');
                            }
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(echeance);
                          }}
                          title="Éditer"
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(echeance);
                          }}
                          title="Supprimer"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredEcheances.length > mobileLimit && (
                  <button
                    onClick={() => setMobileLimit(prev => prev + 10)}
                    className="w-full py-2 text-sm font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg border border-orange-200 transition-colors"
                  >
                    Voir plus ({filteredEcheances.length - mobileLimit} restantes)
                  </button>
                )}
              </>
            )}
          </div>

          {/* Table Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedEcheanceIds.length === filteredEcheances.length && filteredEcheances.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Libellé</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Périodicité</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sens</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dates</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actif</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={9} className="px-4 py-3">
                        <div className="h-12 bg-gray-100 rounded animate-pulse"></div>
                      </td>
                    </tr>
                  ))
                ) : filteredEcheances.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                      Aucune échéance pour ce bien
                    </td>
                  </tr>
                ) : (
                  filteredEcheances.map((echeance) => (
                    <tr
                      key={echeance.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleRowClick(echeance)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedEcheanceIds.includes(echeance.id)}
                          onChange={() => handleSelectEcheance(echeance.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{echeance.label}</td>
                      <td className="px-4 py-3 text-sm">
                        <Badge className={TYPE_COLORS[echeance.type]}>
                          {ECHEANCE_TYPE_LABELS[echeance.type]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {PERIODICITE_LABELS[echeance.periodicite]}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                        {formatCurrency(echeance.montant)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge
                          className={
                            echeance.sens === 'DEBIT'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                          }
                        >
                          {SENS_LABELS[echeance.sens]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(echeance.startAt)}
                        {echeance.endAt && ` → ${formatDate(echeance.endAt)}`}
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={echeance.isActive}
                          onCheckedChange={async (checked) => {
                            if (!organizationId) {
                              notify2.error('OrganizationId manquant');
                              return;
                            }

                            try {
                              const echeanceService = createEcheanceServiceWithMode('app-shell');
                              
                              // ✅ APP-SHELL: Mettre à jour uniquement isActive via service (écrit en IndexedDB + crée pendingOp)
                              // La sync serveur est découplée et se fera plus tard (auto ou manuel)
                              await echeanceService.updateEcheance(echeance.id, organizationId, {
                                isActive: checked,
                              });
                              
                              // ✅ Émettre UNIQUEMENT un événement ciblé (pas de sync immédiate, pas de fetch bloquant)
                              window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
                                detail: { scope: 'property', propertyId, reason: 'update' } 
                              }));
                              
                              notify2.success(checked ? 'Échéance activée' : 'Échéance désactivée');
                            } catch (error: any) {
                              console.error('Erreur lors de la mise à jour de l\'échéance:', error);
                              notify2.error('Erreur', error.message || 'Erreur lors de la mise à jour');
                            }
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(echeance);
                            }}
                            title="Éditer"
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(echeance);
                            }}
                            title="Supprimer"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Desktop */}
          {pagination.pages > 1 && (
            <div className="hidden lg:block p-4 border-t border-gray-200">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.pages}
                onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
              />
            </div>
          )}
        </div>
      </div>

      {/* Modal de formulaire */}
      <EcheanceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleFormSubmit}
        echeance={selectedEcheance}
        properties={propertiesForModal} // Un seul bien (mémorisé pour éviter les re-renders)
        leases={leases}
        mode={modalMode}
        defaultPropertyId={propertyId}
      />

      {/* Drawer lecture seule */}
      <EcheanceDrawer
        echeance={selectedEcheance}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        propertyId={propertyId}
      />

      {/* Modal suppression simple */}
      <ConfirmDeleteEcheanceModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        echeanceId={echeanceToDelete?.id || ''}
        echeanceLabel={echeanceToDelete?.label}
      />

      {/* Modal suppression multiple */}
      <ConfirmDeleteMultipleEcheancesModal
        isOpen={showDeleteMultipleModal}
        onClose={() => setShowDeleteMultipleModal(false)}
        onConfirm={async (action) => {
          await handleConfirmDeleteMultiple(action);
        }}
        echeanceIds={selectedEcheanceIds}
      />
    </div>
  );
}

