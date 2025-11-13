'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '@/components/ui/Table';
import { 
  Eye, 
  Edit, 
  Trash2, 
  Settings, 
  Building2, 
  Users, 
  Calendar, 
  Euro,
  AlertTriangle,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  MoreHorizontal
} from 'lucide-react';
import { LeaseWithDetails } from '@/lib/services/leasesService';
import { SkeletonTable, useLoadingDelay } from '@/components/ui';

interface LeasesTableProps {
  leases: LeaseWithDetails[];
  loading?: boolean;
  onView?: (lease: LeaseWithDetails) => void;
  onEdit?: (lease: LeaseWithDetails) => void;
  onDelete?: (lease: LeaseWithDetails) => void;
  onActions?: (lease: LeaseWithDetails) => void;
  selectedIds?: Set<string>;
  onSelectionChange?: (selectedIds: Set<string>) => void;
  onSelectAll?: (selected: boolean) => void;
  showSelection?: boolean;
  showActions?: boolean;
}

export function LeasesTable({
  leases,
  loading = false,
  onView,
  onEdit,
  onDelete,
  onActions,
  selectedIds = new Set(),
  onSelectionChange,
  onSelectAll,
  showSelection = true,
  showActions = true
}: LeasesTableProps) {
  const [sortField, setSortField] = useState<string>('startDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectLease = (leaseId: string, selected: boolean) => {
    if (!onSelectionChange) return;
    
    const newSelection = new Set(selectedIds);
    if (selected) {
      newSelection.add(leaseId);
    } else {
      newSelection.delete(leaseId);
    }
    onSelectionChange(newSelection);
  };

  const handleSelectAll = (selected: boolean) => {
    if (onSelectAll) {
      onSelectAll(selected);
    }
  };

  const getStatusBadge = (status: string, runtimeStatus: string) => {
    const statusConfig = {
      'BROUILLON': { color: 'gray', icon: <Edit className="h-3 w-3" /> },
      'ENVOYÉ': { color: 'blue', icon: <Clock className="h-3 w-3" /> },
      'SIGNÉ': { color: 'green', icon: <CheckCircle className="h-3 w-3" /> },
      'ACTIF': { color: 'green', icon: <CheckCircle className="h-3 w-3" /> },
      'RÉSILIÉ': { color: 'red', icon: <XCircle className="h-3 w-3" /> }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['BROUILLON'];
    
    return (
      <Badge 
        variant="outline" 
        className={`flex items-center gap-1 ${
          config.color === 'green' ? 'bg-green-50 text-green-700 border-green-200' :
          config.color === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-200' :
          config.color === 'red' ? 'bg-red-50 text-red-700 border-red-200' :
          'bg-gray-50 text-gray-700 border-gray-200'
        }`}
      >
        {config.icon}
        {status}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const typeConfig = {
      'residential': { label: 'Résidentiel', color: 'blue' },
      'commercial': { label: 'Commercial', color: 'purple' },
      'garage': { label: 'Garage', color: 'gray' }
    };

    const config = typeConfig[type as keyof typeof typeConfig] || typeConfig['residential'];
    
    return (
      <Badge variant="outline" className="text-xs">
        {config.label}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const getNextActionBadge = (lease: LeaseWithDetails) => {
    if (!lease.nextAction) return null;

    const isUrgent = lease.daysUntilExpiration && lease.daysUntilExpiration <= 30;
    const isIndexation = lease.nextAction.includes('Indexation');

    return (
      <Badge 
        variant="outline" 
        className={`text-xs ${
          isUrgent ? 'bg-red-50 text-red-700 border-red-200' :
          isIndexation ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
          'bg-blue-50 text-blue-700 border-blue-200'
        }`}
      >
        {lease.nextAction}
      </Badge>
    );
  };

  const getAlerts = (lease: LeaseWithDetails) => {
    const alerts = [];
    
    if (!lease.hasSignedLease) {
      alerts.push(
        <Badge key="missing-doc" variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Sans bail signé
        </Badge>
      );
    }

    if (lease.daysUntilExpiration && lease.daysUntilExpiration <= 30) {
      alerts.push(
        <Badge key="expiring" variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
          <Calendar className="h-3 w-3 mr-1" />
          Expire bientôt
        </Badge>
      );
    }

    if (lease.daysUntilIndexation && lease.daysUntilIndexation <= 30) {
      alerts.push(
        <Badge key="indexation" variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
          <Euro className="h-3 w-3 mr-1" />
          Indexation due
        </Badge>
      );
    }

    return alerts;
  };

  // Utiliser le hook de délai pour éviter les flashs
  const showLoader = useLoadingDelay(loading);

  if (showLoader) {
    return (
      <Card>
        <CardContent className="p-6">
          <SkeletonTable rows={6} columns={8} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Liste des Baux ({leases.length})</span>
          {showSelection && selectedIds.size > 0 && (
            <Badge variant="secondary">
              {selectedIds.size} sélectionné{selectedIds.size > 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {showSelection && (
                  <TableHeaderCell className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === leases.length && leases.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                  </TableHeaderCell>
                )}
                <TableHeaderCell 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('property.name')}
                >
                  <div className="flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    Bien
                  </div>
                </TableHeaderCell>
                <TableHeaderCell 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('tenant.lastName')}
                >
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    Locataire(s)
                  </div>
                </TableHeaderCell>
                <TableHeaderCell 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('type')}
                >
                  Type
                </TableHeaderCell>
                <TableHeaderCell 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('startDate')}
                >
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Période
                  </div>
                </TableHeaderCell>
                <TableHeaderCell 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('rentAmount')}
                >
                  <div className="flex items-center gap-1">
                    <Euro className="h-4 w-4" />
                    Loyer (€)
                  </div>
                </TableHeaderCell>
                <TableHeaderCell 
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleSort('status')}
                >
                  Statut
                </TableHeaderCell>
                <TableHeaderCell>
                  Prochaine action / Échéance
                </TableHeaderCell>
                {showActions && (
                  <TableHeaderCell className="w-32">
                    Actions
                  </TableHeaderCell>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {leases.map((lease) => (
                <TableRow 
                  key={lease.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => onView?.(lease)}
                >
                  {showSelection && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lease.id)}
                        onChange={(e) => handleSelectLease(lease.id, e.target.checked)}
                        className="rounded border-gray-300"
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div>
                      <div className="font-medium text-gray-900">
                        {lease.Property.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {lease.Property.address}, {lease.Property.city}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium text-gray-900">
                        {lease.Tenant.firstName} {lease.Tenant.lastName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {lease.Tenant.email}
                      </div>
                      {lease.secondaryTenants && lease.secondaryTenants.length > 0 && (
                        <div className="text-xs text-gray-400 mt-1">
                          +{lease.secondaryTenants.length} autre{lease.secondaryTenants.length > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getTypeBadge(lease.type)}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>Du {formatDate(lease.startDate)}</div>
                      {lease.endDate && (
                        <div>Au {formatDate(lease.endDate)}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-gray-900">
                      {formatCurrency(lease.rentAmount)}
                    </div>
                    {lease.charges > 0 && (
                      <div className="text-sm text-gray-500">
                        + {formatCurrency(lease.charges)} charges
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(lease.status, lease.runtimeStatus)}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {getNextActionBadge(lease)}
                      <div className="flex flex-wrap gap-1">
                        {getAlerts(lease)}
                      </div>
                    </div>
                  </TableCell>
                  {showActions && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onView?.(lease)}
                          title="Voir le détail"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit?.(lease)}
                          title="Modifier"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onActions?.(lease)}
                          title="Actions"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete?.(lease)}
                          title="Supprimer"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {leases.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">Aucun bail trouvé</p>
            <p className="text-sm">Ajustez vos filtres ou créez un nouveau bail</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
