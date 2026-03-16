/**
 * Core Component pour la page Documents
 * 
 * Une seule source de vérité graphique utilisable en mode "normal" et "app-shell"
 * Toute la logique UI est centralisée ici.
 * 
 * RÉPLIQUE EXACTEMENT le comportement de DocumentsPageUnified.tsx
 */

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  Search, 
  Filter, 
  Upload as UploadIcon, 
  CheckSquare,
  Trash2,
  RefreshCw,
  Link as LinkIcon,
  X,
  FileText,
  Clock,
  CheckCircle,
  FileX,
  Loader2,
  AlertCircle,
  Menu,
  Plus,
  Star,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { SmartSelect, SmartSelectOption } from '@/components/ui/SmartSelect';
import { SmartDatePicker } from '@/components/ui/SmartDatePicker';
import { StatCard } from '@/components/ui/StatCard';
import { useDashboardInsights } from '@/features/insights/hooks/useDashboardInsights';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import {
  DocumentTable,
  DocumentLinkSelector,
  DocumentTableRow,
} from '@/components/documents/unified';
import { useUploadReviewModal } from '@/contexts/UploadReviewModalContext';
import { useDocumentsData, type DocumentsFilters, type DocumentTableRow as DocRow } from './hooks/useDocumentsData';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { useAlert } from '@/hooks/useAlert';
import { getGlobalSyncService } from '@/lib/offline/syncGlobal';
import { createDocumentServiceWithMode } from '@/domain/services/documentServiceFactory';
import { getLocalDB } from '@/lib/offline/db';
import { useSidebarOptional } from '@/contexts/SidebarContext';

// ✅ IMPORT STATIQUE pour garantir le fonctionnement offline (évite ChunkLoadError en app-shell)
import { DocumentEditModal } from '@/components/documents/unified/DocumentEditModal';
import DocumentDrawer from '@/components/documents/DocumentDrawer';
import { ConfirmDeleteDocumentModal } from '@/components/documents/ConfirmDeleteDocumentModal';

export interface DocumentsPageCoreProps {
  mode: 'normal' | 'app-shell';
}

