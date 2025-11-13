'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { notify2 } from '@/lib/notify2';
import { Upload as UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { DocumentsMonthlyChart } from '@/components/documents/DocumentsMonthlyChart';
import { DocumentsByTypeChart } from '@/components/documents/DocumentsByTypeChart';
import { DocumentsLinksDistributionChart } from '@/components/documents/DocumentsLinksDistributionChart';
import { DocumentsKpiBar } from '@/components/documents/DocumentsKpiBar';
import { DocumentTable, DocumentTableRow } from '@/components/documents/unified/DocumentTable';
import { useDocumentsKpis } from '@/hooks/useDocumentsKpis';
import { useDocumentsCharts } from '@/hooks/useDocumentsCharts';
import { useUploadReviewModal } from '@/contexts/UploadReviewModalContext';
import { ConfirmDeleteDocumentModal } from '@/components/documents/ConfirmDeleteDocumentModal';
import { DocumentEditModal } from '@/components/documents/unified/DocumentEditModal';
import DocumentDrawer from '@/components/documents/DocumentDrawer';
import { BackToPropertyButton } from '@/components/shared/BackToPropertyButton';
import { PropertySubNav } from '@/components/bien/PropertySubNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Filter, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openModalWithFileSelection } = useUploadReviewModal();

  // États principaux
  const [documents, setDocuments] = useState<DocumentTableRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    offset: 0,
    total: 0,
    hasMore: false,
  });
  const [isLoading, setIsLoading] = useState(true);

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

  // États des filtres
  const [filters, setFilters] = useState<Filters>({
    query: '',
    type: '',
    ocrStatus: '',
    linkedTo: '',
    dateFrom: '',
    dateTo: '',
  });

  // État pour les types de documents
  const [documentTypes, setDocumentTypes] = useState<any[]>([]);

  // État pour forcer le rafraîchissement des KPI et graphiques
  const [refreshKey, setRefreshKey] = useState(0);

  // État pour afficher/masquer les filtres avancés
  const [showFilters, setShowFilters] = useState(false);

  // État pour le tri
  const [sortField, setSortField] = useState<'date' | 'size' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Charger les KPI avec les hooks (scopé par propertyId)
  const { kpis, isLoading: kpisLoading } = useDocumentsKpis({
    periodStart,
    periodEnd,
    refreshKey,
    propertyId, // Scope par bien
  });

  // Charger les graphiques avec les hooks (scopé par propertyId)
  const { data: chartsData, isLoading: chartsLoading } = useDocumentsCharts({
    periodStart,
    periodEnd,
    refreshKey,
    propertyId, // Scope par bien
  });

  // Nettoyer l'URL au montage (une seule fois)
  const hasCleanedUrl = React.useRef(false);
  useEffect(() => {
    if (!hasCleanedUrl.current) {
      const hasFilters = searchParams.toString().length > 0;
      if (hasFilters) {
        router.replace(`/biens/${propertyId}/documents`, { scroll: false });
      }
      hasCleanedUrl.current = true;
    }
  }, [router, searchParams, propertyId]);

  // Chargement des types de documents
  useEffect(() => {
    const loadDocumentTypes = async () => {
      try {
        const response = await fetch('/api/document-types');
        const data = await response.json();
        setDocumentTypes(data.documentTypes || []);
      } catch (error) {
        console.error('Erreur lors du chargement des types:', error);
      }
    };

    loadDocumentTypes();
  }, []);

  // Chargement des documents (scopé par propertyId)
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();

      // Ajouter le propertyId pour le scope
      params.append('propertyId', propertyId);

      // Ajouter les filtres de base
      if (filters.query) params.append('query', filters.query);
      if (filters.type) params.append('type', filters.type);
      if (filters.linkedTo) params.append('linkedTo', filters.linkedTo);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);

      // Appliquer le filtre KPI actif (si pas de filtre linkedTo manuel)
      if (!filters.linkedTo) {
        if (activeKpiFilter === 'pending') {
          params.append('ocrStatus', 'pending');
        } else if (activeKpiFilter === 'unclassified') {
          params.append('status', 'unclassified');
        } else if (activeKpiFilter === 'ocrFailed') {
          params.append('ocrStatus', 'failed');
        } else if (activeKpiFilter === 'orphans') {
          params.append('linkedTo', 'none');
        }
      } else {
        // Si un filtre linkedTo manuel est actif, on applique quand même les filtres de statut
        if (activeKpiFilter === 'pending') {
          params.append('ocrStatus', 'pending');
        } else if (activeKpiFilter === 'unclassified') {
          params.append('status', 'unclassified');
        } else if (activeKpiFilter === 'ocrFailed') {
          params.append('ocrStatus', 'failed');
        }
      }
      // Si activeKpiFilter === 'total', pas de filtre supplémentaire

      // Ajouter la pagination
      params.append('offset', pagination.offset.toString());
      params.append('limit', pagination.limit.toString());

      const response = await fetch(`/api/documents?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors du chargement des documents');
      }

      setDocuments(data.documents || []);
      setPagination((prev) => ({
        ...prev,
        total: data.pagination?.total || 0,
        hasMore: data.pagination?.hasMore || false,
      }));
      setTotalCount(data.pagination?.total || 0);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      notify2.error('Erreur lors du chargement des documents');
    } finally {
      setIsLoading(false);
    }
  }, [filters, pagination.offset, pagination.limit, activeKpiFilter, propertyId]);

  // Chargement des données quand les filtres changent ou refreshKey
  useEffect(() => {
    loadData();
  }, [loadData, refreshKey]);

  // Synchronisation des filtres avec l'URL
  const updateURL = useCallback((newFilters: Filters) => {
    const params = new URLSearchParams();
    
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });

    const newURL = params.toString() ? `?${params.toString()}` : '';
    router.replace(`/biens/${propertyId}/documents${newURL}`, { scroll: false });
  }, [router, propertyId]);

  // Gestion des filtres
  const handleFiltersChange = useCallback((newFilters: Filters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, offset: 0, page: 1 }));
    updateURL(newFilters);
  }, [updateURL]);

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
    updateURL(resetFilters);
  }, [updateURL]);

  // Gestion du filtre de période
  const handlePeriodChange = useCallback((start: string, end: string) => {
    setPeriodStart(start);
    setPeriodEnd(end);
  }, []);

  // Gestion du bouton Uploader (avec contexte du bien pré-sélectionné)
  const handleUploadClick = useCallback(() => {
    openModalWithFileSelection({
      scope: 'property',
      propertyId: propertyId,
      autoLinkingContext: {
        propertyId: propertyId,
      },
      onSuccess: () => {
        loadData();
        setRefreshKey(prev => prev + 1);
      }
    });
  }, [openModalWithFileSelection, loadData, propertyId]);

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

  const handleDeleteConfirmed = useCallback(() => {
    loadData();
    setRefreshKey(prev => prev + 1);
    setDocumentToDelete(null);
  }, [loadData]);

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
      setSelectedIds(new Set(documents.map(d => d.id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [documents]);

  // Gestion de la suppression multiple
  const handleDeleteMultiple = useCallback((docs: DocumentTableRow[]) => {
    setDocumentsToDelete(docs);
    setShowDeleteMultipleModal(true);
  }, []);

  const handleDeleteMultipleConfirmed = useCallback(async () => {
    try {
      let deletedCount = 0;
      
      for (const doc of documentsToDelete) {
        try {
          const response = await fetch(`/api/documents/${doc.id}/hard-delete`, {
            method: 'DELETE',
          });
          
          if (response.ok) {
            deletedCount++;
          }
        } catch (fetchError) {
          console.error(`Erreur lors de la suppression de ${doc.id}:`, fetchError);
        }
      }
      
      if (deletedCount > 0) {
        notify2.success(`${deletedCount} document(s) supprimé(s)`);
      }
      
      setSelectedIds(new Set());
      loadData();
      setRefreshKey(prev => prev + 1);
      setShowDeleteMultipleModal(false);
      setDocumentsToDelete([]);
    } catch (error) {
      console.error('Erreur lors de la suppression multiple:', error);
      notify2.error('Erreur lors de la suppression des documents');
    }
  }, [documentsToDelete, loadData]);

  // Gestion de la pagination
  const handlePageChange = (direction: 'prev' | 'next') => {
    setPagination((prev) => {
      const newOffset = direction === 'next' 
        ? prev.offset + prev.limit 
        : Math.max(0, prev.offset - prev.limit);
      
      return {
        ...prev,
        offset: newOffset,
        page: Math.floor(newOffset / prev.limit) + 1,
      };
    });
  };

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

  // Trier les documents
  const sortedDocuments = React.useMemo(() => {
    const sorted = [...documents];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'date':
          comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
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
    
    return sorted;
  }, [documents, sortField, sortOrder]);

  return (
    <div className="space-y-6">
      {/* Header avec menu intégré */}
      <div className="grid grid-cols-3 items-center mb-6 gap-6">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 border-b-4 border-blue-400 pb-2 inline-block">Documents - {propertyName}</h1>
          <p className="text-gray-600 mt-2">Tous les documents liés à ce bien immobilier</p>
        </div>
        
          <div className="flex justify-center">
            <PropertySubNav
              propertyId={propertyId}
              counts={{
                documents: totalCount,
              }}
            />
          </div>
        
        <div className="flex items-center gap-3 justify-end">
          <Button onClick={handleUploadClick}>
            <UploadIcon className="h-4 w-4 mr-2" />
            Uploader
          </Button>
          <BackToPropertyButton 
            propertyId={propertyId} 
            propertyName={propertyName}
          />
        </div>
      </div>

      {/* Graphiques - TOUS sur la même ligne (AU DESSUS DES CARTES) */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
        {/* Graphique 1 : Évolution mensuelle (2 colonnes) */}
        <div className="md:col-span-2">
          <DocumentsMonthlyChart
            data={chartsData.monthly}
            isLoading={chartsLoading}
          />
        </div>
        
        {/* Graphique 2 : Répartition par type (1 colonne) */}
        <div className="md:col-span-1">
          <DocumentsByTypeChart
            data={chartsData.byType}
            isLoading={chartsLoading}
          />
        </div>
        
        {/* Graphique 3 : Répartition des liaisons (1 colonne) */}
        <div className="md:col-span-1">
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
                placeholder="Rechercher par nom, texte, tags..."
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
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-900">
                {selectedIds.size} document{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
              </span>
              <div className="flex-1" />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const docsToDelete = documents.filter(d => selectedIds.has(d.id));
                  handleDeleteMultiple(docsToDelete);
                }}
              >
                Supprimer
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedIds(new Set())}
              >
                Annuler
              </Button>
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
                onClick={() => handleSort('date')}
                className={`flex items-center gap-1 px-2 py-1 text-xs border rounded transition-colors ${
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
                className={`flex items-center gap-1 px-2 py-1 text-xs border rounded transition-colors ${
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
                className={`flex items-center gap-1 px-2 py-1 text-xs border rounded transition-colors ${
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
                onClick={() => handlePageChange('prev')}
              >
                Précédent
              </Button>
              <Button
                variant="outline"
                disabled={!pagination.hasMore}
                onClick={() => handlePageChange('next')}
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
            loadData();
            setRefreshKey(prev => prev + 1);
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

