'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { getLeaseStatusVariant, getLeaseStatusLabel } from '@/utils/leaseStatusBadge';
import { notify2 } from '@/lib/notify2';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { createLeaseServiceWithMode } from '@/domain/services/leaseServiceFactory';
// ✅ OFFLINE-FIRST: Imports statiques pour éviter ChunkLoadError en offline
import { getLeaseRepositoryOffline } from '@/lib/offline/repositories/LeaseRepositoryOffline';
import { getLocalDB } from '@/lib/offline/db';
import { getGlobalSyncService } from '@/lib/offline/syncGlobal';
import {
  classifySmartimmoId,
  getLeaseSignatureDiagLeaseId,
  getLeaseSignatureDiagRemoteLeaseMapping,
  logLeaseSignWorkflowDiag,
  setLeaseSignatureDiagSession,
} from '@/lib/offline/leaseSignatureWorkflowDiag';
import { getTransactionRepositoryOffline } from '@/lib/offline/repositories/TransactionRepositoryOffline';
import { calculateLeaseEndDate } from '@/utils/leaseUtils';

// Fonctions utilitaires pour vérifier les statuts (compatibilité FR/EN)
const isDraft = (status: string) => status === 'DRAFT' || status === 'BROUILLON';
const isToSend = (status: string) =>
  status === 'TO_SEND' ||
  status === 'À_ENVOYER' ||
  status === 'A_ENVOYER' ||
  status === 'A_SIGNER';
const isSent = (status: string) => status === 'SENT' || status === 'ENVOYÉ' || status === 'ENVOYE';
const isSigned = (status: string) => status === 'SIGNED' || status === 'SIGNÉ' || status === 'SIGNE';
const isActiveStatus = (status: string) => status === 'ACTIVE' || status === 'ACTIF';
const isTerminated = (status: string) => status === 'TERMINATED' || status === 'RÉSILIÉ' || status === 'RESILIE';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { AlertModal } from '@/components/ui/AlertModal';
import { useUploadReviewModal } from '@/contexts/UploadReviewModalContext';
import { z } from 'zod';
import { 
  Building2,
  Users,
  Calendar,
  Euro,
  FileText,
  Mail,
  Download,
  Eye,
  Trash2,
  X,
  XCircle,
  FileCheck,
  Clock,
  AlertCircle,
  CheckCircle,
  Plus,
  Send,
  Upload,
  TrendingUp,
  History
} from 'lucide-react';
import { SmartSelect } from '@/components/ui/SmartSelect';
import { SmartDatePicker } from '@/components/ui/SmartDatePicker';

const leaseSchema = z.object({
  propertyId: z.string().min(1, 'Le bien est requis'),
  tenantId: z.string().min(1, 'Le locataire est requis'),
  type: z.enum(['residential', 'commercial', 'garage']),
  furnishedType: z.enum(['vide', 'meuble', 'garage']),
  startDate: z.string().min(1, 'La date de début est requise'),
  endDate: z.string().optional(),
  rentAmount: z.number().min(0, 'Le loyer doit être positif'),
  deposit: z.number().min(0, 'La caution doit être positive'),
  paymentDay: z.number().min(1).max(31, 'Le jour de paiement doit être entre 1 et 31'),
  indexationType: z.enum(['none', 'insee', 'manual']).optional(),
  notes: z.string().optional(),
  status: z.enum(['BROUILLON', 'ENVOYÉ', 'SIGNÉ', 'ACTIF', 'RÉSILIÉ', 'ARCHIVÉ']).optional(),
  // Gestion déléguée
  chargesRecupMensuelles: z.number().min(0).optional(),
  chargesNonRecupMensuelles: z.number().min(0).optional(),
});

interface LeaseEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  lease: any;
  properties: any[];
  tenants: any[];
  mode?: 'normal' | 'app-shell'; // ✅ Mode pour détecter App Shell
  propertyId?: string; // ✅ PropertyId pour le refresh ciblé
  /** Bail signé/actif : ouvre le flux renouvellement / avenant (même UX partout) */
  onRequestAmendment?: () => void;
}

