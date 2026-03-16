'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { notify2 } from '@/lib/notify2';
import { Upload as UploadIcon, Plus, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DocumentsKpiBar } from '@/components/documents/DocumentsKpiBar';
import { DocumentsMonthlyChart } from '@/components/documents/DocumentsMonthlyChart';
import { DocumentsByTypeChart } from '@/components/documents/DocumentsByTypeChart';
import { DocumentsLinksDistributionChart } from '@/components/documents/DocumentsLinksDistributionChart';
import { DocumentTable, DocumentTableRow } from '@/components/documents/unified/DocumentTable';
import { useDocumentsData } from '@/features/documents/hooks/useDocumentsData';
import { useUploadReviewModal } from '@/contexts/UploadReviewModalContext';
import { ConfirmDeleteDocumentModal } from '@/components/documents/ConfirmDeleteDocumentModal';
import { DocumentEditModal } from '@/components/documents/unified/DocumentEditModal';
import DocumentDrawer from '@/components/documents/DocumentDrawer';
import { usePropertyHeaderActions } from '@/app/biens/[id]/PropertyHeaderActionsContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { SmartSelect, SmartSelectOption } from '@/components/ui/SmartSelect';
import { SmartDatePicker } from '@/components/ui/SmartDatePicker';
import { Filter, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { getLocalDB } from '@/lib/offline/db';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { getGlobalSyncService } from '@/lib/offline/syncGlobal';
import { createDocumentServiceWithMode } from '@/domain/services/documentServiceFactory';
import { navigateToView } from '@/utils/appShellNavigation';

interface Filters {
  query: string;
  type: string;
  ocrStatus: string;
  linkedTo: string;
  dateFrom: string;
  dateTo: string;
}

interface PropertyDocumentsClientProps {
  propertyId: string;
  propertyName: string;
}

export default function PropertyDocumentsClient({ propertyId, propertyName }: PropertyDocumentsClientProps) {
  const { organizationId } = useCurrentOrganization();

  const { openModalWithFileSelection } = useUploadReviewModal();
  const { setActions } = usePropertyHeaderActions();

  // États des modals et drawer
  const [selectedDocument, setSelectedDocument] = useState<DocumentTableRow | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [documentToEdit, setDocumentToEdit] = useState<DocumentTableRow | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<DocumentTableRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // États pour la sélection multiple
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteMultipleModal, setShowDeleteMultipleModal] = useState(false);
  const [documentsToDelete, setDocumentsToDelete] = useState<DocumentTableRow[]>([]);
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);

  // États pour la période (format YYYY-MM)
  const now = new Date();
  const [periodStart, setPeriodStart] = useState(`${now.getFullYear()}-01`);
  const [periodEnd, setPeriodEnd] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

  // État pour le filtre KPI actif (par défaut: 'total' = vue globale)
  const [activeKpiFilter, setActiveKpiFilter] = useState<string | null>('total');

  // États des filtres (appliqués en mémoire)
  const [filters, setFilters] = useState<Filters>({
    query: '',
    type: '',
    ocrStatus: '',
    linkedTo: '',
    dateFrom: '',
    dateTo: '',
  });

  // État pour les types de documents (chargés depuis IndexedDB)
  const [documentTypes, setDocumentTypes] = useState<any[]>([]);

  // État pour afficher/masquer les filtres avancés
  const [showFilters, setShowFilters] = useState(false);

  // État pour le tri
  const [sortField, setSortField] = useState<'type'>('type');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // État pour la pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 30, // 30 éléments par page en desktop
    offset: 0,
  });

  // ✅ APP-SHELL: Mémoriser l'objet filters pour éviter les re-renders
  // ⚠️ CRITIQUE: L'objet filters inline change de référence à chaque render
  const documentsFilters = useMemo(() => ({
    query: '', // Pas de filtre de recherche dans le hook, on filtre en mémoire
    type: '', // Pas de filtre de type dans le hook, on filtre en mémoire
    scope: '', // Pas de scope, on filtre manuellement par propertyId
    status: '',
    linkedTo: '',
    dateFrom: '',
    dateTo: '',
    includeDeleted: false,
  }), []); // ✅ Dépendances vides = référence stable

  // ✅ APP-SHELL: Charger les documents depuis IndexedDB filtrés par propertyId
  // Le hook filtre maintenant par propertyId dans IndexedDB, donc on récupère directement les bons documents
  const { documents: allDocumentsRaw, stats, pagination: hookPagination, loading: isLoading } = useDocumentsData({
    mode: 'app-shell',
    propertyId, // ✅ Passer propertyId pour filtrer dans IndexedDB ET filtrer les events
    filters: documentsFilters, // ✅ Référence stable
    offset: 0,
    limit: 10000, // Charger tous les documents (limite haute)
  });

  // ✅ APP-SHELL: Utiliser directement allDocumentsRaw (le hook gère déjà la mémorisation)
  // ⚠️ CRITIQUE: Ne pas re-mémoriser ici pour éviter les boucles infinies
  const allDocuments = allDocumentsRaw;

  // ✅ APP-SHELL: Filtrer les documents en mémoire selon les filtres UI
  const filteredDocuments = useMemo(() => {
    let filtered = allDocuments.filter(doc => {
      // ✅ Note: Les documents sont déjà filtrés par propertyId via DocumentLink dans useDocumentsData
      // On n'a plus besoin de filtrer par propertyId ici, le hook l'a déjà fait

      // Filtre de recherche
      if (filters.query) {
        const searchLower = filters.query.toLowerCase();
        const matchesQuery = 
          doc.filenameOriginal?.toLowerCase().includes(searchLower) ||
          doc.fileName?.toLowerCase().includes(searchLower) ||
          doc.tags?.toLowerCase().includes(searchLower);
        if (!matchesQuery) return false;
      }

      // Filtre de type
      if (filters.type) {
        if (doc.documentTypeId !== filters.type) return false;
      }

      // Filtre OCR status
      if (filters.ocrStatus) {
        if (filters.ocrStatus === 'processed' && doc.ocrStatus !== 'processed') return false;
        if (filters.ocrStatus === 'failed' && doc.ocrStatus !== 'failed') return false;
        if (filters.ocrStatus === 'pending' && doc.ocrStatus !== 'pending') return false;
      }

      // Filtre linkedTo
      if (filters.linkedTo) {
        const hasLink = doc.DocumentLink && doc.DocumentLink.length > 0;
        if (filters.linkedTo === 'none' && hasLink) return false;
        if (filters.linkedTo !== 'none' && !hasLink) return false;
        if (filters.linkedTo !== 'none' && hasLink) {
          const linkedType = filters.linkedTo.toLowerCase();
          const hasMatchingLink = doc.DocumentLink?.some(link => link.linkedType === linkedType);
          if (!hasMatchingLink) return false;
        }
      }

      // Filtre dateFrom
      if (filters.dateFrom) {
        const docDate = new Date(doc.uploadedAt || doc.createdAt || 0);
        const fromDate = new Date(filters.dateFrom);
        if (docDate < fromDate) return false;
      }

      // Filtre dateTo
      if (filters.dateTo) {
        const docDate = new Date(doc.uploadedAt || doc.createdAt || 0);
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (docDate > toDate) return false;
      }

      // Filtre KPI actif
      if (activeKpiFilter === 'pending' && doc.status !== 'pending') return false;
      if (activeKpiFilter === 'unclassified' && (doc.status === 'active' || doc.documentTypeId)) return false;
      if (activeKpiFilter === 'ocrFailed' && doc.ocrStatus !== 'failed') return false;
      if (activeKpiFilter === 'orphans') {
        const hasLink = doc.DocumentLink && doc.DocumentLink.length > 0;
        if (hasLink) return false;
      }

      return true;
    });

    return filtered;
  }, [allDocuments, filters, activeKpiFilter]); // ✅ propertyId retiré car les documents sont déjà filtrés par le hook

  // ✅ Calculer les KPI depuis les documents filtrés
  // Note: allDocuments est déjà filtré par propertyId via DocumentLink dans le hook
  const kpis = useMemo(() => {
    // Les documents sont déjà filtrés par propertyId via DocumentLink dans useDocumentsData
    const propertyDocs = allDocuments; // Déjà filtrés par le hook
    return {
      total: propertyDocs.length,
      pending: propertyDocs.filter(d => d.status === 'pending').length,
      unclassified: propertyDocs.filter(d => d.status === 'active' && !d.documentTypeId).length,
      ocrFailed: propertyDocs.filter(d => d.ocrStatus === 'failed').length,
      orphans: propertyDocs.filter(d => {
        const hasLink = d.DocumentLink && d.DocumentLink.length > 0;
        return !hasLink && !d.deletedAt;
      }).length,
    };
  }, [allDocuments]);

  const kpisLoading = isLoading;

  // ✅ Calculer les graphiques depuis les documents filtrés
  // Note: allDocuments est déjà filtré par propertyId via DocumentLink dans le hook
  const chartsData = useMemo(() => {
    // Les documents sont déjà filtrés par propertyId via DocumentLink dans useDocumentsData
    const propertyDocs = allDocuments; // Déjà filtrés par le hook
    
    // Graphique mensuel
    const monthly: Record<string, number> = {};
    propertyDocs.forEach(doc => {
      const date = new Date(doc.uploadedAt || doc.createdAt || 0);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthly[monthKey] = (monthly[monthKey] || 0) + 1;
    });

    // Graphique par type
    const byType: Record<string, number> = {};
    propertyDocs.forEach(doc => {
      const typeLabel = doc.DocumentType?.label || 'Non classé';
      byType[typeLabel] = (byType[typeLabel] || 0) + 1;
    });

    // Répartition des liaisons
    // ✅ Format attendu par DocumentsLinksDistributionChart: noLinks, oneLink, twoLinks, threeOrMore
    const linksCounts = propertyDocs.map(doc => {
      const linkCount = doc.DocumentLink?.length || 0;
      return Number(linkCount) || 0; // ✅ S'assurer que c'est un nombre
    });
    
    const linksDistribution = {
      noLinks: Number(linksCounts.filter(count => count === 0).length) || 0,
      oneLink: Number(linksCounts.filter(count => count === 1).length) || 0,
      twoLinks: Number(linksCounts.filter(count => count === 2).length) || 0,
      threeOrMore: Number(linksCounts.filter(count => count >= 3).length) || 0,
    };

    return {
      monthly: Object.entries(monthly).map(([month, count]) => ({ month, count })),
      byType: Object.entries(byType).map(([type, count]) => ({ type, count })),
      linksDistribution,
    };
  }, [allDocuments]); // ✅ propertyId retiré car les documents sont déjà filtrés par le hook

  const chartsLoading = isLoading;

  // ✅ Charger les types de documents depuis IndexedDB
  useEffect(() => {
    const loadDocumentTypes = async () => {
      try {
        const db = await getLocalDB();
        const types = await db.DocumentType.toArray();
        setDocumentTypes(types);
      } catch (error) {
        console.error('Erreur lors du chargement des types:', error);
      }
    };

    loadDocumentTypes();
  }, []);

  // Gestion des filtres (plus de synchronisation URL, tout en mémoire)
  const handleFiltersChange = useCallback((newFilters: Filters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, offset: 0, page: 1 }));
  }, []);

  // Gestion du filtre KPI (cartes filtrantes)
  const handleKpiFilterChange = useCallback((filterKey: string | null) => {
    if (filterKey === activeKpiFilter) {
      // Si on clique sur la carte déjà active (sauf "total"), on revient à "total"
      if (filterKey !== 'total') {
        setActiveKpiFilter('total');
      }
    } else {
      // On active la nouvelle carte
      setActiveKpiFilter(filterKey);
    }
    setPagination(prev => ({ ...prev, offset: 0, page: 1 }));
  }, [activeKpiFilter]);

  const handleResetFilters = useCallback(() => {
    const resetFilters: Filters = {
      query: '',
      type: '',
      ocrStatus: '',
      linkedTo: '',
      dateFrom: '',
      dateTo: '',
    };

    setFilters(resetFilters);
    setPagination(prev => ({ ...prev, offset: 0, page: 1 }));
  }, []);

  // Gestion du filtre de période (pour les graphiques, mais pas utilisé pour filtrer les documents)
  const handlePeriodChange = useCallback((start: string, end: string) => {
    setPeriodStart(start);
    setPeriodEnd(end);
  }, []);

  // ✅ APP-SHELL: Gestion du bouton Uploader (ONLINE-ONLY, pas de document local si offline)
  const handleUploadClick = useCallback(() => {
    // ✅ RÈGLE 1: En AppShell, upload = ONLINE-ONLY (garde-fou)
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
    if (!isOnline) {
      notify2.info('L\'upload de documents nécessite une connexion réseau. Veuillez vous connecter et réessayer.');
      return;
    }

    openModalWithFileSelection({
      scope: 'property',
      propertyId: propertyId,
      autoLinkingContext: {
        propertyId: propertyId,
      },
      onSuccess: async () => {
        // ✅ RÈGLE 2: Dispatch UNIQUEMENT si écriture IndexedDB réelle (pull réussi)
        if (!organizationId) {
          console.warn('[PropertyDocumentsClient] ⚠️ organizationId manquant, pas de pull');
          return;
        }

        try {
          // Pull des documents et DocumentLink depuis Supabase vers IndexedDB
          await getGlobalSyncService().syncEntityFromRemoteByName('document', organizationId);
          await getGlobalSyncService().syncEntityFromRemoteByName('documentLink', organizationId);
          
          
          // ✅ Émettre UNIQUEMENT si pull réussi (écriture IndexedDB réelle)
          window.dispatchEvent(new CustomEvent('documents:refresh', { 
            detail: { scope: 'property', propertyId, reason: 'upload' } 
          }));
        } catch (error) {
          // ✅ RÈGLE 2: Pas de dispatch en cas d'erreur (pas d'écriture IndexedDB réelle)
          console.warn('[PropertyDocumentsClient] ⚠️ Erreur lors du pull après upload (pas de dispatch):', error);
          // Les documents apparaîtront après la prochaine sync manuelle
        }
      }
    });
  }, [openModalWithFileSelection, propertyId, organizationId]);

  // Gestion de la visualisation d'un document (ouvre le drawer)
  const handleViewDocument = useCallback((doc: DocumentTableRow) => {
    setSelectedDocument(doc);
    setIsDrawerOpen(true);
  }, []);

  // Gestion de l'édition d'un document (ouvre la modal de modification directement)
  const handleEditDocument = useCallback((doc: DocumentTableRow) => {
    setDocumentToEdit(doc);
    setShowEditModal(true);
  }, []);

  // Gestion du téléchargement
  const handleDownload = useCallback((doc: DocumentTableRow) => {
    window.open(`/api/documents/${doc.id}/file`, '_blank');
  }, []);

  // Gestion de la suppression
  const handleDelete = useCallback((doc: DocumentTableRow) => {
    setDocumentToDelete(doc);
    setShowDeleteModal(true);
  }, []);

  // ✅ APP-SHELL: Suppression via DocumentService puis refresh ciblé
  const handleDeleteConfirmed = useCallback(async () => {
    if (!documentToDelete || !organizationId) {
      setDocumentToDelete(null);
      setIsDeleting(false);
      return;
    }

    const docToDelete = documentToDelete;
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

    // ✅ Afficher le loader immédiatement
    setIsDeleting(true);

    try {
      // ⚠️ Utiliser DocumentService (créera pendingOps en mode app-shell)
      const documentService = createDocumentServiceWithMode('app-shell');
      await documentService.deleteDocument(docToDelete.id, organizationId);

      // ⚠️ En mode app-shell online : push → pull → refresh ciblé (pas de sync:refresh global)
      if (isOnline) {
        try {
          const syncService = getGlobalSyncService();
          await syncService.syncAllPendingToRemote(organizationId);
          // Pull immédiat pour mettre à jour IndexedDB
          await syncService.syncEntityFromRemoteByName('document', organizationId);
          await syncService.syncEntityFromRemoteByName('documentLink', organizationId);
        } catch (syncError) {
          console.warn('[PropertyDocumentsClient] Erreur lors du sync après suppression:', syncError);
          // Ne pas bloquer l'opération si la sync échoue
        }
      }

      // ✅ Émettre UNIQUEMENT l'événement ciblé (pas de sync:refresh global)
      window.dispatchEvent(new CustomEvent('documents:refresh', { 
        detail: { scope: 'property', propertyId, reason: 'delete' } 
      }));
      
      // ✅ Fermer la modal et réinitialiser l'état
      setDocumentToDelete(null);
      setIsDeleting(false);
      setShowDeleteModal(false);
      notify2.success('Document supprimé');
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      setIsDeleting(false);
      notify2.error('Erreur lors de la suppression du document');
    }
  }, [documentToDelete, organizationId, propertyId]);

  // Gestion de la sélection
  const handleSelectDocument = useCallback((docId: string, selected: boolean) => {
    const newSelection = new Set(selectedIds);
    if (selected) {
      newSelection.add(docId);
    } else {
      newSelection.delete(docId);
    }
    setSelectedIds(newSelection);
  }, [selectedIds]);

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(allDocuments.map(d => d.id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [allDocuments]);

  // Gestion de la suppression multiple
  const handleDeleteMultiple = useCallback((docs: DocumentTableRow[]) => {
    setDocumentsToDelete(docs);
    setShowDeleteMultipleModal(true);
  }, []);

  // ✅ APP-SHELL: Suppression multiple via DocumentService puis refresh ciblé
  const handleDeleteMultipleConfirmed = useCallback(async () => {
    if (!documentsToDelete || documentsToDelete.length === 0 || !organizationId) {
      setSelectedIds(new Set());
      setShowDeleteMultipleModal(false);
      setDocumentsToDelete([]);
      setIsDeletingMultiple(false);
      return;
    }

    const docsToDelete = documentsToDelete;
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

    // ✅ Afficher le loader immédiatement
    setIsDeletingMultiple(true);

    try {
      // ⚠️ Utiliser DocumentService pour chaque document (créera pendingOps en mode app-shell)
      const documentService = createDocumentServiceWithMode('app-shell');
      
      for (const doc of docsToDelete) {
        await documentService.deleteDocument(doc.id, organizationId);
      }

      // ⚠️ En mode app-shell online : push → pull → refresh ciblé (pas de sync:refresh global)
      if (isOnline) {
        try {
          const syncService = getGlobalSyncService();
          await syncService.syncAllPendingToRemote(organizationId);
          // Pull immédiat pour mettre à jour IndexedDB
          await syncService.syncEntityFromRemoteByName('document', organizationId);
          await syncService.syncEntityFromRemoteByName('documentLink', organizationId);
        } catch (syncError) {
          console.warn('[PropertyDocumentsClient] Erreur lors du sync après suppression multiple:', syncError);
          // Ne pas bloquer l'opération si la sync échoue
        }
      }

      // ✅ Émettre UNIQUEMENT l'événement ciblé (pas de sync:refresh global)
      window.dispatchEvent(new CustomEvent('documents:refresh', { 
        detail: { scope: 'property', propertyId, reason: 'delete_multiple' } 
      }));
      
      // ✅ Fermer la modal et réinitialiser l'état
      setSelectedIds(new Set());
      setShowDeleteMultipleModal(false);
      setDocumentsToDelete([]);
      setIsDeletingMultiple(false);
      notify2.success(`${docsToDelete.length} document${docsToDelete.length > 1 ? 's' : ''} supprimé${docsToDelete.length > 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Erreur lors de la suppression multiple:', error);
      setIsDeletingMultiple(false);
      notify2.error('Erreur lors de la suppression des documents');
    }
  }, [documentsToDelete, organizationId, propertyId]);


  const activeFiltersCount = Object.values(filters).filter(v => v && v !== '').length;

  // Fonction de tri
  const handleSort = (field: 'type') => {
    if (sortField === field) {
      // Toggle l'ordre si c'est le même champ
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Nouveau champ, ordre par défaut desc
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // ✅ APP-SHELL: Paginer et trier les documents filtrés en mémoire
  const paginatedAndSortedDocuments = useMemo(() => {
    // Trier d'abord
    const sorted = [...filteredDocuments];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'type':
          const typeA = a.DocumentType?.label || 'ZZZ';
          const typeB = b.DocumentType?.label || 'ZZZ';
          comparison = typeA.localeCompare(typeB);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    // Puis paginer
    const start = pagination.offset;
    const end = start + pagination.limit;
    return sorted.slice(start, end);
  }, [filteredDocuments, sortField, sortOrder, pagination.offset, pagination.limit]);

  const totalCount = filteredDocuments.length;
  const sortedDocuments = paginatedAndSortedDocuments;

  // Mémoriser les actions pour éviter les re-renders inutiles
  // ✅ Utiliser useRef pour stabiliser setActions et éviter les boucles infinies
  const setActionsRef = React.useRef(setActions);
  setActionsRef.current = setActions;
  
  const headerActions = useMemo(() => (
    <div className="flex items-center gap-2">
      <button
        onClick={handleUploadClick}
        className="inline-flex items-center justify-center h-8 w-8 text-orange-600 border border-orange-200 rounded-lg bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white transition-all duration-300 ease-out focus:outline-none"
        aria-label="Uploader un document"
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
  ), [handleUploadClick]);

  // Définir les actions dans le header
  // ✅ Utiliser setActionsRef pour éviter les re-renders causés par setActions qui change
  React.useEffect(() => {
    setActionsRef.current(headerActions);
    
    return () => {
      setActionsRef.current(null);
    };
  }, [headerActions]); // ✅ Seulement headerActions comme dépendance

  const showCharts = allDocuments.length > 100;

  return (
    <div className="space-y-6">
      {/* 4 KPI compacts */}
      <DocumentsKpiBar
        kpis={kpis}
        activeFilter={activeKpiFilter}
        onFilterChange={handleKpiFilterChange}
        isLoading={kpisLoading}
        hideOrphans={true}
        compact={true}
      />

      {/* Barre recherche + filtres rapides */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Rechercher par nom, tags, type..."
            value={filters.query}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            className="flex-1"
          />
          {activeFiltersCount > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={handleResetFilters}>
              Réinitialiser
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <SmartSelect
            value={filters.type}
            onChange={(value) => setFilters({ ...filters, type: value })}
            options={[
              { value: '', label: 'Type document' },
              ...(Array.isArray(documentTypes) ? documentTypes.map((type: { code: string; label: string }) => ({
                value: type.code,
                label: type.label
              })) : [])
            ]}
            placeholder="Type"
            className="min-w-[140px]"
          />
          <SmartSelect
            value={filters.ocrStatus}
            onChange={(value) => setFilters({ ...filters, ocrStatus: value })}
            options={[
              { value: '', label: 'Statut OCR' },
              { value: 'processed', label: 'Traité' },
              { value: 'failed', label: 'Échoué' },
              { value: 'pending', label: 'En attente' }
            ]}
            placeholder="OCR"
            className="min-w-[120px]"
          />
          <SmartSelect
            value={filters.linkedTo}
            onChange={(value) => setFilters({ ...filters, linkedTo: value })}
            options={[
              { value: '', label: 'Lié à' },
              { value: 'property', label: 'Bien' },
              { value: 'lease', label: 'Bail' },
              { value: 'transaction', label: 'Transaction' },
              { value: 'tenant', label: 'Locataire' },
              { value: 'none', label: 'Aucune liaison' }
            ]}
            placeholder="Liaison"
            className="min-w-[130px]"
          />
          {showFilters && (
            <>
              <SmartDatePicker
                value={filters.dateFrom}
                onChange={(value) => setFilters({ ...filters, dateFrom: value })}
                placeholder="Du"
              />
              <SmartDatePicker
                value={filters.dateTo}
                onChange={(value) => setFilters({ ...filters, dateTo: value })}
                placeholder="Au"
              />
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="text-gray-500"
          >
            <Filter className="h-4 w-4 mr-1" />
            {showFilters ? 'Moins' : 'Dates'}
          </Button>
        </div>
      </div>

      {/* Graphiques (uniquement si plus de 100 documents) */}
      {showCharts && (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-4">
          <div className="lg:col-span-2 min-w-0">
            <DocumentsMonthlyChart data={chartsData.monthly} isLoading={chartsLoading} />
          </div>
          <div className="lg:col-span-1 min-w-0">
            <DocumentsByTypeChart data={chartsData.byType} isLoading={chartsLoading} />
          </div>
          <div className="lg:col-span-1 min-w-0">
            <DocumentsLinksDistributionChart data={chartsData.linksDistribution} isLoading={chartsLoading} />
          </div>
        </div>
      )}

      {/* Actions groupées */}
      {selectedIds.size > 0 && (
        <Card>
          <CardContent className="py-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <span className="text-sm font-medium text-gray-900">
                {selectedIds.size} document{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
              </span>
              <div className="flex-1" />
              <div className="flex gap-2 w-full sm:w-auto">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    const docsToDelete = allDocuments.filter(d => selectedIds.has(d.id));
                    handleDeleteMultiple(docsToDelete);
                  }}
                  className="flex-1 sm:flex-initial"
                >
                  Supprimer
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedIds(new Set())}
                  className="flex-1 sm:flex-initial"
                >
                  Annuler
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tableau */}
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <p className="text-sm text-gray-600">
            {totalCount > 0
              ? `Affichage de ${pagination.offset + 1} à ${Math.min(pagination.offset + pagination.limit, totalCount)} sur ${totalCount}`
              : 'Aucun document'}
          </p>
        </CardHeader>
        <CardContent>
          {/* Tri rapide */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">{sortedDocuments.length}</span> document{sortedDocuments.length > 1 ? 's' : ''} affiché{sortedDocuments.length > 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Tri rapide:</span>
              <button
                onClick={() => handleSort('type')}
                className={`flex items-center gap-1 px-2 py-1 text-xs border rounded transition-colors ${
                  sortField === 'type' 
                    ? 'bg-orange-50 border-orange-300 text-orange-700' 
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
                title="Trier par type"
              >
                Type {sortField === 'type' ? (sortOrder === 'desc' ? <ArrowDown className="h-3 w-3 text-orange-600" /> : <ArrowUp className="h-3 w-3 text-orange-600" />) : <ArrowUpDown className="h-3 w-3" />}
              </button>
            </div>
          </div>

          <DocumentTable
            documents={sortedDocuments}
            onView={handleViewDocument}
            onEdit={handleEditDocument}
            onDownload={handleDownload}
            onDelete={handleDelete}
            onSelect={handleSelectDocument}
            onSelectAll={handleSelectAll}
            selectedIds={selectedIds}
            showSelection={true}
            showLinkedTo={true}
            loading={isLoading}
          />

          {/* Pagination */}
          {totalCount > pagination.limit && (
            <div className="flex justify-center gap-2 mt-6">
              <Button
                variant="outline"
                disabled={pagination.offset === 0}
                onClick={() => setPagination(prev => ({
                  ...prev,
                  offset: Math.max(0, prev.offset - prev.limit),
                  page: Math.max(1, prev.page - 1),
                }))}
              >
                Précédent
              </Button>
              <Button
                variant="outline"
                disabled={pagination.offset + pagination.limit >= totalCount}
                onClick={() => setPagination(prev => ({
                  ...prev,
                  offset: prev.offset + prev.limit,
                  page: prev.page + 1,
                }))}
              >
                Suivant
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drawer de visualisation d'un document */}
      <DocumentDrawer
        document={selectedDocument}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedDocument(null);
        }}
        onDelete={(doc) => {
          setIsDrawerOpen(false);
          handleDelete(doc);
        }}
        onDownload={handleDownload}
      />

      {/* Modal de modification d'un document */}
      {documentToEdit && (
        <DocumentEditModal
          document={documentToEdit}
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setDocumentToEdit(null);
          }}
          onUpdate={() => {
            window.dispatchEvent(new CustomEvent('documents:refresh', { 
              detail: { scope: 'property', propertyId, reason: 'update' } 
            }));
            setShowEditModal(false);
            setDocumentToEdit(null);
          }}
        />
      )}

      {/* Modal de confirmation de suppression */}
      {documentToDelete && (
        <ConfirmDeleteDocumentModal
          isOpen={showDeleteModal}
          onClose={() => {
            if (!isDeleting) {
              setShowDeleteModal(false);
              setDocumentToDelete(null);
              setIsDeleting(false);
            }
          }}
          onConfirm={handleDeleteConfirmed}
          documentId={documentToDelete.id}
          documentName={documentToDelete.filenameOriginal}
          mode="app-shell"
          organizationId={organizationId}
          isDeleting={isDeleting}
        />
      )}

      {/* Modal de confirmation de suppression multiple */}
      {showDeleteMultipleModal && (
        <ConfirmDeleteDocumentModal
          isOpen={showDeleteMultipleModal}
          onClose={() => {
            if (!isDeletingMultiple) {
              setShowDeleteMultipleModal(false);
              setDocumentsToDelete([]);
              setIsDeletingMultiple(false);
            }
          }}
          onConfirm={handleDeleteMultipleConfirmed}
          documentId={documentsToDelete[0]?.id || ''}
          documentName={`${documentsToDelete.length} document${documentsToDelete.length > 1 ? 's' : ''}`}
          mode="app-shell"
          organizationId={organizationId}
          isDeleting={isDeletingMultiple}
        />
      )}
    </div>
  );
}