export function DocumentsPageCore({
  mode,
}: DocumentsPageCoreProps) {
  const { organizationId } = useCurrentOrganization();
  const { showAlert, showConfirm } = useAlert();
  
  // Récupérer le contexte sidebar pour le hamburger mobile
  const sidebarContext = useSidebarOptional();

  // Filtres
  const [filters, setFilters] = useState<DocumentsFilters>({
    query: '',
    type: '',
    scope: '',
    status: '',
    linkedTo: '',
    dateFrom: '',
    dateTo: '',
    includeDeleted: false,
    filterFavorites: false,
  });
  const [submittedFilters, setSubmittedFilters] = useState(filters);
  const [filterFavoritesOnly, setFilterFavoritesOnly] = useState(false);

  // UI States
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [documentToEdit, setDocumentToEdit] = useState<DocRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showLinkSelector, setShowLinkSelector] = useState(false);
  const [documentTypes, setDocumentTypes] = useState<any[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<DocRow | null>(null);
  const [isDeletingDocument, setIsDeletingDocument] = useState(false);
  
  // Hook pour la modal d'upload unifiée
  const { openModalWithFileSelection } = useUploadReviewModal();

  // Pagination
  const [pagination, setPagination] = useState({
    offset: 0,
    limit: 30, // 30 éléments par page en desktop
    total: 0,
    hasMore: false,
  });

  // Utiliser le hook unifié pour les données
  const {
    documents,
    stats,
    pagination: dataPagination,
    loading,
    error,
    updateDocumentFavorite,
  } = useDocumentsData({
    mode,
    filters: mode === 'app-shell' ? submittedFilters : undefined,
    offset: pagination.offset,
    limit: pagination.limit,
    filterFavorites: filterFavoritesOnly,
  });

  // Synchroniser la pagination
  useEffect(() => {
    if (dataPagination) {
      setPagination(prev => ({
        ...prev,
        total: dataPagination.total,
        hasMore: dataPagination.hasMore,
      }));
    }
  }, [dataPagination]);

  const { insights, loading: insightsLoading } = useDashboardInsights({ mode, scope: 'documents' });

  // Charger les types de documents
  useEffect(() => {
    const loadDocumentTypes = async () => {
      try {
        if (mode === 'app-shell') {
          // ✅ En mode app-shell, TOUJOURS charger depuis IndexedDB (pas de fetch)
          const db = await getLocalDB();
          const types = await db.DocumentType.toArray();
          setDocumentTypes(types);
        } else {
          // Mode normal : utiliser l'API
          const response = await fetch('/api/document-types');
          const data = await response.json();
          setDocumentTypes(data.documentTypes || []);
        }
      } catch (error) {
        console.error('Error loading document types:', error);
      }
    };

    loadDocumentTypes();
  }, [mode]);

  // Handler pour le bouton Uploader
  const handleUploadClick = () => {
    // ⚠️ Upload = ONLINE ONLY (règle métier)
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
    
    if (!isOnline) {
      showAlert({
        type: 'info',
        title: 'Upload de documents',
        message: 'L\'upload de documents nécessite une connexion réseau. Veuillez vous connecter et réessayer.',
      }).catch(console.error);
      return;
    }

    openModalWithFileSelection({
      scope: 'global',
      autoLinkingContext: {},
      onSuccess: () => {
        if (mode === 'app-shell') {
          // ⚠️ Après upload en app-shell online : pull immédiat pour récupérer les documents créés
          if (isOnline && organizationId) {
            getGlobalSyncService()
              .syncEntityFromRemoteByName('document', organizationId)
              .then(() => getGlobalSyncService().syncEntityFromRemoteByName('documentLink', organizationId))
              .then(() => {
                window.dispatchEvent(new CustomEvent('sync:refresh'));
                window.dispatchEvent(new CustomEvent('documents:refresh'));
              })
              .catch((error) => {
                console.warn('[DocumentsPageCore] Erreur lors du pull après upload:', error);
                // Ne pas bloquer, les documents apparaîtront après la prochaine sync
                window.dispatchEvent(new CustomEvent('documents:refresh'));
              });
          } else {
            window.dispatchEvent(new CustomEvent('documents:refresh'));
          }
        } else {
          // Recharger les documents
          setPagination(prev => ({ ...prev, offset: 0 }));
        }
      }
    });
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
    }, 500);

    return () => clearTimeout(timer);
  }, [filters.query, submittedFilters.query]);

  const handleResetFilters = () => {
    const resetFilters: DocumentsFilters = {
      query: '',
      type: '',
      scope: '',
      status: '',
      linkedTo: '',
      dateFrom: '',
      dateTo: '',
      includeDeleted: false,
      filterFavorites: false,
    };
    setFilters(resetFilters);
    setSubmittedFilters(resetFilters);
    setFilterFavoritesOnly(false);
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
          newFilters.type = '';
        } else if (filterValue === 'ocrFailed') {
          newFilters.status = 'ocr_failed';
        } else if (filterValue === 'draft') {
          newFilters.status = 'draft';
        }
        break;
      case 'orphan':
        newFilters.status = 'orphan';
        break;
      case 'total':
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
    const confirmed = await showConfirm({
      title: 'Supprimer les documents',
      message: `Supprimer ${selectedIds.size} document(s) ?`,
    });

    if (!confirmed || !organizationId) return;

    try {
      // ⚠️ Utiliser DocumentService (créera pendingOps en mode app-shell)
      const documentService = createDocumentServiceWithMode(mode);
      
      const deletePromises = Array.from(selectedIds).map(id =>
        documentService.deleteDocument(id, organizationId)
      );
      
      await Promise.all(deletePromises);

      // ✅ En mode app-shell online : sync asynchrone en arrière-plan (non bloquant)
      const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
      if (mode === 'app-shell' && isOnline) {
        // ✅ Sync en arrière-plan sans bloquer l'UI
        getGlobalSyncService()
          .syncAllPendingToRemote(organizationId)
          .then(() => {
            // Pull immédiat pour mettre à jour IndexedDB
            return Promise.all([
              getGlobalSyncService().syncEntityFromRemoteByName('document', organizationId),
              getGlobalSyncService().syncEntityFromRemoteByName('documentLink', organizationId)
            ]);
          })
          .then(() => {
            window.dispatchEvent(new CustomEvent('sync:refresh'));
          })
          .catch((syncError) => {
            console.warn('[DocumentsPageCore] Erreur lors du sync après suppression multiple:', syncError);
            // Ne pas bloquer l'opération si la sync échoue
          });
      }

      await showAlert({
        type: 'success',
        title: 'Documents supprimés',
        message: mode === 'app-shell' && !isOnline
          ? `${selectedIds.size} document(s) supprimé(s) localement. Ils seront synchronisés avec le serveur dès que la connexion sera rétablie.`
          : `${selectedIds.size} document(s) supprimé(s)`,
      });

      setSelectedIds(new Set());
      setPagination(prev => ({ ...prev, offset: 0 }));
      
      // Refresh UI
      if (mode === 'app-shell') {
        window.dispatchEvent(new CustomEvent('documents:refresh'));
      }
    } catch (error: any) {
      console.error('Error deleting documents:', error);
      await showAlert({
        type: 'error',
        title: 'Erreur',
        message: error.message || 'Erreur lors de la suppression',
      });
    }
  };

  const handleBulkReclassify = async () => {
    const confirmed = await showConfirm({
      title: 'Reclasser les documents',
      message: `Reclasser ${selectedIds.size} document(s) ?`,
    });

    if (!confirmed) return;

    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

    // ⚠️ Reclassification = action server-only (nécessite OCR/classification automatique du serveur)
    if (!isOnline) {
        await showAlert({
          type: 'info',
          title: 'Reclassification',
          message: 'La reclassification nécessite une connexion réseau. Veuillez vous connecter et réessayer.',
        });
        return;
      }

    try {
      // Appeler l'API serveur pour chaque document
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/documents/${id}/classify`, { method: 'POST' })
        )
      );

      // ✅ En mode app-shell online : pull asynchrone en arrière-plan (non bloquant)
      if (mode === 'app-shell' && organizationId) {
        // ✅ Pull en arrière-plan sans bloquer l'UI
        getGlobalSyncService()
          .syncEntityFromRemoteByName('document', organizationId)
          .then(() => {
            window.dispatchEvent(new CustomEvent('sync:refresh'));
            window.dispatchEvent(new CustomEvent('documents:refresh'));
          })
          .catch((syncError) => {
            console.warn('[DocumentsPageCore] Erreur lors du pull après reclassification:', syncError);
            // Ne pas bloquer, les documents apparaîtront après la prochaine sync
            window.dispatchEvent(new CustomEvent('documents:refresh'));
          });
      }

      await showAlert({
        type: 'success',
        title: 'Reclassification lancée',
        message: 'Reclassification lancée avec succès',
      });

      setSelectedIds(new Set());
      if (mode === 'app-shell') {
        window.dispatchEvent(new CustomEvent('documents:refresh'));
      } else {
      setPagination(prev => ({ ...prev, offset: 0 }));
      }
    } catch (error) {
      console.error('Error reclassifying documents:', error);
      await showAlert({
        type: 'error',
        title: 'Erreur',
        message: 'Erreur lors de la reclassification',
      });
    }
  };

  const handleBulkRelink = () => {
    if (selectedIds.size === 0) {
      showAlert({
        type: 'info',
        title: 'Aucun document sélectionné',
        message: 'Veuillez sélectionner au moins un document avant de le relier.',
      }).catch(console.error);
      return;
    }
    setShowLinkSelector(true);
  };
  
  // ✅ Handler pour lier un document sans sélection préalable
  const handleLinkDocument = () => {
    setShowLinkSelector(true);
  };

  const handleLinkSelected = async (linkedTo: string, linkedIds?: string[]) => {
    if (!organizationId) {
      await showAlert({
        type: 'error',
        title: 'Erreur',
        message: 'OrganizationId manquant',
      });
      return;
    }

    try {
      // ⚠️ Utiliser DocumentService pour créer/supprimer les liens
      const documentService = createDocumentServiceWithMode(mode);
      
      // Convertir linkedTo vers le format attendu par le service
      const linkedTypeMap: Record<string, 'property' | 'lease' | 'transaction' | 'tenant' | 'loan' | 'global'> = {
        property: 'property',
        lease: 'lease',
        transaction: 'transaction',
        tenant: 'tenant',
        loan: 'loan',
        global: 'global',
      };
      const linkedType = linkedTypeMap[linkedTo] || 'global';

      // ✅ Si aucun document sélectionné, permettre de sélectionner un document dans la liste
      const documentsToLink = selectedIds.size > 0 
        ? Array.from(selectedIds)
        : []; // Si aucun document sélectionné, on ne peut pas créer de lien
      
      if (documentsToLink.length === 0) {
        await showAlert({
          type: 'info',
          title: 'Aucun document sélectionné',
          message: 'Veuillez sélectionner au moins un document dans la liste avant de le relier.',
        });
        return;
      }

      // ✅ Fermer la modal AVANT de créer/supprimer les liens pour voir la modal d'acquittement
      setShowLinkSelector(false);

      // ✅ Récupérer les liens existants pour chaque document pour calculer les différences
      const db = await getLocalDB();
      const allLinks = await db.DocumentLink.toArray();
      
      const linkPromises: Promise<any>[] = [];
      
      if (linkedType === 'global') {
        // Lien global : un seul lien par document
        for (const documentId of documentsToLink) {
          // Vérifier si un lien global existe déjà
          const existingGlobalLink = allLinks.find(
            link => link.documentId === documentId && 
            link.linkedType?.toLowerCase() === 'global'
          );
          
          if (!existingGlobalLink) {
            // Créer le lien global s'il n'existe pas
            linkPromises.push(
              documentService.linkDocument(
                {
                  documentId,
                  linkedType,
                  linkedId: null,
                },
                organizationId
              )
            );
          }
          // Si le lien existe déjà, ne rien faire (pas de déliage pour global)
        }
      } else {
        // Lien spécifique : gérer création et suppression
        const selectedEntityIdsSet = new Set(linkedIds || []);
        
        for (const documentId of documentsToLink) {
          // Récupérer les liens existants pour ce document et ce type
          const existingLinksForDoc = allLinks.filter(
            link => link.documentId === documentId && 
            link.linkedType?.toLowerCase() === linkedType &&
            link.linkedId && link.linkedId !== 'global'
          );
          
          const existingEntityIds = new Set(existingLinksForDoc.map(link => link.linkedId));
          
          // ✅ Calculer les différences
          // Entités à lier (nouvelles)
          const toLink = Array.from(selectedEntityIdsSet).filter(id => !existingEntityIds.has(id));
          // Entités à délier (décochées)
          const toUnlink = Array.from(existingEntityIds).filter(id => !selectedEntityIdsSet.has(id));
          
          // Créer les nouveaux liens
          for (const linkedId of toLink) {
            linkPromises.push(
              documentService.linkDocument(
                {
                  documentId,
                  linkedType,
                  linkedId,
                },
                organizationId
              )
            );
          }
          
          // Supprimer les liens décochés
          for (const linkedId of toUnlink) {
            linkPromises.push(
              documentService.unlinkDocument(
                {
                  documentId,
                  linkedType,
                  linkedId,
                },
                organizationId
              )
            );
          }
        }
      }
      
      await Promise.all(linkPromises);

      // ✅ En mode app-shell online : sync asynchrone en arrière-plan (non bloquant)
      const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
      if (mode === 'app-shell' && isOnline) {
        // ✅ Sync en arrière-plan sans bloquer l'UI
        getGlobalSyncService()
          .syncAllPendingToRemote(organizationId)
          .then(() => {
            // Pull immédiat pour mettre à jour IndexedDB (les liens sont créés côté serveur)
            return getGlobalSyncService().syncEntityFromRemoteByName('documentLink', organizationId);
          })
          .then(() => {
            window.dispatchEvent(new CustomEvent('sync:refresh'));
          })
          .catch((syncError) => {
            console.warn('[DocumentsPageCore] Erreur lors du sync après liaison:', syncError);
            // Ne pas bloquer l'opération si la sync échoue
          });
      }

      await showAlert({
        type: 'success',
        title: 'Documents reliés',
        message: mode === 'app-shell' && !isOnline
          ? 'Documents reliés localement. Ils seront synchronisés avec le serveur dès que la connexion sera rétablie.'
          : 'Documents reliés avec succès',
      });

      setSelectedIds(new Set());
      
      // Refresh UI
      if (mode === 'app-shell') {
        window.dispatchEvent(new CustomEvent('documents:refresh'));
      } else {
        setPagination(prev => ({ ...prev, offset: 0 }));
      }
    } catch (error: any) {
      console.error('Error relinking documents:', error);
      await showAlert({
        type: 'error',
        title: 'Erreur',
        message: error.message || 'Erreur lors de la reliaison',
      });
    }
  };

  const handleViewDocument = (doc: DocRow) => {
    setSelectedDocument(doc);
    setIsDrawerOpen(true);
  };

  const handleDownload = (doc: DocRow) => {
    window.open(`/api/documents/${doc.id}/file`, '_blank');
  };

  const handleEdit = (doc: DocRow) => {
    setDocumentToEdit(doc);
    setShowEditModal(true);
  };

  const handleDelete = async (doc: DocRow) => {
    setDocumentToDelete(doc);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirmed = async () => {
    if (!documentToDelete || !organizationId) {
      setDocumentToDelete(null);
      setDeleteModalOpen(false);
      setIsDeletingDocument(false);
      return;
    }

    const docToDelete = documentToDelete;
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;

    // ✅ NE PAS FERMER LA MODALE - afficher le loader dans la modale
    setIsDeletingDocument(true);

    try {
      // ⚠️ Utiliser DocumentService (créera pendingOps en mode app-shell)
      const documentService = createDocumentServiceWithMode(mode);
      
      await documentService.deleteDocument(docToDelete.id, organizationId);

      // ⚠️ En mode app-shell online : push → pull → refresh (règle transversale)
      if (mode === 'app-shell' && isOnline) {
        try {
          const syncService = getGlobalSyncService();
          await syncService.syncAllPendingToRemote(organizationId);
          // Pull immédiat pour mettre à jour IndexedDB
          await syncService.syncEntityFromRemoteByName('document', organizationId);
          await syncService.syncEntityFromRemoteByName('documentLink', organizationId);
          window.dispatchEvent(new CustomEvent('sync:refresh'));
        } catch (syncError) {
          console.warn('[DocumentsPageCore] Erreur lors du sync après suppression:', syncError);
          // Ne pas bloquer l'opération si la sync échoue
        }
      }

      // ✅ FERMER LA MODALE après succès
      setDeleteModalOpen(false);
      setDocumentToDelete(null);
      setIsDeletingDocument(false);

      // ✅ Alertes après (non bloquant, pattern REX)
      showAlert({
        type: 'success',
        title: 'Document supprimé',
        message: mode === 'app-shell' && !isOnline
          ? 'Le document a été supprimé localement et sera synchronisé avec le serveur dès que la connexion sera rétablie.'
          : 'Document supprimé avec succès',
      }).catch(console.error);

      // Refresh UI
      if (mode === 'app-shell') {
        window.dispatchEvent(new CustomEvent('documents:refresh'));
      } else {
        setPagination(prev => ({ ...prev, offset: 0 }));
      }
    } catch (error: any) {
      console.error('Error deleting document:', error);
      // ✅ FERMER LA MODALE même en cas d'erreur
      setDeleteModalOpen(false);
      setDocumentToDelete(null);
      setIsDeletingDocument(false);
      
      showAlert({
        type: 'error',
        title: 'Erreur',
        message: error.message || 'Erreur lors de la suppression',
      }).catch(console.error);
    }
  };

  const handlePurgeDrafts = async (force: boolean = false) => {
    // ⚠️ Purge = ONLINE ONLY (action server-only)
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
    
    if (!isOnline) {
      await showAlert({
        type: 'info',
        title: 'Purge des brouillons',
        message: 'La purge des brouillons nécessite une connexion réseau. Veuillez vous connecter et réessayer.',
      });
      return;
    }

    try {
      // ✅ Utiliser DocumentService pour prévisualiser les statistiques
      const documentService = createDocumentServiceWithMode(mode);
      const statsData = await documentService.previewPurgeDrafts();
      
      if (statsData.success) {
        const { totalDrafts, orphanedDrafts, activeDrafts } = statsData.data;
        
        let confirmMessage = '';
        if (force) {
          confirmMessage = `Êtes-vous sûr de vouloir purger TOUS les ${totalDrafts} document(s) brouillon(s) ?\n\n⚠️ Cela inclut:\n- ${orphanedDrafts} document(s) orphelin(s)\n- ${activeDrafts} document(s) avec session active\n\nCette action est IRRÉVERSIBLE.`;
        } else {
          if (orphanedDrafts === 0) {
            await showAlert({
              type: 'info',
              title: 'Aucun brouillon orphelin',
              message: 'Aucun document brouillon orphelin à purger.\n\nUtilisez "Purger TOUT" pour supprimer tous les brouillons (y compris ceux avec session active).',
            });
            return;
          }
          confirmMessage = `Êtes-vous sûr de vouloir purger les ${orphanedDrafts} document(s) brouillon orphelin(s) ?\n\n(Les ${activeDrafts} document(s) avec session active seront conservés)\n\nCette action est irréversible.`;
        }
        
        const confirmed = await showConfirm({
          title: 'Purger les brouillons',
          message: confirmMessage,
        });

        if (!confirmed) return;
      }
    } catch (error) {
      console.error('Error fetching draft stats:', error);
      const confirmed = await showConfirm({
        title: 'Purger les brouillons',
        message: `Êtes-vous sûr de vouloir purger les documents brouillons${force ? ' (TOUS)' : ' orphelins'} ? Cette action est irréversible.`,
      });
      if (!confirmed) return;
    }

    try {
      // ✅ Utiliser DocumentService pour purger (action server-only, pas de pendingOp)
      const documentService = createDocumentServiceWithMode(mode);
      const result = await documentService.purgeDrafts({ force });

      // ✅ Afficher l'alerte de succès immédiatement (non bloquant)
        await showAlert({
          type: 'success',
          title: 'Purge terminée',
          message: `Purge terminée: ${result.results.deleted} document(s) supprimé(s), ${result.results.errors} erreur(s)`,
        });

      // ⚠️ En mode app-shell online : pull en arrière-plan pour mettre à jour IndexedDB (non bloquant)
      if (mode === 'app-shell' && organizationId) {
        // Ne pas attendre le pull - l'exécuter en arrière-plan
        const syncService = getGlobalSyncService();
        Promise.all([
          syncService.syncEntityFromRemoteByName('document', organizationId),
          syncService.syncEntityFromRemoteByName('documentLink', organizationId),
        ]).then(() => {
          // Émettre les events après le pull (en arrière-plan)
          window.dispatchEvent(new CustomEvent('sync:refresh'));
          window.dispatchEvent(new CustomEvent('documents:refresh'));
        }).catch((pullError) => {
          console.warn('[DocumentsPageCore] Erreur lors du pull après purge brouillons:', pullError);
          // Émettre quand même un refresh pour l'UI
          window.dispatchEvent(new CustomEvent('documents:refresh'));
        });
      } else {
        // Mode normal : juste rafraîchir la pagination
        setPagination(prev => ({ ...prev, offset: 0 }));
      }
    } catch (error: any) {
      console.error('Error purging drafts:', error);
      await showAlert({
        type: 'error',
        title: 'Erreur',
        message: error.message || 'Erreur lors de la purge des documents brouillons',
      });
    }
  };

  const handlePurgeOrphans = async () => {
    // ⚠️ Purge = ONLINE ONLY (action server-only)
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine;
    
    if (!isOnline) {
      await showAlert({
        type: 'info',
        title: 'Purge des orphelins',
        message: 'La purge des orphelins nécessite une connexion réseau. Veuillez vous connecter et réessayer.',
      });
      return;
    }

    try {
      // ✅ Utiliser DocumentService pour prévisualiser les orphelins
      const documentService = createDocumentServiceWithMode(mode);
      const dryRunData = await documentService.previewPurgeOrphans();

      if (dryRunData.count === 0) {
        await showAlert({
          type: 'info',
          title: 'Aucun orphelin',
          message: 'Aucun document orphelin à supprimer.',
        });
        return;
      }

      const confirmMessage = `Êtes-vous sûr de vouloir supprimer les ${dryRunData.count} document(s) orphelin(s) ?\n\n⚠️ Ces documents n'ont aucune liaison et seront supprimés définitivement.\n\nCette action est IRRÉVERSIBLE.`;
      
      const confirmed = await showConfirm({
        title: 'Supprimer les orphelins',
        message: confirmMessage,
      });

      if (!confirmed) return;

      // ✅ Utiliser DocumentService pour purger (action server-only, pas de pendingOp)
      const result = await documentService.purgeOrphans();

      // ✅ Afficher l'alerte de succès immédiatement (non bloquant)
        await showAlert({
          type: 'success',
          title: 'Nettoyage terminé',
          message: `Nettoyage terminé: ${result.results.deleted} document(s) orphelin(s) supprimé(s), ${result.results.errors} erreur(s)`,
        });

      // ⚠️ En mode app-shell online : pull en arrière-plan pour mettre à jour IndexedDB (non bloquant)
      if (mode === 'app-shell' && organizationId) {
        // Ne pas attendre le pull - l'exécuter en arrière-plan
        const syncService = getGlobalSyncService();
        Promise.all([
          syncService.syncEntityFromRemoteByName('document', organizationId),
          syncService.syncEntityFromRemoteByName('documentLink', organizationId),
        ]).then(() => {
          // Émettre les events après le pull (en arrière-plan)
          window.dispatchEvent(new CustomEvent('sync:refresh'));
          window.dispatchEvent(new CustomEvent('documents:refresh'));
        }).catch((pullError) => {
          console.warn('[DocumentsPageCore] Erreur lors du pull après purge orphelins:', pullError);
          // Émettre quand même un refresh pour l'UI
          window.dispatchEvent(new CustomEvent('documents:refresh'));
        });
      } else {
        // Mode normal : juste rafraîchir la pagination
        setPagination(prev => ({ ...prev, offset: 0 }));
      }
    } catch (error: any) {
      console.error('Error purging orphans:', error);
      await showAlert({
        type: 'error',
        title: 'Erreur',
        message: error.message || 'Erreur lors de la suppression des documents orphelins',
      });
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
    filterFavoritesOnly,
  ].filter(Boolean).length;

  // États de chargement et erreur
  if (loading && documents.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
        <span className="ml-3 text-gray-600">Chargement des documents...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="text-center text-red-600">
            <p className="font-medium">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Rendu principal
  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Header - Identique à TransactionsPageCore */}
      <div className="mb-4 sm:mb-6 space-y-3">
        {/* Ligne 1 : Hamburger + Titre + Bouton "+" */}
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {/* Bouton hamburger mobile - Discret, aligné à gauche du titre */}
            {sidebarContext && (
              <button
                onClick={sidebarContext.toggleSidebar}
                className="lg:hidden flex items-center justify-center w-10 h-10 min-w-[40px] min-h-[40px] flex-shrink-0 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                aria-label={sidebarContext.sidebarOpen ? "Fermer le menu" : "Ouvrir le menu"}
              >
                {sidebarContext.sidebarOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            )}
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate min-w-0">Documents</h1>
            <div className="flex-shrink-0 flex items-center gap-2">
              {/* ✅ OFFLINE-FIRST: Bouton "Lier un document existant" - fonctionne en offline */}
              <button
                onClick={handleLinkDocument}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 h-8 text-xs sm:text-sm text-blue-600 border border-blue-200 rounded-lg bg-white hover:bg-blue-50 transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="Lier un document existant"
                title="Lier un document existant (fonctionne hors ligne)"
              >
                <LinkIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Lier</span>
              </button>
              {/* Bouton "Uploader" - désactivé en offline */}
              <button
                onClick={handleUploadClick}
                className="inline-flex items-center justify-center h-8 w-8 text-orange-600 border border-orange-200 rounded-lg bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Uploader un document"
                disabled={typeof navigator !== 'undefined' && !navigator.onLine}
                title={typeof navigator !== 'undefined' && !navigator.onLine ? 'L\'upload de documents nécessite une connexion internet' : 'Uploader un document'}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Ligne 2 : Description + Actions supplémentaires */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <p className="text-sm sm:text-base text-gray-600">
              {pagination.total} document{pagination.total > 1 ? 's' : ''} au total
            </p>
            <Link
              href="/documents/rapport-gestionnaire"
              className="text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
            >
              Rapport gestionnaire →
            </Link>
          </div>
          <div className="flex gap-2">
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
      </div>

      {/* Cartes de statistiques */}
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
              <button
                type="button"
                onClick={() => {
                  setFilterFavoritesOnly((prev) => !prev);
                  setPagination((p) => ({ ...p, offset: 0 }));
                }}
                className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                title={filterFavoritesOnly ? 'Afficher tous les documents' : 'Afficher uniquement les favoris'}
              >
                {filterFavoritesOnly ? (
                  <Star className="h-5 w-5 fill-amber-400 text-amber-500 animate-pulse" />
                ) : (
                  <Star className="h-5 w-5 text-gray-400 hover:text-amber-500" />
                )}
              </button>
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
                placeholder="Rechercher par nom, texte, tags, type..."
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
                  <SmartSelect
                    value={filters.type}
                    onChange={(value) => setFilters({ ...filters, type: value })}
                    options={[
                      { value: '', label: 'Tous les types' },
                      ...(Array.isArray(documentTypes) ? documentTypes.map((type) => ({
                        value: type.code,
                        label: type.label
                      })) : [])
                    ]}
                    placeholder="Sélectionner un type"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Scope
                  </label>
                  <SmartSelect
                    value={filters.scope}
                    onChange={(value) => setFilters({ ...filters, scope: value })}
                    options={[
                      { value: '', label: 'Tous' },
                      { value: 'global', label: 'Global' },
                      { value: 'property', label: 'Biens' },
                      { value: 'lease', label: 'Baux' },
                      { value: 'transaction', label: 'Transactions' }
                    ]}
                    placeholder="Sélectionner un scope"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Statut
                  </label>
                  <SmartSelect
                    value={filters.status}
                    onChange={(value) => setFilters({ ...filters, status: value })}
                    options={[
                      { value: '', label: 'Tous' },
                      { value: 'pending', label: 'En attente' },
                      { value: 'classified', label: 'Classé' },
                      { value: 'draft', label: 'Brouillons' },
                      { value: 'rejected', label: 'Rejeté' },
                      { value: 'archived', label: 'Archivé' }
                    ]}
                    placeholder="Sélectionner un statut"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date début
                  </label>
                  <SmartDatePicker
                    value={filters.dateFrom}
                    onChange={(value) => setFilters({ ...filters, dateFrom: value })}
                    placeholder="jj/mm/aaaa"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date fin
                  </label>
                  <SmartDatePicker
                    value={filters.dateTo}
                    onChange={(value) => setFilters({ ...filters, dateTo: value })}
                    placeholder="jj/mm/aaaa"
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
            onToggleFavorite={(doc, isFavorite) => updateDocumentFavorite(doc.id, isFavorite)}
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
            showFavorite={true}
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
          mode={mode}
          organizationId={organizationId || undefined}
          onClose={() => {
            setShowEditModal(false);
            setDocumentToEdit(null);
          }}
          onUpdate={() => {
            if (mode === 'app-shell') {
              window.dispatchEvent(new CustomEvent('documents:refresh'));
            }
            setPagination(prev => ({ ...prev, offset: 0 }));
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
              <DialogTitle>
                {selectedIds.size > 0 
                  ? `Relier ${selectedIds.size} document${selectedIds.size > 1 ? 's' : ''} sélectionné${selectedIds.size > 1 ? 's' : ''}`
                  : 'Lier un document existant'
                }
              </DialogTitle>
            </DialogHeader>
            {selectedIds.size === 0 && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>💡 Astuce :</strong> Sélectionnez un ou plusieurs documents dans la liste ci-dessous, puis fermez cette modal et cliquez à nouveau sur "Lier" pour les relier.
                </p>
              </div>
            )}
            <DocumentLinkSelector
              mode={mode}
              documentIds={Array.from(selectedIds)}
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
            setIsDeletingDocument(false);
          }}
          onConfirm={handleDeleteConfirmed}
          documentId={documentToDelete.id}
          documentName={documentToDelete.filenameOriginal}
          mode={mode}
          organizationId={organizationId || undefined}
          isDeleting={isDeletingDocument}
        />
      )}
    </div>
  );
}
