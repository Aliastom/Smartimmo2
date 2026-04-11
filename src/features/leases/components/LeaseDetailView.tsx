'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, FileText, Euro, Upload, Send, RotateCcw, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LeaseDetailHeader } from './LeaseDetailHeader';
import { LeaseDetailPaymentsSection } from './LeaseDetailPaymentsSection';
import { formatLeasePeriod } from '@/utils/leaseUtils';
import { getLocalDB } from '@/lib/offline/db';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import type { LeaseWithDetails } from '@/lib/services/leasesService';
import type { LeasePaymentsTimelineMonth } from '../hooks/useLeasePaymentsTimeline';
import { useLeaseIndexationStatus } from '../hooks/useLeaseIndexationStatus';
import { normalizeLeaseContractStatus } from '../utils/leaseWorkflowStatus';
import { getLeaseDocumentDisplayInfo } from '../utils/leaseDocumentDisplay';

interface LeaseDetailViewProps {
  lease: LeaseWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (lease: LeaseWithDetails) => void;
  onDelete: (lease: LeaseWithDetails) => void;
  onTerminateLease?: (lease: LeaseWithDetails) => void;
  onGenerateReceipt?: (lease: LeaseWithDetails) => void;
  onEnregistrerPaiement?: (lease: LeaseWithDetails, month: LeasePaymentsTimelineMonth) => void;
  onVoirTransaction?: (lease: LeaseWithDetails, month: LeasePaymentsTimelineMonth) => void;
  onIndexLease?: (lease: LeaseWithDetails) => void;
  onRenewLease?: (lease: LeaseWithDetails) => void;
  onSendForSignature?: (lease: LeaseWithDetails) => Promise<void> | void;
  onCancelSend?: (lease: LeaseWithDetails) => Promise<void> | void;
  onUploadSignedLease?: (lease: LeaseWithDetails, file: File) => Promise<void> | void;
  onActivateLease?: (lease: LeaseWithDetails) => Promise<void> | void;
}

const formatDate = (dateString: string): string =>
  new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

const getFurnishedLabel = (furnishedType: string | null) => {
  const types: Record<string, string> = {
    VIDE: 'Vide',
    MEUBLE: 'Meublé',
    COLOCATION_MEUBLEE: 'Colocation meublée',
    COLOCATION_VIDE: 'Colocation vide',
  };
  return types[furnishedType || 'VIDE'] || 'Vide';
};

const getIndexationLabel = (indexationType: string | null) => {
  if (!indexationType || indexationType === 'AUCUNE') return 'Aucune';
  const types: Record<string, string> = {
    IRL: 'IRL (Indice de Référence des Loyers)',
    ILAT: 'ILAT',
    ICC: 'ICC',
    AUTRE: 'Autre',
  };
  return types[indexationType] || indexationType;
};

type WorkflowStage = 'BROUILLON' | 'ENVOYE' | 'SIGNE' | 'ACTIF' | 'RESILIE';

const getWorkflowStage = (lease: LeaseWithDetails): WorkflowStage => {
  const raw = String(lease.status || '').trim().toUpperCase();
  const contract = normalizeLeaseContractStatus(lease.status);
  if (contract === 'RESILIE' || contract === 'ARCHIVE') return 'RESILIE';
  if (contract === 'ACTIF') return 'ACTIF';
  if (raw.includes('SIGN')) return 'SIGNE';
  if (
    raw.includes('ENVOY') ||
    raw === 'SENT' ||
    raw === 'A_SIGNER' ||
    raw === 'A_ENVOYER' ||
    raw === 'À_ENVOYER' ||
    raw === 'TO_SEND'
  ) {
    return 'ENVOYE';
  }
  return 'BROUILLON';
};

