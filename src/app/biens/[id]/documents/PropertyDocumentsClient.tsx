'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { notify2 } from '@/lib/notify2';
import { Upload as UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DocumentsMonthlyChart } from '@/components/documents/DocumentsMonthlyChart';
import { DocumentsByTypeChart } from '@/components/documents/DocumentsByTypeChart';
import { DocumentsLinksDistributionChart } from '@/components/documents/DocumentsLinksDistributionChart';
import { DocumentsKpiBar } from '@/components/documents/DocumentsKpiBar';
import { DocumentTable, DocumentTableRow } from '@/components/documents/unified/DocumentTable';
import { useDocumentsData } from '@/features/documents/hooks/useDocumentsData';
import { useUploadReviewModal } from '@/contexts/UploadReviewModalContext';
import { ConfirmDeleteDocumentModal } from '@/components/documents/ConfirmDeleteDocumentModal';
import { DocumentEditModal } from '@/components/documents/unified/DocumentEditModal';
import DocumentDrawer from '@/components/documents/DocumentDrawer';
import { BackToPropertyButton } from '@/components/shared/BackToPropertyButton';
import { usePropertyHeaderActions } from '@/app/biens/[id]/PropertyHeaderActionsContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Filter, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { getLocalDB } from '@/lib/offline/db';

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
  // ✅ DEV-ONLY: Log de mount/unmount pour détecter les remounts
  const mountId = React.useRef(Math.random().toString(36).substring(7));
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[PropertyDocumentsClient] 🟢 MOUNT (id: ${mountId.current}, propertyId: ${propertyId})`);
      return () => {
        console.log(`[PropertyDocumentsClient] 🔴 UNMOUNT (id: ${mountId.current}, propertyId: ${propertyId})`);
      };
    }
  }, [propertyId]);

  // ✅ DEV-ONLY: Compteur de renders
  if (process.env.NODE_ENV === 'development') {
    console.count('PropertyDocumentsClient render');
  }

  const { openModalWithFileSelection } = useUploadReviewModal();
  const { setActions } = usePropertyHeaderActions();

  // États des modals et drawer
  const [selectedDocument, setSelectedDocument] = useState<DocumentTableRow | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [documentToEdit, setDocumentToEdit] = useState<DocumentTableRow | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<DocumentTableRow | null>(null);
  
  // États pour la sélection multiple
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteMultipleModal, setShowDeleteMultipleModal] = useState(false);
  const [documentsToDelete, setDocumentsToDelete] = useState<DocumentTableRow[]>([]);

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
  const [sortField, setSortField] = useState<'date' | 'size' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // État pour la pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 30, // 30 éléments par page en desktop
    offset: 0,
  });

  // ✅ APP-SHELL: Charger TOUS les documents depuis IndexedDB (une seule fois)
  // On charge sans filtres, puis on applique les filtres en mémoire (y compris propertyId)
  const { documents: allDocuments, stats, pagination: hookPagination, loading: isLoading } = useDocumentsData({
    mode: 'app-shell',
    propertyId, // ✅ Passer propertyId pour filtrer les events
    filters: {
      query: '', // Pas de filtre de recherche dans le hook, on filtre en mémoire
      type: '', // Pas de filtre de type dans le hook, on filtre en mémoire
      scope: '', // Pas de scope, on filtre manuellement par propertyId
      status: '',
      linkedTo: '',
      dateFrom: '',
      dateTo: '',
      includeDeleted: false,
    },
    offset: 0,
    limit: 10000, // Charger tous les documents (limite haute)
  });

  // ✅ APP-SHELL: Filtrer les documents en mémoire selon les filtres UI
  const filteredDocuments = useMemo(() => {
    const perfStart = process.env.NODE_ENV === 'development' ? performance.now() : 0;
    
    let filtered = allDocuments.filter(doc => {
      // Filtrer par propertyId (déjà fait par le hook, mais double vérification)
      if (doc.propertyId !== propertyId) return false;

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

    if (process.env.NODE_ENV === 'development') {
      const perfEnd = performance.now();
      console.log(`[PropertyDocumentsClient] ⏱️ Filtrage documents: ${(perfEnd - perfStart).toFixed(2)}ms (${filtered.length}/${allDocuments.length})`);
    }

    return filtered;
  }, [allDocuments, propertyId, filters, activeKpiFilter]);

  // ✅ Calculer les KPI depuis les documents filtrés
  const kpis = useMemo(() => {
    const propertyDocs = allDocuments.filter(doc => doc.propertyId === propertyId);
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
  }, [allDocuments, propertyId]);

  const kpisLoading = isLoading;

  // ✅ Calculer les graphiques depuis les documents filtrés
  const chartsData = useMemo(() => {
    const propertyDocs = allDocuments.filter(doc => doc.propertyId === propertyId);
    
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
    const linksDistribution = {
      transaction: propertyDocs.filter(d => d.DocumentLink?.some(l => l.linkedType === 'transaction')).length,
      lease: propertyDocs.filter(d => d.DocumentLink?.some(l => l.linkedType === 'lease')).length,
      property: propertyDocs.filter(d => d.DocumentLink?.some(l => l.linkedType === 'property')).length,
      tenant: propertyDocs.filter(d => d.DocumentLink?.some(l => l.linkedType === 'tenant')).length,
      global: propertyDocs.filter(d => d.DocumentLink?.some(l => l.linkedType === 'global')).length,
      none: propertyDocs.filter(d => !d.DocumentLink || d.DocumentLink.length === 0).length,
    };

    return {
      monthly: Object.entries(monthly).map(([month, count]) => ({ month, count })),
      byType: Object.entries(byType).map(([type, count]) => ({ type, count })),
      linksDistribution,
    };
  }, [allDocuments, propertyId]);

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

  // ✅ APP-SHELL: Gestion du bouton Uploader (avec événement ciblé pour refresh)
  const handleUploadClick = useCallback(() => {
    openModalWithFileSelection({
      scope: 'property',
      propertyId: propertyId,
      autoLinkingContext: {
        propertyId: propertyId,
      },
      onSuccess: () => {
        // ✅ Émettre un événement ciblé avec payload scope + propertyId
        window.dispatchEvent(new CustomEvent('documents:refresh', { 
          detail: { scope: 'property', propertyId, reason: 'upload' } 
        }));
      }
    });
  }, [openModalWithFileSelection, propertyId]);

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

  // ✅ APP-SHELL: Refresh via événement ciblé avec payload
  const handleDeleteConfirmed = useCallback(() => {
    window.dispatchEvent(new CustomEvent('documents:refresh', { 
      detail: { scope: 'property', propertyId, reason: 'delete' } 
    }));
    setDocumentToDelete(null);
  }, [propertyId]);

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

  // ✅ APP-SHELL: Suppression via repository offline (local-first)
  const handleDeleteMultipleConfirmed = useCallback(async () => {
    try {
      // TODO: Implémenter la suppression via repository offline
      // Pour l'instant, on émet juste l'événement de refresh
      // La suppression sera gérée par le modal ConfirmDeleteDocumentModal
      setSelectedIds(new Set());
      window.dispatchEvent(new CustomEvent('documents:refresh', { 
        detail: { scope: 'property', propertyId, reason: 'delete_multiple' } 
      }));
      setShowDeleteMultipleModal(false);
      setDocumentsToDelete([]);
    } catch (error) {
      console.error('Erreur lors de la suppression multiple:', error);
      notify2.error('Erreur lors de la suppression des documents');
    }
  }, [propertyId]);


  const activeFiltersCount = Object.values(filters).filter(v => v && v !== '').length;

  // Fonction de tri
  const handleSort = (field: 'date' | 'size' | 'type') => {
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
        case 'date':
          const dateA = new Date(a.createdAt || a.uploadedAt || 0).getTime();
          const dateB = new Date(b.createdAt || b.uploadedAt || 0).getTime();
          comparison = dateB - dateA;
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
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
  const headerActions = useMemo(() => (
    <>
      <Button onClick={handleUploadClick}>
        <UploadIcon className="h-4 w-4 mr-2" />
        Uploader
      </Button>
      <BackToPropertyButton 
        propertyId={propertyId} 
        propertyName={propertyName}
      />
    </>
  ), [propertyId, propertyName, handleUploadClick]);

  // Définir les actions dans le header
  React.useEffect(() => {
    setActions(headerActions);
    
    return () => {
      setActions(null);
    };
  }, [setActions, headerActions]);

  return (
    <div className="space-y-6">
      {/* Graphiques - Mobile: empilés, Desktop: grille */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-4">
        {/* Graphique 1 : Évolution mensuelle (2 colonnes) */}
        <div className="lg:col-span-2 min-w-0">
          <DocumentsMonthlyChart
            data={chartsData.monthly}
            isLoading={chartsLoading}
          />
        </div>
        
        {/* Graphique 2 : Répartition par type (1 colonne) */}
        <div className="lg:col-span-1 min-w-0">
          <DocumentsByTypeChart
            data={chartsData.byType}
            isLoading={chartsLoading}
          />
        </div>
        
        {/* Graphique 3 : Répartition des liaisons (1 colonne) */}
        <div className="lg:col-span-1 min-w-0">
          <DocumentsLinksDistributionChart
            data={chartsData.linksDistribution}
            isLoading={chartsLoading}
          />
        </div>
      </div>

      {/* Cartes KPI (APRÈS LES GRAPHIQUES) - Cartes filtrantes actives */}
      <DocumentsKpiBar
        kpis={kpis}
        activeFilter={activeKpiFilter}
        onFilterChange={handleKpiFilterChange}
        isLoading={kpisLoading}
        hideOrphans={true} // Masquer "Orphelins" dans le contexte d'un bien
      />

      {/* Filtres avancés */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Filtres</CardTitle>
              {activeFiltersCount > 0 && (
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full">
                  {activeFiltersCount} actif{activeFiltersCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? 'Masquer' : 'Afficher'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Recherche principale - Recherche directe */}
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Rechercher par nom, texte, tags, type..."
                value={filters.query}
                onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                className="flex-1"
              />
              {activeFiltersCount > 0 && (
                <Button type="button" variant="outline" onClick={handleResetFilters}>
                  Réinitialiser
                </Button>
              )}
            </div>

            {/* Filtres avancés */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type de document
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    value={filters.type}
                    onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                  >
                    <option value="">Tous les types</option>
                    {documentTypes.map((type) => (
                      <option key={type.id} value={type.code}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Statut OCR
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    value={filters.ocrStatus}
                    onChange={(e) => setFilters({ ...filters, ocrStatus: e.target.value })}
                  >
                    <option value="">Tous</option>
                    <option value="processed">Traité</option>
                    <option value="failed">Échoué</option>
                    <option value="pending">En attente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Liaisons
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    value={filters.linkedTo}
                    onChange={(e) => setFilters({ ...filters, linkedTo: e.target.value })}
                  >
                    <option value="">Tous</option>
                    <option value="lease">Lié à un Bail</option>
                    <option value="transaction">Lié à une Transaction</option>
                    <option value="tenant">Lié à un Locataire</option>
                    <option value="global">Global</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date début
                  </label>
                  <Input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date fin
                  </label>
                  <Input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mb-4 pb-3 border-b">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">{sortedDocuments.length}</span> document{sortedDocuments.length > 1 ? 's' : ''} affiché{sortedDocuments.length > 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide w-full sm:w-auto">
              <span className="text-xs text-gray-500 whitespace-nowrap">Tri rapide:</span>
              <button
                onClick={() => handleSort('date')}
                className={`flex items-center gap-1 px-2 py-1 text-xs border rounded transition-colors whitespace-nowrap ${
                  sortField === 'date' 
                    ? 'bg-blue-50 border-blue-300 text-blue-700' 
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
                title="Trier par date"
              >
                Date {sortField === 'date' ? (sortOrder === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3" />}
              </button>
              <button
                onClick={() => handleSort('size')}
                className={`flex items-center gap-1 px-2 py-1 text-xs border rounded transition-colors whitespace-nowrap ${
                  sortField === 'size' 
                    ? 'bg-blue-50 border-blue-300 text-blue-700' 
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
                title="Trier par taille"
              >
                Taille {sortField === 'size' ? (sortOrder === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3" />}
              </button>
              <button
                onClick={() => handleSort('type')}
                className={`flex items-center gap-1 px-2 py-1 text-xs border rounded transition-colors whitespace-nowrap ${
                  sortField === 'type' 
                    ? 'bg-blue-50 border-blue-300 text-blue-700' 
                    : 'bg-white border-gray-300 hover:bg-gray-50'
                }`}
                title="Trier par type"
              >
                Type {sortField === 'type' ? (sortOrder === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3" />}
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
            setShowDeleteModal(false);
            setDocumentToDelete(null);
          }}
          onConfirm={handleDeleteConfirmed}
          documentId={documentToDelete.id}
          documentName={documentToDelete.filenameOriginal}
        />
      )}

      {/* Modal de confirmation de suppression multiple */}
      {showDeleteMultipleModal && (
        <ConfirmDeleteDocumentModal
          isOpen={showDeleteMultipleModal}
          onClose={() => {
            setShowDeleteMultipleModal(false);
            setDocumentsToDelete([]);
          }}
          onConfirm={handleDeleteMultipleConfirmed}
          documentId={documentsToDelete[0]?.id || ''}
          documentName={`${documentsToDelete.length} document${documentsToDelete.length > 1 ? 's' : ''}`}
        />
      )}
    </div>
  );
}

