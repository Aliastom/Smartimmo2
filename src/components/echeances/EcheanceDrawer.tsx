'use client';

import React, { useState, useEffect } from 'react';
import { X, Edit, Trash2, Copy, Calendar, Euro, Building2, FileText, Tag, Info, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import {
  EcheanceRecurrente,
  ECHEANCE_TYPE_LABELS,
  PERIODICITE_LABELS,
  SENS_LABELS,
  TYPE_COLORS,
} from '@/types/echeance';
import Link from 'next/link';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { createEcheanceServiceWithMode } from '@/domain/services/echeanceServiceFactory';
import { notify2 } from '@/lib/notify2';
import { getEcheanceRepositoryOffline } from '@/lib/offline/repositories/EcheanceRepositoryOffline';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';
import { getLeaseRepositoryOffline } from '@/lib/offline/repositories/LeaseRepositoryOffline';
import { getTenantRepositoryOffline } from '@/lib/offline/repositories/TenantRepositoryOffline';

interface EcheanceDrawerProps {
  echeance: EcheanceRecurrente | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (echeance: EcheanceRecurrente) => void;
  onDuplicate: (echeance: EcheanceRecurrente) => void;
  onDelete: (echeance: EcheanceRecurrente) => void;
  propertyId?: string; // Pour émettre l'événement de refresh
}

export function EcheanceDrawer({
  echeance: initialEcheance,
  isOpen,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
  propertyId,
}: EcheanceDrawerProps) {
  const { organizationId } = useCurrentOrganization();
  
  // ✅ CORRECTION: État local pour l'échéance (mis à jour via événements)
  const [echeance, setEcheance] = useState<EcheanceRecurrente | null>(initialEcheance);
  
  // Mettre à jour l'état local quand la prop change
  useEffect(() => {
    setEcheance(initialEcheance);
  }, [initialEcheance]);
  
  // ✅ CORRECTION: Écouter les événements de refresh pour mettre à jour l'échéance dans le drawer
  useEffect(() => {
    if (!isOpen || !echeance || !organizationId) return;
    
    const handleRefresh = async (event: Event) => {
      if (!(event instanceof CustomEvent && event.detail)) return;
      
      const detail = event.detail as { scope?: string; propertyId?: string; reason?: string };
      
      // Filtrer par scope et propertyId si présent
      if (detail.scope === 'property' && propertyId && detail.propertyId !== propertyId) {
        return;
      }
      
      // Recharger l'échéance depuis IndexedDB avec ses relations
      try {
        const echeanceRepo = getEcheanceRepositoryOffline();
        const updated = await echeanceRepo.getById(echeance.id, organizationId);
        
        if (updated) {
          // ✅ Récupérer les relations Property et Lease avec leurs noms
          let property = null;
          let lease = null;
          
          if (updated.propertyId) {
            const propertyRepo = getPropertyRepositoryOffline();
            const propertyData = await propertyRepo.getById(updated.propertyId, organizationId);
            if (propertyData) {
              property = { id: propertyData.id, name: propertyData.name };
            }
          }
          
          if (updated.leaseId) {
            const leaseRepo = getLeaseRepositoryOffline();
            const leaseData = await leaseRepo.getById(updated.leaseId, organizationId);
            if (leaseData) {
              // Récupérer le nom du locataire
              let tenantName = '';
              if (leaseData.tenantId) {
                const tenantRepo = getTenantRepositoryOffline();
                const tenantData = await tenantRepo.getById(leaseData.tenantId, organizationId);
                if (tenantData) {
                  tenantName = tenantData.name || '';
                }
              }
              lease = {
                id: leaseData.id,
                type: leaseData.type || '',
                status: leaseData.status || '',
                tenantName,
              };
            }
          }
          
          setEcheance({
            id: updated.id,
            propertyId: updated.propertyId || null,
            leaseId: updated.leaseId || null,
            label: updated.label,
            type: updated.type,
            periodicite: updated.periodicite,
            montant: Number(updated.montant),
            recuperable: updated.recuperable,
            sens: updated.sens,
            startAt: new Date(updated.startAt),
            endAt: updated.endAt ? new Date(updated.endAt) : null,
            isActive: updated.isActive,
            createdAt: updated.createdAt ? new Date(updated.createdAt) : undefined,
            updatedAt: updated.updatedAt ? new Date(updated.updatedAt) : undefined,
            Property: property,
            Lease: lease,
          });
        }
      } catch (error) {
        console.error('Erreur lors du rechargement de l\'échéance:', error);
      }
    };
    
    window.addEventListener('deadlines:refresh', handleRefresh);
    window.addEventListener('echeances:refresh', handleRefresh);
    
    return () => {
      window.removeEventListener('deadlines:refresh', handleRefresh);
      window.removeEventListener('echeances:refresh', handleRefresh);
    };
  }, [isOpen, echeance?.id, organizationId, propertyId]);
  
  if (!isOpen || !echeance) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return '—';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const formatDateShort = (date: Date | string | null) => {
    if (!date) return '—';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getAmountColor = () => {
    return echeance.sens === 'DEBIT' ? 'text-red-600' : 'text-green-600';
  };

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
                Détail de l'échéance
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {echeance.label}
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
            <div className="space-y-4">
              {/* Montant et statut */}
              <div className="flex items-center justify-between">
                <div>
                  <span className={`text-3xl font-bold ${getAmountColor()}`}>
                    {echeance.sens === 'DEBIT' ? '-' : '+'}{formatCurrency(echeance.montant)}
                  </span>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={TYPE_COLORS[echeance.type]}>
                      {ECHEANCE_TYPE_LABELS[echeance.type]}
                    </Badge>
                    <Badge className={echeance.sens === 'DEBIT' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                      {SENS_LABELS[echeance.sens]}
                    </Badge>
                    <Badge variant={echeance.isActive ? 'success' : 'secondary'}>
                      {echeance.isActive ? (
                        <><CheckCircle className="h-3 w-3 mr-1" /> Actif</>
                      ) : (
                        <><XCircle className="h-3 w-3 mr-1" /> Inactif</>
                      )}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Date de début</p>
                  <p className="font-medium">{formatDateShort(echeance.startAt)}</p>
                </div>
              </div>

              {/* Statut Actif (autosave) */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Switch
                    id="isActive-drawer"
                    checked={echeance.isActive}
                    onCheckedChange={async (checked) => {
                      if (!organizationId) {
                        notify2.error('OrganizationId manquant');
                        return;
                      }

                      try {
                        // ✅ Mise à jour optimiste : mettre à jour l'état local immédiatement
                        setEcheance(prev => prev ? { ...prev, isActive: checked } : null);
                        
                        const echeanceService = await createEcheanceServiceWithMode('app-shell');
                        
                        await echeanceService.updateEcheance(echeance.id, organizationId, {
                          isActive: checked,
                        });
                        
                        // ✅ Émettre un événement ciblé pour rafraîchir les hooks (KPI, tableau)
                        if (propertyId) {
                          window.dispatchEvent(new CustomEvent('deadlines:refresh', { 
                            detail: { scope: 'property', propertyId, reason: 'update' } 
                          }));
                        } else {
                          window.dispatchEvent(new CustomEvent('echeances:refresh'));
                        }
                        
                        notify2.success(checked ? 'Échéance activée' : 'Échéance désactivée');
                      } catch (error: any) {
                        console.error('Erreur lors de la mise à jour de l\'échéance:', error);
                        // ✅ Rollback en cas d'erreur
                        setEcheance(prev => prev ? { ...prev, isActive: !checked } : null);
                        notify2.error('Erreur', error.message || 'Erreur lors de la mise à jour');
                      }
                    }}
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900">
                      Marquer comme active
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Cette modification est automatiquement sauvegardée.
                </p>
              </div>

              {/* Détails */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Périodicité */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Périodicité</span>
                  </div>
                  <p className="font-medium">{PERIODICITE_LABELS[echeance.periodicite]}</p>
                </div>

                {/* Charge récupérable */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Charge récupérable</span>
                  </div>
                  <p className="font-medium">{echeance.recuperable ? 'Oui' : 'Non'}</p>
                </div>

                {/* Bien */}
                {echeance.Property && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Bien</span>
                    </div>
                    <div>
                      <Link
                        href={`/app?view=property&propertyId=${echeance.Property.id}&tab=transactions`}
                        className="font-medium text-primary-600 hover:underline"
                      >
                        {echeance.Property.name}
                      </Link>
                    </div>
                  </div>
                )}

                {/* Bail */}
                {echeance.Lease && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Bail</span>
                    </div>
                    <p className="font-medium">
                      {echeance.Lease.type} - {echeance.Lease.status}
                    </p>
                  </div>
                )}
              </div>

              {/* Période */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Période
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Date de début</p>
                    <p className="font-medium">{formatDate(echeance.startAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Date de fin</p>
                    <p className="font-medium">
                      {echeance.endAt ? formatDate(echeance.endAt) : 'Aucune (récurrence infinie)'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Informations système */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Informations système</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {echeance.createdAt && (
                    <div>
                      <p className="text-sm text-gray-600">Créée le</p>
                      <p className="font-medium">{formatDateShort(echeance.createdAt)}</p>
                    </div>
                  )}
                  {echeance.updatedAt && (
                    <div>
                      <p className="text-sm text-gray-600">Modifiée le</p>
                      <p className="font-medium">{formatDateShort(echeance.updatedAt)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600">ID Échéance</p>
                    <p className="font-mono text-xs text-gray-500">{echeance.id}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-4 border-t">
            <Button
              variant="outline"
              onClick={() => onDelete(echeance)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </Button>
            <Button
              variant="outline"
              onClick={() => onDuplicate(echeance)}
            >
              <Copy className="h-4 w-4 mr-2" />
              Dupliquer
            </Button>
            <Button onClick={() => onEdit(echeance)}>
              <Edit className="h-4 w-4 mr-2" />
              Éditer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

