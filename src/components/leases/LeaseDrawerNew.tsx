'use client';

import React from 'react';
import { X, Edit, Trash2, FileText, Download, Calendar, Euro, Building2, Users, Home, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { LeaseWithDetails } from '@/lib/services/leasesService';
import { formatLeasePeriod } from '@/utils/leaseUtils';

interface LeaseDrawerNewProps {
  lease: LeaseWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (lease: LeaseWithDetails) => void;
  onDelete: (lease: LeaseWithDetails) => void;
  onGenerateReceipt?: (lease: LeaseWithDetails) => void;
  onDownloadSignedLease?: (lease: LeaseWithDetails) => void;
}

export default function LeaseDrawerNew({
  lease,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onGenerateReceipt,
  onDownloadSignedLease
}: LeaseDrawerNewProps) {
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
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl transform transition-transform overflow-y-auto">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b bg-gray-50 sticky top-0 z-10">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-gray-900">
                Bail — {lease.Tenant.firstName} {lease.Tenant.lastName}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {lease.Property.name}
              </p>
              <div className="flex gap-2 mt-2">
                {getStatusBadge(lease.status)}
                <Badge variant="outline">{getFurnishedLabel(lease.furnishedType)}</Badge>
                {lease.type && <Badge variant="outline">{lease.type}</Badge>}
              </div>
            </div>
            <button
              onClick={onClose}
              className="ml-4 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Actions rapides */}
          <div className="flex gap-2 p-4 border-b bg-white">
            <Button
              variant="default"
              size="sm"
              onClick={() => onEdit(lease)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Modifier
            </Button>
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
            {onDownloadSignedLease && lease.signedPdfUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownloadSignedLease(lease)}
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger bail
              </Button>
            )}
            <div className="flex-1" />
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

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Section 1: Résumé financier */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                <Euro className="h-5 w-5 mr-2 text-gray-500" />
                Résumé financier
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Loyer mensuel HC</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(lease.rentAmount)}</span>
                </div>
                {lease.chargesRecupMensuelles && lease.chargesRecupMensuelles > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Charges récupérables</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(lease.chargesRecupMensuelles)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-sm font-medium text-gray-900">Total mensuel payé par locataire</span>
                  <span className="text-lg font-bold text-gray-900">{formatCurrency(totalMensuel)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-sm text-gray-600">Dépôt de garantie</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(lease.deposit || 0)}</span>
                </div>
              </div>
            </div>

            {/* Section 2: Échéances */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-gray-500" />
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
                  <div className="flex justify-between">
                    <span className="text-gray-600">Prochaine indexation</span>
                    <Badge variant="warning">À calculer</Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Informations bail */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-gray-500" />
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
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                <Building2 className="h-5 w-5 mr-2 text-gray-500" />
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
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                <Users className="h-5 w-5 mr-2 text-gray-500" />
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
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-3">
                  Notes / Clauses particulières
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                  {lease.notes}
                </div>
              </div>
            )}

            {/* Section 7: Documents liés */}
            <div>
              <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-gray-500" />
                Documents liés
              </h3>
              <div className="text-sm text-gray-500">
                {/* TODO: Afficher la liste des documents liés au bail */}
                Fonctionnalité à venir
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