export default function LeaseDetailView({
  lease,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onTerminateLease,
  onGenerateReceipt,
  onEnregistrerPaiement,
  onVoirTransaction,
  onIndexLease,
  onRenewLease,
  onSendForSignature,
  onCancelSend,
  onUploadSignedLease,
  onActivateLease,
}: LeaseDetailViewProps) {
  const { organizationId } = useCurrentOrganization();
  const [signedLeaseDocument, setSignedLeaseDocument] = useState<any | null>(null);
  const [loadingDocument, setLoadingDocument] = useState(false);
  const [uploadingSignedLease, setUploadingSignedLease] = useState(false);
  const [workflowActionLoading, setWorkflowActionLoading] = useState<null | 'send' | 'cancel' | 'upload' | 'activate' | 'terminate'>(null);
  const workflowSectionRef = useRef<HTMLDivElement>(null);

  const scrollToWorkflow = useCallback(() => {
    workflowSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const loadSignedLease = useCallback(async () => {
    if (!lease || !organizationId) {
      setSignedLeaseDocument(null);
      return;
    }
    try {
      setLoadingDocument(true);
      const db = await getLocalDB();
      const allLinks = await db.DocumentLink.toArray();
      const leaseLinks = allLinks.filter(
        (link: any) =>
          (link.linkedType?.toLowerCase() === 'lease' || link.linkedType === 'LEASE') &&
          link.linkedId === lease.id
      );
      if (leaseLinks.length === 0) {
        setSignedLeaseDocument(null);
        return;
      }
      const documentIds = leaseLinks.map((link: any) => link.documentId);
      const documents = await db.Document.where('id')
        .anyOf(documentIds)
        .filter((doc: any) => doc.organizationId === organizationId && !doc.deletedAt)
        .toArray();
      const documentTypeIds = documents
        .map((doc: any) => doc.documentTypeId)
        .filter((id: any): id is string => id != null);
      if (documentTypeIds.length === 0) {
        setSignedLeaseDocument(null);
        return;
      }
      const documentTypes = await db.DocumentType.where('id').anyOf(documentTypeIds).toArray();
      const bailSigneType = documentTypes.find((dt: any) => dt.code === 'BAIL_SIGNE');
      if (!bailSigneType) {
        setSignedLeaseDocument(null);
        return;
      }
      const bailSigneDoc = documents.find((doc: any) => doc.documentTypeId === bailSigneType.id);
      setSignedLeaseDocument(bailSigneDoc || null);
    } catch (err) {
      console.error('[LeaseDetailView] loadSignedLease', err);
      setSignedLeaseDocument(null);
    } finally {
      setLoadingDocument(false);
    }
  }, [lease?.id, organizationId]);

  useEffect(() => {
    if (!isOpen || !lease || !organizationId) {
      setSignedLeaseDocument(null);
      return;
    }
    loadSignedLease();
  }, [isOpen, lease?.id, organizationId, loadSignedLease]);

  useEffect(() => {
    if (!isOpen || !lease || !organizationId) return;
    const handleRefresh = (event: CustomEvent) => {
      const d = event.detail;
      if (d?.scope === 'global' || (d?.scope === 'property' && d?.propertyId === lease.propertyId)) {
        loadSignedLease();
      }
    };
    window.addEventListener('documents:refresh', handleRefresh as EventListener);
    return () => window.removeEventListener('documents:refresh', handleRefresh as EventListener);
  }, [isOpen, lease?.id, lease?.propertyId, organizationId, loadSignedLease]);

  if (!isOpen || !lease) return null;

  const totalMensuel = lease.rentAmount + (lease.chargesRecupMensuelles || 0);
  const period = formatLeasePeriod(lease.startDate, lease.endDate, lease.furnishedType);
  const workflowStage = getWorkflowStage(lease);
  const workflowSteps: WorkflowStage[] = ['BROUILLON', 'ENVOYE', 'SIGNE', 'ACTIF', 'RESILIE'];
  const currentStepIndex = workflowSteps.indexOf(workflowStage);
  const stepLabels: Record<WorkflowStage, string> = {
    BROUILLON: 'Brouillon',
    ENVOYE: 'Envoyé',
    SIGNE: 'Signé',
    ACTIF: 'Actif',
    RESILIE: 'Résilié',
  };
  const indexationStatus = useLeaseIndexationStatus(lease);
  const indexationLabelByStatus: Record<string, string> = {
    NONE: 'Aucune échéance immédiate',
    UPCOMING: 'À préparer',
    DUE: 'À indexer',
    APPLIED: 'Déjà appliquée',
  };
  const timelineEvents = [
    { key: 'created', date: lease.createdAt, label: 'Bail cree' },
    ...(workflowStage !== 'BROUILLON'
      ? [{ key: 'sent', date: lease.updatedAt || lease.createdAt, label: 'Envoye au locataire' }]
      : []),
    ...(workflowStage === 'SIGNE' || workflowStage === 'ACTIF' || workflowStage === 'RESILIE' || lease.signedPdfUrl
      ? [{ key: 'signed', date: lease.updatedAt || lease.createdAt, label: 'Bail signe' }]
      : []),
    ...(workflowStage === 'ACTIF' || workflowStage === 'RESILIE'
      ? [{ key: 'active', date: lease.updatedAt || lease.createdAt, label: 'Bail active' }]
      : []),
  ];
  const leaseDocumentDisplay = getLeaseDocumentDisplayInfo(lease.status, signedLeaseDocument);

  const handleSignedUploadClick = async () => {
    if (!onUploadSignedLease) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploadingSignedLease(true);
      setWorkflowActionLoading('upload');
      try {
        await onUploadSignedLease(lease, file);
      } finally {
        setUploadingSignedLease(false);
        setWorkflowActionLoading(null);
      }
    };
    input.click();
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 h-screen w-full lg:w-auto lg:max-w-2xl bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Détail du bail</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* 1. Cockpit */}
          <LeaseDetailHeader
            lease={lease}
            onEdit={() => onEdit(lease)}
            onDelete={() => onDelete(lease)}
            onTerminateLease={onTerminateLease ? () => onTerminateLease(lease) : undefined}
            onGenerateReceipt={onGenerateReceipt ? () => onGenerateReceipt(lease) : undefined}
            onEnregistrerPaiement={
              onEnregistrerPaiement ? (month) => onEnregistrerPaiement(lease, month) : undefined
            }
            onIndexLease={onIndexLease ? () => onIndexLease(lease) : () => onEdit(lease)}
            onRenewLease={onRenewLease ? () => onRenewLease(lease) : () => onEdit(lease)}
          />

          <div ref={workflowSectionRef} className="rounded-2xl border border-gray-200 overflow-hidden scroll-mt-4">
            <h3 className="text-lg font-semibold text-gray-900 p-6 border-b border-gray-100">
              Workflow du bail
            </h3>
            <div className="p-6 space-y-5">
              {workflowStage !== 'ACTIF' && workflowStage !== 'RESILIE' && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-xs font-semibold">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Action requise
                </div>
              )}

              <div className="flex items-center gap-2">
                {workflowSteps.map((step, index) => {
                  const active = index === currentStepIndex;
                  const done = index < currentStepIndex;
                  return (
                    <React.Fragment key={step}>
                      <button
                        type="button"
                        onClick={scrollToWorkflow}
                        className="flex flex-col items-center min-w-[72px] rounded-lg p-1 -m-1 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-1"
                      >
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 ${
                            done
                              ? 'bg-green-600 text-white border-green-600'
                              : active
                                ? 'bg-orange-500 text-white border-orange-500 ring-2 ring-orange-200'
                                : 'bg-white text-gray-400 border-gray-200'
                          }`}
                          title={stepLabels[step]}
                        >
                          <span aria-hidden>{done ? '✔' : active ? '●' : '○'}</span>
                        </div>
                        <span
                          className={`text-xs mt-1 text-center ${active ? 'text-orange-800 font-semibold' : 'text-gray-600'}`}
                        >
                          {stepLabels[step]}
                        </span>
                      </button>
                      {index < workflowSteps.length - 1 && (
                        <div
                          className={`h-0.5 flex-1 min-w-[8px] ${done ? 'bg-green-500' : active ? 'bg-orange-300' : 'bg-gray-200'}`}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Action principale</p>
                  {workflowStage !== 'ACTIF' && workflowStage !== 'RESILIE' && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                      <AlertTriangle className="h-3 w-3" />
                      Action requise
                    </span>
                  )}
                </div>

                {workflowStage === 'BROUILLON' && (
                  <Button
                    onClick={async () => {
                      if (!onSendForSignature) return;
                      setWorkflowActionLoading('send');
                      try {
                        await onSendForSignature(lease);
                      } finally {
                        setWorkflowActionLoading(null);
                      }
                    }}
                    disabled={!onSendForSignature || workflowActionLoading !== null}
                    className="w-full sm:w-auto"
                  >
                    {workflowActionLoading === 'send' ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    {workflowActionLoading === 'send' ? 'Envoi en cours...' : 'Envoyer pour signature'}
                  </Button>
                )}

                {workflowStage === 'ENVOYE' && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={handleSignedUploadClick}
                      disabled={!onUploadSignedLease || uploadingSignedLease || workflowActionLoading !== null}
                      className="shadow-soft"
                    >
                      {uploadingSignedLease || workflowActionLoading === 'upload' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {uploadingSignedLease || workflowActionLoading === 'upload'
                        ? 'Upload en cours...'
                        : 'Bail signé (upload PDF)'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        if (!onCancelSend) return;
                        setWorkflowActionLoading('cancel');
                        try {
                          await onCancelSend(lease);
                        } finally {
                          setWorkflowActionLoading(null);
                        }
                      }}
                      disabled={!onCancelSend || workflowActionLoading !== null}
                    >
                      {workflowActionLoading === 'cancel' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4 mr-2" />
                      )}
                      {workflowActionLoading === 'cancel' ? "Annulation..." : "Annuler l'envoi"}
                    </Button>
                  </div>
                )}

                {workflowStage === 'SIGNE' && (
                  <Button
                    onClick={async () => {
                      if (!onActivateLease) return;
                      setWorkflowActionLoading('activate');
                      try {
                        await onActivateLease(lease);
                      } finally {
                        setWorkflowActionLoading(null);
                      }
                    }}
                    disabled={!onActivateLease || workflowActionLoading !== null}
                  >
                    {workflowActionLoading === 'activate' ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    {workflowActionLoading === 'activate' ? 'Activation...' : 'Activer le bail'}
                  </Button>
                )}

                {workflowStage === 'ACTIF' && (
                  <Button
                    variant="danger"
                    onClick={async () => {
                      if (!onTerminateLease) return;
                      setWorkflowActionLoading('terminate');
                      try {
                        await onTerminateLease(lease);
                      } finally {
                        setWorkflowActionLoading(null);
                      }
                    }}
                    disabled={!onTerminateLease || workflowActionLoading !== null}
                  >
                    {workflowActionLoading === 'terminate' ? 'Résiliation...' : 'Résilier le bail'}
                  </Button>
                )}

                {workflowStage === 'RESILIE' && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => onDelete(lease)}
                      className="border-red-300 text-red-700 hover:bg-red-50"
                    >
                      Supprimer le bail
                    </Button>
                    <p className="w-full text-xs text-gray-500">
                      Suppression sécurisée : vérification des dépendances (transactions liées, etc.).
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 overflow-hidden">
            <h3 className="text-lg font-semibold text-gray-900 p-6 border-b border-gray-100">
              Historique du bail
            </h3>
            <div className="p-6">
              <ol className="space-y-3">
                {timelineEvents.map((event, idx) => (
                  <li key={`${event.key}-${idx}`} className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-gray-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{event.label}</p>
                      <p className="text-xs text-gray-500">
                        {event.date ? formatDate(String(event.date)) : 'Date non disponible'}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* 2. Paiements */}
          <LeaseDetailPaymentsSection
            leaseId={lease.id}
            propertyId={lease.propertyId}
            organizationId={lease.organizationId ?? organizationId ?? ''}
            leaseStatus={lease.status}
            leaseStartDate={lease.startDate}
            tenantName={lease.Tenant ? `${lease.Tenant.firstName} ${lease.Tenant.lastName}` : undefined}
            paymentDay={lease.paymentDay ?? 5}
            rentAmount={lease.rentAmount}
            chargesRecup={lease.chargesRecupMensuelles ?? 0}
            onEnregistrer={
              onEnregistrerPaiement ? (month) => onEnregistrerPaiement(lease, month) : undefined
            }
            onVoir={onVoirTransaction ? (month) => onVoirTransaction(lease, month) : undefined}
          />

          {/* 3. Configuration financière */}
          <div className="rounded-2xl border border-gray-200 overflow-hidden">
            <h3 className="text-lg font-semibold text-gray-900 p-6 border-b border-gray-100 flex items-center gap-2">
              <Euro className="h-5 w-5" />
              Configuration financière
            </h3>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="text-center py-1">
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                    Total dû par le locataire (mensuel)
                  </p>
                  <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalMensuel)}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm border-t border-gray-200 pt-3">
                  <div>
                    <p className="text-gray-500 text-xs">Revenu propriétaire (loyer HC)</p>
                    <p className="font-semibold text-gray-900">{formatCurrency(lease.rentAmount)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Charges récupérables (payées par le locataire)</p>
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(lease.chargesRecupMensuelles || 0)}
                    </p>
                  </div>
                </div>
                {lease.chargesNonRecupMensuelles != null && lease.chargesNonRecupMensuelles > 0 && (
                  <p className="text-xs text-gray-600 border-t border-gray-200 pt-2">
                    Charges non récupérables (charge propriétaire) :{' '}
                    <span className="font-medium">{formatCurrency(lease.chargesNonRecupMensuelles)}</span>
                  </p>
                )}
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="text-sm text-gray-400">Dépôt de garantie</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(lease.deposit || 0)}</span>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                {lease.paymentDay && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Jour de paiement</span>
                    <span className="font-medium">{lease.paymentDay} de chaque mois</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Indexation</span>
                  <span className="font-medium">{getIndexationLabel(lease.indexationType)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Statut indexation</span>
                  <span className="font-medium">{indexationLabelByStatus[indexationStatus.status] || '—'}</span>
                </div>
                {lease.indexationType && lease.indexationType !== 'AUCUNE' && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-2 space-y-1">
                    <p className="text-sm text-gray-600">Dernière indexation</p>
                    <p className="font-medium text-gray-900">—</p>
                    <p className="text-sm text-gray-600">Prochaine indexation estimée</p>
                    <p className="font-medium text-gray-900">Anniversaire du bail</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4. Contrat */}
          <div className="rounded-2xl border border-gray-200 overflow-hidden">
            <h3 className="text-lg font-semibold text-gray-900 p-6 border-b border-gray-100 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Contrat
            </h3>
            <div className="p-6 space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Type de bail</span>
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
                  <span
                    className={`font-medium ${period.calculated ? 'text-gray-500 italic' : ''}`}
                  >
                    {period.endText.replace('Au ', '')}
                  </span>
                </div>
                {lease.noticeMonths && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Préavis</span>
                    <span className="font-medium">{lease.noticeMonths} mois</span>
                  </div>
                )}
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="font-medium text-gray-900">{lease.Property.name}</div>
                <div className="text-sm text-gray-600 mt-1">{lease.Property.address}</div>
                {lease.Property.city && (
                  <div className="text-sm text-gray-600">
                    {lease.Property.postalCode} {lease.Property.city}
                  </div>
                )}
              </div>
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
              {lease.notes && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Notes / Clauses particulières</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{lease.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* 5. Documents */}
          <div className="rounded-2xl border border-gray-200 overflow-hidden">
            <h3 className="text-lg font-semibold text-gray-900 p-6 border-b border-gray-100 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documents
            </h3>
            <div className="p-6">
              {loadingDocument ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mb-2" />
                  <p>Chargement...</p>
                </div>
              ) : signedLeaseDocument ? (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{signedLeaseDocument.filenameOriginal}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-sm text-gray-600">{leaseDocumentDisplay.label}</p>
                      <Badge size="sm" variant={leaseDocumentDisplay.badgeVariant}>
                        {leaseDocumentDisplay.badgeLabel}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => signedLeaseDocument?.url && window.open(signedLeaseDocument.url, '_blank')}
                  >
                    Voir
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mb-2 opacity-50" />
                  <p>Aucun document lié</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
