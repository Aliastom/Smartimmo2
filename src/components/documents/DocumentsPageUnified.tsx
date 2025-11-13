'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Upload as UploadIcon, 
  CheckSquare,
  Download,
  Trash2,
  RefreshCw,
  Link as LinkIcon,
  X,
  Calendar,
  Tag,
  AlertCircle,
  FileText,
  Clock,
  CheckCircle,
  FileX
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { InsightBar } from '@/components/ui/InsightBar';
import { InsightChip } from '@/components/ui/InsightChip';
import { MiniDonut } from '@/components/ui/MiniDonut';
import { useDashboardInsights } from '@/hooks/useDashboardInsights';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import {
  DocumentTable,
  DocumentLinkSelector,
  DocumentTableRow,
} from './unified';
import { DocumentEditModal } from './unified/DocumentEditModal';
import DocumentDrawer from './DocumentDrawer';
import { useUploadReviewModal } from '@/contexts/UploadReviewModalContext';
import { ConfirmDeleteDocumentModal } from './ConfirmDeleteDocumentModal';

export function DocumentsPageUnified() {
  // États
  const [documents, setDocuments] = useState<DocumentTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    classified: 0,
    ocrFailed: 0,
    drafts: 0,
    orphans: 0,
  });
  const { insights, loading: insightsLoading } = useDashboardInsights('documents');

  // Filtres
  const [filters, setFilters] = useState({
    query: '',
    type: '',
    scope: '',
    status: '',
    linkedTo: '',
    dateFrom: '',
    dateTo: '',
    includeDeleted: false,
  });
  const [submittedFilters, setSubmittedFilters] = useState(filters);

  // UI States
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [documentToEdit, setDocumentToEdit] = useState<DocumentTableRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showLinkSelector, setShowLinkSelector] = useState(false);
  const [documentTypes, setDocumentTypes] = useState<any[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<DocumentTableRow | null>(null);
  
  // Hook pour la modal d'upload unifiée
  const { openModalWithFileSelection } = useUploadReviewModal();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Pagination
  const [pagination, setPagination] = useState({
    offset: 0,
    limit: 50,
    total: 0,
    hasMore: false,
  });

  // Handler pour le bouton Uploader
  const handleUploadClick = () => {
    openModalWithFileSelection({
      scope: 'global',
      autoLinkingContext: {
        // Pour les documents globaux, pas de contexte spécifique
        // Les liaisons seront déterminées par le type de document
      },
      onSuccess: () => {
        loadDocuments();
        loadStats();
      }
    });
  };

  // Charger les données initiales
  useEffect(() => {
    loadDocuments();
    loadStats();
    loadDocumentTypes();
  }, [submittedFilters, pagination.offset]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (submittedFilters.query) params.append('query', submittedFilters.query);
      if (submittedFilters.type) params.append('type', submittedFilters.type);
      if (submittedFilters.scope) params.append('scope', submittedFilters.scope);
      if (submittedFilters.status) params.append('status', submittedFilters.status);
      if (submittedFilters.linkedTo) params.append('linkedTo', submittedFilters.linkedTo);
      if (submittedFilters.dateFrom) params.append('dateFrom', submittedFilters.dateFrom);
      if (submittedFilters.dateTo) params.append('dateTo', submittedFilters.dateTo);
      if (submittedFilters.includeDeleted) params.append('includeDeleted', 'true');
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
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/documents/stats');
      const data = await response.json();
      
      // Charger aussi les statistiques des orphelins
      try {
        const orphansResponse = await fetch('/api/documents/cleanup?type=orphan&dryRun=true');
        const orphansData = await orphansResponse.json();
        if (orphansData.success) {
          data.orphans = orphansData.count;
        }
      } catch (orphanError) {
        console.warn('Error loading orphan stats:', orphanError);
        data.orphans = 0;
      }
      
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadDocumentTypes = async () => {
    try {
      const response = await fetch('/api/document-types');
      const data = await response.json();
      setDocumentTypes(data.documentTypes || []);
    } catch (error) {
      console.error('Error loading document types:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedFilters(filters);
    setPagination((prev) => ({ ...prev, offset: 0 }));
  };

  // Recherche automatique avec debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (filters.query !== submittedFilters.query) {
        setSubmittedFilters(filters);
        setPagination((prev) => ({ ...prev, offset: 0 }));
      }
    }, 500); // Attendre 500ms après la dernière frappe

    return () => clearTimeout(timer);
  }, [filters.query]);

  const handleResetFilters = () => {
    const resetFilters = {
      query: '',
      type: '',
      scope: '',
      status: '',
      linkedTo: '',
      dateFrom: '',
      dateTo: '',
      includeDeleted: false,
    };
    setFilters(resetFilters);
    setSubmittedFilters(resetFilters);
    setPagination((prev) => ({ ...prev, offset: 0 }));
  };

  // Handler pour le filtrage par carte
  const handleCardFilter = (filterType: string, filterValue: any) => {
    const newFilters = { ...filters };
    
    switch (filterType) {
           case 'status':
             if (filterValue === 'pending') {
               newFilters.status = 'pending';
             } else if (filterValue === 'classified') {
               newFilters.status = 'active';
               newFilters.type = ''; // Reset type filter
             } else if (filterValue === 'ocrFailed') {
               newFilters.status = 'ocr_failed';
             } else if (filterValue === 'draft') {
               newFilters.status = 'draft';
             }
             break;
           case 'orphan':
             // Filtrer les documents orphelins (sans liaisons)
             newFilters.status = 'orphan';
             break;
      case 'total':
        // Reset all filters
        newFilters.status = '';
        newFilters.type = '';
        newFilters.scope = '';
        newFilters.linkedTo = '';
        break;
    }
    
    setFilters(newFilters);
    setSubmittedFilters(newFilters);
    setPagination((prev) => ({ ...prev, offset: 0 }));
  };

  const handleSelectDocument = (docId: string, selected: boolean) => {
    const newSelection = new Set(selectedIds);
    if (selected) {
      newSelection.add(docId);
    } else {
      newSelection.delete(docId);
    }
    setSelectedIds(newSelection);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Supprimer ${selectedIds.size} document(s) ?`)) return;

    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/documents/${id}`, { method: 'DELETE' })
        )
      );
      setSelectedIds(new Set());
      loadDocuments();
      loadStats();
    } catch (error) {
      console.error('Error deleting documents:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const handleBulkReclassify = async () => {
    if (!confirm(`Reclasser ${selectedIds.size} document(s) ?`)) return;

    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/documents/${id}/classify`, { method: 'POST' })
        )
      );
      alert('Reclassification lancée avec succès');
      loadDocuments();
    } catch (error) {
      console.error('Error reclassifying documents:', error);
      alert('Erreur lors de la reclassification');
    }
  };

  const handleBulkRelink = () => {
    setShowLinkSelector(true);
  };

  const handleLinkSelected = async (linkedTo: string, linkedId?: string) => {
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/documents/${id}/relink`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ linkedTo, linkedId }),
          })
        )
      );
      setShowLinkSelector(false);
      setSelectedIds(new Set());
      loadDocuments();
      alert('Documents reliés avec succès');
    } catch (error) {
      console.error('Error relinking documents:', error);
      alert('Erreur lors de la reliaison');
    }
  };

  const handleViewDocument = (doc: DocumentTableRow) => {
    setSelectedDocument(doc);
    setIsDrawerOpen(true);
  };

  const handleDownload = (doc: DocumentTableRow) => {
    window.open(`/api/documents/${doc.id}/file`, '_blank');
  };

  const handleEdit = (doc: DocumentTableRow) => {
    // Ouvrir la modal d'édition
    setDocumentToEdit(doc);
    setShowEditModal(true);
  };

  const handleDelete = async (doc: DocumentTableRow) => {
    // Ouvrir la modal de confirmation avec le document
    setDocumentToDelete(doc);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirmed = () => {
    // Recharger les documents après suppression
    loadDocuments();
    loadStats();
    setDocumentToDelete(null);
  };

  const handlePurgeDrafts = async (force: boolean = false) => {
    // D'abord, récupérer les statistiques pour afficher un message approprié
    try {
      const statsResponse = await fetch('/api/documents/purge-drafts');
      const statsData = await statsResponse.json();
      
      if (statsData.success) {
        const { totalDrafts, orphanedDrafts, activeDrafts } = statsData.data;
        
        let confirmMessage = '';
        if (force) {
          confirmMessage = `Êtes-vous sûr de vouloir purger TOUS les ${totalDrafts} document(s) brouillon(s) ?\n\n` +
                          `⚠️ Cela inclut:\n` +
                          `- ${orphanedDrafts} document(s) orphelin(s)\n` +
                          `- ${activeDrafts} document(s) avec session active\n\n` +
                          `Cette action est IRRÉVERSIBLE.`;
        } else {
          if (orphanedDrafts === 0) {
            alert('Aucun document brouillon orphelin à purger.\n\nUtilisez "Purger TOUT" pour supprimer tous les brouillons (y compris ceux avec session active).');
            return;
          }
          confirmMessage = `Êtes-vous sûr de vouloir purger les ${orphanedDrafts} document(s) brouillon orphelin(s) ?\n\n` +
                          `(Les ${activeDrafts} document(s) avec session active seront conservés)\n\n` +
                          `Cette action est irréversible.`;
        }
        
        if (!confirm(confirmMessage)) {
          return;
        }
      }
    } catch (error) {
      console.error('Error fetching draft stats:', error);
      // Continuer avec un message générique
      if (!confirm(`Êtes-vous sûr de vouloir purger les documents brouillons${force ? ' (TOUS)' : ' orphelins'} ? Cette action est irréversible.`)) {
        return;
      }
    }

    try {
      const response = await fetch('/api/documents/purge-drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`✅ Purge terminée: ${result.results.deleted} document(s) supprimé(s), ${result.results.errors} erreur(s)`);
        loadDocuments();
        loadStats();
      } else {
        alert(`❌ Erreur: ${result.error}`);
      }
    } catch (error) {
      console.error('Error purging drafts:', error);
      alert('❌ Erreur lors de la purge des documents brouillons');
    }
  };

  const handlePurgeOrphans = async () => {
    try {
      // D'abord, faire un dry run pour voir combien d'orphelins
      const dryRunResponse = await fetch('/api/documents/cleanup?type=orphan&dryRun=true');
      const dryRunData = await dryRunResponse.json();
      
      if (!dryRunData.success) {
        alert(`❌ Erreur lors de la vérification: ${dryRunData.error}`);
        return;
      }

      if (dryRunData.count === 0) {
        alert('Aucun document orphelin à supprimer.');
        return;
      }

      const confirmMessage = `Êtes-vous sûr de vouloir supprimer les ${dryRunData.count} document(s) orphelin(s) ?\n\n` +
                            `⚠️ Ces documents n'ont aucune liaison et seront supprimés définitivement.\n\n` +
                            `Cette action est IRRÉVERSIBLE.`;
      
      if (!confirm(confirmMessage)) {
        return;
      }

      // Effectuer la suppression
      const response = await fetch('/api/documents/cleanup?type=orphan', {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        alert(`✅ Nettoyage terminé: ${result.results.deleted} document(s) orphelin(s) supprimé(s), ${result.results.errors} erreur(s)`);
        loadDocuments();
        loadStats();
      } else {
        alert(`❌ Erreur: ${result.error}`);
      }
    } catch (error) {
      console.error('Error purging orphans:', error);
      alert('❌ Erreur lors de la suppression des documents orphelins');
    }
  };

  const activeFiltersCount = [
    filters.query,
    filters.type,
    filters.scope,
    filters.status,
    filters.linkedTo,
    filters.dateFrom,
    filters.dateTo,
    filters.includeDeleted,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-600 mt-1">
            {pagination.total} document{pagination.total > 1 ? 's' : ''} au total
          </p>
        </div>
        <div className="flex gap-2">
          {/* 1) Input file caché */}
          <Button onClick={handleUploadClick}>
            <UploadIcon className="h-4 w-4 mr-2" />
            Uploader
          </Button>
          {stats.drafts > 0 && (
            <Button 
              variant="outline" 
              onClick={() => handlePurgeDrafts(true)}
              className="text-orange-600 border-orange-300 hover:bg-orange-50"
              title="Purger TOUS les documents brouillons (orphelins et actifs)"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Purger brouillons ({stats.drafts})
            </Button>
          )}
          {stats.orphans > 0 && (
            <Button 
              variant="outline" 
              onClick={handlePurgeOrphans}
              className="text-purple-600 border-purple-300 hover:bg-purple-50"
              title="Supprimer les documents orphelins (sans aucune liaison)"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Purger orphelins ({stats.orphans})
            </Button>
          )}
        </div>
      </div>

      {/* Cartes de statistiques - Toutes en StatCard Phase 2 */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 auto-rows-fr">
        <StatCard
          title="Total documents"
          value={insights.totalDocuments?.toString() || '0'}
          iconName="FileText"
          color="indigo"
          trendValue={0}
          trendLabel="% vs mois dernier"
          trendDirection="flat"
          rightIndicator="chevron"
          onClick={() => handleCardFilter('total', null)}
        />
        
        <StatCard
          title="En attente"
          value={insights.pendingDocuments?.toString() || '0'}
          iconName="Clock"
          color="amber"
          trendValue={0}
          trendLabel="% vs mois dernier"
          trendDirection="flat"
          rightIndicator="chevron"
          onClick={() => handleCardFilter('status', 'pending')}
        />
        
        <StatCard
          title="Classés"
          value={insights.classifiedDocuments?.toString() || '0'}
          iconName="CheckCircle"
          color="green"
          trendValue={0}
          trendLabel="% vs mois dernier"
          trendDirection="flat"
          rightIndicator="chevron"
          onClick={() => handleCardFilter('status', 'classified')}
        />
        
        <StatCard
          title="OCR échoué"
          value={insights.ocrFailedDocuments?.toString() || '0'}
          iconName="FileX"
          color="red"
          trendValue={0}
          trendLabel="% vs mois dernier"
          trendDirection="flat"
          rightIndicator="chevron"
          onClick={() => handleCardFilter('status', 'ocrFailed')}
        />
        
        <StatCard
          title="Brouillons"
          value={stats.drafts?.toString() || '0'}
          iconName="FileClock"
          color="yellow"
          trendValue={0}
          trendLabel="% vs mois dernier"
          trendDirection="flat"
          rightIndicator="chevron"
          onClick={() => handleCardFilter('status', 'draft')}
        />
        
        <StatCard
          title="Orphelins"
          value={stats.orphans?.toString() || '0'}
          iconName="AlertCircle"
          color="purple"
          trendValue={0}
          trendLabel="Sans liaison"
          trendDirection="flat"
          rightIndicator="chevron"
          onClick={() => handleCardFilter('orphan', null)}
        />
        
        <StatCard
          title="% classés"
          value={`${Math.round(insights.classificationRate || 0)}%`}
          iconName="CheckCircle"
          color={insights.classificationRate && insights.classificationRate > 80 ? 'green' : 'amber'}
          trendValue={0}
          trendLabel="% vs mois dernier"
          trendDirection="flat"
          rightIndicator="progress"
          progressValue={insights.classificationRate || 0}
        />
      </div>


      {/* Filtres */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Filtres</CardTitle>
              {activeFiltersCount > 0 && (
                <Badge variant="primary">{activeFiltersCount} actif{activeFiltersCount > 1 ? 's' : ''}</Badge>
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
          <form onSubmit={handleSearch} className="space-y-4">
            {/* Recherche principale */}
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Rechercher par nom, texte, tags..."
                value={filters.query}
                onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                className="flex-1"
              />
              <Button type="submit">
                <Search className="h-4 w-4" />
              </Button>
              {activeFiltersCount > 0 && (
                <Button type="button" variant="outline" onClick={handleResetFilters}>
                  Réinitialiser
                </Button>
              )}
            </div>

            {/* Filtres avancés */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
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
                    Scope
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    value={filters.scope}
                    onChange={(e) => setFilters({ ...filters, scope: e.target.value })}
                  >
                    <option value="">Tous</option>
                    <option value="global">Global</option>
                    <option value="property">Biens</option>
                    <option value="lease">Baux</option>
                    <option value="transaction">Transactions</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Statut
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  >
                    <option value="">Tous</option>
                    <option value="pending">En attente</option>
                    <option value="classified">Classé</option>
                    <option value="draft">Brouillons</option>
                    <option value="rejected">Rejeté</option>
                    <option value="archived">Archivé</option>
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

                <div className="flex items-end">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      checked={filters.includeDeleted}
                      onChange={(e) =>
                        setFilters({ ...filters, includeDeleted: e.target.checked })
                      }
                    />
                    <span className="ml-2 text-sm text-gray-700">Inclure supprimés</span>
                  </label>
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Actions groupées */}
      {selectedIds.size > 0 && (
        <Card>
          <CardContent>
            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <CheckSquare className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">
                {selectedIds.size} document{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
              </span>
              <div className="flex-1" />
              <Button variant="outline" size="sm" onClick={handleBulkRelink}>
                <LinkIcon className="h-4 w-4 mr-2" />
                Relier
              </Button>
              <Button variant="outline" size="sm" onClick={handleBulkReclassify}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reclasser
              </Button>
              <Button variant="outline" size="sm" onClick={handleBulkDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liste des documents */}
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>
            {pagination.total > 0
              ? `Affichage de ${pagination.offset + 1} à ${Math.min(pagination.offset + pagination.limit, pagination.total)} sur ${pagination.total}`
              : 'Aucun document'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DocumentTable
            documents={documents}
            onView={handleViewDocument}
            onEdit={handleEdit}
            onDownload={handleDownload}
            onDelete={handleDelete}
            onSelect={handleSelectDocument}
            onSelectAll={(selected) => {
              if (selected) {
                setSelectedIds(new Set(documents.map(d => d.id)));
              } else {
                setSelectedIds(new Set());
              }
            }}
            selectedIds={selectedIds}
            showSelection={true}
            showLinkedTo={true}
            loading={loading}
          />

          {/* Pagination */}
          {pagination.total > pagination.limit && (
            <div className="flex justify-center gap-2 mt-6">
              <Button
                variant="outline"
                disabled={pagination.offset === 0}
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    offset: Math.max(0, prev.offset - prev.limit),
                  }))
                }
              >
                Précédent
              </Button>
              <Button
                variant="outline"
                disabled={!pagination.hasMore}
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    offset: prev.offset + prev.limit,
                  }))
                }
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
            loadDocuments();
            loadStats();
            setShowEditModal(false);
            setDocumentToEdit(null);
          }}
        />
      )}

      {/* Sélecteur de liaison */}
      {showLinkSelector && (
        <Dialog open={showLinkSelector} onOpenChange={() => setShowLinkSelector(false)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Relier les documents sélectionnés</DialogTitle>
            </DialogHeader>
            <DocumentLinkSelector
              onSelect={handleLinkSelected}
              onCancel={() => setShowLinkSelector(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de confirmation de suppression */}
      {documentToDelete && (
        <ConfirmDeleteDocumentModal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setDocumentToDelete(null);
          }}
          onConfirm={handleDeleteConfirmed}
          documentId={documentToDelete.id}
          documentName={documentToDelete.filenameOriginal}
        />
      )}

    </div>
  );
}

