/**
 * Hook unifié pour charger les données des documents
 * Fonctionne en mode "normal" (online avec fallback offline) et "app-shell" (offline-first)
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getLocalDB } from '@/lib/offline/db';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import type { LocalDocument } from '@/lib/offline/db';

export interface DocumentTableRow {
  id: string;
  filenameOriginal: string;
  fileName: string;
  mime: string;
  size: number;
  url: string;
  documentTypeId?: string;
  detectedTypeId?: string;
  ocrStatus: string;
  status: string;
  source: string;
  uploadedAt: string;
  tags?: string;
  linkedTo?: string;
  linkedId?: string;
  propertyId?: string;
  transactionId?: string;
  leaseId?: string;
  loanId?: string;
  tenantId?: string;
  DocumentType?: {
    id: string;
    code: string;
    label: string;
  };
  property?: {
    id: string;
    name: string;
  };
  transaction?: {
    id: string;
    label: string;
  };
  lease?: {
    id: string;
    Property: {
      name: string;
    };
    Tenant: {
      firstName: string;
      lastName: string;
    };
  };
  tenant?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface DocumentsFilters {
  query: string;
  type: string;
  scope: string;
  status: string;
  linkedTo: string;
  dateFrom: string;
  dateTo: string;
  includeDeleted: boolean;
}

export interface DocumentsStats {
  total: number;
  pending: number;
  classified: number;
  ocrFailed: number;
  drafts: number;
  orphans: number;
}

export interface UseDocumentsDataOptions {
  mode: 'normal' | 'app-shell';
  filters?: DocumentsFilters;
  offset?: number;
  limit?: number;
  propertyId?: string; // ✅ Optionnel : pour filtrer les events par propertyId
}

export function useDocumentsData(options: UseDocumentsDataOptions) {
  const { mode, filters: filtersProp, offset = 0, limit = 50, propertyId } = options;
  const { organizationId } = useCurrentOrganization();
  const router = mode === 'normal' ? useRouter() : null;
  const searchParams = mode === 'normal' ? useSearchParams() : null;

  // ✅ Mémoriser filtersProp pour éviter les re-renders causés par changement de référence
  // ⚠️ CRITIQUE: filtersProp est un objet qui change de référence à chaque render si passé inline
  const filters = useMemo(() => filtersProp || {
    query: '',
    type: '',
    scope: '',
    status: '',
    linkedTo: '',
    dateFrom: '',
    dateTo: '',
    includeDeleted: false,
  }, [
    filtersProp?.query,
    filtersProp?.type,
    filtersProp?.scope,
    filtersProp?.status,
    filtersProp?.linkedTo,
    filtersProp?.dateFrom,
    filtersProp?.dateTo,
    filtersProp?.includeDeleted,
  ]);

  const [documents, setDocuments] = useState<LocalDocument[]>([]);
  const [stats, setStats] = useState<DocumentsStats>({
    total: 0,
    pending: 0,
    classified: 0,
    ocrFailed: 0,
    drafts: 0,
    orphans: 0,
  });
  const [loading, setLoading] = useState(mode === 'app-shell');
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pagination, setPagination] = useState({
    offset,
    limit,
    total: 0,
    hasMore: false,
  });

  // Charger les données selon le mode
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      if (mode === 'app-shell') {
        // Mode app-shell : charger UNIQUEMENT depuis IndexedDB
        if (!organizationId) {
          setError('OrganizationId requis');
          setLoading(false);
          return;
        }

        try {
          setLoading(true);
          setError(null);

          const db = await getLocalDB();
          let query = db.Document.where('organizationId').equals(organizationId);

          // ✅ CRITIQUE: Filtrer par propertyId si spécifié (pour PropertyDocumentsClient)
          // Les documents sont liés aux propriétés via DocumentLink, pas directement via propertyId
          let documentIdsForProperty: Set<string> | null = null;
          if (propertyId) {
            // Charger les DocumentLink pour ce propertyId
            // Note: linkedType peut être en minuscules ou majuscules dans IndexedDB
            // Utiliser filter() au lieu de where() pour l'index composite si nécessaire
            let propertyLinks: any[] = [];
            try {
              // Essayer avec l'index composite
              propertyLinks = await db.DocumentLink
                .where('[linkedType+linkedId]')
                .equals(['property', propertyId])
                .toArray();
            } catch (err) {
              // Fallback: utiliser filter() si l'index composite ne fonctionne pas
              const allLinks = await db.DocumentLink.toArray();
              propertyLinks = allLinks.filter(link => 
                link.linkedType?.toLowerCase() === 'property' && link.linkedId === propertyId
              );
            }
            
            // Aussi chercher avec 'PROPERTY' en majuscules (au cas où)
            if (propertyLinks.length === 0) {
              try {
                const propertyLinksUpper = await db.DocumentLink
                  .where('[linkedType+linkedId]')
                  .equals(['PROPERTY', propertyId])
                  .toArray();
                propertyLinks = propertyLinksUpper;
              } catch (err) {
                // Ignorer si l'index composite ne fonctionne pas
              }
            }
            
            documentIdsForProperty = new Set(propertyLinks.map(link => link.documentId));
            
            if (documentIdsForProperty.size === 0) {
              // Si aucun lien trouvé, retourner un tableau vide
              query = query.filter(() => false); // Force un résultat vide
            } else {
              // Filtrer les documents qui ont un lien vers cette propriété
              query = query.filter(doc => documentIdsForProperty!.has(doc.id));
            }
          }

          // Appliquer les filtres (déjà mémorisé)
          if (filters.query) {
            const searchLower = filters.query.toLowerCase();
            query = query.filter(doc => 
              doc.filenameOriginal.toLowerCase().includes(searchLower) ||
              doc.fileName.toLowerCase().includes(searchLower) ||
              (doc.extractedText && doc.extractedText.toLowerCase().includes(searchLower)) ||
              (doc.tags && doc.tags.toLowerCase().includes(searchLower))
            );
          }

          if (filters.type) {
            query = query.filter(doc => doc.documentTypeId === filters.type);
          }

          if (filters.scope) {
            if (filters.scope === 'property') {
              query = query.filter(doc => doc.propertyId);
            } else if (filters.scope === 'lease') {
              query = query.filter(doc => doc.leaseId);
            } else if (filters.scope === 'transaction') {
              query = query.filter(doc => doc.transactionId);
            } else if (filters.scope === 'global') {
              query = query.filter(doc => !doc.propertyId && !doc.leaseId && !doc.transactionId);
            }
          }

          // ⚠️ PROBLÈME: Le filtre "orphan" nécessite DocumentLink, on le traitera après récupération
          const isOrphanFilter = filters.status === 'orphan';
          
          if (filters.status && !isOrphanFilter) {
            if (filters.status === 'pending') {
              query = query.filter(doc => doc.status === 'pending');
            } else if (filters.status === 'active' || filters.status === 'classified') {
              query = query.filter(doc => doc.status === 'active');
            } else if (filters.status === 'draft') {
              query = query.filter(doc => doc.status === 'draft');
            } else if (filters.status === 'ocr_failed') {
              query = query.filter(doc => doc.ocrStatus === 'failed');
            }
          }

          if (filters.dateFrom) {
            const from = new Date(filters.dateFrom);
            query = query.filter(doc => new Date(doc.uploadedAt) >= from);
          }

          if (filters.dateTo) {
            const to = new Date(filters.dateTo);
            query = query.filter(doc => new Date(doc.uploadedAt) <= to);
          }

          if (!filters.includeDeleted) {
            query = query.filter(doc => !doc.deletedAt);
          }

          let allDocuments = await query.toArray();
          
          // ⚠️ PROBLÈME: Appliquer le filtre "orphan" après récupération (nécessite DocumentLink)
          if (isOrphanFilter) {
            const allLinks = await db.DocumentLink.toArray();
            const documentsWithLinks = new Set(allLinks.map(link => link.documentId));
            // Documents qui n'ont aucun lien = orphelins (comme le serveur: DocumentLink: { none: {} })
            allDocuments = allDocuments.filter(doc => !doc.deletedAt && !documentsWithLinks.has(doc.id));
          }
          
          // ✅ Trier par date de création (plus récent en premier) comme en mode normal
          allDocuments.sort((a, b) => {
            const dateA = new Date(a.createdAt || a.uploadedAt || 0).getTime();
            const dateB = new Date(b.createdAt || b.uploadedAt || 0).getTime();
            return dateB - dateA; // Descendant (plus récent en premier)
          });
          
          const total = allDocuments.length;
          
          // Paginer
          const paginatedDocuments = allDocuments.slice(offset, offset + limit);

          // Calculer les stats (utiliser tous les documents, pas seulement les filtrés)
          // Pour les stats, on doit recalculer depuis tous les documents de l'organisation
          const allOrgDocuments = await db.Document
            .where('organizationId')
            .equals(organizationId)
            .filter(doc => !filters.includeDeleted ? !doc.deletedAt : true)
            .toArray();
          
          // ✅ CORRECTION: Le total doit utiliser allOrgDocuments.length pour inclure tous les documents (y compris brouillons)
          const totalForStats = allOrgDocuments.length;
          
          // Récupérer tous les liens une seule fois pour les stats
          const allLinks = await db.DocumentLink.toArray();
          const documentsWithLinks = new Set(allLinks.map(link => link.documentId));
          
          const pending = allOrgDocuments.filter(d => d.status === 'pending').length;
          const classified = allOrgDocuments.filter(d => d.status === 'active' && d.documentTypeId).length;
          const ocrFailed = allOrgDocuments.filter(d => d.ocrStatus === 'failed').length;
          const drafts = allOrgDocuments.filter(d => d.status === 'draft').length;
          
          // ⚠️ PROBLÈME: Calculer les orphelins via DocumentLink (comme le serveur)
          // Un document est orphelin s'il n'a AUCUN DocumentLink (comme le serveur: DocumentLink: { none: {} })
          const orphans = allOrgDocuments.filter(doc => {
            // Exclure les documents supprimés
            if (doc.deletedAt) return false;
            // Vérifier via DocumentLink (comme le serveur) - document sans aucun lien = orphelin
            return !documentsWithLinks.has(doc.id);
          }).length;

          // ✅ CORRECTION: Charger DocumentType et DocumentLink pour enrichir les documents
          // Récupérer tous les types de documents nécessaires
          const documentTypeIds = new Set(
            paginatedDocuments
              .map(doc => doc.documentTypeId)
              .filter((id): id is string => id !== null && id !== undefined)
          );
          const documentTypes = documentTypeIds.size > 0
            ? await db.DocumentType.where('id').anyOf(Array.from(documentTypeIds)).toArray()
            : [];
          const documentTypeMap = new Map(documentTypes.map(dt => [dt.id, dt]));

          // Récupérer tous les liens pour les documents paginés
          const documentIds = new Set(paginatedDocuments.map(doc => doc.id));
          const documentLinksForDocs = await db.DocumentLink
            .filter(link => documentIds.has(link.documentId))
            .toArray();
          
          // ⚠️ ENRICHIR les liens avec les noms des entités liées (transaction, property, lease, etc.)
          // Récupérer les IDs uniques des entités liées
          const transactionIds = new Set<string>();
          const propertyIds = new Set<string>();
          const leaseIds = new Set<string>();
          
          documentLinksForDocs.forEach(link => {
            const linkedType = link.linkedType.toLowerCase();
            if (linkedType === 'transaction' && link.linkedId && link.linkedId !== 'global') {
              transactionIds.add(link.linkedId);
            } else if (linkedType === 'property' && link.linkedId && link.linkedId !== 'global') {
              propertyIds.add(link.linkedId);
            } else if (linkedType === 'lease' && link.linkedId && link.linkedId !== 'global') {
              leaseIds.add(link.linkedId);
            }
          });
          
          // Charger les transactions, properties et leases pour enrichir les entityName
          // ⚠️ GESTION SPÉCIALE POUR TRANSACTION : db.Transaction peut être une fonction
          let transactions: any[] = [];
          if (transactionIds.size > 0) {
            try {
              let transactionTable = (db as any).Transaction;
              if (!transactionTable || typeof transactionTable === 'function' || typeof transactionTable.where !== 'function') {
                const foundTable = db.tables.find((t: any) => t.name === 'Transaction');
                if (foundTable && typeof foundTable.where === 'function') {
                  transactionTable = foundTable;
                }
              }
              if (transactionTable && typeof transactionTable.where === 'function') {
                transactions = await transactionTable.where('id').anyOf(Array.from(transactionIds)).toArray();
              }
            } catch (err) {
              console.warn('[useDocumentsData] Erreur lors du chargement des transactions pour enrichir entityName:', err);
            }
          }
          
          const [properties, leases] = await Promise.all([
            propertyIds.size > 0
              ? db.Property.where('id').anyOf(Array.from(propertyIds)).toArray()
              : [],
            leaseIds.size > 0
              ? db.Lease.where('id').anyOf(Array.from(leaseIds)).toArray()
              : [],
          ]);
          
          const transactionMap = new Map(transactions.map(t => [t.id, t.label || `Transaction ${t.id.substring(0, 8)}`]));
          const propertyMap = new Map(properties.map(p => [p.id, p.name || `Bien ${p.id.substring(0, 8)}`]));
          const leaseMap = new Map(leases.map(l => [l.id, `Bail ${l.id.substring(0, 8)}`])); // Les baux n'ont pas de nom simple
          
          // Grouper les liens par documentId
          const linksByDocumentId = new Map<string, typeof documentLinksForDocs>();
          documentLinksForDocs.forEach(link => {
            if (!linksByDocumentId.has(link.documentId)) {
              linksByDocumentId.set(link.documentId, []);
            }
            linksByDocumentId.get(link.documentId)!.push(link);
          });

          // Enrichir les documents avec les types et liens
          const enrichedDocuments = paginatedDocuments.map(doc => {
            const docWithRelations = { ...doc } as any;
            // Ajouter DocumentType
            if (doc.documentTypeId && documentTypeMap.has(doc.documentTypeId)) {
              const docType = documentTypeMap.get(doc.documentTypeId)!;
              docWithRelations.DocumentType = {
                id: docType.id,
                label: docType.label,
                code: docType.code,
              };
            }
            // Ajouter DocumentLink avec entityName enrichi
            if (linksByDocumentId.has(doc.id)) {
              // ✅ Convertir linkedType en minuscule pour correspondre au format attendu par DocumentTable
              docWithRelations.DocumentLink = linksByDocumentId.get(doc.id)!.map(link => {
                // linkedType peut être en majuscules dans IndexedDB (PROPERTY, LEASE, etc.)
                const linkedTypeLower = link.linkedType.toLowerCase();
                
                // ⚠️ ENRICHIR entityName si manquant
                let entityName = link.entityName;
                if (!entityName && link.linkedId && link.linkedId !== 'global') {
                  if (linkedTypeLower === 'transaction') {
                    entityName = transactionMap.get(link.linkedId);
                  } else if (linkedTypeLower === 'property') {
                    entityName = propertyMap.get(link.linkedId);
                  } else if (linkedTypeLower === 'lease') {
                    entityName = leaseMap.get(link.linkedId);
                  }
                }
                
                return {
                  id: `${link.documentId}-${link.linkedType}-${link.linkedId}`,
                  linkedType: linkedTypeLower,
                  linkedId: link.linkedId,
                  entityName: entityName || undefined,
                };
              });
            }
            return docWithRelations;
          });

          if (!cancelled) {
            setDocuments(enrichedDocuments);
            setStats({
              total: totalForStats, // ✅ Utiliser totalForStats au lieu de total (qui ne compte que les documents filtrés)
              pending,
              classified,
              ocrFailed,
              drafts,
              orphans,
            });
            setPagination({
              offset,
              limit,
              total: totalForStats, // ✅ Utiliser totalForStats pour la pagination aussi
              hasMore: offset + limit < totalForStats,
            });
            setLoading(false);
          }
        } catch (e: any) {
          if (!cancelled) {
            console.error('[useDocumentsData] Erreur chargement app-shell:', e);
            setError('Impossible de charger les documents.');
            setLoading(false);
          }
        }
      } else {
        // Mode normal : charger depuis l'API
        try {
          setLoading(true);
          setError(null);

          const params = new URLSearchParams();
          // Utiliser filters (déjà mémorisé)
          if (filters.query) params.append('query', filters.query);
          if (filters.type) params.append('type', filters.type);
          if (filters.scope) params.append('scope', filters.scope);
          if (filters.status) params.append('status', filters.status);
          if (filters.linkedTo) params.append('linkedTo', filters.linkedTo);
          if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
          if (filters.dateTo) params.append('dateTo', filters.dateTo);
          if (filters.includeDeleted) params.append('includeDeleted', 'true');
          params.append('offset', offset.toString());
          params.append('limit', limit.toString());

          const [documentsResponse, statsResponse] = await Promise.all([
            fetch(`/api/documents?${params.toString()}`),
            fetch('/api/documents/stats'),
          ]);

          if (!documentsResponse.ok) {
            throw new Error('Erreur lors du chargement des documents');
          }

          const documentsData = await documentsResponse.json();
          const statsData = await statsResponse.json();

          // Charger aussi les statistiques des orphelins
          let orphans = 0;
          try {
            const orphansResponse = await fetch('/api/documents/cleanup?type=orphan&dryRun=true');
            const orphansData = await orphansResponse.json();
            if (orphansData.success) {
              orphans = orphansData.count;
            }
          } catch (orphanError) {
            console.warn('Error loading orphan stats:', orphanError);
          }

          if (!cancelled) {
            setDocuments(documentsData.documents || []);
            setStats({
              ...statsData,
              orphans,
            });
            setPagination({
              offset,
              limit,
              total: documentsData.pagination?.total || 0,
              hasMore: documentsData.pagination?.hasMore || false,
            });
            setLoading(false);
          }
        } catch (e: any) {
          if (!cancelled) {
            console.error('[useDocumentsData] Erreur chargement normal:', e);
            // En cas d'erreur, essayer de charger depuis IndexedDB
            if (organizationId) {
              try {
                const db = await getLocalDB();
                let allDocuments = await db.Document
                  .where('organizationId')
                  .equals(organizationId)
                  .toArray();
                
                // ✅ Trier par date de création (plus récent en premier) comme en mode normal
                allDocuments.sort((a, b) => {
                  const dateA = new Date(a.createdAt || a.uploadedAt || 0).getTime();
                  const dateB = new Date(b.createdAt || b.uploadedAt || 0).getTime();
                  return dateB - dateA; // Descendant (plus récent en premier)
                });
                
                const paginatedDocuments = allDocuments.slice(offset, offset + limit);
                const total = allDocuments.length;
                const pending = allDocuments.filter(d => d.status === 'pending').length;
                const classified = allDocuments.filter(d => d.status === 'active' && d.documentTypeId).length;
                const ocrFailed = allDocuments.filter(d => d.ocrStatus === 'failed').length;
                const drafts = allDocuments.filter(d => d.status === 'draft').length;
                
                // ⚠️ PROBLÈME: Calculer les orphelins via DocumentLink (comme le serveur)
                const allLinks = await db.DocumentLink.toArray();
                const documentsWithLinks = new Set(allLinks.map(link => link.documentId));
                const orphans = allDocuments.filter(doc => {
                  if (doc.deletedAt) return false;
                  return !documentsWithLinks.has(doc.id);
                }).length;

                if (!cancelled) {
                  setDocuments(paginatedDocuments);
                  setStats({
                    total,
                    pending,
                    classified,
                    ocrFailed,
                    drafts,
                    orphans,
                  });
                  setPagination({
                    offset,
                    limit,
                    total,
                    hasMore: offset + limit < total,
                  });
                  setLoading(false);
                }
              } catch (offlineError) {
                if (!cancelled) {
                  setError('Impossible de charger les documents.');
                  setLoading(false);
                }
              }
            } else {
              setError('Impossible de charger les documents.');
              setLoading(false);
            }
          }
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [mode, organizationId, filters, offset, limit, refreshKey]); // ✅ Utiliser filters (mémorisé) au lieu de filtersProp

  // ✅ RÈGLE 3: Écouter UNIQUEMENT documents:refresh (pas sync:refresh)
  // ✅ Filtrer les events par propertyId si spécifié
  // ✅ RÈGLE 9: Anti-loop - ignorer refresh identiques <300ms
  // ✅ CRITIQUE: Mémoriser handleRefresh avec useCallback pour éviter les re-attachements
  const lastRefreshRef = useRef<{ propertyId?: string; reason?: string; timestamp: number } | null>(null);
  
  const handleRefresh = useCallback((event: Event) => {
    // ✅ RÈGLE 3: Vérifier que c'est bien un event documents:refresh
    if (event.type !== 'documents:refresh') {
      return;
    }

    // ✅ RÈGLE 3: Filtrer strictement par scope et propertyId
    if (propertyId && event instanceof CustomEvent && event.detail) {
      const detail = event.detail as { scope?: string; propertyId?: string; reason?: string };
      // Ignorer les events qui ne sont pas pour cette propriété
      if (detail.scope !== 'property' || !detail.propertyId || detail.propertyId !== propertyId) {
        return;
      }

      // ✅ RÈGLE 9: Anti-loop - ignorer refresh identiques <300ms
      const now = Date.now();
      const lastRefresh = lastRefreshRef.current;
      if (lastRefresh && 
          lastRefresh.propertyId === detail.propertyId && 
          lastRefresh.reason === detail.reason &&
          (now - lastRefresh.timestamp) < 300) {
        return;
      }
      
      // Mettre à jour la référence du dernier refresh
      lastRefreshRef.current = {
        propertyId: detail.propertyId,
        reason: detail.reason,
        timestamp: now,
      };
    } else if (propertyId) {
      // Si propertyId est défini mais l'event n'a pas de detail, ignorer
      return;
    }

    setRefreshKey(prev => prev + 1);
  }, [propertyId]);

  // ✅ RÈGLE 3: Écouter UNIQUEMENT documents:refresh (pas sync:refresh)
  useEffect(() => {
    if (mode === 'app-shell') {
      window.addEventListener('documents:refresh', handleRefresh);
      return () => {
        window.removeEventListener('documents:refresh', handleRefresh);
      };
    }
  }, [mode, handleRefresh]); // ✅ handleRefresh est mémorisé avec useCallback

  // Convertir LocalDocument vers DocumentTableRow pour compatibilité
  // ✅ En mode app-shell, les documents sont déjà enrichis avec DocumentType et DocumentLink dans loadData
  const convertedDocuments: DocumentTableRow[] = useMemo(() => {
    return documents.map(doc => ({
      id: doc.id,
      filenameOriginal: doc.filenameOriginal,
      fileName: doc.fileName,
      mime: doc.mime,
      size: doc.size,
      url: doc.url,
      documentTypeId: doc.documentTypeId || undefined,
      detectedTypeId: doc.detectedTypeId || undefined,
      ocrStatus: doc.ocrStatus,
      status: doc.status,
      source: doc.source,
      uploadedAt: doc.uploadedAt,
      createdAt: doc.createdAt || doc.uploadedAt || new Date().toISOString(), // Fallback si createdAt est manquant
      tags: doc.tags || undefined,
      linkedTo: doc.linkedTo || undefined,
      linkedId: doc.linkedId || undefined,
      propertyId: doc.propertyId || undefined,
      transactionId: doc.transactionId || undefined,
      leaseId: doc.leaseId || undefined,
      loanId: doc.loanId || undefined,
      tenantId: doc.tenantId || undefined,
      // ✅ Les relations DocumentType et DocumentLink sont déjà chargées dans loadData pour app-shell
      DocumentType: (doc as any).DocumentType || undefined,
      property: undefined,
      transaction: undefined,
      lease: undefined,
      tenant: undefined,
      DocumentLink: (doc as any).DocumentLink || undefined,
    }));
  }, [documents]);

  return {
    documents: convertedDocuments,
    stats,
    pagination,
    loading,
    error,
    // Utilitaires pour le mode normal
    router: router || null,
    searchParams: searchParams || null,
  };
}
