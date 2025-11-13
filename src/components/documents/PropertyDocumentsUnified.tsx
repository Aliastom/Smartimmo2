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
  FileX,
  FileClock
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { InsightBar } from '@/components/ui/InsightBar';
import { InsightChip } from '@/components/ui/InsightChip';
import { InfoChip } from '@/components/ui/InfoChip';
import { InsightSkeleton } from '@/components/ui/InsightSkeleton';
import { MiniDonut } from '@/components/ui/MiniDonut';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DocumentTable,
  DocumentModal,
  DocumentLinkSelector,
  DocumentTableRow,
} from './unified';
import { useUploadReviewModal } from '@/contexts/UploadReviewModalContext';
import { usePropertyInsights, PropertyDocumentsInsights } from '@/hooks/usePropertyInsights';

interface PropertyDocumentsUnifiedProps {
  propertyId: string;
  propertyName: string;
}

export function PropertyDocumentsUnified({ propertyId, propertyName }: PropertyDocumentsUnifiedProps) {
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

  // Insights property-scoped via API
  const { insights: documentsInsights, loading: insightsLoading } = usePropertyInsights(
    propertyId,
    'documents',
    'month'
  ) as { insights: PropertyDocumentsInsights | null; loading: boolean };

  // Filtres
  const [filters, setFilters] = useState({
    query: '',
    type: '',
    status: '',
    includeDeleted: false,
  });
  const [submittedFilters, setSubmittedFilters] = useState(filters);
  
  // Filtre actif pour les cartes
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // UI States
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showLinkSelector, setShowLinkSelector] = useState(false);
  const [documentTypes, setDocumentTypes] = useState<any[]>([]);
  
  // Hook pour la modal d'upload unifiée
  const { openModalWithFileSelection } = useUploadReviewModal();

  // Pagination
  const [pagination, setPagination] = useState({
    offset: 0,
    limit: 50,
  });

  // Charger les données
  useEffect(() => {
    loadDocuments();
    loadStats();
    loadDocumentTypes();
  }, [propertyId, submittedFilters, pagination]);

  const router = useRouter();
  const searchParams = useSearchParams();

  const loadDocuments = async () => {
    setLoading(true);
    try {
      let endpoint = `/api/documents?propertyId=${propertyId}&includeDeleted=${filters.includeDeleted}&offset=${pagination.offset}&limit=${pagination.limit}`;
      
      if (submittedFilters.query) {
        endpoint += `&query=${encodeURIComponent(submittedFilters.query)}`;
      }
      if (submittedFilters.type) {
        endpoint += `&type=${submittedFilters.type}`;
      }
      if (submittedFilters.status) {
        endpoint += `&status=${submittedFilters.status}`;
      }

      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Erreur de chargement');
      
      const data = await response.json();
      setDocuments(data.documents || data || []);
    } catch (error) {
      console.error('Erreur de chargement des documents:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`/api/documents/stats?propertyId=${propertyId}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Erreur de chargement des stats:', error);
    }
  };

  // Gestion du clic sur les cartes de statistiques (InsightChips)
  const handleCardFilter = (filterType: string) => {
    // Le chip "Total" doit toujours réinitialiser immédiatement
    if (filterType === 'total') {
      setActiveFilter(null);
      const newFilters = { ...filters, status: '' };
      setFilters(newFilters);
      setSubmittedFilters(newFilters);
      const params = new URLSearchParams(searchParams.toString());
      params.delete('status');
      router.replace(`?${params.toString()}`, { scroll: false });
    } else if (activeFilter === filterType) {
      // Toggle: désactiver si on reclique
      setActiveFilter(null);
      const newFilters = { ...filters, status: '' };
      setFilters(newFilters);
      setSubmittedFilters(newFilters);
      const params = new URLSearchParams(searchParams.toString());
      params.delete('status');
      router.replace(`?${params.toString()}`, { scroll: false });
    } else {
      // Activer le nouveau filtre
      setActiveFilter(filterType);
      const newFilters = { ...filters, status: filterType };
      setFilters(newFilters);
      setSubmittedFilters(newFilters);
      const params = new URLSearchParams(searchParams.toString());
      params.set('status', filterType);
      router.replace(`?${params.toString()}`, { scroll: false });
    }
    // notifier
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('filters:changed'));
    }
  };

  const loadDocumentTypes = async () => {
    try {
      const response = await fetch('/api/admin/document-types?includeInactive=false');
      const data = await response.json();
      if (data.success) {
        setDocumentTypes(data.data);
      }
    } catch (error) {
      console.error('Erreur de chargement des types:', error);
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
      status: '',
      includeDeleted: false,
    };
    setFilters(resetFilters);
    setSubmittedFilters(resetFilters);
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

  const selectAll = () => {
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map(d => d.id)));
    }
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
          fetch(`/api/documents/${id}/link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ linkedTo, linkedId }),
          })
        )
      );
      alert('Documents reliés avec succès');
      setSelectedIds(new Set());
      setShowLinkSelector(false);
      loadDocuments();
    } catch (error) {
      console.error('Error linking documents:', error);
      alert('Erreur lors de la liaison');
    }
  };

  const handleViewDocument = (doc: DocumentTableRow) => {
    setSelectedDocument(doc);
  };

  const handleEditDocument = (doc: DocumentTableRow) => {
    // Ouvrir la modal d'édition (identique à onView)
    setSelectedDocument(doc);
  };

  const handleDownloadDocument = (doc: DocumentTableRow) => {
    if (doc.fileName) {
      window.open(`/api/documents/${doc.id}/file`, '_blank');
    }
  };

  const handlePurgeDrafts = async (force: boolean = false) => {
    try {
      const statsResponse = await fetch('/api/documents/purge-drafts');
      const statsData = await statsResponse.json();

      if (!statsData.success) {
        alert(`❌ Erreur lors de la vérification: ${statsData.error}`);
        return;
      }

      const { orphanedDrafts, activeDrafts } = statsData.data;

      if (orphanedDrafts === 0) {
        alert('Aucun document brouillon orphelin à supprimer.');
        return;
      }

      const confirmMessage = force 
        ? `Êtes-vous sûr de vouloir supprimer TOUS les ${orphanedDrafts + activeDrafts} document(s) brouillon(s) ?\n\n⚠️ Cette action supprimera aussi les brouillons avec session active.\n\nCette action est IRRÉVERSIBLE.`
        : `Êtes-vous sûr de vouloir supprimer les ${orphanedDrafts} document(s) brouillon(s) orphelin(s) ?\n\n⚠️ Seuls les brouillons sans session active seront supprimés.\n\nCette action est IRRÉVERSIBLE.`;
      
      if (!confirm(confirmMessage)) {
        return;
      }

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

      const confirmMessage = `Êtes-vous sûr de vouloir supprimer les ${dryRunData.count} document(s) orphelin(s) ?\n\n⚠️ Ces documents n'ont aucune liaison et seront supprimés définitivement.\n\nCette action est IRRÉVERSIBLE.`;
      
      if (!confirm(confirmMessage)) {
        return;
      }

      const response = await fetch('/api/documents/cleanup?type=orphan', {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        alert(`✅ Nettoyage terminé: ${result.results.deleted} document(s) supprimé(s), ${result.results.errors} erreur(s)`);
        loadDocuments();
        loadStats();
      } else {
        alert(`❌ Erreur: ${result.error}`);
      }
    } catch (error) {
      console.error('Error purging orphans:', error);
      alert('❌ Erreur lors du nettoyage des documents orphelins');
    }
  };

  const handleDeleteDocument = async (doc: DocumentTableRow) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;

    try {
      const response = await fetch(`/api/documents/${doc.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Erreur de suppression');

      loadDocuments();
      loadStats();
    } catch (error) {
      console.error('Erreur de suppression:', error);
      alert('Erreur lors de la suppression du document');
    }
  };

  // Handler pour le bouton Uploader
  const handleUploadClick = () => {
    openModalWithFileSelection({
      scope: 'property',
      propertyId: propertyId,
      autoLinkingContext: {
        propertyId: propertyId
      },
      onSuccess: () => {
        loadDocuments();
        loadStats();
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Documents</h2>
          <p className="text-sm text-gray-600">Documents liés à ce bien</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={() => window.location.href = `/biens`}
            className="flex items-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Liste des biens
          </Button>
          <Button onClick={handleUploadClick} className="flex items-center gap-2">
            <UploadIcon className="h-4 w-4" />
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
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 auto-rows-fr">
        <StatCard
          title="Total documents"
          value={(documentsInsights?.totalDocuments ?? stats.total).toString()}
          iconName="FileText"
          color="indigo"
          trendValue={0}
          trendLabel="% vs mois dernier"
          trendDirection="flat"
          rightIndicator="chevron"
          onClick={() => handleCardFilter('total')}
          isActive={activeFilter === 'total'}
        />
        
        <StatCard
          title="En attente"
          value={(documentsInsights?.pendingDocuments ?? stats.pending).toString()}
          iconName="Clock"
          color="amber"
          trendValue={0}
          trendLabel="% vs mois dernier"
          trendDirection="flat"
          rightIndicator="chevron"
          onClick={() => handleCardFilter('pending')}
          isActive={activeFilter === 'pending'}
        />
        
        <StatCard
          title="Classés"
          value={(documentsInsights?.classifiedDocuments ?? stats.classified).toString()}
          iconName="CheckCircle"
          color="green"
          trendValue={0}
          trendLabel="% vs mois dernier"
          trendDirection="flat"
          rightIndicator="chevron"
          onClick={() => handleCardFilter('classified')}
          isActive={activeFilter === 'classified'}
        />
        
        <StatCard
          title="OCR échoué"
          value={(documentsInsights?.ocrFailedDocuments ?? stats.ocrFailed).toString()}
          iconName="FileX"
          color="red"
          trendValue={0}
          trendLabel="% vs mois dernier"
          trendDirection="flat"
          rightIndicator="chevron"
          onClick={() => handleCardFilter('ocr_failed')}
          isActive={activeFilter === 'ocr_failed'}
        />
        
        <StatCard
          title="Brouillons"
          value={(documentsInsights?.draftDocuments ?? stats.drafts).toString()}
          iconName="FileClock"
          color="yellow"
          trendValue={0}
          trendLabel="% vs mois dernier"
          trendDirection="flat"
          rightIndicator="chevron"
          onClick={() => handleCardFilter('draft')}
          isActive={activeFilter === 'draft'}
        />
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Rechercher par nom, texte, tags..."
                  value={filters.query}
                  onChange={(e) => setFilters(prev => ({ ...prev, query: e.target.value }))}
                />
              </div>
              <Button type="submit" variant="outline">
                <Search className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" onClick={handleResetFilters}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Actions groupées */}
      {selectedIds.size > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-blue-900">
                  {selectedIds.size} document(s) sélectionné(s)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkRelink}
                  className="flex items-center gap-2"
                >
                  <LinkIcon className="h-4 w-4" />
                  Relier
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkReclassify}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reclasser
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="flex items-center gap-2 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table des documents */}
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>
            Affichage de 1 à {documents.length} sur {documents.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DocumentTable
            documents={documents}
            onView={handleViewDocument}
            onEdit={handleEditDocument}
            onDownload={handleDownloadDocument}
            onDelete={handleDeleteDocument}
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
            showLinkedTo={false}
            loading={loading}
          />
        </CardContent>
      </Card>

      {/* Modal de document */}
      {selectedDocument && (
        <DocumentModal
          document={selectedDocument}
          isOpen={!!selectedDocument}
          onClose={() => setSelectedDocument(null)}
          onUpdate={() => {
            loadDocuments();
            loadStats();
            setSelectedDocument(null);
          }}
        />
      )}

      {/* Sélecteur de liaison */}
      {showLinkSelector && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-xl">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Relier les documents sélectionnés
              </h3>
              <DocumentLinkSelector
                onSelect={handleLinkSelected}
                onCancel={() => setShowLinkSelector(false)}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}