export default function LeaseEditModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  lease,
  properties: externalProperties,
  tenants: externalTenants,
  mode = 'normal',
  propertyId: propPropertyId,
  onRequestAmendment,
}: LeaseEditModalProps) {
  const toInputDate = (value: string | Date | null | undefined): string =>
    value ? new Date(value).toISOString().slice(0, 10) : '';
  // ✅ OFFLINE-FIRST: Détecter explicitement offline/app-shell
  // ⚠️ DURCISSEMENT: Utiliser UNIQUEMENT le paramètre mode, pas window.location
  const isAppShell = mode === 'app-shell';
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  const shouldUseLocalData = isAppShell || isOffline;
  
  // ✅ Hook pour récupérer organizationId en app-shell
  const { organizationId } = useCurrentOrganization();
  
  const [formData, setFormData] = useState({
    id: '',
    propertyId: '',
    tenantId: '',
    type: 'residential',
    furnishedType: 'vide',
    startDate: '',
    endDate: '',
    rentAmount: 0,
    deposit: 0,
    paymentDay: 1,
    indexationType: 'none',
    notes: '',
    status: 'BROUILLON',
    chargesRecupMensuelles: 0,
    chargesNonRecupMensuelles: 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [isWorkflowActionLoading, setIsWorkflowActionLoading] = useState(false);
  const [isUploadingSigned, setIsUploadingSigned] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [showProfileAlert, setShowProfileAlert] = useState(false);
  const [profileAlertData, setProfileAlertData] = useState<{
    title: string;
    message: string;
    missingFields: string[];
  } | null>(null);
  const [showIndexationModal, setShowIndexationModal] = useState(false);
  const [indexationHistory, setIndexationHistory] = useState<any[]>([]);
  const [isLoadingIndexation, setIsLoadingIndexation] = useState(false);
  const [showErrorsAccordion, setShowErrorsAccordion] = useState(false); // Mobile: accordéon erreurs
  
  // Hook pour la modal d'upload unifiée
  const { openModalWithDocumentType, isOpen: isUploadModalOpen } = useUploadReviewModal();
  
  // Écouter la fermeture de la modal d'upload pour désactiver le loader
  // ⚠️ IMPORTANT: Le loader doit rester actif pendant toute la durée de l'upload ET de la finalisation
  // Il ne doit se désactiver que quand le callback onSuccess est appelé (ou après un timeout de sécurité)
  useEffect(() => {
    // Timeout de sécurité global : désactiver le loader après 60 secondes maximum
    if (isUploadingSigned) {
      const safetyTimeout = setTimeout(() => {
        console.warn('[LeaseEditModal] [UPLOAD-SIGNED] ⚠️ Timeout de sécurité global: désactivation du loader après 60s');
        setIsUploadingSigned(false);
      }, 60000); // 60 secondes maximum
      
      return () => clearTimeout(safetyTimeout);
    }
  }, [isUploadingSigned]);
  
  // Écouter la fermeture de la modal pour désactiver le loader après un délai
  // (le callback onSuccess devrait normalement le faire, mais c'est une sécurité)
  useEffect(() => {
    if (!isUploadModalOpen && isUploadingSigned) {
      // Attendre un peu pour laisser le temps au callback onSuccess de s'exécuter
      const timeout = setTimeout(() => {
        console.log('[LeaseEditModal] [UPLOAD-SIGNED] Modal fermée, désactivation du loader (timeout de sécurité après fermeture)');
        setIsUploadingSigned(false);
      }, 10000); // 10 secondes pour laisser le temps au callback et à la sync
      
      return () => clearTimeout(timeout);
    }
  }, [isUploadModalOpen, isUploadingSigned]);
  
  // Charger les données
  const loadData = async () => {
    setIsLoadingData(true);
    try {
      // ✅ APP-SHELL: Utiliser les props passés depuis IndexedDB
      if (shouldUseLocalData && externalProperties && externalTenants) {
        setProperties(externalProperties);
        setTenants(externalTenants);
        setIsLoadingData(false);
        return;
      }
      
      // Mode normal : charger depuis l'API
      const [propertiesRes, tenantsRes] = await Promise.all([
        fetch('/api/properties?limit=10000'),
        fetch('/api/tenants?limit=10000')
      ]);

      if (propertiesRes.ok) {
        const propertiesData = await propertiesRes.json();
        // L'API retourne { data: [...], pagination: {...} }
        const propertiesList = propertiesData.data || propertiesData.properties || propertiesData.items || (Array.isArray(propertiesData) ? propertiesData : []);
        const finalList = Array.isArray(propertiesList) ? propertiesList : [];
        setProperties(finalList);
      }

      if (tenantsRes.ok) {
        const tenantsData = await tenantsRes.json();
        // L'API retourne { data: [...], pagination: {...} }
        const tenantsList = tenantsData.data || tenantsData.tenants || tenantsData.items || (Array.isArray(tenantsData) ? tenantsData : []);
        const finalList = Array.isArray(tenantsList) ? tenantsList : [];
        setTenants(finalList);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  // ✅ OFFLINE-FIRST: Charger l'historique des réindexations
  const loadIndexationHistory = async () => {
    if (!lease?.id) return;
    
    // ✅ OFFLINE-FIRST: En offline/app-shell, lire depuis IndexedDB
    if (shouldUseLocalData && organizationId) {
      try {
        // ✅ APP-SHELL/OFFLINE: Lire depuis IndexedDB
        const db = await getLocalDB();
        
        // ✅ Utiliser l'index composite [organizationId+leaseId] pour une recherche efficace
        const indexations = await db.RentIndexation
          .where('[organizationId+leaseId]')
          .equals([organizationId, lease.id])
          .sortBy('effectiveDate');
        
        // Convertir en format attendu par l'UI (ordre décroissant par date d'effet)
        const formattedIndexations = indexations
          .map((indexation: any) => ({
          id: indexation.id,
          previousRentAmount: indexation.previousRentAmount,
          newRentAmount: indexation.newRentAmount,
          effectiveDate: indexation.effectiveDate,
          indexType: indexation.indexType,
          indexValue: indexation.indexValue,
          indexDate: indexation.indexDate,
          reason: indexation.reason,
          notes: indexation.notes,
          createdAt: indexation.createdAt,
          }))
          .reverse(); // Inverser pour avoir les plus récentes en premier (comme l'API)
        
        setIndexationHistory(formattedIndexations);
      } catch (error) {
        // ✅ OFFLINE-FIRST: En offline/app-shell, pas d'erreur console (comportement attendu)
        // Utiliser console.warn en DEV uniquement pour le debug
        if (process.env.NODE_ENV === 'development') {
          console.warn('[LeaseEditModal] Erreur chargement historique indexation depuis IndexedDB (offline/app-shell):', error);
        }
        setIndexationHistory([]);
      }
      return;
    }
    
    // ✅ MODE NORMAL: Utiliser l'API uniquement si online
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      // Si on passe en offline, retourner un tableau vide
      setIndexationHistory([]);
      return;
    }
    
    try {
      const response = await fetch(`/api/leases/${lease.id}/index-rent`);
      if (response.ok) {
        const data = await response.json();
        setIndexationHistory(data.indexations || []);
      }
    } catch (error) {
      // ✅ Ne pas logguer si c'est une erreur réseau attendue en offline
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        // Erreur réseau attendue, ne pas logguer
        setIndexationHistory([]);
        return;
      }
      console.error('Error loading indexation history:', error);
      setIndexationHistory([]);
    }
  };

  // Charger les données et initialiser le formulaire
  useEffect(() => {
    if (isOpen) {
      // Utiliser les données externes si disponibles, sinon charger
      if (externalProperties && externalProperties.length > 0 && externalTenants && externalTenants.length > 0) {
        console.log('[LeaseEditModal] Utilisation des données externes - Properties:', externalProperties.length, 'Tenants:', externalTenants.length);
        setProperties(externalProperties);
        setTenants(externalTenants);
        setIsLoadingData(false);
      } else {
        console.log('[LeaseEditModal] Chargement des données depuis l\'API');
        loadData();
      }
      
      // Charger l'historique des réindexations si bail existant
      if (lease?.id) {
        loadIndexationHistory();
      }
      
      if (lease) {
        // ✅ APP-SHELL: Recharger le bail depuis IndexedDB pour avoir les données les plus récentes
        // ⚠️ CRITIQUE : Ne pas utiliser directement le prop lease qui peut être obsolète
        // Lire depuis IndexedDB pour garantir la cohérence avec les mises à jour locales
        const loadLeaseData = async () => {
          let currentLease = lease;
          
          if (isAppShell && organizationId && lease.id) {
            try {
              const leaseRepo = getLeaseRepositoryOffline();
              
              // ✅ Lire le bail depuis IndexedDB (source locale) - PAS de fetch vers Supabase
              // ⚠️ CRITIQUE: L'ID peut avoir changé après une sync (UUID local → ID Prisma)
              // On essaie d'abord avec l'ID du prop, puis on cherche par critères si pas trouvé
              let localLease = await leaseRepo.getById(lease.id, organizationId);
              
              // Si pas trouvé avec l'ID du prop, chercher par critères (ID peut avoir changé après sync)
              if (!localLease && (lease.propertyId || lease.Property?.id) && (lease.tenantId || lease.Tenant?.id) && lease.startDate) {
                try {
                  const db = await getLocalDB();
                  const propertyId = lease.propertyId || lease.Property?.id;
                  const tenantId = lease.tenantId || lease.Tenant?.id;
                  
                  // Chercher par propertyId + tenantId + startDate (critères uniques)
                  const matchingLeases = await db.Lease
                    .where('organizationId')
                    .equals(organizationId)
                    .and((l: any) => 
                      l.propertyId === propertyId && 
                      l.tenantId === tenantId &&
                      l.startDate === (typeof lease.startDate === 'string' ? lease.startDate : new Date(lease.startDate).toISOString().split('T')[0])
                    )
                    .toArray();
                  
                  if (matchingLeases.length > 0) {
                    const foundLease = matchingLeases[0];
                    localLease = foundLease;
                    if (process.env.NODE_ENV === 'development') {
                      console.log('[LeaseEditModal] [LOCAL-FIRST] ✅ Bail trouvé par critères (ID changé après sync):', {
                        oldId: lease.id,
                        newId: foundLease.id,
                        propertyId,
                        tenantId
                      });
                    }
                  }
                } catch (searchError) {
                  console.warn('[LeaseEditModal] ⚠️ Erreur lors de la recherche par critères:', searchError);
                }
              }
              
              if (localLease) {
                // ✅ Utiliser les données locales (plus récentes) au lieu du prop lease
                // ⚠️ CRITIQUE: Utiliser l'ID local (peut être différent de lease.id après sync)
                currentLease = {
                  ...lease, // Conserver les relations (Property, Tenant) du prop
                  ...localLease, // Écraser avec les données locales (status, dates, ID mis à jour, etc.)
                  id: localLease.id, // ✅ CRITIQUE: Utiliser l'ID local (peut avoir changé)
                  Property: lease.Property || localLease.propertyId ? { id: localLease.propertyId } : undefined,
                  Tenant: lease.Tenant || localLease.tenantId ? { id: localLease.tenantId } : undefined,
                };
                
                if (process.env.NODE_ENV === 'development') {
                  console.log('[LeaseEditModal] [LOCAL-FIRST] Bail rechargé depuis IndexedDB:', {
                    propId: lease.id,
                    localId: localLease?.id,
                    idChanged: localLease ? (lease.id !== localLease.id) : false,
                    localStatus: localLease?.status,
                    propStatus: lease.status,
                    usingLocal: !!localLease
                  });
                }
              } else {
                console.warn('[LeaseEditModal] ⚠️ Bail non trouvé dans IndexedDB, utilisation du prop lease');
              }
            } catch (localLoadError) {
              console.error('[LeaseEditModal] ⚠️ Erreur lors du rechargement local, utilisation du prop lease:', localLoadError);
              // En cas d'erreur, utiliser le prop lease (fallback)
            }
          }
          
          // Édition d'un bail existant
          console.log('[LeaseEditModal] Mode édition - Lease:', currentLease);
          console.log('[LeaseEditModal] PropertyId:', currentLease.propertyId, 'TenantId:', currentLease.tenantId);
          console.log('[LeaseEditModal] ID complet:', currentLease.id, 'Longueur:', currentLease.id?.length);
          
          // ✅ Vérifier que l'ID est présent (les IDs Prisma sont ~25 caractères, pas 36)
          // ⚠️ CRITIQUE: S'assurer que l'ID est complet et non tronqué
          const leaseId = String(currentLease.id || '').trim();
          if (!leaseId || leaseId.length < 20) {
            console.error('[LeaseEditModal] ⚠️ ID du bail invalide ou tronqué:', {
              id: currentLease.id,
              idLength: currentLease.id?.length || 0,
              trimmedId: leaseId,
              trimmedLength: leaseId.length,
              leaseId: lease?.id,
              leaseIdLength: lease?.id?.length || 0
            });
            notify2.error('Erreur', `ID du bail invalide ou tronqué: "${leaseId}" (longueur: ${leaseId.length}). Veuillez recharger la page.`);
            return;
          }
          
          // ✅ En mode app-shell, s'assurer que propertyId et tenantId sont présents
          // Ils devraient être inclus dans useLeasesData, mais on fait un fallback au cas où
          const propertyId = currentLease.propertyId || currentLease.Property?.id || '';
          const tenantId = currentLease.tenantId || currentLease.Tenant?.id || '';
          
          if (isAppShell && (!propertyId || !tenantId)) {
            console.warn('[LeaseEditModal] ⚠️ PropertyId ou TenantId manquant, bail:', currentLease);
          }
          
          setFormData({
            id: leaseId, // ✅ Utiliser l'ID complet et validé
            propertyId,
            tenantId,
            type: currentLease.type || 'residential',
            furnishedType: currentLease.furnishedType || 'vide',
            startDate: currentLease.startDate ? new Date(currentLease.startDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            endDate: toInputDate(
              currentLease.endDate ??
                calculateLeaseEndDate(currentLease.startDate, null, currentLease.furnishedType)
            ),
            rentAmount: currentLease.rentAmount || 0,
            deposit: currentLease.deposit || 0,
            paymentDay: currentLease.paymentDay || 1,
            indexationType: currentLease.indexationType || 'none',
            notes: currentLease.notes || '',
            status: currentLease.status || 'BROUILLON', // ✅ CRITIQUE: Utiliser le statut local (à jour)
            chargesRecupMensuelles: currentLease.chargesRecupMensuelles || 0,
            chargesNonRecupMensuelles: currentLease.chargesNonRecupMensuelles || 0,
          });
        };
        
        // ✅ APP-SHELL: Charger depuis IndexedDB de manière asynchrone
        if (isAppShell && organizationId) {
          loadLeaseData();
        } else {
          // Mode normal: utiliser directement le prop lease
          setFormData({
            id: lease.id,
            propertyId: lease.propertyId || lease.Property?.id || '',
            tenantId: lease.tenantId || lease.Tenant?.id || '',
            type: lease.type || 'residential',
            furnishedType: lease.furnishedType || 'vide',
            startDate: lease.startDate ? new Date(lease.startDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            endDate: toInputDate(lease.endDate ?? calculateLeaseEndDate(lease.startDate, null, lease.furnishedType)),
            rentAmount: lease.rentAmount || 0,
            deposit: lease.deposit || 0,
            paymentDay: lease.paymentDay || 1,
            indexationType: lease.indexationType || 'none',
            notes: lease.notes || '',
            status: lease.status || 'BROUILLON',
            chargesRecupMensuelles: lease.chargesRecupMensuelles || 0,
            chargesNonRecupMensuelles: lease.chargesNonRecupMensuelles || 0,
          });
        }
      } else {
        // Création d'un nouveau bail
        setFormData({
          id: '',
          propertyId: '',
          tenantId: '',
          type: 'residential',
          furnishedType: 'vide',
          startDate: '',
          endDate: '',
          rentAmount: 0,
          deposit: 0,
          paymentDay: 1,
          indexationType: 'none',
          notes: '',
          status: 'BROUILLON',
          chargesRecupMensuelles: 0,
          chargesNonRecupMensuelles: 0,
        });
      }
      setActiveTab('basic'); // Reset to first tab
    }
  }, [lease, isOpen, externalProperties, externalTenants]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      const validatedData = leaseSchema.parse({
        ...formData,
        rentAmount: parseFloat(formData.rentAmount.toString()) || 0,
        deposit: parseFloat(formData.deposit.toString()) || 0,
        paymentDay: parseInt(formData.paymentDay.toString()) || 1,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        // Gestion déléguée
        chargesRecupMensuelles: parseFloat(formData.chargesRecupMensuelles.toString()) || 0,
        chargesNonRecupMensuelles: parseFloat(formData.chargesNonRecupMensuelles.toString()) || 0,
      });
      
      await onSubmit({ ...validatedData, id: formData.id });
      onClose();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fonction pour déterminer si un bail signé devrait être automatiquement actif
  const isLeaseAutoActive = () => {
    if (formData.status !== 'SIGNÉ') return false;
    
    const startDate = new Date(formData.startDate);
    const now = new Date();
    
    // Si le bail a commencé ou commence dans moins de 30 jours, il devrait être actif
    const daysUntilStart = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilStart <= 30;
  };

  // Fonction pour vérifier si le locataire a un email valide
  const canSendForSignature = () => {
    if (!formData.tenantId) return false;
    
    const tenant = tenants.find(t => t.id === formData.tenantId);
    if (!tenant) return false;
    
    // Vérifier que le locataire a un email valide
    return tenant.email && tenant.email.trim() !== '';
  };

  // Fonction pour vérifier si tous les champs obligatoires sont remplis
  const areRequiredFieldsFilled = () => {
    return (
      formData.propertyId &&
      formData.tenantId &&
      formData.type &&
      formData.startDate &&
      formData.rentAmount > 0
    );
  };

  // Liste des champs manquants pour l'affichage mobile
  const getMissingFields = () => {
    const missing: string[] = [];
    if (!formData.propertyId) missing.push('Bien');
    if (!formData.tenantId) missing.push('Locataire');
    if (!formData.type) missing.push('Type de bail');
    if (!formData.startDate) missing.push('Date de début');
    if (formData.rentAmount <= 0) missing.push('Montant du loyer (onglet "Financier")');
    return missing;
  };

  const missingFields = getMissingFields();
  const missingCount = missingFields.length;

  // Fonction pour vérifier si un onglet a des champs obligatoires manquants
  const hasMissingRequiredFields = (tabId: string) => {
    switch (tabId) {
      case 'basic':
        return !formData.propertyId || !formData.tenantId || !formData.type || !formData.startDate;
      case 'financial':
        return formData.rentAmount <= 0;
      default:
        return false;
    }
  };

  // Fonction pour vérifier si le bail peut être supprimé
  const canDeleteLease = async () => {
    if (isDraft(formData.status)) return { canDelete: true, reason: null };
    
    try {
      // ✅ APP-SHELL: Vérifier les transactions depuis IndexedDB
      if (isAppShell && organizationId) {
        const transactionRepo = getTransactionRepositoryOffline();
        const transactions = await transactionRepo.getAll(organizationId, { leaseId: formData.id });
        
        if (transactions.length > 0) {
          return { 
            canDelete: false, 
            reason: 'Ce bail ne peut pas être supprimé car il contient des transactions. Résiliez-le à la place.' 
          };
        }
      } else if (!isAppShell) {
        // Mode normal : vérifier depuis l'API
        const response = await fetch(`/api/transactions?leaseId=${formData.id}`);
        if (response.ok) {
          const data = await response.json();
          const hasTransactions = data.transactions && data.transactions.length > 0;
          
          if (hasTransactions) {
            return { 
              canDelete: false, 
              reason: 'Ce bail ne peut pas être supprimé car il contient des transactions. Résiliez-le à la place.' 
            };
          }
        }
      }
      
      return { canDelete: true, reason: null };
    } catch (error) {
      console.error('Erreur lors de la vérification des transactions:', error);
      return { canDelete: false, reason: 'Erreur lors de la vérification des données.' };
    }
  };

  const handleWorkflowAction = async (action: string) => {
    // ✅ Empêcher les double-clics et les appels multiples
    if (isWorkflowActionLoading) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[LeaseEditModal] ⚠️ Action déjà en cours, ignore l\'appel:', action);
      }
      return;
    }
    
    // ✅ APP-SHELL: Désactiver les actions spéciales en offline
    if (isAppShell && !navigator.onLine) {
      notify2.error('Action indisponible', 'Cette action nécessite une connexion internet. Veuillez vous connecter et réessayer.');
      return;
    }
    
    setIsWorkflowActionLoading(true);
    try {
      let result = null;
      
      // Messages personnalisés selon l'action
      let successMessage = '';
      let newStatus = '';
      
      switch (action) {
        case 'send-for-signature': {
          try {
          // Workflow transactionnel:
          // - AUCUN passage en "À signer" avant succès complet de l'envoi
          // - en cas d'échec, statut conservé (BROUILLON)
          let localLease: any = null;
          let targetPropertyId: string | undefined = undefined;

          if (!navigator.onLine) {
            setIsWorkflowActionLoading(false);
            notify2.error('Action indisponible', "L'envoi pour signature nécessite une connexion internet.");
            return;
          }

          if (isAppShell && organizationId && formData.id) {
            setLeaseSignatureDiagSession(formData.id);
            console.warn('[LEASE_SIGN_WORKFLOW_DIAG] ACTIVATED', {
              leaseId: formData.id,
              storedLeaseId: getLeaseSignatureDiagLeaseId(),
              leaseIdKind: classifySmartimmoId(formData.id),
            });
            try {
              const leaseRepo = getLeaseRepositoryOffline();
              localLease = await leaseRepo.getById(formData.id, organizationId);
              if (!localLease) {
                notify2.error('Erreur', `Bail introuvable dans les données locales (ID: ${formData.id})`);
                setIsWorkflowActionLoading(false);
                return;
              }
              const currentStatus = localLease.status || 'BROUILLON';
              if (!isDraft(currentStatus) && !isToSend(currentStatus) && !isSent(currentStatus)) {
                notify2.error(
                  'Action impossible',
                  `Le bail doit être en BROUILLON/À signer pour être envoyé. Statut actuel : ${getLeaseStatusLabel(currentStatus)}`
                );
                setIsWorkflowActionLoading(false);
                return;
              }
              targetPropertyId = propPropertyId || formData.propertyId || localLease.propertyId;

              // Prérequis critique : synchroniser avant appel send, sinon IDs locaux non reconnus côté API.
              const db = await getLocalDB();
              const allOps = await db.pendingOperations
                .where('status')
                .anyOf(['pending', 'error', 'syncing'])
                .toArray();
              const orgOps = allOps.filter(
                (op: any) => op.organizationId === organizationId || op.organizationId == null
              );
              const leaseOps = orgOps.filter((op: any) => op.entity === 'lease');
              logLeaseSignWorkflowDiag({
                step: 'preflight_pending_ops_snapshot',
                organizationId,
                leaseId: localLease.id,
                leaseIdKind: classifySmartimmoId(localLease.id),
                pendingOpsCount: orgOps.length,
                leaseOpsCount: leaseOps.length,
                leaseOps: leaseOps.map((op: any) => ({
                  id: op.id,
                  entity: op.entity,
                  entityId: op.entityId,
                  operation: op.operation,
                  status: op.status,
                  createdAt: op.createdAt,
                  payload: op.payload,
                })),
              });

              const isCurrentLeaseRemote = classifySmartimmoId(localLease.id) === 'cuid_remote';
              if (isCurrentLeaseRemote) {
                const normalizeDay = (v: any) =>
                  typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : '';
                const staleCreateOps = leaseOps.filter((op: any) => {
                  if (op.operation !== 'create') return false;
                  const p = op.payload || {};
                  const byId = op.entityId === localLease.id || p.id === localLease.id;
                  const bySignature =
                    p.propertyId === localLease.propertyId &&
                    p.tenantId === localLease.tenantId &&
                    normalizeDay(p.startDate) === normalizeDay(localLease.startDate) &&
                    Math.abs(Number(p.rentAmount ?? 0) - Number(localLease.rentAmount ?? 0)) < 0.01;
                  return byId || bySignature;
                });

                let remoteLeaseExists = false;
                let remoteLeaseGetStatus: number | 'network_error' = 'network_error';
                try {
                  const remoteLeaseCheck = await fetch(`/api/leases/${encodeURIComponent(localLease.id)}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                  });
                  remoteLeaseGetStatus = remoteLeaseCheck.status;
                  if (remoteLeaseCheck.ok) {
                    remoteLeaseExists = true;
                  } else if (remoteLeaseCheck.status === 404) {
                    remoteLeaseExists = false;
                  } else if (remoteLeaseCheck.status === 403 || remoteLeaseCheck.status === 401) {
                    console.warn(
                      '[LeaseEditModal] Préflight send-for-signature: GET bail',
                      remoteLeaseCheck.status,
                      '(accès refusé) — traité comme bail absent pour la décision sync.'
                    );
                    remoteLeaseExists = false;
                  } else {
                    console.warn(
                      '[LeaseEditModal] Préflight send-for-signature: GET bail statut inattendu',
                      remoteLeaseCheck.status,
                      '— pas de blocage utilisateur, fallback sync si nécessaire.'
                    );
                    remoteLeaseExists = false;
                  }
                } catch (remoteCheckErr) {
                  console.warn(
                    '[LeaseEditModal] Préflight send-for-signature: GET bail réseau/erreur — diagnostic non bloquant:',
                    remoteCheckErr
                  );
                  remoteLeaseExists = false;
                }

                const deletedPendingIds: string[] = [];
                if (remoteLeaseExists && staleCreateOps.length > 0) {
                  for (const op of staleCreateOps) {
                    await db.pendingOperations.delete(op.id);
                    deletedPendingIds.push(op.id);
                  }
                }

                logLeaseSignWorkflowDiag({
                  step: 'preflight_pending_op_decision',
                  organizationId,
                  leaseId: localLease.id,
                  leaseIdKind: classifySmartimmoId(localLease.id),
                  remoteLeaseExists,
                  remoteLeaseGetStatus,
                  staleCreateOpsCount: staleCreateOps.length,
                  staleCreateOpsIds: staleCreateOps.map((op: any) => op.id),
                  deletedPendingIds,
                  decision:
                    remoteLeaseExists
                      ? 'skip_global_sync_for_remote_current_lease'
                      : 'run_global_sync_fallback',
                });

                if (remoteLeaseExists) {
                  logLeaseSignWorkflowDiag({
                    step: 'preflight_sync_skipped_remote_lease',
                    organizationId,
                    leaseId: localLease.id,
                    reason:
                      'current_lease_is_remote_and_stale_local_create_op_must_not_block_send_for_signature',
                    deletedPendingIds,
                  });
                } else {
                  const syncService = getGlobalSyncService();
                  const syncResults = await syncService.syncAllPendingToRemote(organizationId);
                  const syncHasErrors = Object.values(syncResults).some(
                    (r) => !r || r.success === false || (r.errors ?? 0) > 0
                  );
                  if (syncHasErrors) {
                    notify2.error(
                      'Envoi impossible',
                      "Synchronisation incomplète (dépendances distantes manquantes). Le bail reste en brouillon."
                    );
                    setIsWorkflowActionLoading(false);
                    return;
                  }
                }
              } else {
                const syncService = getGlobalSyncService();
                const syncResults = await syncService.syncAllPendingToRemote(organizationId);
                const syncHasErrors = Object.values(syncResults).some(
                  (r) => !r || r.success === false || (r.errors ?? 0) > 0
                );
                if (syncHasErrors) {
                  notify2.error(
                    'Envoi impossible',
                    "Synchronisation incomplète (dépendances distantes manquantes). Le bail reste en brouillon."
                  );
                  setIsWorkflowActionLoading(false);
                  return;
                }
              }

              // Recharger le bail local après sync pour récupérer l'ID serveur éventuel.
              {
                const db = await getLocalDB();
                let refreshed = await leaseRepo.getById(formData.id, organizationId);
                if (!refreshed && localLease) {
                  const candidates = await db.Lease.where('organizationId')
                    .equals(organizationId)
                    .toArray();
                  refreshed =
                    candidates.find(
                      (l: any) =>
                        l.propertyId === localLease.propertyId &&
                        l.tenantId === localLease.tenantId &&
                        l.startDate === localLease.startDate &&
                        Math.abs(Number(l.rentAmount) - Number(localLease.rentAmount)) < 0.01
                    ) || null;
                }
                if (refreshed) {
                  localLease = refreshed;
                  if (refreshed.id !== formData.id) {
                    setFormData((prev) => ({ ...prev, id: refreshed.id }));
                  }
                }
              }
            } catch (preflightError) {
              console.error('[LeaseEditModal] Préflight send-for-signature échoué:', preflightError);
              notify2.error('Envoi impossible', 'Préparation de l’envoi échouée. Le bail reste en brouillon.');
              setIsWorkflowActionLoading(false);
              return;
            }
          }
          
          // ✅ ÉTAPE 3: Vérifier le profil utilisateur (pour la génération PDF)
          const profileValidation = await fetch('/api/profiles/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (!profileValidation.ok) {
            // En mode app-shell, le statut est déjà À_ENVOYER, on peut continuer
            if (isAppShell) {
              notify2.warning('Profil incomplet', 'Le bail a été marqué comme "À envoyer", mais le PDF ne pourra pas être généré sans profil complet.');
              successMessage = 'Bail marqué comme "À envoyer"';
              newStatus = 'À_ENVOYER';
              break;
            } else {
              setIsWorkflowActionLoading(false);
              notify2.error('Erreur de validation', 'Impossible de valider le profil utilisateur');
              return;
            }
          }
          
          const validationResult = await profileValidation.json();
          
          if (!validationResult.isValid) {
            // En mode app-shell, le statut est déjà À_ENVOYER, on peut continuer
            if (isAppShell) {
              const shouldGoToProfile = confirm(
                `${validationResult.message}\n\nLe bail a été marqué comme "À envoyer", mais le PDF ne pourra pas être généré sans profil complet.\n\nSouhaitez-vous aller à votre profil pour le compléter ?`
              );
              
              if (shouldGoToProfile) {
                window.location.href = '/app?view=profil';
              }
              
              successMessage = 'Bail marqué comme "À envoyer"';
              newStatus = 'À_ENVOYER';
              break;
            } else {
              setIsWorkflowActionLoading(false);
              const missingFieldsList = validationResult.missingFields.map((field: string) => `• ${field}`).join('\n');
              const alertMessage = `${validationResult.message}\n\nChamps manquants :\n${missingFieldsList}`;
              
              const shouldGoToProfile = confirm(
                `${alertMessage}\n\nSouhaitez-vous aller à votre profil pour le compléter ?`
              );
              
              if (shouldGoToProfile) {
                window.location.href = '/profil';
              }
              return;
            }
          }
          
          // ✅ Vérifier que l'ID est complet
          if (!formData.id || formData.id.length < 20) {
            setIsWorkflowActionLoading(false);
            notify2.error('Erreur', 'ID du bail invalide ou incomplet');
            return;
          }
          
          // Appeler l'API pour générer PDF/EML
          // ⚠️ CRITIQUE: Vérifier que formData.id est complet et valide
          if (!formData.id || formData.id.length < 20) {
            setIsWorkflowActionLoading(false);
            notify2.error('Erreur', `ID du bail invalide ou incomplet: "${formData.id}" (longueur: ${formData.id?.length || 0})`);
            console.error('[LeaseEditModal] [SEND-FOR-SIGNATURE] ID invalide:', {
              formDataId: formData.id,
              idLength: formData.id?.length || 0,
              localLeaseId: localLease?.id,
              localLeaseIdLength: localLease?.id?.length || 0
            });
            return;
          }
          
          const leaseIdEncoded = encodeURIComponent(formData.id);
          const apiUrl = `/api/leases/${leaseIdEncoded}/send-for-signature`;

          const remoteLeaseMap = getLeaseSignatureDiagRemoteLeaseMapping();
          logLeaseSignWorkflowDiag({
            step: '7_before_send_for_signature',
            leaseIdUsedInUrl: formData.id,
            leaseIdKindInUrl: classifySmartimmoId(formData.id),
            localLeaseIdFromState: localLease?.id,
            localLeaseIdKind: classifySmartimmoId(localLease?.id),
            apiUrl,
            lastPostApiLeasesMapping: remoteLeaseMap,
            urlIdMatchesRemoteFromStep6: remoteLeaseMap
              ? formData.id === remoteLeaseMap.remoteLeaseId
              : null,
          });
          
          if (process.env.NODE_ENV === 'development') {
            console.log('[LeaseEditModal] [SEND-FOR-SIGNATURE] Appel API:', {
              originalId: formData.id,
              encodedId: leaseIdEncoded,
              fullUrl: apiUrl,
              idLength: formData.id.length
            });
          }
          
          try {
            const response = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                email: tenants.find(t => t.id === formData.tenantId)?.email,
                message: 'Bail à signer' 
              }),
            });
            
            if (response.ok) {
              result = await response.json();
              
              // Télécharger le fichier EML
              if (result.downloadUrl) {
                try {
                  const fileResponse = await fetch(result.downloadUrl, { method: 'GET' });
                  if (fileResponse.ok) {
                    const blob = await fileResponse.blob();
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `bail-signature-${formData.id}.eml`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    window.URL.revokeObjectURL(url);
                  }
                } catch (downloadError) {
                  console.error('Erreur lors du téléchargement du fichier EML:', downloadError);
                  // Ne pas bloquer le workflow : l'envoi est validé côté serveur.
                }
              }
              
              // Mettre à jour en ENVOYÉ uniquement après succès API (transactionnel)
              if (isAppShell && organizationId && formData.id) {
                try {
                  const leaseService = createLeaseServiceWithMode('app-shell');
                  const updatedLeaseFromApi = result.lease;
                  
                  if (!targetPropertyId) {
                    targetPropertyId = propPropertyId || formData.propertyId || updatedLeaseFromApi?.propertyId || localLease?.propertyId;
                  }
                  
                  await leaseService.updateLease(formData.id, organizationId, {
                    status: 'ENVOYÉ',
                  });
                  
                  if (targetPropertyId) {
                    window.dispatchEvent(new CustomEvent('leases:refresh', {
                      detail: { scope: 'property', propertyId: targetPropertyId, reason: 'update' }
                    }));
                  }
                  
                } catch (error) {
                  console.error('[LeaseEditModal] Erreur lors de la mise à jour en ENVOYÉ:', error);
                  // Fallback: ne pas afficher un faux succès silencieux
                  notify2.warning('Envoi effectué', "L'envoi a réussi mais le statut local n'a pas pu être mis à jour.");
                }
              }
              
              successMessage = 'Bail envoyé pour signature avec succès';
              newStatus = 'ENVOYÉ';
              notify2.success(successMessage, 'Le fichier EML a été téléchargé automatiquement');
            } else {
              const errorData = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
              setIsWorkflowActionLoading(false);
              const statusHint =
                errorData?.currentStatus != null
                  ? ` Statut côté serveur : ${errorData.currentStatus}.`
                  : '';
              notify2.error(
                "Erreur lors de l'envoi",
                `${errorData.error || "Impossible d'envoyer le bail pour signature"}.${statusHint} Le bail reste en brouillon.`
              );
              successMessage = '';
              newStatus = '';
            }
          } catch (apiError) {
            console.error('[LeaseEditModal] Erreur lors de l\'appel API:', apiError);
            setIsWorkflowActionLoading(false);
            notify2.error(
              'Erreur réseau', 
              'Impossible de finaliser l’envoi. Le bail reste en brouillon.'
            );
            successMessage = '';
            newStatus = '';
          }
          
          // ✅ En mode normal (non app-shell), mettre à jour le statut selon le résultat
          if (!isAppShell) {
            // En mode normal, on fait confiance à l'API pour mettre à jour le statut
            // (le code existant gère déjà cela)
          }
          } finally {
            if (process.env.NODE_ENV === 'development') {
              console.debug('[LEASE_SIGN_WORKFLOW_DIAG] session terminée (fin du bloc send-for-signature)');
            }
            setLeaseSignatureDiagSession(null);
          }
          break;
        }
        case 'mark-active':
          // ✅ APP-SHELL: Mettre à jour localement via LeaseService (création de pending opération)
          if (isAppShell && organizationId && formData.id) {
            try {
              const leaseService = createLeaseServiceWithMode('app-shell');
              await leaseService.updateLease(formData.id, organizationId, {
                status: 'ACTIF',
              });
              
              // ✅ Dispatcher un événement de refresh ciblé
              // Utiliser propPropertyId en priorité, puis formData.propertyId
              const targetPropertyId = propPropertyId || formData.propertyId;
              if (targetPropertyId) {
                window.dispatchEvent(new CustomEvent('leases:refresh', { 
                  detail: { scope: 'property', propertyId: targetPropertyId, reason: 'update' } 
                }));
              } else {
                window.dispatchEvent(new CustomEvent('leases:refresh', { 
                  detail: { scope: 'global', reason: 'update' } 
                }));
              }
              
              successMessage = 'Bail marqué comme actif !';
              newStatus = 'ACTIF';
            } catch (error) {
              console.error('[LeaseEditModal] Erreur lors de la mise à jour locale du statut:', error);
              throw error;
            }
          } else {
            // Mode normal : appel API
            const activeResponse = await fetch(`/api/leases/${formData.id}/mark-active`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
            });
            
            if (!activeResponse.ok) {
              const errorData = await activeResponse.json();
              throw new Error(errorData.error || 'Erreur lors de l\'activation');
            }
            
            result = await activeResponse.json();
            successMessage = 'Bail marqué comme actif !';
            newStatus = 'ACTIF';
          }
          break;
        case 'delete':
          // Vérifier si le bail peut être supprimé
          const deleteCheck = await canDeleteLease();
          if (!deleteCheck.canDelete) {
            throw new Error(deleteCheck.reason || 'Suppression non autorisée');
          }
          
          // Demander confirmation spéciale si ce n'est pas un brouillon
          if (formData.status !== 'BROUILLON') {
            const confirmation = prompt(
              `Êtes-vous sûr de vouloir supprimer ce bail ?\n\nCeci est une action irréversible.\n\nTapez "SUPPRIMER" pour confirmer :`
            );
            if (confirmation !== 'SUPPRIMER') {
              throw new Error('Suppression annulée par l\'utilisateur');
            }
          }
          
          // ✅ APP-SHELL: Supprimer localement via LeaseService (création de pending opération)
          if (isAppShell && organizationId && formData.id) {
            try {
              const leaseService = createLeaseServiceWithMode('app-shell');
              await leaseService.deleteLease(formData.id, organizationId);
              
              // ✅ Dispatcher un événement de refresh ciblé
              // Utiliser propPropertyId en priorité, puis formData.propertyId
              const targetPropertyId = propPropertyId || formData.propertyId;
              if (targetPropertyId) {
                window.dispatchEvent(new CustomEvent('leases:refresh', { 
                  detail: { scope: 'property', propertyId: targetPropertyId, reason: 'delete' } 
                }));
              } else {
                window.dispatchEvent(new CustomEvent('leases:refresh', { 
                  detail: { scope: 'global', reason: 'delete' } 
                }));
              }
              
              successMessage = 'Bail supprimé avec succès !';
              // Fermer la modal sans recharger
              setTimeout(() => {
                onClose();
              }, 500);
              return;
            } catch (error) {
              console.error('[LeaseEditModal] Erreur lors de la suppression locale:', error);
              throw error;
            }
          } else {
            // Mode normal : appel API
            const deleteResponse = await fetch(`/api/leases/${formData.id}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
            });
            
            if (!deleteResponse.ok) {
              const errorData = await deleteResponse.json();
              throw new Error(errorData.error || 'Erreur lors de la suppression');
            }
            
            successMessage = 'Bail supprimé avec succès !';
            // Fermer la modal et recharger
            window.location.reload();
            return;
          }
        case 'terminate':
          // ✅ APP-SHELL: Mettre à jour IndexedDB DIRECTEMENT (sans passer par LeaseService pour éviter les appels multiples)
          if (isAppShell && organizationId && formData.id) {
            try {
              // ✅ ÉTAPE 1: Mettre à jour IndexedDB DIRECTEMENT via le repository offline
              const leaseRepo = getLeaseRepositoryOffline();
              
              // Lire le lease existant
              const db = await getLocalDB();
              const existing = await db.Lease.get(formData.id);
              
              if (!existing) {
                throw new Error('Bail non trouvé');
              }
              
              // ✅ ÉTAPE 2: Mettre à jour DIRECTEMENT avec upsert (crée automatiquement la pendingOp)
              await leaseRepo.upsert({
                ...existing,
                id: formData.id,
                organizationId,
                status: 'RÉSILIÉ',
                updatedAt: new Date().toISOString(),
              }, organizationId);
              
              // ✅ ÉTAPE 3: Vérifier que l'update a bien fonctionné
              const updatedLease = await db.Lease.get(formData.id);
              
              if (!updatedLease) {
                throw new Error('Bail non trouvé après mise à jour');
              }
              
              if (updatedLease.status !== 'RÉSILIÉ') {
                console.error('[LeaseEditModal] ⚠️ Le status n\'a pas été mis à jour correctement:', {
                  expected: 'RÉSILIÉ',
                  actual: updatedLease.status
                });
                throw new Error('Le status n\'a pas été mis à jour correctement dans IndexedDB');
              }
              
              // ✅ ÉTAPE 4: Dispatcher l'événement APRÈS vérification de l'update
              const targetPropertyId = propPropertyId || formData.propertyId || updatedLease.propertyId;
              if (targetPropertyId) {
                window.dispatchEvent(new CustomEvent('leases:refresh', { 
                  detail: { scope: 'property', propertyId: targetPropertyId, reason: 'update' } 
                }));
              } else {
                window.dispatchEvent(new CustomEvent('leases:refresh', { 
                  detail: { scope: 'global', reason: 'update' } 
                }));
              }
              
              successMessage = 'Bail résilié avec succès !';
              newStatus = 'RÉSILIÉ';
            } catch (error) {
              console.error('[LeaseEditModal] Erreur lors de la mise à jour locale du statut:', error);
              throw error;
            }
          } else {
            // Mode normal : appel API
            const terminateResponse = await fetch(`/api/leases/${formData.id}/terminate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
            });
            
            if (!terminateResponse.ok) {
              const errorData = await terminateResponse.json();
              throw new Error(errorData.error || 'Erreur lors de la résiliation');
            }
            
            result = await terminateResponse.json();
            successMessage = 'Bail résilié avec succès !';
            newStatus = 'RÉSILIÉ';
          }
          break;
        case 'cancel-send':
          if (!formData.id) {
            throw new Error('ID du bail manquant');
          }
          
          // ✅ APP-SHELL: Mettre à jour localement via LeaseService (création de pending opération)
          if (isAppShell && organizationId) {
            try {
              const leaseService = createLeaseServiceWithMode('app-shell');
              await leaseService.updateLease(formData.id, organizationId, {
                status: 'BROUILLON',
              });
              
              // ✅ Dispatcher un événement de refresh ciblé après la mise à jour IndexedDB
              // Utiliser propPropertyId en priorité, puis formData.propertyId
              const targetPropertyId = propPropertyId || formData.propertyId;
              
              // ✅ Utiliser requestAnimationFrame pour s'assurer que l'IndexedDB est à jour
              // et que le dispatch se fait après le cycle de rendu actuel
              requestAnimationFrame(() => {
                if (targetPropertyId) {
                  window.dispatchEvent(new CustomEvent('leases:refresh', {
                    detail: { scope: 'property', propertyId: targetPropertyId, reason: 'update' }
                  }));
                } else {
                  window.dispatchEvent(new CustomEvent('leases:refresh', {
                    detail: { scope: 'global', reason: 'update' }
                  }));
                }
              });
              
              successMessage = 'Envoi annulé avec succès ! Le bail est revenu en statut BROUILLON.';
              newStatus = 'BROUILLON';
            } catch (error) {
              console.error('[LeaseEditModal] Erreur lors de la mise à jour locale du statut:', error);
              throw error;
            }
          } else {
            // Mode normal : appel API
            const cancelResponse = await fetch(`/api/leases/${formData.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'BROUILLON' })
            });
            
            if (!cancelResponse.ok) {
              const errorData = await cancelResponse.json();
              throw new Error(errorData.error || 'Erreur lors de l\'annulation');
            }
            
            result = await cancelResponse.json();
            successMessage = 'Envoi annulé avec succès ! Le bail est revenu en statut BROUILLON.';
            newStatus = 'BROUILLON';
          }
          break;
        case 'mark-unsigned':
          // ✅ APP-SHELL: Mettre à jour localement via LeaseService (création de pending opération)
          if (isAppShell && organizationId && formData.id) {
            try {
              const leaseService = createLeaseServiceWithMode('app-shell');
              await leaseService.updateLease(formData.id, organizationId, {
                status: 'ENVOYÉ',
              });
              
              // ✅ Dispatcher un événement de refresh ciblé
              // Utiliser propPropertyId en priorité, puis formData.propertyId
              const targetPropertyId = propPropertyId || formData.propertyId;
              if (targetPropertyId) {
                window.dispatchEvent(new CustomEvent('leases:refresh', { 
                  detail: { scope: 'property', propertyId: targetPropertyId, reason: 'update' } 
                }));
              } else {
                window.dispatchEvent(new CustomEvent('leases:refresh', { 
                  detail: { scope: 'global', reason: 'update' } 
                }));
              }
              
              successMessage = 'Bail marqué comme non signé avec succès ! Le bail est revenu en statut ENVOYÉ.';
              newStatus = 'ENVOYÉ';
            } catch (error) {
              console.error('[LeaseEditModal] Erreur lors de la mise à jour locale du statut:', error);
              throw error;
            }
          } else {
            // Mode normal : appel API
            const unsignedResponse = await fetch(`/api/leases/${formData.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'ENVOYÉ' })
            });
            
            if (!unsignedResponse.ok) {
              const errorData = await unsignedResponse.json();
              throw new Error(errorData.error || 'Erreur lors de la modification');
            }
            
            successMessage = 'Bail marqué comme non signé avec succès ! Le bail est revenu en statut ENVOYÉ.';
            newStatus = 'ENVOYÉ';
          }
          break;
      }
      
      // Mettre à jour le statut localement
      if (newStatus) {
        setFormData(prev => ({ ...prev, status: newStatus as any }));
      }
      
      // ✅ APP-SHELL: Pour toutes les actions de workflow, ne PAS recharger la page, utiliser refresh ciblé
      if (isAppShell && (action === 'send-for-signature' || action === 'cancel-send' || action === 'mark-unsigned' || action === 'mark-active' || action === 'terminate')) {
        // En app-shell, le refresh ciblé est déjà fait dans le case spécifique
        // Afficher le toast de succès si disponible
        if (successMessage) {
          notify2.success(successMessage);
        }
        // Fermer la modal sans recharger
        setTimeout(() => {
          onClose();
        }, 500);
      } else if (action === 'terminate' || action === 'delete' || action === 'mark-active' || action === 'send-for-signature' || action === 'cancel-send' || action === 'mark-unsigned') {
        // Mode normal : recharger la page
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 1500);
      } else if (successMessage) {
        // Pour les autres actions, afficher un toast de succès
        notify2.success(successMessage);
      }
      
    } catch (error) {
      console.error('Error executing workflow action:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      notify2.error('Erreur lors de l\'exécution de l\'action', errorMessage);
      // Ne pas changer le statut en cas d'erreur
    } finally {
      setIsWorkflowActionLoading(false);
    }
  };

  const handleUploadSigned = async (file: File) => {
    // ✅ APP-SHELL: Désactiver en offline
    if (isAppShell && !navigator.onLine) {
      notify2.error('Action indisponible', 'L\'upload du bail signé nécessite une connexion internet.');
      return;
    }
    
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('signedPdf', file);
      
      const response = await fetch(`/api/leases/${formData.id}/upload-signed`, {
        method: 'POST',
        body: uploadFormData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de l\'upload');
      }

      const result = await response.json();
      
      // Vérifier si le bail devrait devenir automatiquement actif
      const startDate = new Date(formData.startDate);
      const now = new Date();
      const daysUntilStart = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      let newStatus = 'SIGNÉ';
      let alertMessage = 'Bail signé uploadé avec succès ! Le statut a été mis à jour à SIGNÉ.';
      
      if (daysUntilStart <= 30) {
        // Le bail devrait être automatiquement actif
        newStatus = 'ACTIF';
        alertMessage = 'Bail signé uploadé avec succès ! Le statut a été automatiquement mis à jour à ACTIF (bail en cours).';
      }
      
      // ✅ APP-SHELL: Mettre à jour localement via LeaseService (création de pending opération)
      if (isAppShell && organizationId && formData.id) {
        try {
          const leaseService = createLeaseServiceWithMode('app-shell');
          await leaseService.updateLease(formData.id, organizationId, {
            status: newStatus,
            signedPdfUrl: (result as any)?.signedPdfUrl || (result as any)?.lease?.signedPdfUrl || (formData as any).signedPdfUrl,
          });
          
          // ✅ ÉTAPE 2: Puller les métadonnées Document + DocumentLink vers IndexedDB
          // ⚠️ RÈGLE PRODUIT: "Bail signé" = archivé durablement (Supabase Storage + métadonnées + liens)
          // Après upload, on doit puller les métadonnées Document et DocumentLink créées côté serveur
          try {
            const syncService = getGlobalSyncService();
            
            // Puller les documents et documentLinks pour cette organisation
            await Promise.all([
              syncService.syncEntityFromRemoteByName('document', organizationId),
              syncService.syncEntityFromRemoteByName('documentLink', organizationId),
            ]);
            
            if (process.env.NODE_ENV === 'development') {
              console.log('[LeaseEditModal] [UPLOAD-SIGNED] ✅ Métadonnées Document + DocumentLink pullées vers IndexedDB');
            }
          } catch (syncError) {
            console.error('[LeaseEditModal] ⚠️ Erreur lors du pull des métadonnées Document/DocumentLink:', syncError);
            // Ne pas bloquer, mais avertir l'utilisateur
            notify2.warning(
              'Métadonnées non synchronisées', 
              'Le bail a été uploadé, mais les métadonnées du document ne sont pas encore disponibles localement. Elles seront synchronisées lors de la prochaine sync.'
            );
          }
          
          // ✅ Dispatcher un événement de refresh ciblé
          // Utiliser propPropertyId en priorité, puis formData.propertyId
          const targetPropertyId = propPropertyId || formData.propertyId;
          if (targetPropertyId) {
            window.dispatchEvent(new CustomEvent('leases:refresh', { 
              detail: { scope: 'property', propertyId: targetPropertyId, reason: 'update' } 
            }));
            // ✅ Dispatcher aussi un refresh pour les documents (le bail signé est un document)
            window.dispatchEvent(new CustomEvent('documents:refresh', { 
              detail: { scope: 'property', propertyId: targetPropertyId, reason: 'create' } 
            }));
          } else {
            window.dispatchEvent(new CustomEvent('leases:refresh', { 
              detail: { scope: 'global', reason: 'update' } 
            }));
            window.dispatchEvent(new CustomEvent('documents:refresh', { 
              detail: { scope: 'global', reason: 'create' } 
            }));
          }
          
          // Mettre à jour le formData localement
          setFormData(prev => ({ ...prev, status: newStatus as any, signedPdfUrl: (result as any)?.signedPdfUrl || (result as any)?.lease?.signedPdfUrl || (prev as any).signedPdfUrl }));
        } catch (error) {
          console.error('[LeaseEditModal] Erreur lors de la mise à jour locale du statut:', error);
          // Ne pas bloquer l'opération si la mise à jour locale échoue
        }
      } else {
        // Mode normal : mettre à jour le statut via API si nécessaire
        if (daysUntilStart <= 30) {
          try {
            await fetch(`/api/leases/${formData.id}/mark-active`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            });
          } catch (error) {
            console.error('Error marking lease as active:', error);
            newStatus = 'SIGNÉ';
            alertMessage = 'Bail signé uploadé avec succès ! Le statut a été mis à jour à SIGNÉ (erreur lors du passage à ACTIF).';
          }
        }
      }
      
      notify2.success(alertMessage);
      
      // Mettre à jour le statut localement
      setFormData(prev => ({ ...prev, status: newStatus as any }));
      
      // ✅ APP-SHELL: Ne PAS recharger la page, le refresh ciblé est déjà fait
      if (!isAppShell) {
        // Mode normal : recharger la page
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (error) {
      console.error('Error uploading signed PDF:', error);
      alert(`Erreur lors de l'upload du bail signé: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const tabs = [
    { id: 'basic', label: 'Contrat', icon: Building2, required: true },
    { id: 'financial', label: 'Financier', icon: Euro, required: false },
    { id: 'terms', label: 'Clauses et conditions', icon: FileText, required: false },
  ];

  // Règles de verrouillage selon le statut
  const isContractualFieldLocked = (fieldName: string): boolean => {
    const status = formData.status;
    
    // Statut Résilié : TOUT est verrouillé (lecture seule)
    if (status === 'RÉSILIÉ' || status === 'RESILIE') {
      return true;
    }
    
    // Statut Signé/Actif : champs contractuels verrouillés
    if (status === 'SIGNÉ' || status === 'SIGNE' || status === 'ACTIF') {
      const lockedFields = [
        'propertyId',
        'tenantId',
        'type',
        'furnishedType',
        'startDate',
        'endDate',
        'rentAmount',
        'deposit',
        'chargesRecupMensuelles',
        'chargesNonRecupMensuelles',
        'paymentDay',
        'indexationType',
        'notes'
      ];
      return lockedFields.includes(fieldName);
    }
    
    // Statut Brouillon/Envoyé : édition totale OK
    return false;
  };

  const isReadOnly = formData.status === 'RÉSILIÉ' || formData.status === 'RESILIE';
  const isContractLocked = formData.status === 'SIGNÉ' || formData.status === 'SIGNE' || formData.status === 'ACTIF';

  const renderBasicInfo = () => (
    <div className="space-y-6">
      {/* Banner de verrouillage pour baux Signés/Actifs */}
      {isContractLocked && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-5 w-5 text-amber-800 shrink-0" />
            <h3 className="font-semibold text-amber-950">Contrat signé ou en cours — champs verrouillés</h3>
          </div>
          <p className="text-sm text-amber-900 font-medium">Les champs contractuels sont verrouillés.</p>
          <p className="text-sm text-amber-900 mt-1">
            Pour modifier le loyer, les dates ou les conditions, créez un avenant ou un renouvellement (bouton en bas de la fenêtre).
          </p>
        </div>
      )}

      {/* Banner lecture seule pour baux Résiliés */}
      {isReadOnly && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-5 w-5 text-red-700" />
            <h3 className="font-medium text-red-900">Bail résilié</h3>
          </div>
          <p className="text-sm text-red-800">
            Ce bail est résilié. Toutes les informations sont en lecture seule.
          </p>
        </div>
      )}

      {/* Header avec indication des champs obligatoires (si éditable) */}
      {!isReadOnly && !isContractLocked && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-5 w-5 text-gray-600" />
            <h3 className="font-medium text-gray-900">Informations obligatoires</h3>
          </div>
          <p className="text-sm text-gray-700">
            Les champs marqués d'un astérisque rouge (*) sont obligatoires pour modifier le bail.
          </p>
        </div>
      )}

      {/* Sélection du bien et locataire */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex flex-wrap items-center gap-2">
            <span className="text-red-500">*</span> Bien
            {isContractualFieldLocked('propertyId') && (
              <Badge variant="secondary" className="text-[10px] font-semibold">
                Non modifiable
              </Badge>
            )}
          </label>
          {lease ? (
            // Mode édition : afficher le nom du bien en lecture seule
            <input
              type="text"
              value={properties && Array.isArray(properties) && properties.length > 0 
                ? properties.find(p => p.id === formData.propertyId)?.name || 'Bien non trouvé'
                : 'Chargement...'}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
            />
          ) : (
            // Mode création : SmartSelect
            <SmartSelect
              options={(properties && Array.isArray(properties) ? properties : []).map(p => ({
                value: p.id,
                label: `${p.name} - ${p.address}`
              }))}
              value={formData.propertyId}
              onChange={(value) => handleChange('propertyId', value)}
              placeholder="Rechercher un bien..."
              error={!!errors.propertyId}
              aria-label="Sélectionner un bien"
            />
          )}
          {errors.propertyId && <p className="text-red-500 text-sm mt-1">{errors.propertyId}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex flex-wrap items-center gap-2">
            <span className="text-red-500">*</span> Locataire
            {isContractualFieldLocked('tenantId') && (
              <Badge variant="secondary" className="text-[10px] font-semibold">
                Non modifiable
              </Badge>
            )}
          </label>
          {isContractualFieldLocked('tenantId') ? (
            // Verrouillé : afficher en lecture seule
            <input
              type="text"
              value={tenants && Array.isArray(tenants) && tenants.length > 0 
                ? tenants.find(t => t.id === formData.tenantId)
                  ? `${tenants.find(t => t.id === formData.tenantId)?.firstName} ${tenants.find(t => t.id === formData.tenantId)?.lastName}`
                  : 'Locataire non trouvé'
                : 'Chargement...'}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
            />
          ) : (
            // Éditable : SmartSelect
            <SmartSelect
              options={(tenants && Array.isArray(tenants) ? tenants : []).map(t => ({
                value: t.id,
                label: `${t.firstName} ${t.lastName}${t.email ? ` - ${t.email}` : ''}`
              }))}
              value={formData.tenantId}
              onChange={(value) => handleChange('tenantId', value)}
              placeholder="Rechercher un locataire..."
              error={!!errors.tenantId}
              aria-label="Sélectionner un locataire"
            />
          )}
          {errors.tenantId && <p className="text-red-500 text-sm mt-1">{errors.tenantId}</p>}
        </div>
      </div>

      {/* Type de bail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex flex-wrap items-center gap-2" htmlFor="lease-edit-type">
            <span className="text-red-500">*</span> Type de bail
            {isContractualFieldLocked('type') && (
              <Badge variant="secondary" className="text-[10px] font-semibold">
                Non modifiable
              </Badge>
            )}
          </label>
          <SmartSelect
            id="lease-edit-type"
            value={formData.type}
            onChange={(value) => handleChange('type', value)}
            disabled={isContractualFieldLocked('type')}
            options={[
              { value: 'residential', label: 'Résidentiel' },
              { value: 'commercial', label: 'Commercial' },
              { value: 'garage', label: 'Garage' },
            ]}
            placeholder="Sélectionner un type"
            error={!!errors.type}
            aria-label="Type de bail"
          />
          {errors.type && <p className="text-red-500 text-sm mt-1">{errors.type}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex flex-wrap items-center gap-2" htmlFor="lease-edit-furnishedType">
            Type de meublé
            {isContractualFieldLocked('furnishedType') && (
              <Badge variant="secondary" className="text-[10px] font-semibold">
                Non modifiable
              </Badge>
            )}
          </label>
          <SmartSelect
            id="lease-edit-furnishedType"
            value={formData.furnishedType}
            onChange={(value) => handleChange('furnishedType', value)}
            disabled={isContractualFieldLocked('furnishedType')}
            options={[
              { value: 'vide', label: 'Vide' },
              { value: 'meuble', label: 'Meublé' },
              { value: 'garage', label: 'Garage' },
            ]}
            placeholder="Sélectionner un type"
            aria-label="Type de meublé"
          />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex flex-wrap items-center gap-2" htmlFor="lease-edit-startDate">
            <span className="text-red-500">*</span> Date de début
            {isContractualFieldLocked('startDate') && (
              <Badge variant="secondary" className="text-[10px] font-semibold">
                Non modifiable
              </Badge>
            )}
          </label>
          <SmartDatePicker
            id="lease-edit-startDate"
            value={formData.startDate}
            onChange={(value) => handleChange('startDate', value)}
            disabled={isContractualFieldLocked('startDate')}
            placeholder="Sélectionner une date"
            error={!!errors.startDate}
            aria-label="Date de début"
          />
          {errors.startDate && <p className="text-red-500 text-sm mt-1">{errors.startDate}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex flex-wrap items-center gap-2" htmlFor="lease-edit-endDate">
            Date de fin (optionnel)
            {isContractualFieldLocked('endDate') && (
              <Badge variant="secondary" className="text-[10px] font-semibold">
                Non modifiable
              </Badge>
            )}
          </label>
          <div className="relative">
            <SmartDatePicker
              id="lease-edit-endDate"
              value={formData.endDate || ''}
              onChange={(value) => handleChange('endDate', value || undefined)}
              disabled={isContractualFieldLocked('endDate')}
              placeholder="Sélectionner une date"
              aria-label="Date de fin"
            />
            {formData.endDate && !isContractualFieldLocked('endDate') && (
              <button
                type="button"
                onClick={() => handleChange('endDate', undefined)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 bg-white z-10"
                title="Effacer la date"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const totalLocataire = formData.rentAmount + (formData.chargesRecupMensuelles || 0);

  const renderFinancialInfo = () => (
    <div className="space-y-8">
      <p className="text-sm text-gray-600">
        <strong className="text-gray-900">Ce que paie le locataire</strong> = loyer hors charges + charges récupérables. Les
        charges non récupérables sont un coût pour le propriétaire (non refacturées au locataire).
      </p>

      {/* 1–2 : Loyer HC + charges récup (ordre produit) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex flex-wrap items-center gap-2">
            <span className="text-red-500">*</span> Loyer mensuel hors charges (€)
            {isContractualFieldLocked('rentAmount') && (
              <Badge variant="secondary" className="text-[10px] font-semibold">
                Non modifiable
              </Badge>
            )}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={formData.rentAmount}
            onChange={(e) => handleChange('rentAmount', parseFloat(e.target.value) || 0)}
            disabled={isContractualFieldLocked('rentAmount')}
            className={`w-full px-3 py-2 border rounded-lg bg-white outline-none focus:ring-0 focus:border-orange-500 transition-colors ${
              errors.rentAmount ? 'border-red-500' : 'border-gray-300'
            } ${isContractualFieldLocked('rentAmount') ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''}`}
          />
          {errors.rentAmount && <p className="text-red-500 text-sm mt-1">{errors.rentAmount}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex flex-wrap items-center gap-2">
            Charges récupérables mensuelles (€)
            {isContractualFieldLocked('chargesRecupMensuelles') && (
              <Badge variant="secondary" className="text-[10px] font-semibold">
                Non modifiable
              </Badge>
            )}
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.chargesRecupMensuelles || ''}
            onChange={(e) => handleChange('chargesRecupMensuelles', parseFloat(e.target.value) || 0)}
            disabled={isContractualFieldLocked('chargesRecupMensuelles')}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg bg-white outline-none focus:ring-0 focus:border-orange-500 transition-colors ${
              isContractualFieldLocked('chargesRecupMensuelles') ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
            }`}
            placeholder="Ex: 20.00"
          />
          <p className="text-xs text-gray-500 mt-1.5">Montant refacturé au locataire (charges récupérables).</p>
        </div>
      </div>

      {/* 3 : Total locataire — résumé calculé uniquement */}
      <div className="rounded-xl border-2 border-orange-200 bg-orange-50/60 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-900 mb-1">Total dû par le locataire (mensuel)</p>
        <p className="text-3xl font-bold text-gray-900">{totalLocataire.toFixed(2)} €</p>
        <p className="text-xs text-orange-900/80 mt-2">
          Loyer HC ({formData.rentAmount.toFixed(2)} €) + charges récupérables ({(formData.chargesRecupMensuelles || 0).toFixed(2)} €). Ce total
          n&apos;est pas saisi directement : il se met à jour automatiquement.
        </p>
      </div>

      {/* 4–7 */}
      <div className="space-y-6 border-t border-gray-200 pt-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex flex-wrap items-center gap-2">
            Charges non récupérables mensuelles (€)
            {isContractualFieldLocked('chargesNonRecupMensuelles') && (
              <Badge variant="secondary" className="text-[10px] font-semibold">
                Non modifiable
              </Badge>
            )}
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.chargesNonRecupMensuelles || ''}
            onChange={(e) => handleChange('chargesNonRecupMensuelles', parseFloat(e.target.value) || 0)}
            disabled={isContractualFieldLocked('chargesNonRecupMensuelles')}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg bg-white outline-none focus:ring-0 focus:border-orange-500 transition-colors ${
              isContractualFieldLocked('chargesNonRecupMensuelles') ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
            }`}
            placeholder="Ex: 35.00"
          />
          <p className="text-xs text-gray-500 mt-1.5">Coût à votre charge (non facturé au locataire).</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex flex-wrap items-center gap-2">
            Dépôt de garantie (€)
            {isContractualFieldLocked('deposit') && (
              <Badge variant="secondary" className="text-[10px] font-semibold">
                Non modifiable
              </Badge>
            )}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={formData.deposit}
            onChange={(e) => handleChange('deposit', parseFloat(e.target.value) || 0)}
            disabled={isContractualFieldLocked('deposit')}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg bg-white outline-none focus:ring-0 focus:border-orange-500 transition-colors ${
              isContractualFieldLocked('deposit') ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
            }`}
            placeholder="Ex: 1700.00"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex flex-wrap items-center gap-2">
            Jour de paiement du loyer
            {isContractualFieldLocked('paymentDay') && (
              <Badge variant="secondary" className="text-[10px] font-semibold">
                Non modifiable
              </Badge>
            )}
          </label>
          <input
            type="number"
            min="1"
            max="31"
            value={formData.paymentDay}
            onChange={(e) => handleChange('paymentDay', parseInt(e.target.value) || 1)}
            disabled={isContractualFieldLocked('paymentDay')}
            className={`w-full px-3 py-2 border border-gray-300 rounded-lg bg-white outline-none focus:ring-0 focus:border-orange-500 transition-colors ${
              isContractualFieldLocked('paymentDay') ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
            }`}
          />
          <p className="text-xs text-gray-500 mt-1">Jour du mois où le loyer doit être payé (1-31)</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex flex-wrap items-center gap-2" htmlFor="lease-edit-indexationType">
            Type d&apos;indexation
            {isContractualFieldLocked('indexationType') && (
              <Badge variant="secondary" className="text-[10px] font-semibold">
                Non modifiable
              </Badge>
            )}
          </label>
          <SmartSelect
            id="lease-edit-indexationType"
            value={formData.indexationType}
            onChange={(value) => handleChange('indexationType', value)}
            disabled={isContractualFieldLocked('indexationType')}
            options={[
              { value: 'none', label: 'Aucune indexation' },
              { value: 'insee', label: 'Index INSEE' },
              { value: 'manual', label: 'Indexation manuelle' },
            ]}
            placeholder="Sélectionner un type"
            aria-label="Type d'indexation"
          />
        </div>
      </div>
    </div>
  );

  const renderTermsInfo = () => (
    <div className="space-y-8">
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2 flex flex-wrap items-center gap-2">
          Notes et clauses particulières
          {isContractualFieldLocked('notes') && (
            <Badge variant="secondary" className="text-[10px] font-semibold">
              Non modifiable
            </Badge>
          )}
        </label>
        <p className="text-xs text-gray-500 mb-2">Texte libre pour précisions ou clauses hors modèle.</p>
        <textarea
          value={formData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          disabled={isContractualFieldLocked('notes')}
          rows={6}
          className={`w-full px-3 py-2 border border-gray-300 rounded-lg bg-white outline-none focus:ring-0 focus:border-orange-500 transition-colors ${
            isContractualFieldLocked('notes') ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
          }`}
          placeholder="Ajoutez ici toutes les clauses particulières, conditions spéciales, ou notes importantes pour ce bail..."
        />
      </div>

      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Clauses standard incluses</CardTitle>
          <CardDescription className="text-sm">
            Ces clauses seront automatiquement incluses dans le bail généré
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3.5">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm">Obligation de paiement du loyer et des charges</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm">Interdiction de sous-location sans autorisation</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm">Obligation d'assurance habitation</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm">Respect des règles de copropriété</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm">Conditions de résiliation</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderStatusInfo = () => (
    <div className="space-y-6">
      {/* Statut du bail (lecture seule) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Statut du bail
        </label>
        <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
          <Badge variant={getLeaseStatusVariant(formData.status)}>
            {getLeaseStatusLabel(formData.status)}
          </Badge>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Le statut avance automatiquement via les actions (Envoi, Upload signé, etc.)
        </p>
        
        {/* Avertissement pour baux SIGNÉ qui devraient être ACTIF */}
        {isSigned(formData.status) && isLeaseAutoActive() && (
          <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-md">
            <p className="text-xs text-orange-700">
              ⚠️ Ce bail devrait être ACTIF (commence dans moins de 30 jours). 
              Utilisez l'action "Marquer comme actif" ci-dessous.
            </p>
          </div>
        )}
      </div>

      {/* Informations du bail */}
      <Card>
        <CardHeader>
          <CardTitle>Informations du bail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">ID du bail</p>
              <p className="font-medium font-mono text-xs">{lease?.id}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Date de création</p>
              <p className="font-medium">
                {lease?.createdAt ? new Date(lease.createdAt).toLocaleDateString('fr-FR') : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Dernière modification</p>
              <p className="font-medium">
                {lease?.updatedAt ? new Date(lease.updatedAt).toLocaleDateString('fr-FR') : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Statut actuel</p>
              <Badge variant={getLeaseStatusVariant(formData.status)}>
                {getLeaseStatusLabel(formData.status)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workflow du bail */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow du bail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {[
              { status: 'BROUILLON', label: 'Brouillon' },
              { status: 'ENVOYÉ', label: 'Envoyé' },
              { status: 'SIGNÉ', label: 'Signé' },
              { status: 'ACTIF', label: 'Actif' }
            ].map((step, index) => {
              const statusOrder = ['BROUILLON', 'ENVOYÉ', 'SIGNÉ', 'ACTIF'];
              const currentIndex = statusOrder.indexOf(formData.status);
              const stepIndex = statusOrder.indexOf(step.status);
              
              const isActive = formData.status === step.status;
              const isCompleted = currentIndex > stepIndex;
              
              let circleClass = 'w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 text-gray-400';
              let lineClass = 'flex-1 h-0.5 mx-2 bg-gray-200';
              
              if (isActive) {
                if (isDraft(formData.status)) {
                  circleClass = 'w-8 h-8 rounded-full flex items-center justify-center bg-orange-500 text-white';
                } else if (isSent(formData.status)) {
                  circleClass = 'w-8 h-8 rounded-full flex items-center justify-center bg-yellow-500 text-white';
                } else if (isSigned(formData.status)) {
                  circleClass = 'w-8 h-8 rounded-full flex items-center justify-center bg-green-500 text-white';
                } else if (isActiveStatus(formData.status)) {
                  circleClass = 'w-8 h-8 rounded-full flex items-center justify-center bg-purple-500 text-white';
                }
              } else if (isCompleted) {
                circleClass = 'w-8 h-8 rounded-full flex items-center justify-center bg-green-500 text-white';
                lineClass = 'flex-1 h-0.5 mx-2 bg-green-500';
              }
              
              return (
                <React.Fragment key={step.status}>
                  <div className="flex flex-col items-center">
                    <div className={circleClass}>
                      <span className="font-medium text-sm">{index + 1}</span>
                    </div>
                    <span className="text-xs mt-2 text-center">{step.label}</span>
                  </div>
                  {index < 3 && <div className={lineClass} />}
                </React.Fragment>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Actions du Workflow */}
      <Card>
        <CardHeader>
          <CardTitle>Actions du Workflow</CardTitle>
          <CardDescription>
            Utilisez ces actions pour faire avancer le statut du bail
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Envoyer pour signature - BROUILLON */}
            {isDraft(formData.status) && (
              <Button
                variant="outline"
                className="h-auto p-4 flex flex-col items-center gap-2"
                onClick={() => handleWorkflowAction('send-for-signature')}
                disabled={isWorkflowActionLoading || !canSendForSignature()}
              >
                <Mail className="h-6 w-6 text-orange-500" />
                <span className="font-medium">
                  {isWorkflowActionLoading ? 'Envoi en cours...' : 'Envoyer pour signature'}
                </span>
                <span className="text-xs text-gray-500">Statut → À ENVOYER puis ENVOYÉ</span>
                {!canSendForSignature() && (
                  <span className="text-xs text-red-500 mt-1">
                    ⚠️ Locataire sans email
                  </span>
                )}
              </Button>
            )}

            {/* Réessayer l'envoi - À_ENVOYER */}
            {isToSend(formData.status) && (
              <Button
                variant="outline"
                className="h-auto p-4 flex flex-col items-center gap-2 border-orange-200 text-orange-600 hover:bg-orange-50"
                onClick={() => handleWorkflowAction('send-for-signature')}
                disabled={isWorkflowActionLoading || !canSendForSignature()}
              >
                <Mail className="h-6 w-6 text-orange-500" />
                <span className="font-medium">
                  {isWorkflowActionLoading ? 'Envoi en cours...' : 'Réessayer l\'envoi'}
                </span>
                <span className="text-xs text-gray-500">Action manuelle requise (non-idempotente)</span>
                {!canSendForSignature() && (
                  <span className="text-xs text-red-500 mt-1">
                    ⚠️ Locataire sans email
                  </span>
                )}
              </Button>
            )}

            {/* Upload bail signé - seulement pour ENVOYÉ */}
            {isSent(formData.status) && (
              <Button
                type="button"
                variant="outline"
                className="h-auto p-4 flex flex-col items-center gap-2 w-full cursor-pointer"
                disabled={isUploadingSigned || (shouldUseLocalData && !navigator.onLine)}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsUploadingSigned(true);
                  
                  openModalWithDocumentType('BAIL_SIGNE', 'Bail signé', {
                    autoLinkingContext: {
                      leaseId: formData.id,
                      propertyId: formData.propertyId,
                      tenantsIds: formData.tenantId ? [formData.tenantId] : []
                    },
                    onSuccess: async () => {
                      try {
                        console.log('[LeaseEditModal] [UPLOAD-SIGNED] onSuccess callback appelé');
                        
                        // ✅ APP-SHELL: Mettre à jour IndexedDB et créer pendingOp
                        if (isAppShell && organizationId && formData.id) {
                          try {
                            console.log('[LeaseEditModal] [UPLOAD-SIGNED] Début sync app-shell...');
                            
                            // 1. Puller le bail mis à jour depuis Supabase vers IndexedDB
                            const syncService = getGlobalSyncService();
                            
                            // Puller le bail spécifique (ou tous les baux de l'organisation)
                            console.log('[LeaseEditModal] [UPLOAD-SIGNED] Pulling lease...');
                            await syncService.syncEntityFromRemoteByName('lease', organizationId);
                            
                            // 2. Puller aussi les documents et documentLinks créés
                            console.log('[LeaseEditModal] [UPLOAD-SIGNED] Pulling documents and documentLinks...');
                            await Promise.all([
                              syncService.syncEntityFromRemoteByName('document', organizationId),
                              syncService.syncEntityFromRemoteByName('documentLink', organizationId),
                            ]);
                            
                            // 3. Dispatcher un événement de refresh ciblé
                            const targetPropertyId = propPropertyId || formData.propertyId;
                            console.log('[LeaseEditModal] [UPLOAD-SIGNED] Dispatching refresh events...', { targetPropertyId });
                            if (targetPropertyId) {
                              window.dispatchEvent(new CustomEvent('leases:refresh', { 
                                detail: { scope: 'property', propertyId: targetPropertyId, reason: 'update' } 
                              }));
                              window.dispatchEvent(new CustomEvent('documents:refresh', { 
                                detail: { scope: 'property', propertyId: targetPropertyId, reason: 'create' } 
                              }));
                            } else {
                              window.dispatchEvent(new CustomEvent('leases:refresh', { 
                                detail: { scope: 'global', reason: 'update' } 
                              }));
                              window.dispatchEvent(new CustomEvent('documents:refresh', { 
                                detail: { scope: 'global', reason: 'create' } 
                              }));
                            }
                            
                            // 4. Recharger le bail depuis IndexedDB pour mettre à jour formData
                            console.log('[LeaseEditModal] [UPLOAD-SIGNED] Reloading lease from IndexedDB...');
                            const leaseRepo = getLeaseRepositoryOffline();
                            const updatedLease = await leaseRepo.getById(formData.id, organizationId);
                            
                            if (updatedLease) {
                              console.log('[LeaseEditModal] [UPLOAD-SIGNED] Lease mis à jour:', { 
                                id: updatedLease.id, 
                                status: updatedLease.status,
                                signedPdfUrl: updatedLease.signedPdfUrl 
                              });
                              setFormData(prev => ({
                                ...prev,
                                status: updatedLease.status as any,
                                signedPdfUrl: updatedLease.signedPdfUrl || (prev as any).signedPdfUrl
                              }));
                            } else {
                              console.warn('[LeaseEditModal] [UPLOAD-SIGNED] Lease non trouvé dans IndexedDB après sync');
                            }
                            
                            notify2.success('Bail signé uploadé avec succès !', 'Le statut a été mis à jour.');
                            console.log('[LeaseEditModal] [UPLOAD-SIGNED] ✅ Sync terminée avec succès');
                          } catch (error) {
                            console.error('[LeaseEditModal] [UPLOAD-SIGNED] ❌ Erreur lors de la mise à jour après upload:', error);
                            notify2.error('Erreur', 'Le bail a été uploadé mais la mise à jour locale a échoué. Veuillez rafraîchir la page.');
                          }
                        } else {
                          // Mode normal : mettre à jour le statut localement
                          // Le statut sera déterminé par l'API (ACTIF si dans la période active, sinon SIGNÉ)
                          const updatedFormData = { ...formData, status: 'SIGNÉ' as any };
                          setFormData(updatedFormData);
                          onSubmit?.(updatedFormData);
                          notify2.success('Bail signé uploadé avec succès !', 'Le statut a été mis à jour.');
                        }
                      } finally {
                        // Désactiver le loader immédiatement après l'exécution du callback
                        console.log('[LeaseEditModal] [UPLOAD-SIGNED] ✅ Callback terminé, désactivation du loader');
                        setIsUploadingSigned(false);
                      }
                    },
                    onError: (error: string) => {
                      console.error('[LeaseEditModal] Erreur lors de l\'upload:', error);
                      notify2.error('Erreur', error || 'Erreur lors de l\'upload du bail signé');
                      setIsUploadingSigned(false);
                    }
                  });
                }}
              >
                {isUploadingSigned ? (
                  <>
                    <div className="h-6 w-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                    <span className="font-medium">Upload en cours...</span>
                    <span className="text-xs text-gray-500">Veuillez patienter</span>
                  </>
                ) : (shouldUseLocalData && !navigator.onLine) ? (
                  <>
                    <Upload className="h-6 w-6 text-gray-400" />
                    <span className="font-medium text-gray-400">Upload bail signé</span>
                    <span className="text-xs text-red-500 mt-1">
                      ⚠️ Action indisponible hors ligne
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      Cette action nécessite une connexion internet
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-green-500" />
                    <span className="font-medium">Upload bail signé</span>
                    <span className="text-xs text-gray-500">Statut → SIGNÉ</span>
                  </>
                )}
              </Button>
            )}

            {/* Marquer comme actif - seulement pour SIGNÉ et si devrait être actif automatiquement */}
            {isSigned(formData.status) && isLeaseAutoActive() && (
              <Button
                variant="outline"
                className="h-auto p-4 flex flex-col items-center gap-2"
                onClick={() => handleWorkflowAction('mark-active')}
              >
                <CheckCircle className="h-6 w-6 text-green-500" />
                <span className="font-medium">Marquer comme actif</span>
                <span className="text-xs text-gray-500">Statut → ACTIF</span>
              </Button>
            )}

            {/* Supprimer le bail - seulement pour BROUILLON */}
            {isDraft(formData.status) && (
              <Button
                variant="outline"
                className="h-auto p-4 flex flex-col items-center gap-2 border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => {
                  if (confirm('Êtes-vous sûr de vouloir supprimer définitivement ce bail ? Cette action est irréversible.')) {
                    handleWorkflowAction('delete');
                  }
                }}
              >
                <Trash2 className="h-6 w-6 text-red-500" />
                <span className="font-medium">Supprimer le bail</span>
                <span className="text-xs text-red-500">Suppression définitive</span>
              </Button>
            )}

            {/* Annuler l'envoi - retour arrière depuis ENVOYÉ vers BROUILLON */}
            {isSent(formData.status) && (
              <Button
                variant="outline"
                className="h-auto p-4 flex flex-col items-center gap-2 border-orange-200 text-orange-600 hover:bg-orange-50"
                onClick={() => handleWorkflowAction('cancel-send')}
                disabled={isWorkflowActionLoading}
              >
                <X className="h-6 w-6 text-orange-500" />
                <span className="font-medium">Annuler l'envoi</span>
                <span className="text-xs text-gray-500">Statut → BROUILLON</span>
              </Button>
            )}

            {/* Marquer non signé - retour arrière depuis SIGNÉ vers ENVOYÉ */}
            {isSigned(formData.status) && (
              <Button
                variant="outline"
                className="h-auto p-4 flex flex-col items-center gap-2 border-orange-200 text-orange-600 hover:bg-orange-50"
                onClick={() => {
                  if (confirm('Êtes-vous sûr de vouloir marquer ce bail comme non signé ? Il reviendra en statut ENVOYÉ.')) {
                    handleWorkflowAction('mark-unsigned');
                  }
                }}
              >
                <X className="h-6 w-6 text-orange-500" />
                <span className="font-medium">Marquer non signé</span>
                <span className="text-xs text-gray-500">Statut → ENVOYÉ</span>
              </Button>
            )}

            {/* Résilier le bail - pour tous sauf BROUILLON et RÉSILIÉ */}
            {formData.status !== 'RÉSILIÉ' && formData.status !== 'BROUILLON' && (
              <Button
                variant="outline"
                className="h-auto p-4 flex flex-col items-center gap-2"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  // ✅ Vérification explicite de la confirmation
                  const confirmed = window.confirm('Êtes-vous sûr de vouloir résilier ce bail ? Cette action est irréversible.');
                  
                  if (!confirmed) {
                    // Si l'utilisateur annule, ne rien faire
                    return;
                  }
                  
                  // Seulement si confirmé, exécuter l'action
                  await handleWorkflowAction('terminate');
                }}
              >
                <Trash2 className="h-6 w-6 text-red-500" />
                <span className="font-medium">Résilier le bail</span>
                <span className="text-xs text-gray-500">Statut → RÉSILIÉ</span>
              </Button>
            )}

            {/* Réindexer le loyer - pour baux ACTIF ou SIGNÉ */}
            {(formData.status === 'ACTIF' || formData.status === 'SIGNÉ' || formData.status === 'SIGNE') && lease && (
              <Button
                type="button"
                variant="outline"
                className="h-auto p-4 flex flex-col items-center gap-2 border-orange-200 text-orange-600 hover:bg-orange-50"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  loadIndexationHistory();
                  setShowIndexationModal(true);
                }}
              >
                <TrendingUp className="h-6 w-6 text-orange-500" />
                <span className="font-medium">Réindexer le loyer</span>
                <span className="text-xs text-gray-500">Mettre à jour le montant</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Historique des réindexations */}
      {lease && indexationHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historique des réindexations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {indexationHistory.map((indexation, idx) => (
                <div key={indexation.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-orange-500" />
                      <span className="font-medium text-sm">
                        {new Date(indexation.effectiveDate).toLocaleDateString('fr-FR')}
                      </span>
                      {indexation.indexType && (
                        <Badge variant="outline" className="text-xs">
                          {indexation.indexType}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(indexation.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Ancien loyer :</span>
                      <span className="ml-2 font-medium">{indexation.previousRentAmount.toFixed(2)} €</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Nouveau loyer :</span>
                      <span className="ml-2 font-medium text-green-600">{indexation.newRentAmount.toFixed(2)} €</span>
                    </div>
                  </div>
                  {indexation.reason && (
                    <p className="text-xs text-gray-500 mt-2">{indexation.reason}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'basic': return renderBasicInfo();
      case 'financial': return renderFinancialInfo();
      case 'terms': return renderTermsInfo();
      default: return renderBasicInfo();
    }
  };

  const handleAmendmentPrimaryClick = () => {
    if (onRequestAmendment) {
      onRequestAmendment();
      return;
    }
    notify2.info(
      'Renouvellement ou avenant',
      'Lancez un renouvellement depuis la page Baux (application) ou les actions du détail du bail lorsque cette option est proposée.'
    );
  };

  if (!isOpen) return null;

  // Labels courts pour mobile
  const tabLabelsMobile: Record<string, string> = {
    'basic': 'Essentiel',
    'financial': 'Finances',
    'terms': 'Clauses',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={lease ? `Modifier le bail - ${lease.Tenant?.firstName} ${lease.Tenant?.lastName}` : 'Nouveau bail'}
      size="xl"
      footer={
        <div className="flex flex-col gap-3">
          {/* Mobile: Accordéon erreurs */}
          {!areRequiredFieldsFilled() && missingCount > 0 && (
            <div className="lg:hidden">
              <button
                type="button"
                onClick={() => setShowErrorsAccordion(!showErrorsAccordion)}
                className="w-full text-left text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between"
              >
                <span className="font-medium">⚠️ Erreurs ({missingCount})</span>
                <span className={`transform transition-transform ${showErrorsAccordion ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
              {showErrorsAccordion && (
                <div className="mt-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="font-medium mb-2">Champs obligatoires manquants :</p>
                  <ul className="list-disc list-inside space-y-1">
                    {missingFields.map((field, idx) => (
                      <li key={idx}>{field}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Desktop: Erreurs inline (comportement existant) */}
          {!areRequiredFieldsFilled() && missingCount > 0 && (
            <div className="hidden lg:block text-sm text-amber-600">
              <p>⚠️ Champs obligatoires manquants :</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                {missingFields.map((field, idx) => (
                  <li key={idx}>{field}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions footer */}
          <div className="flex flex-col gap-3">
            {isContractLocked && !isReadOnly && (
              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Les données contractuelles ne peuvent pas être enregistrées depuis cette fenêtre. Utilisez le bouton orange
                pour créer un avenant ou un renouvellement.
              </p>
            )}
            <div className="flex flex-col-reverse sm:flex-row gap-3 items-stretch sm:items-center sm:flex-wrap">
              <Button variant="ghost" onClick={onClose} disabled={isSubmitting} className="w-full sm:w-auto order-last sm:order-first">
                Annuler
              </Button>

              <div className="flex-1 hidden sm:block min-w-[8px]" />

              {isContractLocked && !isReadOnly ? (
                <>
                  <Button
                    type="button"
                    variant="default"
                    onClick={handleAmendmentPrimaryClick}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white font-semibold"
                  >
                    <FileCheck className="h-4 w-4 mr-2 shrink-0" />
                    Créer un avenant / renouvellement
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSubmit}
                    disabled
                    title="Contrat signé ou actif : les modifications directes ne sont pas autorisées. Créez un avenant."
                    className="w-full sm:w-auto border-gray-300 text-gray-500 bg-gray-50 cursor-not-allowed"
                  >
                    Enregistrer les modifications
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !areRequiredFieldsFilled() || isReadOnly}
                  title={
                    isReadOnly
                      ? 'Bail résilié - lecture seule'
                      : !areRequiredFieldsFilled()
                        ? 'Veuillez remplir tous les champs obligatoires'
                        : ''
                  }
                  className="w-full sm:w-auto"
                >
                  {isSubmitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
                </Button>
              )}
            </div>
          </div>
        </div>
      }
    >
      {isLoadingData ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des données...</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {/* Tabs Navigation - Sticky sur mobile */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 -mx-4 md:-mx-6 px-4 md:px-6 mb-4">
            <nav className="overflow-x-auto -mb-px flex space-x-4 md:space-x-8 scrollbar-hide">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const hasMissing = hasMissingRequiredFields(tab.id);
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-1 md:gap-2 relative whitespace-nowrap flex-shrink-0 ${
                      activeTab === tab.id
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tabLabelsMobile[tab.id] || tab.label}</span>
                    {tab.required && <span className="text-red-500 text-xs">*</span>}
                    {hasMissing && (
                      <div className="w-2 h-2 bg-red-500 rounded-full ml-1 flex-shrink-0"></div>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content - Scrollable avec padding-bottom pour footer et safe-area */}
          <div 
            className="flex-1 overflow-y-auto overscroll-contain min-h-0 min-w-0"
            style={{
              paddingBottom: 'max(2rem, calc(2rem + env(safe-area-inset-bottom)))',
              WebkitOverflowScrolling: 'touch',
              overscrollBehavior: 'contain',
            }}
          >
            <div className="min-w-0">
              {renderTabContent()}
            </div>
          </div>
        </form>
      )}
      
      {/* Modal d'alerte pour le profil incomplet */}
      {showProfileAlert && profileAlertData && (
        <AlertModal
          isOpen={showProfileAlert}
          onClose={() => setShowProfileAlert(false)}
          onConfirm={() => {
            setShowProfileAlert(false);
            window.location.href = '/profil';
          }}
          title={profileAlertData.title}
          message={profileAlertData.message}
          type="warning"
          confirmText="Aller au profil"
          cancelText="Annuler"
          showCancel={true}
        />
      )}

      {/* Modal de réindexation */}
      {showIndexationModal && lease && (
        <RentIndexationModal
          isOpen={showIndexationModal}
          onClose={() => setShowIndexationModal(false)}
          lease={lease}
          currentRentAmount={formData.rentAmount}
          onSuccess={async () => {
            // Recharger les données du bail
            const leaseResponse = await fetch(`/api/leases/${lease.id}`);
            if (leaseResponse.ok) {
              const payload = await leaseResponse.json();
              const updatedLease = payload?.data ?? payload;
              setFormData((prev) => ({
                ...prev,
                rentAmount: updatedLease.rentAmount ?? prev.rentAmount,
              }));
            }
            // Recharger l'historique
            await loadIndexationHistory();
            notify2.success('Réindexation effectuée', 'Le loyer a été mis à jour avec succès');
          }}
        />
      )}
    </Modal>
  );
}

// Composant modal de réindexation
interface RentIndexationModalProps {
  isOpen: boolean;
  onClose: () => void;
  lease: any;
  currentRentAmount: number;
  onSuccess: () => void;
}

function RentIndexationModal({ isOpen, onClose, lease, currentRentAmount, onSuccess }: RentIndexationModalProps) {
  const [formData, setFormData] = useState({
    newRentAmount: currentRentAmount,
    effectiveDate: new Date().toISOString().split('T')[0],
    indexType: 'MANUAL' as 'IRL' | 'ILAT' | 'ICC' | 'MANUAL' | '',
    indexValue: undefined as number | undefined,
    indexDate: undefined as string | undefined,
    reason: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Mettre à jour le nouveau loyer quand le loyer actuel change
  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({
        ...prev,
        newRentAmount: currentRentAmount
      }));
    }
  }, [currentRentAmount, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      // Validation
      if (formData.newRentAmount <= 0) {
        setErrors({ newRentAmount: 'Le nouveau loyer doit être positif' });
        setIsSubmitting(false);
        return;
      }

      if (!formData.effectiveDate) {
        setErrors({ effectiveDate: 'La date d\'effet est requise' });
        setIsSubmitting(false);
        return;
      }

      // ✅ APP-SHELL: Désactiver en offline
      if (isAppShell && !navigator.onLine) {
        setErrors({ effectiveDate: 'L\'indexation nécessite une connexion internet.' });
        setIsSubmitting(false);
        notify2.error('Action indisponible', 'L\'indexation du loyer nécessite une connexion internet.');
        return;
      }

      const response = await fetch(`/api/leases/${lease.id}/index-rent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newRentAmount: formData.newRentAmount,
          effectiveDate: formData.effectiveDate,
          indexType: formData.indexType || undefined,
          indexValue: formData.indexValue || undefined,
          indexDate: formData.indexDate || undefined,
          reason: formData.reason || undefined,
          notes: formData.notes || undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la réindexation');
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error indexing rent:', error);
      notify2.error('Erreur', error instanceof Error ? error.message : 'Erreur lors de la réindexation');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Réindexer le loyer"
      size="md"
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Enregistrement...' : 'Enregistrer la réindexation'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations actuelles */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h4 className="font-medium text-orange-900 mb-2">Loyer actuel</h4>
          <p className="text-2xl font-bold text-orange-900">{currentRentAmount.toFixed(2)} €</p>
        </div>

        {/* Nouveau loyer */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <span className="text-red-500">*</span> Nouveau loyer mensuel (€)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.newRentAmount}
            onChange={(e) => setFormData(prev => ({ ...prev, newRentAmount: parseFloat(e.target.value) || 0 }))}
            className={`w-full px-3 py-2 border rounded-lg bg-white outline-none focus:ring-0 focus:border-orange-500 transition-colors ${
              errors.newRentAmount ? 'border-red-500' : 'border-gray-300'
            }`}
            required
          />
          {errors.newRentAmount && <p className="text-red-500 text-sm mt-1">{errors.newRentAmount}</p>}
        </div>

        {/* Date d'effet */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <span className="text-red-500">*</span> Date d'effet
          </label>
          <input
            type="date"
            value={formData.effectiveDate}
            onChange={(e) => setFormData(prev => ({ ...prev, effectiveDate: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-lg bg-white outline-none focus:ring-0 focus:border-orange-500 transition-colors ${
              errors.effectiveDate ? 'border-red-500' : 'border-gray-300'
            }`}
            required
          />
          {errors.effectiveDate && <p className="text-red-500 text-sm mt-1">{errors.effectiveDate}</p>}
        </div>

        {/* Type d'indice */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="lease-edit-indexType">
            Type d'indice (optionnel)
          </label>
          <SmartSelect
            id="lease-edit-indexType"
            value={formData.indexType || ''}
            onChange={(value) => setFormData(prev => ({ ...prev, indexType: value as any }))}
            options={[
              { value: '', label: 'Aucun indice' },
              { value: 'IRL', label: 'IRL (Indice de Référence des Loyers)' },
              { value: 'ILAT', label: 'ILAT (Indice des Loyers à l\'Ancien)' },
              { value: 'ICC', label: 'ICC (Indice du Coût de la Construction)' },
              { value: 'MANUAL', label: 'Manuel' },
            ]}
            placeholder="Sélectionner un type"
            aria-label="Type d'indice"
          />
        </div>

        {/* Valeur de l'indice (si indice sélectionné) */}
        {formData.indexType && formData.indexType !== '' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valeur de l'indice
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.indexValue || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, indexValue: parseFloat(e.target.value) || undefined }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Ex: 123.45"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date de référence de l'indice
              </label>
              <input
                type="date"
                value={formData.indexDate || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, indexDate: e.target.value || undefined }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        )}

        {/* Raison */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Raison de la réindexation (optionnel)
          </label>
          <input
            type="text"
            value={formData.reason}
            onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Ex: Révision annuelle selon IRL"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes (optionnel)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Notes supplémentaires..."
          />
        </div>

        {/* Aperçu de la variation */}
        {formData.newRentAmount !== currentRentAmount && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-2">Variation</h4>
            <div className="flex items-center gap-4">
              <div>
                <span className="text-sm text-gray-600">Ancien :</span>
                <span className="ml-2 font-medium">{currentRentAmount.toFixed(2)} €</span>
              </div>
              <div>→</div>
              <div>
                <span className="text-sm text-gray-600">Nouveau :</span>
                <span className="ml-2 font-medium text-green-600">{formData.newRentAmount.toFixed(2)} €</span>
              </div>
              <div className="ml-auto">
                <span className="text-sm text-gray-600">Différence :</span>
                <span className={`ml-2 font-medium ${formData.newRentAmount > currentRentAmount ? 'text-green-600' : 'text-red-600'}`}>
                  {formData.newRentAmount > currentRentAmount ? '+' : ''}
                  {(formData.newRentAmount - currentRentAmount).toFixed(2)} €
                </span>
              </div>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
