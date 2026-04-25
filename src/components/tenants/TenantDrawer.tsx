'use client';

import React, { useState, useEffect } from 'react';
import { X, Edit, Trash2, Mail, Phone, Calendar, MapPin, Building2, FileText, User, AlertCircle, Euro, Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Drawer } from '@/components/ui/Drawer';
import { cn } from '@/utils/cn';
import type { TenantWithRelations } from '@/lib/db/TenantRepo';
import { getLocalDB } from '@/lib/offline/db';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';

interface TenantDrawerProps {
  tenant: TenantWithRelations | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (tenant: TenantWithRelations) => void;
  onDelete: (tenant: TenantWithRelations) => void;
  onViewLeases?: (tenant: TenantWithRelations) => void;
}

export function TenantDrawer({
  tenant,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onViewLeases,
}: TenantDrawerProps) {
  const { organizationId } = useCurrentOrganization();
  const [properties, setProperties] = useState<any[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);

  // Charger les propriétés associées aux baux
  useEffect(() => {
    if (!isOpen || !tenant || !organizationId) {
      setProperties([]);
      return;
    }

    async function loadProperties() {
      try {
        setLoadingProperties(true);
        const db = await getLocalDB();
        
        // Récupérer les propertyIds depuis les baux
        const propertyIds = tenant.Lease?.map(lease => lease.Property?.name || '').filter(Boolean);
        
        if (propertyIds.length === 0) {
          setProperties([]);
          return;
        }

        // Charger les propriétés depuis IndexedDB
        const props = await db.Property
          .where('organizationId')
          .equals(organizationId)
          .toArray();
        
        // Filtrer celles qui sont liées aux baux du locataire
        const tenantPropertyIds = tenant.Lease?.map(lease => {
          // En app-shell, on peut avoir seulement propertyId dans lease
          return lease.Property?.name || '';
        }).filter(Boolean) || [];

        setProperties(props.filter(p => tenantPropertyIds.includes(p.name)));
      } catch (error) {
        console.error('[TenantDrawer] Erreur chargement propriétés:', error);
        setProperties([]);
      } finally {
        setLoadingProperties(false);
      }
    }

    loadProperties();
  }, [isOpen, tenant, organizationId]);

  if (!tenant) return null;

  const hasActiveLeases = tenant.Lease?.some(lease => lease.status === 'ACTIF') || false;
  const activeLeases = tenant.Lease?.filter(lease => lease.status === 'ACTIF') || [];
  const allLeases = tenant.Lease || [];

  const getStatusBadge = () => {
    const status = tenant.status || 'ACTIVE';
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return <Badge variant="success">Actif</Badge>;
      case 'INACTIVE':
        return <Badge variant="gray">Inactif</Badge>;
      case 'BLOCKED':
        return <Badge variant="danger">Bloqué</Badge>;
      default:
        return <Badge variant="gray">Inactif</Badge>;
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`${tenant.firstName} ${tenant.lastName}`}
      size="lg"
      className="h-full flex flex-col"
      footer={
        <div className="space-y-3">
          <div>{getStatusBadge()}</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                onEdit(tenant);
                onClose();
              }}
              className="flex-1"
            >
              <Edit className="h-4 w-4 mr-2" />
              Modifier
            </Button>
            {onViewLeases && allLeases.length > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  onViewLeases(tenant);
                  onClose();
                }}
                className="flex-1"
              >
                <FileText className="h-4 w-4 mr-2" />
                Voir les baux
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                onDelete(tenant);
                onClose();
              }}
              disabled={hasActiveLeases}
              className={cn(
                "flex-1",
                hasActiveLeases && "opacity-50 cursor-not-allowed"
              )}
              title={hasActiveLeases ? 'Impossible de supprimer : bail(s) actif(s)' : ''}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </Button>
          </div>
        </div>
      }
    >
      {/* Content - scrollable */}
      <div className="py-6 space-y-6">
          {/* Informations personnelles */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <User className="h-4 w-4" />
              Informations personnelles
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500">Email</label>
                <div className="flex items-center gap-2 mt-1">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <p className="text-sm text-gray-900">{tenant.email}</p>
                </div>
              </div>
              {tenant.phone && (
                <div>
                  <label className="text-xs text-gray-500">Téléphone</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <p className="text-sm text-gray-900">{tenant.phone}</p>
                  </div>
                </div>
              )}
              {tenant.birthDate && (
                <div>
                  <label className="text-xs text-gray-500">Date de naissance</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <p className="text-sm text-gray-900">
                      {new Date(tenant.birthDate).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              )}
              {tenant.nationality && (
                <div>
                  <label className="text-xs text-gray-500">Nationalité</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Star className="h-4 w-4 text-gray-400" />
                    <p className="text-sm text-gray-900">{tenant.nationality}</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Adresse */}
          {(tenant.address || tenant.city) && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Adresse
              </h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-900">
                  {tenant.address && <>{tenant.address}<br /></>}
                  {tenant.postalCode && tenant.city && (
                    <>{tenant.postalCode} {tenant.city}</>
                  )}
                  {tenant.country && <><br />{tenant.country}</>}
                </p>
              </div>
            </section>
          )}

          {/* Informations professionnelles */}
          {(tenant.occupation || tenant.employer || tenant.monthlyIncome) && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Informations professionnelles
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tenant.occupation && (
                  <div>
                    <label className="text-xs text-gray-500">Profession</label>
                    <p className="text-sm text-gray-900 mt-1">{tenant.occupation}</p>
                  </div>
                )}
                {tenant.employer && (
                  <div>
                    <label className="text-xs text-gray-500">Employeur</label>
                    <p className="text-sm text-gray-900 mt-1">{tenant.employer}</p>
                  </div>
                )}
                {tenant.monthlyIncome && (
                  <div>
                    <label className="text-xs text-gray-500">Revenus mensuels</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Euro className="h-4 w-4 text-gray-400" />
                      <p className="text-sm text-gray-900">
                        {tenant.monthlyIncome.toLocaleString('fr-FR')} €
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Contact d'urgence */}
          {(tenant.emergencyContact || tenant.emergencyPhone) && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Contact d'urgence
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tenant.emergencyContact && (
                  <div>
                    <label className="text-xs text-gray-500">Nom</label>
                    <p className="text-sm text-gray-900 mt-1">{tenant.emergencyContact}</p>
                  </div>
                )}
                {tenant.emergencyPhone && (
                  <div>
                    <label className="text-xs text-gray-500">Téléphone</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <p className="text-sm text-gray-900">{tenant.emergencyPhone}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Baux */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Baux ({allLeases.length})
            </h3>
            {allLeases.length > 0 ? (
              <div className="space-y-3">
                {allLeases.map((lease) => (
                  <div
                    key={lease.id}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <p className="font-medium text-gray-900">
                            {lease.Property?.name || 'Bien inconnu'}
                          </p>
                        </div>
                        {lease.Property?.address && (
                          <p className="text-xs text-gray-600 mb-2">
                            {lease.Property.address}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-600">
                          <span>
                            Du {new Date(lease.startDate).toLocaleDateString('fr-FR')}
                          </span>
                          {lease.endDate && (
                            <span>
                              au {new Date(lease.endDate).toLocaleDateString('fr-FR')}
                            </span>
                          )}
                          {!lease.endDate && <span>En cours</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Euro className="h-3 w-3 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">
                            {lease.rentAmount?.toLocaleString('fr-FR')} €/mois
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <Badge
                          variant={lease.status === 'ACTIF' ? 'success' : 'gray'}
                        >
                          {lease.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500">Aucun bail associé</p>
              </div>
            )}
          </section>

          {/* Notes */}
          {tenant.notes && (
            <section>
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Notes
              </h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{tenant.notes}</p>
              </div>
            </section>
          )}
      </div>
    </Drawer>
  );
}

