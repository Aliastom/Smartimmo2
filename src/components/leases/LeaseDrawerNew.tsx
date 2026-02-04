'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Edit, Trash2, FileText, Calendar, Euro, Building2, Users, Receipt, Eye } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { LeaseWithDetails } from '@/lib/services/leasesService';
import { formatLeasePeriod } from '@/utils/leaseUtils';
import { getLocalDB } from '@/lib/offline/db';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';

interface LeaseDrawerNewProps {
  lease: LeaseWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (lease: LeaseWithDetails) => void;
  onDelete: (lease: LeaseWithDetails) => void;
  onGenerateReceipt?: (lease: LeaseWithDetails) => void;
}

export default function LeaseDrawerNew({
  lease,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onGenerateReceipt
}: LeaseDrawerNewProps) {
  const { organizationId } = useCurrentOrganization();
  const [signedLeaseDocument, setSignedLeaseDocument] = useState<any | null>(null);
  const [loadingDocument, setLoadingDocument] = useState(false);

  // Fonction pour charger le document BAIL_SIGNE
  const loadSignedLease = useCallback(async () => {
    if (!lease || !organizationId) {
      setSignedLeaseDocument(null);
      return;
    }

    try {
      setLoadingDocument(true);
      const db = await getLocalDB();
      
      // 1. Récupérer les liens DocumentLink pour ce bail
      const allLinks = await db.DocumentLink.toArray();
      const leaseLinks = allLinks.filter(link => 
        (link.linkedType?.toLowerCase() === 'lease' || link.linkedType === 'LEASE') && 
        link.linkedId === lease.id
      );
      
      if (leaseLinks.length === 0) {
        setSignedLeaseDocument(null);
        return;
      }

      // 2. Récupérer les documents liés
      const documentIds = leaseLinks.map(link => link.documentId);
      const documents = await db.Document
        .where('id')
        .anyOf(documentIds)
        .filter(doc => doc.organizationId === organizationId && !doc.deletedAt)
        .toArray();

      // 3. Trouver le document de type BAIL_SIGNE
      const documentTypeIds = documents
        .map(doc => doc.documentTypeId)
        .filter((id): id is string => id !== null && id !== undefined);
      
      if (documentTypeIds.length === 0) {
        setSignedLeaseDocument(null);
        return;
      }

      const documentTypes = await db.DocumentType
        .where('id')
        .anyOf(documentTypeIds)
        .toArray();
      
      const bailSigneType = documentTypes.find(dt => dt.code === 'BAIL_SIGNE');
      if (!bailSigneType) {
        setSignedLeaseDocument(null);
        return;
      }

      const bailSigneDoc = documents.find(doc => doc.documentTypeId === bailSigneType.id);
      setSignedLeaseDocument(bailSigneDoc || null);
    } catch (error) {
      console.error('[LeaseDrawerNew] Erreur lors du chargement du bail signé:', error);
      setSignedLeaseDocument(null);
    } finally {
      setLoadingDocument(false);
    }
  }, [lease?.id, organizationId]);

  // Charger le document BAIL_SIGNE lié au bail
  useEffect(() => {
    if (!isOpen || !lease || !organizationId) {
      setSignedLeaseDocument(null);
      return;
    }

    loadSignedLease();
  }, [isOpen, lease?.id, organizationId]);

  // Écouter les événements de refresh pour mettre à jour le document
  useEffect(() => {
    if (!isOpen || !lease || !organizationId) return;

    const handleDocumentsRefresh = (event: CustomEvent) => {
      const detail = event.detail;
      // Vérifier si le refresh concerne ce bail (scope property avec propertyId ou scope global)
      if (detail.scope === 'global' || 
          (detail.scope === 'property' && detail.propertyId === lease.propertyId)) {
        loadSignedLease();
      }
    };

    window.addEventListener('documents:refresh', handleDocumentsRefresh as EventListener);
    
    return () => {
      window.removeEventListener('documents:refresh', handleDocumentsRefresh as EventListener);
    };
  }, [isOpen, lease?.id, lease?.propertyId, organizationId, loadSignedLease]);

  if (!isOpen || !lease) return null;

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: any; label: string }> = {
      'BROUILLON': { variant: 'secondary', label: 'Brouillon' },
      'ENVOYÉ': { variant: 'default', label: 'Envoyé' },
      'ENVOYE': { variant: 'default', label: 'Envoyé' },
      'SIGNÉ': { variant: 'success', label: 'Signé' },
      'SIGNE': { variant: 'success', label: 'Signé' },
      'ACTIF': { variant: 'success', label: 'Actif' },
      'RÉSILIÉ': { variant: 'destructive', label: 'Résilié' },
      'RESILIE': { variant: 'destructive', label: 'Résilié' },
    };

    const config = statusConfig[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getFurnishedLabel = (furnishedType: string | null) => {
    const types: Record<string, string> = {
      'VIDE': 'Vide',
      'MEUBLE': 'Meublé',
      'COLOCATION_MEUBLEE': 'Colocation meublée',
      'COLOCATION_VIDE': 'Colocation vide',
    };
    return types[furnishedType || 'VIDE'] || 'Vide';
  };

  const getIndexationLabel = (indexationType: string | null) => {
    if (!indexationType || indexationType === 'AUCUNE') return 'Aucune';
    const types: Record<string, string> = {
      'IRL': 'IRL (Indice de Référence des Loyers)',
      'ILAT': 'ILAT',
      'ICC': 'ICC',
      'AUTRE': 'Autre',
    };
    return types[indexationType] || indexationType;
  };

  const totalMensuel = lease.rentAmount + (lease.chargesRecupMensuelles || 0);

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer - Mobile: plein écran, Desktop: side panel */}
      <div className="fixed right-0 top-0 h-screen w-full lg:w-auto lg:max-w-2xl bg-white shadow-xl transform transition-transform">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Bail — {lease.Tenant.firstName} {lease.Tenant.lastName}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {lease.Property.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Informations principales */}
            <div className="space-y-4">
              {/* Section 1: Résumé financier */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <Euro className="h-5 w-5" />
                  Résumé financier
                </h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Loyer mensuel HC</span>
                  <span className="font-semibold text-green-600">{formatCurrency(lease.rentAmount)}</span>
                </div>
                {lease.chargesRecupMensuelles && lease.chargesRecupMensuelles > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Charges récupérables</span>
                    <span className="font-semibold text-green-600">{formatCurrency(lease.chargesRecupMensuelles)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-sm font-medium text-gray-900">Total mensuel payé par locataire</span>
                  <span className="text-2xl font-bold text-green-600">{formatCurrency(totalMensuel)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-sm text-gray-600">Dépôt de garantie</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(lease.deposit || 0)}</span>
                </div>
              </div>
            </div>

              {/* Section 2: Échéances */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Échéances
                </h3>
              <div className="space-y-2 text-sm">
                {lease.paymentDay && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Jour de paiement</span>
                    <span className="font-medium">{lease.paymentDay} de chaque mois</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Type d'indexation</span>
                  <span className="font-medium">{getIndexationLabel(lease.indexationType)}</span>
                </div>
                {lease.indexationType && lease.indexationType !== 'AUCUNE' && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Prochaine indexation</p>
                    <p className="text-lg font-bold text-gray-900">À calculer</p>
                  </div>
                )}
              </div>
              </div>

              {/* Section 3: Informations bail */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Informations bail
                </h3>
                <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Type de bail</span>
                  <span className="font-medium">{lease.type || 'Non spécifié'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Type de meublé</span>
                  <span className="font-medium">{getFurnishedLabel(lease.furnishedType)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Date de début</span>
                  <span className="font-medium">{formatDate(lease.startDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Date de fin</span>
                  {(() => {
                    const period = formatLeasePeriod(lease.startDate, lease.endDate, lease.furnishedType);
                    const endDateFormatted = period.endText.replace('Au ', '');
                    return (
                      <span className={`font-medium ${period.calculated ? 'text-gray-500 italic' : ''}`}>
                        {endDateFormatted}
                      </span>
                    );
                  })()}
                </div>
                {lease.noticeMonths && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Préavis</span>
                    <span className="font-medium">{lease.noticeMonths} mois</span>
                  </div>
                )}
                </div>
              </div>

              {/* Section 4: Bien */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Bien immobilier
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                <div className="font-medium text-gray-900">{lease.Property.name}</div>
                <div className="text-sm text-gray-600 mt-1">{lease.Property.address}</div>
                {lease.Property.city && (
                  <div className="text-sm text-gray-600">
                    {lease.Property.postalCode} {lease.Property.city}
                  </div>
                )}
                </div>
              </div>

              {/* Section 5: Locataire */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Locataire
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="font-medium text-gray-900">
                  {lease.Tenant.firstName} {lease.Tenant.lastName}
                </div>
                {lease.Tenant.email && (
                  <div className="text-sm text-gray-600">{lease.Tenant.email}</div>
                )}
                {lease.Tenant.phone && (
                  <div className="text-sm text-gray-600">{lease.Tenant.phone}</div>
                )}
                </div>
              </div>

              {/* Section 6: Notes */}
              {lease.notes && (
                <div className="border-t pt-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Notes / Clauses particulières</h3>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                  {lease.notes}
                  </div>
                </div>
              )}

              {/* Section 7: Documents liés */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Documents liés
                  </h3>
                </div>
                {loadingDocument ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
                    <p>Chargement des documents...</p>
                  </div>
                ) : signedLeaseDocument ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{signedLeaseDocument.filenameOriginal}</p>
                        <p className="text-sm text-gray-600">
                          Bail signé
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          if (signedLeaseDocument.url) {
                            window.open(signedLeaseDocument.url, '_blank');
                          }
                        }}
                      >
                        Voir
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Aucun document lié</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-4 border-t">
            {onGenerateReceipt && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onGenerateReceipt(lease)}
                className="border-purple-300 text-purple-600 hover:bg-purple-50"
              >
                <Receipt className="h-4 w-4 mr-2" />
                Générer quittance
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={() => onEdit(lease)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Modifier
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(lease)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

