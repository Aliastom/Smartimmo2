'use client';

import React, { useState, useEffect } from 'react';
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
  MapPin,
  ChevronDown,
  ChevronRight,
  Download,
  FileCheck,
  FileX,
  Plus,
  MoreHorizontal
} from 'lucide-react';
import { LeaseWithDetails } from '@/lib/services/leasesService';
import { LeaseDocumentsService, LeaseDocumentsSummary } from '@/lib/services/leaseDocumentsService';
import { useUploadReviewModal } from '@/contexts/UploadReviewModalContext';
import { getLeaseDocumentDisplayInfo } from '@/features/leases/utils/leaseDocumentDisplay';
import { Drawer } from '@/components/ui/Drawer';

interface LeasesDetailDrawerV2Props {
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
  onLeaseUpdate?: () => void; // Callback pour notifier les mises à jour du bail
}

export function LeasesDetailDrawerV2({
  lease,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onActions,
  onViewFull,
  onUploadDocument,
  onSendForSignature,
  onTerminate,
  onLeaseUpdate
}: LeasesDetailDrawerV2Props) {
  const [documents, setDocuments] = useState<LeaseDocumentsSummary | null>(null);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  // Hook pour la modal d'upload unifiée
  const { openModalWithDocumentType } = useUploadReviewModal();

  // Charger les documents liés au bail
  useEffect(() => {
    if (lease && isOpen) {
      console.log('🔄 Drawer: Chargement des documents pour le bail', lease.id);
      setLoadingDocuments(true);
      LeaseDocumentsService.getLeaseDocuments(lease.id)
        .then((documents) => {
          console.log('📄 Drawer: Documents chargés:', documents);
          setDocuments(documents);
        })
        .catch((error) => {
          console.error('❌ Drawer: Erreur lors du chargement des documents:', error);
        })
        .finally(() => setLoadingDocuments(false));
    } else if (!isOpen) {
      // Réinitialiser les documents quand le drawer se ferme
      setDocuments(null);
    }
  }, [lease, isOpen]);

  // Recharger les documents quand le drawer s'ouvre (même bail)
  useEffect(() => {
    if (lease && isOpen) {
      console.log('🔄 Drawer: Rechargement forcé des documents à l\'ouverture');
      setLoadingDocuments(true);
      LeaseDocumentsService.getLeaseDocuments(lease.id)
        .then((documents) => {
          console.log('📄 Drawer: Documents rechargés à l\'ouverture:', documents);
          setDocuments(documents);
        })
        .catch((error) => {
          console.error('❌ Drawer: Erreur lors du rechargement:', error);
        })
        .finally(() => setLoadingDocuments(false));
    }
  }, [isOpen]); // Se déclenche à chaque ouverture/fermeture


  // Handler pour ouvrir la modal d'upload avec un type spécifique
  const handleUploadDocument = (documentTypeCode: string, documentTypeLabel: string) => {
    if (!lease) return;
    
    openModalWithDocumentType(documentTypeCode, documentTypeLabel, {
      autoLinkingContext: {
        leaseId: lease.id,
        propertyId: lease.Property.id,
        tenantsIds: [lease.Tenant.id]
      },
      onSuccess: () => {
        // Notifier le composant parent pour recharger les données du bail
        onLeaseUpdate?.();
        
        // Recharger les documents avec un délai pour laisser le temps à la DB d'être mise à jour
        setTimeout(async () => {
          console.log('🔄 Drawer: Rechargement des documents après upload...');
          setLoadingDocuments(true);
          try {
            const updatedDocuments = await LeaseDocumentsService.getLeaseDocuments(lease.id);
            setDocuments(updatedDocuments);
            console.log('✅ Drawer: Documents rechargés après upload:', updatedDocuments);
          } catch (error) {
            console.error('❌ Drawer: Erreur lors du rechargement des documents:', error);
          } finally {
            setLoadingDocuments(false);
          }
        }, 1000);
      }
    });
  };


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

  // Workflow visuel
  const getWorkflowSteps = () => {
    const steps = [
      { key: 'BROUILLON', label: 'Brouillon', icon: <Edit className="h-4 w-4" /> },
      { key: 'ENVOYÉ', label: 'Envoyé', icon: <Send className="h-4 w-4" /> },
      { key: 'SIGNÉ', label: 'Signé', icon: <CheckCircle className="h-4 w-4" /> },
      { key: 'ACTIF', label: 'Actif', icon: <CheckCircle className="h-4 w-4" /> },
      { key: 'RÉSILIÉ', label: 'Résilié', icon: <XCircle className="h-4 w-4" /> }
    ];

    const currentIndex = steps.findIndex(step => step.key === lease.status);
    
    return (
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = index <= currentIndex;
          const isCurrent = index === currentIndex;
          
          return (
            <div key={step.key} className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                isCurrent 
                  ? 'bg-blue-500 border-blue-500 text-white' 
                  : isActive 
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'bg-gray-100 border-gray-300 text-gray-500'
              }`}>
                {step.icon}
              </div>
              <span className={`text-xs mt-1 ${
                isCurrent ? 'text-blue-600 font-medium' : 
                isActive ? 'text-green-600' : 'text-gray-500'
              }`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // Composant pour un document
  const DocumentItem = ({ 
    document, 
    label, 
    badgeLabel,
    badgeVariant,
    documentTypeCode,
    onView 
  }: { 
    document: any; 
    label: string; 
    badgeLabel?: string;
    badgeVariant?: 'secondary' | 'warning' | 'success';
    documentTypeCode: string;
    onView?: () => void; 
  }) => {
    if (document) {
      return (
        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-3">
            <FileCheck className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-green-800">{label}</p>
              {badgeLabel && badgeVariant && (
                <Badge variant={badgeVariant} size="sm" className="mt-1">
                  {badgeLabel}
                </Badge>
              )}
              <p className="text-sm text-green-600">{document.filenameOriginal}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onView}
            className="text-green-700 border-green-300 hover:bg-green-100"
          >
            <Eye className="h-4 w-4 mr-1" />
            Ouvrir
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
        <div className="flex items-center gap-3">
          <FileX className="h-5 w-5 text-orange-600" />
          <div>
            <p className="font-medium text-orange-800">{label}</p>
            <p className="text-sm text-orange-600">Document manquant</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleUploadDocument(documentTypeCode, label)}
          className="text-orange-700 border-orange-300 hover:bg-orange-100"
        >
          <Upload className="h-4 w-4 mr-1" />
          Uploader
        </Button>
      </div>
    );
  };

  // Actions rapides
  const getQuickActions = () => {
    const actions = [
      {
        label: 'Uploader bail signé',
        icon: <Upload className="h-4 w-4" />,
        onClick: () => handleUploadDocument('BAIL_SIGNE', 'Bail signé'),
        show: ['ENVOYÉ', 'SIGNÉ'].includes(lease.status)
      },
      {
        label: 'Envoyer à la signature',
        icon: <Send className="h-4 w-4" />,
        onClick: () => onSendForSignature?.(lease),
        show: lease.status === 'BROUILLON'
      },
      {
        label: 'Voir transactions',
        icon: <FileText className="h-4 w-4" />,
        onClick: () => console.log('Voir transactions'),
        show: true
      },
      {
        label: 'Exporter bail PDF',
        icon: <Download className="h-4 w-4" />,
        onClick: () => console.log('Exporter PDF'),
        show: true
      },
      {
        label: 'Résilier',
        icon: <XCircle className="h-4 w-4" />,
        onClick: () => onTerminate?.(lease),
        show: ['ACTIF', 'SIGNÉ'].includes(lease.status),
        variant: 'destructive' as const
      }
    ];

    return actions.filter(action => action.show);
  };

  // Alertes dynamiques
  const getAlerts = () => {
    const alerts = [];

    if (!lease.hasSignedLease) {
      alerts.push({
        type: 'error',
        icon: <AlertTriangle className="h-4 w-4" />,
        message: 'Bail signé manquant',
        color: 'bg-red-50 text-red-800 border-red-200'
      });
    }

    if (lease.daysUntilExpiration && lease.daysUntilExpiration <= 30) {
      alerts.push({
        type: 'warning',
        icon: <Calendar className="h-4 w-4" />,
        message: `Expire dans ${lease.daysUntilExpiration} jour${lease.daysUntilExpiration > 1 ? 's' : ''}`,
        color: 'bg-orange-50 text-orange-800 border-orange-200'
      });
    }

    if (lease.daysUntilIndexation && lease.daysUntilIndexation <= 30) {
      alerts.push({
        type: 'info',
        icon: <Euro className="h-4 w-4" />,
        message: `Indexation due dans ${lease.daysUntilIndexation} jour${lease.daysUntilIndexation > 1 ? 's' : ''}`,
        color: 'bg-yellow-50 text-yellow-800 border-yellow-200'
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        type: 'success',
        icon: <CheckCircle className="h-4 w-4" />,
        message: 'Aucune alerte - Tout est à jour',
        color: 'bg-green-50 text-green-800 border-green-200'
      });
    }

    return alerts;
  };
  const leaseDocumentDisplay = getLeaseDocumentDisplayInfo(lease.status, documents?.bailSigne || null);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Détail du bail"
      size="xl"
      footerAlreadyStandardized
      footer={
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
              
              {/* 3️⃣ Actions rapides dropdown */}
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQuickActions(!showQuickActions)}
                  className="flex items-center gap-2"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  Actions
                  <ChevronDown className="h-4 w-4" />
                </Button>
                
                {showQuickActions && (
                  <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                    <div className="p-2 space-y-1">
                      {getQuickActions().map((action, index) => (
                        <Button
                          key={index}
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            action.onClick();
                            setShowQuickActions(false);
                          }}
                          className={`w-full justify-start ${action.variant === 'destructive' ? 'text-red-600 hover:bg-red-50' : ''}`}
                        >
                          {action.icon}
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
      }
    >
      {/* Content */}
      <div className="p-6 space-y-6">
            <section className="border-b border-gray-200 pb-4">
              <p className="text-sm text-gray-500">{lease.Property.name}</p>
            </section>
            {/* 1️⃣ Bloc Workflow visuel */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Statut et Workflow</CardTitle>
                  {getStatusBadge(lease.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Timeline du workflow */}
                <div className="py-4">
                  {getWorkflowSteps()}
                </div>
                
                {/* Actions contextuelles */}
                <div className="flex flex-wrap gap-2">
                  {getQuickActions().slice(0, 2).map((action, index) => (
                    <Button
                      key={index}
                      variant={action.variant || "default"}
                      size="sm"
                      onClick={action.onClick}
                      className="flex items-center gap-2"
                    >
                      {action.icon}
                      {action.label}
                    </Button>
                  ))}
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

            {/* 2️⃣ Bloc Documents liés */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5" />
                  Documents liés
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingDocuments ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Chargement des documents...</p>
                  </div>
                ) : (
                  <>
                    <DocumentItem
                      document={documents?.bailSigne}
                      label={leaseDocumentDisplay.label}
                      badgeLabel={leaseDocumentDisplay.badgeLabel}
                      badgeVariant={leaseDocumentDisplay.badgeVariant}
                      documentTypeCode="BAIL_SIGNE"
                      onView={() => window.open(documents?.bailSigne?.url, '_blank')}
                    />
                    <DocumentItem
                      document={documents?.etatLieuxEntrant}
                      label="État des lieux entrant"
                      documentTypeCode="ETAT_LIEUX_ENTRANT"
                      onView={() => window.open(documents?.etatLieuxEntrant?.url, '_blank')}
                    />
                    <DocumentItem
                      document={documents?.etatLieuxSortant}
                      label="État des lieux sortant"
                      documentTypeCode="ETAT_LIEUX_SORTANT"
                      onView={() => window.open(documents?.etatLieuxSortant?.url, '_blank')}
                    />
                    <DocumentItem
                      document={documents?.assuranceLocataire}
                      label="Assurance locataire"
                      documentTypeCode="ASSURANCE_LOCATAIRE"
                      onView={() => window.open(documents?.assuranceLocataire?.url, '_blank')}
                    />
                    <DocumentItem
                      document={documents?.depotGarantie}
                      label="Dépôt de garantie"
                      documentTypeCode="DEPOT_GARANTIE"
                      onView={() => window.open(documents?.depotGarantie?.url, '_blank')}
                    />
                    
                    {/* Autres documents */}
                    {documents?.otherDocuments && documents.otherDocuments.length > 0 && (
                      <div className="pt-3 border-t">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Autres documents</h4>
                        {documents.otherDocuments.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-gray-600" />
                              <span className="text-sm">{doc.DocumentType.label}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(doc.url, '_blank')}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
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

            {/* 4️⃣ Bloc Actions & Alertes amélioré */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-5 w-5" />
                  Actions et Alertes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {getAlerts().map((alert, index) => (
                  <div key={index} className={`flex items-center gap-2 p-3 rounded-lg border ${alert.color}`}>
                    {alert.icon}
                    <span className="font-medium">{alert.message}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
      </div>
    </Drawer>
  );
}
