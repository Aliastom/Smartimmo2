'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Search, Building2, FileText, CreditCard, Users, Globe } from 'lucide-react';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { getLocalDB } from '@/lib/offline/db';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';
import { getLeaseRepositoryOffline } from '@/lib/offline/repositories/LeaseRepositoryOffline';
import { getTransactionRepositoryOffline } from '@/lib/offline/repositories/TransactionRepositoryOffline';
import { getTenantRepositoryOffline } from '@/lib/offline/repositories/TenantRepositoryOffline';

interface DocumentLinkSelectorProps {
  currentLinkedTo?: 'global' | 'property' | 'lease' | 'transaction' | 'loan' | 'tenant';
  currentLinkedId?: string;
  onSelect: (linkedTo: 'global' | 'property' | 'lease' | 'transaction' | 'loan' | 'tenant', linkedIds?: string[]) => void;
  onCancel?: () => void;
  mode?: 'normal' | 'app-shell';
  documentIds?: string[]; // IDs des documents à lier (pour afficher les liens existants)
}

export function DocumentLinkSelector({
  currentLinkedTo = 'global',
  currentLinkedId,
  onSelect,
  onCancel,
  mode = 'normal',
  documentIds = [],
}: DocumentLinkSelectorProps) {
  const [selectedType, setSelectedType] = useState<'global' | 'property' | 'lease' | 'transaction' | 'loan' | 'tenant'>(currentLinkedTo);
  const [searchQuery, setSearchQuery] = useState('');
  const [entities, setEntities] = useState<any[]>([]);
  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<string>>(new Set(currentLinkedId ? [currentLinkedId] : []));
  const [existingLinks, setExistingLinks] = useState<Set<string>>(new Set()); // IDs des entités liées à TOUS les documents
  const [partialLinks, setPartialLinks] = useState<Map<string, number>>(new Map()); // entityId -> nombre de documents liés (pour les liens partiels)
  const [loading, setLoading] = useState(false);
  const [showMoreEntities, setShowMoreEntities] = useState(false);
  const ENTITY_LIST_INITIAL = 5;
  const { organizationId } = useCurrentOrganization();
  
  // ✅ OFFLINE-FIRST: Détecter le mode app-shell/offline
  const isAppShell = mode === 'app-shell' || (typeof window !== 'undefined' && window.location.pathname.startsWith('/app'));
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  const shouldUseLocalData = isAppShell || isOffline;

  const linkTypes = [
    { value: 'global', label: 'Global', icon: Globe },
    { value: 'property', label: 'Bien', icon: Building2 },
    { value: 'lease', label: 'Bail', icon: FileText },
    { value: 'transaction', label: 'Transaction', icon: CreditCard },
    { value: 'tenant', label: 'Locataire', icon: Users },
  ];

  // ✅ Charger les liens existants pour les documents sélectionnés
  const loadExistingLinks = useCallback(async () => {
    if (!organizationId || documentIds.length === 0 || selectedType === 'global') {
      setExistingLinks(new Set());
      return;
    }
    
    try {
      const linkedType = selectedType.toLowerCase();
      let relevantLinks: any[] = [];
      
      if (shouldUseLocalData) {
        // Mode app-shell/offline : charger depuis IndexedDB
        const db = await getLocalDB();
        const allLinks = await db.DocumentLink.toArray();
        console.log('[DocumentLinkSelector] 🔍 Chargement des liens existants:', {
          totalLinks: allLinks.length,
          documentIds,
          linkedType,
          organizationId
        });
        
        // ✅ Étape 1 : Filtrer les liens par documentId et linkedType
        const linksForDocuments = allLinks.filter(link => {
          const matchesDocument = documentIds.includes(link.documentId);
          const linkTypeLower = (link.linkedType || '').toLowerCase();
          const matchesType = linkTypeLower === linkedType;
          const hasLinkedId = !!link.linkedId && link.linkedId !== 'global';
          return matchesDocument && matchesType && hasLinkedId;
        });
        
        console.log('[DocumentLinkSelector] 🔍 Liens filtrés par document/type:', {
          totalLinksForDocument: linksForDocuments.length,
          sampleLinks: linksForDocuments.slice(0, 5).map(link => ({
            documentId: link.documentId,
            linkedType: link.linkedType,
            linkedId: link.linkedId
          }))
        });
        
        // ✅ Étape 2 : Récupérer les documents pour vérifier leur organizationId
        const documentIdsToCheck = new Set(linksForDocuments.map(link => link.documentId));
        const documents = await db.Document
          .where('id')
          .anyOf(Array.from(documentIdsToCheck))
          .toArray();
        
        // ✅ Étape 3 : Créer un Map pour accès rapide documentId -> organizationId
        const documentOrgMap = new Map(
          documents.map(doc => [doc.id, doc.organizationId])
        );
        
        // ✅ Étape 4 : Filtrer les liens dont le document appartient à la bonne organisation
        relevantLinks = linksForDocuments.filter(link => {
          const docOrgId = documentOrgMap.get(link.documentId);
          const matchesOrg = docOrgId === organizationId;
          
          // ✅ Debug détaillé
          console.log('[DocumentLinkSelector] 🔍 Lien analysé:', {
            documentId: link.documentId,
            linkedType: link.linkedType,
            linkedId: link.linkedId,
            docOrganizationId: docOrgId,
            expectedOrganizationId: organizationId,
            matchesOrg
          });
          
          if (matchesOrg) {
            console.log('[DocumentLinkSelector] ✅ Lien VALIDÉ:', {
              documentId: link.documentId,
              linkedType: link.linkedType,
              linkedId: link.linkedId
            });
          } else {
            console.log('[DocumentLinkSelector] ❌ Lien REJETÉ:', {
              documentId: link.documentId,
              reason: 'OrganizationId du document ne correspond pas',
              docOrgId,
              expectedOrgId: organizationId
            });
          }
          
          return matchesOrg;
        });
        
        console.log('[DocumentLinkSelector] 📊 Liens pertinents trouvés:', relevantLinks.length);
      } else {
        // Mode normal : charger depuis l'API
        try {
          const response = await fetch(`/api/documents/links?documentIds=${documentIds.join(',')}&linkedType=${linkedType}`);
          if (response.ok) {
            const data = await response.json();
            relevantLinks = Array.isArray(data.links) ? data.links : [];
          }
        } catch (apiError) {
          console.warn('[DocumentLinkSelector] Erreur lors du chargement des liens depuis l\'API:', apiError);
        }
      }
      
      // ✅ Extraire les IDs des entités déjà liées
      // IMPORTANT : Distinguer les entités liées à TOUS les documents vs partiellement liées
      const entityLinkCount = new Map<string, number>(); // entityId -> nombre de documents qui y sont liés
      
      for (const link of relevantLinks) {
        const entityId = link.linkedId;
        if (entityId && entityId !== 'global') {
          entityLinkCount.set(entityId, (entityLinkCount.get(entityId) || 0) + 1);
        }
      }
      
      // ✅ Séparer les entités totalement liées (tous les documents) vs partiellement liées
      const linkedEntityIds = new Set<string>(); // Liées à TOUS les documents
      const partialLinkedEntities = new Map<string, number>(); // Liées à CERTAINS documents
      
      for (const [entityId, count] of entityLinkCount.entries()) {
        if (count === documentIds.length) {
          linkedEntityIds.add(entityId);
        } else if (count > 0) {
          partialLinkedEntities.set(entityId, count);
        }
      }
      
      console.log('[DocumentLinkSelector] Liens existants chargés:', {
        documentIds,
        documentCount: documentIds.length,
        linkedType,
        fullyLinkedIds: Array.from(linkedEntityIds),
        partialLinks: Array.from(partialLinkedEntities.entries()).map(([id, count]) => ({ entityId: id, linkedToDocuments: count })),
        relevantLinksCount: relevantLinks.length
      });
      setExistingLinks(linkedEntityIds);
      setPartialLinks(partialLinkedEntities);
    } catch (error) {
      console.warn('[DocumentLinkSelector] Erreur lors du chargement des liens existants:', error);
      setExistingLinks(new Set());
    }
  }, [documentIds, selectedType, organizationId, shouldUseLocalData]);

  useEffect(() => {
    if (documentIds.length > 0 && selectedType !== 'global' && organizationId) {
      loadExistingLinks();
    } else {
      setExistingLinks(new Set());
      setPartialLinks(new Map());
    }
  }, [documentIds, selectedType, organizationId, loadExistingLinks]);

  // ✅ Initialiser selectedEntityIds avec les entités déjà liées quand existingLinks change
  useEffect(() => {
    if (existingLinks.size > 0 && selectedType !== 'global') {
      setSelectedEntityIds(new Set(existingLinks));
    }
  }, [existingLinks, selectedType]);

  useEffect(() => {
    if (selectedType !== 'global') {
      loadEntities();
      setShowMoreEntities(false);
    } else {
      setEntities([]);
      setSelectedEntityIds(new Set());
    }
  }, [selectedType, searchQuery]);

  const loadEntities = async () => {
    setLoading(true);
    try {
      // ✅ OFFLINE-FIRST: Charger depuis IndexedDB en mode app-shell/offline
      if (shouldUseLocalData && organizationId) {
        try {
          switch (selectedType) {
            case 'property': {
              const repo = getPropertyRepositoryOffline();
              const properties = await repo.getAll(organizationId, { includeArchived: false });
              // Filtrer par recherche si nécessaire
              let filtered = properties;
              if (searchQuery) {
                const query = searchQuery.toLowerCase();
                filtered = properties.filter(p => 
                  p.name?.toLowerCase().includes(query) || 
                  p.address?.toLowerCase().includes(query)
                );
              }
              setEntities(filtered.slice(0, 20));
              break;
            }
            case 'lease': {
              const repo = getLeaseRepositoryOffline();
              const propertyRepo = getPropertyRepositoryOffline();
              const tenantRepo = getTenantRepositoryOffline();
              const leases = await repo.getAll(organizationId, {});
              
              // ✅ Enrichir les baux avec Property et Tenant depuis IndexedDB
              const enrichedLeases = await Promise.all(leases.map(async (lease) => {
                const property = lease.propertyId ? await propertyRepo.getById(lease.propertyId, organizationId) : null;
                const tenant = lease.tenantId ? await tenantRepo.getById(lease.tenantId, organizationId) : null;
                return {
                  ...lease,
                  Property: property ? { name: property.name, address: property.address } : null,
                  Tenant: tenant ? { firstName: tenant.firstName, lastName: tenant.lastName } : null,
                };
              }));
              
              // Filtrer par recherche si nécessaire
              let filtered = enrichedLeases;
              if (searchQuery) {
                const query = searchQuery.toLowerCase();
                filtered = enrichedLeases.filter(l => {
                  const propertyName = l.Property?.name?.toLowerCase() || '';
                  const tenantName = `${l.Tenant?.firstName || ''} ${l.Tenant?.lastName || ''}`.toLowerCase();
                  return propertyName.includes(query) || tenantName.includes(query);
                });
              }
              setEntities(filtered.slice(0, 20));
              break;
            }
            case 'transaction': {
              const repo = getTransactionRepositoryOffline();
              const transactions = await repo.getAll(organizationId, {});
              // Filtrer par recherche si nécessaire
              let filtered = transactions;
              if (searchQuery) {
                const query = searchQuery.toLowerCase();
                filtered = transactions.filter(t => 
                  t.label?.toLowerCase().includes(query)
                );
              }
              setEntities(filtered.slice(0, 20));
              break;
            }
            case 'tenant': {
              const repo = getTenantRepositoryOffline();
              const tenants = await repo.getAll(organizationId, {});
              // Filtrer par recherche si nécessaire
              let filtered = tenants;
              if (searchQuery) {
                const query = searchQuery.toLowerCase();
                filtered = tenants.filter(t => 
                  `${t.firstName || ''} ${t.lastName || ''}`.toLowerCase().includes(query)
                );
              }
              setEntities(filtered.slice(0, 20));
              break;
            }
          }
        } catch (error) {
          console.warn('[DocumentLinkSelector] Erreur lors du chargement depuis IndexedDB:', error);
          setEntities([]);
        }
      } else {
        // Mode normal : utiliser l'API
        let endpoint = '';
        switch (selectedType) {
          case 'property':
            endpoint = '/api/properties';
            break;
          case 'lease':
            endpoint = '/api/leases';
            break;
          case 'transaction':
            endpoint = '/api/transactions';
            break;
          case 'tenant':
            endpoint = '/api/tenants';
            break;
        }

        if (endpoint) {
          const params = new URLSearchParams();
          if (searchQuery) params.append('search', searchQuery);
          params.append('limit', '20');

          const response = await fetch(`${endpoint}?${params.toString()}`);
          const data = await response.json();

          // Adapter selon le format de réponse
          if (data.data) {
            setEntities(data.data);
          } else if (Array.isArray(data)) {
            setEntities(data);
          } else {
            setEntities([]);
          }
        }
      }
    } catch (error) {
      console.error('Error loading entities:', error);
      setEntities([]);
    } finally {
      setLoading(false);
    }
  };

  const getEntityLabel = (entity: any) => {
    switch (selectedType) {
      case 'property':
        return `${entity.name} — ${entity.address || ''}`;
      case 'lease':
        return `Bail — ${entity.Property?.name || ''} — ${[entity.Tenant?.firstName, entity.Tenant?.lastName].filter(Boolean).join(' ')}`;
      case 'transaction':
        return `Transaction — ${entity.label || 'Sans libellé'} — ${entity.amount != null ? `${entity.amount} €` : '—'}`;
      case 'tenant':
        return `${entity.firstName || ''} ${entity.lastName || ''}`.trim() || entity.id;
      default:
        return entity.id;
    }
  };

  const uniqueEntities = (() => {
    const seen = new Set<string>();
    return entities.filter((e) => {
      if (!e?.id || seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  })();

  const handleSubmit = () => {
    if (selectedType === 'global') {
      onSelect('global', []);
    } else if (selectedEntityIds.size > 0) {
      onSelect(selectedType, Array.from(selectedEntityIds));
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Type de liaison
        </label>
        <div className="flex flex-wrap gap-2">
          {linkTypes.map((type) => {
            const Icon = type.icon;
            return (
              <Button
                key={type.value}
                variant={selectedType === type.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType(type.value as any)}
              >
                <Icon className="h-4 w-4 mr-2" />
                {type.label}
              </Button>
            );
          })}
        </div>
      </div>

      {selectedType !== 'global' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rechercher un {linkTypes.find(t => t.value === selectedType)?.label.toLowerCase()}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sélectionner
            </label>
            <div className="border border-gray-300 rounded-lg max-h-56 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500">Chargement...</div>
              ) : uniqueEntities.length === 0 ? (
                <div className="p-4 text-center text-gray-500">Aucun résultat</div>
              ) : (
                <div className="divide-y">
                  {(showMoreEntities ? uniqueEntities : uniqueEntities.slice(0, ENTITY_LIST_INITIAL)).map((entity) => {
                    const isSelected = selectedEntityIds.has(entity.id);
                    const isFullyLinked = existingLinks.has(entity.id); // Liée à TOUS les documents
                    const partialLinkCount = partialLinks.get(entity.id) || 0; // Nombre de documents liés (si partiel)
                    const isPartiallyLinked = partialLinkCount > 0 && !isFullyLinked; // Liée à CERTAINS documents
                    
                    return (
                      <div
                        key={entity.id}
                        className={`
                          p-3 cursor-pointer transition-colors
                          ${isSelected ? 'bg-primary-50 border-l-4 border-primary-500' : 'hover:bg-gray-50'}
                          ${isFullyLinked ? 'bg-green-50 border-l-4 border-green-500' : ''}
                          ${isPartiallyLinked ? 'bg-orange-50 border-l-4 border-orange-400' : ''}
                        `}
                        onClick={() => {
                          const newSet = new Set(selectedEntityIds);
                          if (newSet.has(entity.id)) {
                            newSet.delete(entity.id);
                          } else {
                            newSet.add(entity.id);
                          }
                          setSelectedEntityIds(newSet);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                const newSet = new Set(selectedEntityIds);
                                if (newSet.has(entity.id)) {
                                  newSet.delete(entity.id);
                                } else {
                                  newSet.add(entity.id);
                                }
                                setSelectedEntityIds(newSet);
                              }}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-sm">{getEntityLabel(entity)}</span>
                            {isFullyLinked && (
                              <Badge variant="success" className="text-xs bg-green-500 text-white">
                                Déjà lié ({documentIds.length}/{documentIds.length})
                              </Badge>
                            )}
                            {isPartiallyLinked && (
                              <Badge variant="warning" className="text-xs bg-orange-500 text-white">
                                Partiellement lié ({partialLinkCount}/{documentIds.length})
                              </Badge>
                            )}
                          </div>
                          {isSelected && (
                            <Badge variant="default" className="text-xs">Sélectionné</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {!loading && uniqueEntities.length > ENTITY_LIST_INITIAL && (
                <div className="p-2 border-t border-gray-200 bg-gray-50">
                  <button
                    type="button"
                    onClick={() => setShowMoreEntities(!showMoreEntities)}
                    className="text-sm text-orange-600 hover:text-orange-700 font-medium w-full text-center py-1"
                  >
                    {showMoreEntities
                      ? 'Voir moins'
                      : `Voir plus (${uniqueEntities.length - ENTITY_LIST_INITIAL} autre${uniqueEntities.length - ENTITY_LIST_INITIAL > 1 ? 's' : ''})`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="flex gap-2 pt-4 border-t">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Annuler
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={selectedType !== 'global' && selectedEntityIds.size === 0}
        >
          Valider {selectedEntityIds.size > 0 && `(${selectedEntityIds.size})`}
        </Button>
      </div>
    </div>
  );
}

