'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { InsightBar } from '@/components/ui/InsightBar';
import { InsightChip } from '@/components/ui/InsightChip';
import { InsightSkeleton } from '@/components/ui/InsightSkeleton';
import { MiniDonut } from '@/components/ui/MiniDonut';
import { useDashboardInsights } from '@/hooks/useDashboardInsights';
import { SearchInput } from '@/components/ui/SearchInput';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { TenantEditModalV2 } from '@/components/forms/TenantEditModalV2';
import { TenantWithRelations } from '@/lib/db/TenantRepo';
import { 
  Plus, 
  Eye, 
  Edit, 
  Trash2,
  Mail,
  Phone,
  Calendar,
  FileText,
  Building2,
  Users,
  UserCheck,
  UserX,
  Clock
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

interface LocatairesClientProps {
  initialData: {
    data: TenantWithRelations[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
  stats: Array<{
    title: string;
    value: string;
    iconName: string;
    trend: { value: number; label: string; period: string };
    color: 'primary' | 'success' | 'warning' | 'danger' | 'gray';
  }>;
}

export default function LocatairesClient({ initialData, stats }: LocatairesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { insights, loading: insightsLoading } = useDashboardInsights('locataires');
  
  // Détecter l'état actif des chips basé sur les paramètres URL
  const getActiveChip = () => {
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    
    if (!status && !search) return 'total';
    if (status === 'withActiveLeases') return 'withActiveLeases';
    if (status === 'withoutLeases') return 'withoutLeases';
    if (status === 'overduePayments') return 'overduePayments';
    return null;
  };
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<TenantWithRelations | null>(null);
  const [tenantFormOpen, setTenantFormOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantWithRelations | null>(null);
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  }>({
    isOpen: false,
    message: ''
  });

  const handleSearch = (search: string) => {
    const params = new URLSearchParams(searchParams);
    if (search) {
      params.set('search', search);
    } else {
      params.delete('search');
    }
    params.delete('page'); // Reset to first page
    router.push(`/locataires?${params.toString()}`);
  };

  // Handler pour le filtrage par carte
  const handleCardFilter = (filterType: string, filterValue: any) => {
    const params = new URLSearchParams(searchParams);
    
    switch (filterType) {
      case 'status':
        if (filterValue === 'withActiveLeases') {
          params.set('status', 'withActiveLeases');
        } else if (filterValue === 'withoutLeases') {
          params.set('status', 'withoutLeases');
        } else if (filterValue === 'overduePayments') {
          params.set('status', 'overduePayments');
        }
        break;
      case 'total':
        // Reset all filters
        params.delete('status');
        params.delete('search');
        break;
    }
    
    params.delete('page'); // Reset to first page
    router.push(`/locataires?${params.toString()}`);
    
    // Émettre l'événement de changement de filtres
    window.dispatchEvent(new CustomEvent('filters:changed'));
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    router.push(`/locataires?${params.toString()}`);
  };

  const getStatusBadge = (tenant: TenantWithRelations) => {
    // Utiliser le statut du locataire lui-même, pas celui de ses baux
    const tenantStatus = tenant.status || 'ACTIVE';
    
    switch (tenantStatus.toUpperCase()) {
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

  const handleViewTenant = (tenant: TenantWithRelations) => {
    setSelectedTenant(tenant);
    setModalOpen(true);
  };

  const handleDeleteTenant = async (tenant: TenantWithRelations) => {
    // Vérification côté client pour une meilleure UX
    const activeLeases = tenant.Lease.filter(lease => lease.status === 'ACTIF');
    
    if (activeLeases.length > 0) {
      setErrorModal({
        isOpen: true,
        title: 'Impossible de supprimer ce locataire',
        message: `Le locataire "${tenant.firstName} ${tenant.lastName}" a ${activeLeases.length} bail(s) actif(s).`,
        details: [
          {
            field: 'Baux actifs',
            message: `Vous devez d'abord résilier ou supprimer le(s) bail(s) actif(s) : ${activeLeases.map(lease => lease.Property.name).join(', ')}`
          }
        ]
      });
      return;
    }

    if (confirm(`Êtes-vous sûr de vouloir supprimer le locataire "${tenant.firstName} ${tenant.lastName}" ?`)) {
      try {
        const response = await fetch(`/api/tenants/${tenant.id}`, {
          method: 'DELETE'
        });

        if (response.status === 409) {
          const errorData = await response.json();
          setErrorModal({
            isOpen: true,
            title: 'Impossible de supprimer ce locataire',
            message: 'Ce locataire est référencé par des données existantes.',
            details: [
              {
                field: 'Dépendances',
                message: errorData.message || 'Le locataire a des baux ou documents associés'
              }
            ]
          });
          return;
        }

        if (response.ok) {
          // Refresh the page
          router.refresh();
        } else {
          setErrorModal({
            isOpen: true,
            title: 'Erreur de suppression',
            message: 'Une erreur est survenue lors de la suppression du locataire.',
            details: []
          });
        }
      } catch (error) {
        console.error('Error deleting tenant:', error);
        setErrorModal({
          isOpen: true,
          title: 'Erreur de connexion',
          message: 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.',
          details: []
        });
      }
    }
  };

  const handleTenantSubmit = async (data: any) => {
    try {
      let response;
      
      if (editingTenant) {
        // Mise à jour
        response = await fetch(`/api/tenants/${editingTenant.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } else {
        // Création
        response = await fetch('/api/tenants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        
        // Afficher les détails de validation si disponibles
        if (errorData.details && Array.isArray(errorData.details)) {
          setErrorModal({
            isOpen: true,
            title: 'Erreur de validation',
            message: 'Veuillez corriger les erreurs suivantes :',
            details: errorData.details.map((d: any) => ({
              field: d.path ? d.path.join('.') : d.field || 'Champ inconnu',
              message: d.message
            }))
          });
        } else {
          setErrorModal({
            isOpen: true,
            title: 'Erreur',
            message: errorData.error || 'Une erreur est survenue lors de la sauvegarde',
            details: []
          });
        }
        return;
      }

      setTenantFormOpen(false);
      setEditingTenant(null);
      router.refresh();
    } catch (error) {
      console.error('Error saving tenant:', error);
      setErrorModal({
        isOpen: true,
        title: 'Erreur de connexion',
        message: 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.',
        details: []
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <SectionTitle
        title="Locataires"
        description="Gestion de vos locataires et de leurs baux"
        actions={
          <Button onClick={() => setTenantFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouveau Locataire
          </Button>
        }
      />

      {/* Cartes de statistiques - Toutes en StatCard Phase 2 */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 auto-rows-fr">
        <StatCard
          title="Total locataires"
          value={insights.totalTenants?.toString() || '0'}
          iconName="Users"
          color="indigo"
          trendValue={0}
          trendLabel="% vs mois dernier"
          trendDirection="flat"
          rightIndicator="chevron"
          onClick={() => handleCardFilter('total', null)}
          isActive={getActiveChip() === 'total'}
        />
        
        <StatCard
          title="Avec bail actif"
          value={insights.tenantsWithActiveLeases?.toString() || '0'}
          iconName="UserCheck"
          color="green"
          trendValue={0}
          trendLabel="% vs mois dernier"
          trendDirection="flat"
          rightIndicator="chevron"
          onClick={() => handleCardFilter('status', 'withActiveLeases')}
          isActive={getActiveChip() === 'withActiveLeases'}
        />
        
        <StatCard
          title="Sans bail"
          value={insights.tenantsWithoutLeases?.toString() || '0'}
          iconName="UserX"
          color="amber"
          trendValue={0}
          trendLabel="% vs mois dernier"
          trendDirection="flat"
          rightIndicator="chevron"
          onClick={() => handleCardFilter('status', 'withoutLeases')}
          isActive={getActiveChip() === 'withoutLeases'}
        />
        
        <StatCard
          title="% actifs"
          value={`${Math.round((insights.totalTenants && insights.totalTenants > 0) ? ((insights.tenantsWithActiveLeases || 0) / insights.totalTenants) * 100 : 0)}%`}
          iconName="Users"
          color={(insights.totalTenants && insights.totalTenants > 0 && ((insights.tenantsWithActiveLeases || 0) / insights.totalTenants) > 0.8) ? 'green' : 'amber'}
          trendValue={0}
          trendLabel="% vs mois dernier"
          trendDirection="flat"
          rightIndicator="progress"
          progressValue={(insights.totalTenants && insights.totalTenants > 0) ? ((insights.tenantsWithActiveLeases || 0) / insights.totalTenants) * 100 : 0}
        />
        
        {(insights.overduePayments ?? 0) > 0 && (
          <StatCard
            title="Retards de paiement"
            value={insights.overduePayments.toString()}
            iconName="Clock"
            color="red"
            trendValue={0}
            trendLabel="% vs mois dernier"
            trendDirection="flat"
            rightIndicator="chevron"
            onClick={() => handleCardFilter('status', 'overduePayments')}
            isActive={getActiveChip() === 'overduePayments'}
          />
        )}
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des Locataires</CardTitle>
          <CardDescription>
            Recherchez et gérez vos locataires
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <SearchInput
              placeholder="Rechercher un locataire..."
              onSearch={handleSearch}
              className="max-w-md"
              defaultValue={searchParams.get('search') || ''}
            />
          </div>

          {/* Table */}
          {initialData.data.length > 0 ? (
            <>
              <Table hover compact>
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Locataire</TableHeaderCell>
                    <TableHeaderCell>Contact</TableHeaderCell>
                    <TableHeaderCell>Bien</TableHeaderCell>
                    <TableHeaderCell>Baux Actifs</TableHeaderCell>
                    <TableHeaderCell>Statut</TableHeaderCell>
                    <TableHeaderCell>Dernier Bail</TableHeaderCell>
                    <TableHeaderCell>Actions</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initialData.data.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell>
                        <div>
                          <Link 
                            href={`/locataires/${tenant.id}`}
                            className="font-medium text-gray-900 hover:text-primary-600"
                          >
                            {tenant.firstName} {tenant.lastName}
                          </Link>
                          <div className="text-sm text-gray-500">
                            Membre depuis {new Date(tenant.createdAt).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-gray-400" />
                            <span>{tenant.email}</span>
                          </div>
                          {tenant.phone && (
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="h-4 w-4 text-gray-400" />
                              <span>{tenant.phone}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(tenant.Lease?.length || 0) > 0 ? (
                          <div className="space-y-1">
                            {tenant.Lease
                              .filter(lease => lease.status === 'ACTIF')
                              .map((lease, index) => (
                                <div key={index} className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-gray-400" />
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">
                                      {lease.Property.name}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {lease.Property.address}
                                    </div>
                                  </div>
                                </div>
                              ))
                            }
                            {tenant.Lease.filter(lease => lease.status === 'ACTIF').length === 0 && (
                              <span className="text-gray-400 text-sm">Aucun bien actif</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">Aucun bail</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-400" />
                          <span>
                            {(() => {
                              const activeLeasesCount = tenant.Lease.filter(lease => lease.status === 'ACTIF').length;
                              return `${activeLeasesCount} bail${activeLeasesCount > 1 ? 'x' : ''} actif${activeLeasesCount > 1 ? 's' : ''}`;
                            })()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(tenant)}
                      </TableCell>
                      <TableCell>
                        {(tenant.Lease?.length || 0) > 0 ? (
                          <div className="text-sm text-gray-600">
                            {new Date(tenant.Lease[0].startDate).toLocaleDateString('fr-FR')}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewTenant(tenant)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setEditingTenant(tenant);
                              setTenantFormOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteTenant(tenant)}
                            disabled={tenant.Lease.some(lease => lease.status === 'ACTIF')}
                            title={tenant.Lease.some(lease => lease.status === 'ACTIF') 
                              ? 'Impossible de supprimer : bail(s) actif(s)' 
                              : 'Supprimer le locataire'
                            }
                            className={tenant.Lease.some(lease => lease.status === 'ACTIF') 
                              ? 'opacity-50 cursor-not-allowed' 
                              : 'text-red-600 hover:text-red-700'
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {initialData.pagination.pages > 1 && (
                <div className="mt-6">
                  <Pagination
                    currentPage={initialData.pagination.page}
                    totalPages={initialData.pagination.pages}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </>
          ) : (
            <EmptyState
              icon="Users"
              title="Aucun locataire trouvé"
              description="Aucun locataire ne correspond à votre recherche. Essayez de modifier vos critères."
              action={
                <Link href="/locataires/new">
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter un locataire
                  </Button>
                </Link>
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedTenant ? `${selectedTenant.firstName} ${selectedTenant.lastName}` : ''}
        size="lg"
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Fermer
            </Button>
            <Link href={`/locataires/${selectedTenant?.id}/edit`}>
              <Button onClick={() => setModalOpen(false)}>
                <Edit className="h-4 w-4 mr-2" />
                Modifier
              </Button>
            </Link>
          </div>
        }
      >
        {selectedTenant && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Email</label>
                <p className="text-gray-900">{selectedTenant.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Téléphone</label>
                <p className="text-gray-900">{selectedTenant.phone || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Date de naissance</label>
                <p className="text-gray-900">
                  {selectedTenant.birthDate ? new Date(selectedTenant.birthDate).toLocaleDateString('fr-FR') : '-'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Nationalité</label>
                <p className="text-gray-900">{selectedTenant.nationality || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Statut</label>
                <div className="mt-1">{getStatusBadge(selectedTenant)}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Baux</label>
                <p className="text-gray-900">{selectedTenant._count.Lease}</p>
              </div>
            </div>
            
            {(selectedTenant.Lease?.length || 0) > 0 && (
              <div className="mt-4">
                <label className="text-sm font-medium text-gray-700">Baux</label>
                <div className="mt-2 space-y-2">
                  {selectedTenant.Lease.map((lease) => (
                    <div key={lease.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">{lease.Property.name}</p>
                          <p className="text-sm text-gray-600">{lease.Property.address}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(lease.startDate).toLocaleDateString('fr-FR')} - 
                            {lease.endDate ? new Date(lease.endDate).toLocaleDateString('fr-FR') : 'En cours'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">€{lease.rentAmount.toLocaleString('fr-FR')}/mois</p>
                          <Badge variant={lease.status === 'ACTIF' ? 'success' : 'gray'}>
                            {lease.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedTenant.notes && (
              <div>
                <label className="text-sm font-medium text-gray-700">Notes</label>
                <p className="text-gray-900 mt-1">{selectedTenant.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Tenant Form Modal */}
      <TenantEditModalV2
        isOpen={tenantFormOpen}
        onClose={() => {
          setTenantFormOpen(false);
          setEditingTenant(null);
        }}
        onSubmit={handleTenantSubmit}
        initialData={editingTenant}
        title={editingTenant ? 'Modifier le Locataire' : 'Nouveau Locataire'}
      />

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false, message: '' })}
        title={errorModal.title}
        message={errorModal.message}
        details={errorModal.details}
      />
    </div>
  );
}
