'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { 
  X, 
  Building2, 
  Users, 
  Calendar, 
  Euro, 
  FileText, 
  Settings, 
  Edit, 
  Trash2,
  Eye,
  Upload,
  Send,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';
import { LeaseWithDetails } from '@/lib/services/leasesService';

interface LeasesDetailDrawerProps {
  lease: LeaseWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (lease: LeaseWithDetails) => void;
  onDelete?: (lease: LeaseWithDetails) => void;
  onActions?: (lease: LeaseWithDetails) => void;
  onViewFull?: (lease: LeaseWithDetails) => void;
  onUploadDocument?: (lease: LeaseWithDetails) => void;
  onSendForSignature?: (lease: LeaseWithDetails) => void;
  onTerminate?: (lease: LeaseWithDetails) => void;
}

export function LeasesDetailDrawer({
  lease,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onActions,
  onViewFull,
  onUploadDocument,
  onSendForSignature,
  onTerminate
}: LeasesDetailDrawerProps) {
  if (!isOpen || !lease) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
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

  const getTypeLabel = (type: string) => {
    const typeConfig = {
      'residential': 'Résidentiel',
      'commercial': 'Commercial',
      'garage': 'Garage'
    };
    return typeConfig[type as keyof typeof typeConfig] || type;
  };

  const getWorkflowActions = () => {
    const actions = [];

    switch (lease.status) {
      case 'BROUILLON':
        actions.push(
          <Button
            key="send"
            variant="default"
            size="sm"
            onClick={() => onSendForSignature?.(lease)}
            className="flex items-center gap-2"
          >
            <Send className="h-4 w-4" />
            Envoyer à la signature
          </Button>
        );
        break;
      case 'ENVOYÉ':
        actions.push(
          <Button
            key="upload"
            variant="default"
            size="sm"
            onClick={() => onUploadDocument?.(lease)}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Uploader bail signé
          </Button>
        );
        break;
      case 'ACTIF':
      case 'SIGNÉ':
        actions.push(
          <Button
            key="terminate"
            variant="outline"
            size="sm"
            onClick={() => onTerminate?.(lease)}
            className="flex items-center gap-2 text-red-600 border-red-300 hover:bg-red-50"
          >
            <XCircle className="h-4 w-4" />
            Résilier
          </Button>
        );
        break;
    }

    return actions;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl transform transition-transform">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Détail du bail
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {lease.Property.name}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-2"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Statut et actions rapides */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Statut et Workflow</CardTitle>
                  {getStatusBadge(lease.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {getWorkflowActions()}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewFull?.(lease)}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Ouvrir complet
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Informations du bien */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Building2 className="h-5 w-5" />
                  Bien immobilier
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h3 className="font-medium text-gray-900">{lease.Property.name}</h3>
                  <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                    <MapPin className="h-4 w-4" />
                    {lease.Property.address}, {lease.Property.city} {lease.Property.postalCode}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Informations du locataire */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5" />
                  Locataire(s)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Locataire principal */}
                <div className="border rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {lease.Tenant.firstName} {lease.Tenant.lastName}
                      </h4>
                      <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                        <div className="flex items-center gap-1">
                          <Mail className="h-4 w-4" />
                          {lease.Tenant.email}
                        </div>
                        {lease.Tenant.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-4 w-4" />
                            {lease.Tenant.phone}
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Principal
                    </Badge>
                  </div>
                </div>

                {/* Locataires secondaires */}
                {lease.secondaryTenants && lease.secondaryTenants.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-700">Locataires secondaires</h4>
                    {lease.secondaryTenants.map((tenant) => (
                      <div key={tenant.id} className="border rounded-lg p-3 bg-blue-50">
                        <h5 className="font-medium text-gray-900">
                          {tenant.firstName} {tenant.lastName}
                        </h5>
                        <div className="text-sm text-gray-600 mt-1">
                          {tenant.email}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Détails du bail */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5" />
                  Détails du bail
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Type</label>
                    <p className="text-gray-900">{getTypeLabel(lease.type)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Meublé</label>
                    <p className="text-gray-900">
                      {lease.furnishedType === 'meuble' ? 'Oui' : 'Non'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Début</label>
                    <p className="text-gray-900">{formatDate(lease.startDate)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Fin</label>
                    <p className="text-gray-900">
                      {lease.endDate ? formatDate(lease.endDate) : 'Non définie'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Loyer</label>
                    <p className="text-gray-900 font-medium">{formatCurrency(lease.rentAmount)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Charges</label>
                    <p className="text-gray-900">{formatCurrency(lease.charges)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Dépôt</label>
                    <p className="text-gray-900">{formatCurrency(lease.deposit)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Jour de paiement</label>
                    <p className="text-gray-900">
                      {lease.paymentDay ? `Le ${lease.paymentDay}` : 'Non défini'}
                    </p>
                  </div>
                </div>

                {lease.indexationType !== 'none' && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Indexation</label>
                    <p className="text-gray-900">
                      {lease.indexationType === 'insee' ? 'IRL (INSEE)' : 'Manuelle'}
                    </p>
                  </div>
                )}

                {lease.notes && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Notes</label>
                    <p className="text-gray-900 text-sm bg-gray-50 p-3 rounded-lg">
                      {lease.notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Prochaine action et alertes */}
            {(lease.nextAction || !lease.hasSignedLease || lease.daysUntilExpiration || lease.daysUntilIndexation) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AlertTriangle className="h-5 w-5" />
                    Actions et Alertes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {lease.nextAction && (
                    <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span className="text-blue-800 font-medium">{lease.nextAction}</span>
                    </div>
                  )}

                  {!lease.hasSignedLease && (
                    <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      <span className="text-orange-800">Bail non signé - Document manquant</span>
                    </div>
                  )}

                  {lease.daysUntilExpiration && lease.daysUntilExpiration <= 30 && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                      <Calendar className="h-4 w-4 text-red-600" />
                      <span className="text-red-800">
                        Expire dans {lease.daysUntilExpiration} jour{lease.daysUntilExpiration > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}

                  {lease.daysUntilIndexation && lease.daysUntilIndexation <= 30 && (
                    <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
                      <Euro className="h-4 w-4 text-yellow-600" />
                      <span className="text-yellow-800">
                        Indexation due dans {lease.daysUntilIndexation} jour{lease.daysUntilIndexation > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Footer avec actions */}
          <div className="border-t border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit?.(lease)}
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Modifier
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onActions?.(lease)}
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Actions
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete?.(lease)}
                className="flex items-center gap-2 text-red-600 border-red-300 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Supprimer
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
