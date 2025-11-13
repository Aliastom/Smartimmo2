'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { 
  AlertTriangle, 
  Calendar, 
  FileText, 
  Euro, 
  Eye, 
  ExternalLink,
  Building2,
  Users,
  Clock,
  ChevronRight,
  CheckCircle
} from 'lucide-react';
import { LeaseWithDetails } from '@/lib/services/leasesService';

interface LeasesAlertsSectionProps {
  expiringLeases: LeaseWithDetails[];
  missingDocumentsLeases: LeaseWithDetails[];
  indexationDueLeases: LeaseWithDetails[];
  onViewLease?: (lease: LeaseWithDetails) => void;
  onViewAll?: (type: 'expiring' | 'missing' | 'indexation') => void;
  loading?: boolean;
}

export function LeasesAlertsSection({
  expiringLeases,
  missingDocumentsLeases,
  indexationDueLeases,
  onViewLease,
  onViewAll,
  loading = false
}: LeasesAlertsSectionProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const getUrgencyLevel = (days: number) => {
    if (days <= 7) return { level: 'critical', color: 'red', label: 'Critique' };
    if (days <= 30) return { level: 'urgent', color: 'orange', label: 'Urgent' };
    return { level: 'warning', color: 'yellow', label: 'Attention' };
  };

  const LeaseItem = ({ lease, type }: { lease: LeaseWithDetails; type: 'expiring' | 'missing' | 'indexation' }) => {
    const getIcon = () => {
      switch (type) {
        case 'expiring': return <Calendar className="h-4 w-4" />;
        case 'missing': return <FileText className="h-4 w-4" />;
        case 'indexation': return <Euro className="h-4 w-4" />;
      }
    };

    const getBadge = () => {
      switch (type) {
        case 'expiring':
          if (lease.daysUntilExpiration) {
            const urgency = getUrgencyLevel(lease.daysUntilExpiration);
            return (
              <Badge 
                variant="outline" 
                className={`text-xs ${
                  urgency.color === 'red' ? 'bg-red-50 text-red-700 border-red-200' :
                  urgency.color === 'orange' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                  'bg-yellow-50 text-yellow-700 border-yellow-200'
                }`}
              >
                {lease.daysUntilExpiration}j
              </Badge>
            );
          }
          return null;
        case 'missing':
          return (
            <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
              ⚠️ Manquant
            </Badge>
          );
        case 'indexation':
          if (lease.daysUntilIndexation) {
            return (
              <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                {lease.daysUntilIndexation}j
              </Badge>
            );
          }
          return null;
      }
    };

    return (
      <div 
        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => onViewLease?.(lease)}
      >
        <div className="flex items-center gap-3 flex-1">
          <div className={`p-2 rounded-lg ${
            type === 'expiring' ? 'bg-red-50 text-red-600' :
            type === 'missing' ? 'bg-orange-50 text-orange-600' :
            'bg-yellow-50 text-yellow-600'
          }`}>
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-gray-900 truncate">
                {lease.Property.name}
              </h4>
              {getBadge()}
            </div>
            <div className="text-sm text-gray-600">
              <div className="flex items-center gap-1 mb-1">
                <Users className="h-3 w-3" />
                {lease.Tenant.firstName} {lease.Tenant.lastName}
              </div>
              <div className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {lease.Property.address}, {lease.Property.city}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right text-sm">
            <div className="font-medium text-gray-900">
              {formatCurrency(lease.rentAmount)}
            </div>
            <div className="text-gray-500">
              {formatDate(lease.startDate)}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2].map((j) => (
                  <div key={j} className="h-16 bg-gray-200 rounded animate-pulse"></div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const hasAlerts = expiringLeases.length > 0 || missingDocumentsLeases.length > 0 || indexationDueLeases.length > 0;

  if (!hasAlerts) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucune alerte
            </h3>
            <p className="text-gray-600">
              Tous vos baux sont à jour et aucune action urgente n'est requise.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Baux expirant */}
      {expiringLeases.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-red-50 rounded-lg">
                  <Calendar className="h-5 w-5 text-red-600" />
                </div>
                Baux expirant sous 90 jours
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  {expiringLeases.length}
                </Badge>
              </CardTitle>
              {onViewAll && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewAll('expiring')}
                  className="flex items-center gap-2"
                >
                  Voir tous
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {expiringLeases.slice(0, 5).map((lease) => (
                <LeaseItem key={lease.id} lease={lease} type="expiring" />
              ))}
              {expiringLeases.length > 5 && (
                <div className="text-center pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewAll?.('expiring')}
                    className="text-blue-600"
                  >
                    Voir {expiringLeases.length - 5} autre{expiringLeases.length - 5 > 1 ? 's' : ''}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Baux sans documents signés */}
      {missingDocumentsLeases.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-orange-50 rounded-lg">
                  <FileText className="h-5 w-5 text-orange-600" />
                </div>
                Baux sans document signé
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  {missingDocumentsLeases.length}
                </Badge>
              </CardTitle>
              {onViewAll && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewAll('missing')}
                  className="flex items-center gap-2"
                >
                  Voir tous
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {missingDocumentsLeases.slice(0, 5).map((lease) => (
                <LeaseItem key={lease.id} lease={lease} type="missing" />
              ))}
              {missingDocumentsLeases.length > 5 && (
                <div className="text-center pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewAll?.('missing')}
                    className="text-blue-600"
                  >
                    Voir {missingDocumentsLeases.length - 5} autre{missingDocumentsLeases.length - 5 > 1 ? 's' : ''}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Indexation due */}
      {indexationDueLeases.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-yellow-50 rounded-lg">
                  <Euro className="h-5 w-5 text-yellow-600" />
                </div>
                Indexation à traiter
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  {indexationDueLeases.length}
                </Badge>
              </CardTitle>
              {onViewAll && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewAll('indexation')}
                  className="flex items-center gap-2"
                >
                  Voir tous
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {indexationDueLeases.slice(0, 5).map((lease) => (
                <LeaseItem key={lease.id} lease={lease} type="indexation" />
              ))}
              {indexationDueLeases.length > 5 && (
                <div className="text-center pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewAll?.('indexation')}
                    className="text-blue-600"
                  >
                    Voir {indexationDueLeases.length - 5} autre{indexationDueLeases.length - 5 > 1 ? 's' : ''}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
