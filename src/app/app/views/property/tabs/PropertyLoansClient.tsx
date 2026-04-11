'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { notify2 } from '@/lib/notify2';
import { Plus, Edit, Trash2, CheckCircle, Home, ArrowDown, ArrowUp, ArrowDownUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { usePropertyHeaderActions } from '@/app/biens/[id]/PropertyHeaderActionsContext';
import { navigateToView } from '@/utils/appShellNavigation';
import { LoansCRDTimelineChart } from '@/components/loans/LoansCRDTimelineChart';
import { PropertyFinancingSummaryBlock } from '@/features/loans/components/PropertyFinancingSummaryBlock';
import { useTransactionsKpis } from '@/hooks/useTransactionsKpis';
import {
  aggregateActivePropertyLoans,
  getLoanPilotageStatus,
  loanPilotageStatusLabel,
} from '@/features/loans/utils/propertyLoanPilotage';
import { buildCrdTimelineForLoans } from '@/features/loans/utils/buildCrdTimeline';
import {
  LOAN_CASHFLOW_WEIGHT_TOOLTIP,
  LoanCashflowWeightProgressBar,
  computeLoanWeightInCashflowPct,
  getLoanCashflowWeightDisplay,
} from '@/features/loans/utils/loanCashflowWeight';
import { LoanModalV2 } from '@/components/loans/LoanModalV2';
import { LoanDrawer } from '@/components/loans/LoanDrawer';
import { ConfirmDeleteLoanModal } from '@/components/loans/ConfirmDeleteLoanModal';
import { ConfirmDeleteMultipleLoansModal } from '@/components/loans/ConfirmDeleteMultipleLoansModal';
import { LoansFilters } from '@/components/loans/LoansFilters';
import { useLoansData, type Loan } from '@/features/loans/hooks/useLoansData';
import { useLoansCharts } from '@/hooks/useLoansCharts';
import { getLoanRepositoryOffline } from '@/lib/offline/repositories/LoanRepositoryOffline';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
interface PropertyLoansClientProps {
  propertyId: string;
  propertyName: string;
}

interface Filters {
  search: string;
  propertyId: string;
  active: string;
}

export default function PropertyLoansClient({ propertyId, propertyName }: PropertyLoansClientProps) {
  const { setActions } = usePropertyHeaderActions();
  const { organizationId } = useCurrentOrganization();

  // États des modals et drawer
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'duplicate'>('create');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [loanToDelete, setLoanToDelete] = useState<Loan | null>(null);

  // États pour la sélection multiple
  const [selectedLoanIds, setSelectedLoanIds] = useState<string[]>([]);
  const [showDeleteMultipleModal, setShowDeleteMultipleModal] = useState(false);

  // État pour la limite mobile (cards)
  const [mobileLimit, setMobileLimit] = useState(3);

  // États pour la période
  // ✅ Ne pas fixer de période par défaut : le hook calculera automatiquement depuis le prêt le plus ancien
  const [periodStart, setPeriodStart] = useState<string | undefined>(undefined);
  const [periodEnd, setPeriodEnd] = useState<string | undefined>(undefined);

  /** Graph CRD : total ou un prêt actif */
  const [chartLoanId, setChartLoanId] = useState<'all' | string>('all');

  /** Tri colonne « Poids dans cashflow » : none → desc (risque d’abord) → asc → none */
  const [weightColSort, setWeightColSort] = useState<'none' | 'desc' | 'asc'>('none');

  // États des filtres
  const [filters, setFilters] = useState<Filters>({
    search: '',
    propertyId: propertyId,
    active: '', // Par défaut : tous les prêts (actifs et inactifs)
  });

  // ✅ APP-SHELL: Mémoriser l'objet filters pour éviter les re-renders en boucle
  // ⚠️ IMPORTANT: Utiliser filters.active (qui peut être '', '1', ou '0') au lieu de '1' en dur
  // Sinon, le hook useLoansData filtre déjà les prêts et on ne peut plus afficher les inactifs
  const loansFilters = useMemo(() => ({
    propertyId, // ✅ Filtrer par bien
    search: filters.search,
    active: filters.active, // ✅ Utiliser le filtre actif de l'état local (peut être '', '1', ou '0')
  }), [propertyId, filters.search, filters.active]);

  // ✅ APP-SHELL: Charger les prêts depuis IndexedDB avec filtre propertyId
  const {
    loans: allLoans,
    loansForPropertyAggregates,
    properties,
    loading: isLoading,
  } = useLoansData({
    mode: 'app-shell',
    propertyId, // ✅ Passer propertyId pour filtrer les events
    scope: 'property', // ✅ Scope property pour le tab property
    filters: loansFilters,
    periodStart,
    periodEnd,
  });

  const pilotageLoans = loansForPropertyAggregates ?? [];
  const pilotageAgg = useMemo(
    () => aggregateActivePropertyLoans(pilotageLoans),
    [pilotageLoans]
  );

  const { kpis: txKpis, isLoading: txKpisLoading } = useTransactionsKpis({
    mode: 'app-shell',
    propertyId,
  });

  const propertyCashflowMonthly = txKpis.cashflowMensuelMoyen ?? 0;
  const cashflowNet = propertyCashflowMonthly - pilotageAgg.mensualiteTotale;

  const loansSortedForTable = useMemo(() => {
    if (weightColSort === 'none') return allLoans;
    const pctOf = (l: Loan) => {
      const m = l.loanDisplay?.monthlyPayment ?? l.monthlyPayment ?? 0;
      return computeLoanWeightInCashflowPct(m, propertyCashflowMonthly);
    };
    return [...allLoans].sort((a, b) => {
      const wa = pctOf(a);
      const wb = pctOf(b);
      if (wa === null && wb === null) return 0;
      if (wa === null) return 1;
      if (wb === null) return -1;
      return weightColSort === 'desc' ? wb - wa : wa - wb;
    });
  }, [allLoans, weightColSort, propertyCashflowMonthly]);

  const activeLoansOnProperty = pilotageAgg.activeLoans;

  useEffect(() => {
    setChartLoanId('all');
  }, [propertyId]);

  useEffect(() => {
    if (chartLoanId === 'all') return;
    if (!activeLoansOnProperty.some((l) => l.id === chartLoanId)) {
      setChartLoanId('all');
    }
  }, [chartLoanId, activeLoansOnProperty]);

  // ✅ APP-SHELL: Charger les graphiques en mode app-shell (filtrés par propertyId)
  const { data: chartsData, isLoading: chartsLoading } = useLoansCharts({
    mode: 'app-shell', // ✅ Mode app-shell pour utiliser IndexedDB uniquement
    from: periodStart,
    to: periodEnd,
    propertyId,
    scope: 'property', // ✅ Scope property pour le tab property
  });

  // ✅ APP-SHELL: Gestion des filtres (en mémoire uniquement)
  const handleFiltersChange = useCallback((newFilters: Filters) => {
    setFilters(newFilters);
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({
      search: '',
      propertyId: propertyId,
      active: '', // Réinitialiser à "Tous les prêts"
    });
  }, [propertyId]);

  const handlePeriodChange = (start: string, end: string) => {
    setPeriodStart(start);
    setPeriodEnd(end);
  };

  // CRUD Handlers
  const handleCreate = useCallback(() => {
    setSelectedLoan(null);
    setModalMode('create');
    setIsModalOpen(true);
  }, []);

  const handleEdit = (loan: Loan) => {
    setSelectedLoan(loan);
    setModalMode('edit');
    setIsModalOpen(true);
    setIsDrawerOpen(false);
  };

  const handleDuplicate = (loan: Loan) => {
    setSelectedLoan({ ...loan, id: undefined as any, label: `${loan.label} (copie)` });
    setModalMode('create');
    setIsModalOpen(true);
    setIsDrawerOpen(false);
  };

  const handleDelete = (loan: Loan) => {
    setLoanToDelete(loan);
    setShowDeleteModal(true);
    setIsDrawerOpen(false);
  };

  const handleRowClick = (loan: Loan) => {
    setSelectedLoan(loan);
    setIsDrawerOpen(true);
  };

  // ✅ APP-SHELL: Soumission via repository offline (local-first)
  const handleFormSubmit = async (data: any) => {
    if (!organizationId) {
      notify2.error('Organisation requise');
      return;
    }

    try {
      const loanRepo = getLoanRepositoryOffline();
      const db = await import('@/lib/offline/db').then(m => m.getLocalDB());
      
      const loanId = data.id || crypto.randomUUID();
      
      // Préparer les données pour IndexedDB
      const loanData = {
        id: loanId,
        organizationId,
        propertyId: data.propertyId,
        label: data.label,
        principal: data.principal,
        annualRatePct: data.annualRatePct,
        durationMonths: data.durationMonths,
        defermentMonths: data.defermentMonths || 0,
        insurancePct: data.insurancePct || null,
        feesUpfront: data.feesUpfront || null,
        startDate: data.startDate,
        paymentDay: data.paymentDay || null,
        rateType: data.rateType || 'FIXED',
        loanType: data.loanType || null,
        repaymentType: data.repaymentType || null,
        amortizationProfile: data.amortizationProfile || null,
        notes: data.notes || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
      };

      // Créer ou mettre à jour dans IndexedDB (crée automatiquement une pendingOp)
      await loanRepo.upsert(loanData, organizationId);
      
      const now = new Date().toISOString();
      
      // ✅ Mettre à jour la pendingOp pour inclure les stagedDocumentIds et stagedLinkItemIds
      // L'API /api/loans a besoin de ces champs pour finaliser les documents
      // ⚠️ IMPORTANT: Attendre un peu pour s'assurer que la pendingOp est bien créée
      if ((data.stagedDocumentIds && data.stagedDocumentIds.length > 0) || 
          (data.stagedLinkItemIds && data.stagedLinkItemIds.length > 0)) {
        // Attendre un peu pour s'assurer que la pendingOp est créée
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Chercher la pendingOp (peut être en 'pending' ou 'syncing')
        let existingPendingOp = await db.pendingOperations
          .where('[entity+entityId+operation]')
          .equals(['loan', loanId, data.id ? 'update' : 'create'])
          .first();
        
        // Si pas trouvée avec l'index, chercher manuellement
        if (!existingPendingOp) {
          const allPendingOps = await db.pendingOperations
            .where('entity')
            .equals('loan')
            .and((op: any) => op.entityId === loanId && op.operation === (data.id ? 'update' : 'create'))
            .toArray();
          existingPendingOp = allPendingOps[0];
        }
        
        if (existingPendingOp) {
          // Mettre à jour le payload pour inclure les documents
          // ⚠️ IMPORTANT: S'assurer que le payload existant est bien un objet
          const currentPayload = existingPendingOp.payload || {};
          await db.pendingOperations.update(existingPendingOp.id, {
            payload: {
              ...currentPayload,
              stagedDocumentIds: data.stagedDocumentIds || [],
              stagedLinkItemIds: data.stagedLinkItemIds || [],
            },
            updatedAt: now,
          });
          
          console.log(`[PropertyLoansClient] ✅ PendingOp mise à jour avec stagedDocumentIds: ${data.stagedDocumentIds?.length || 0}, stagedLinkItemIds: ${data.stagedLinkItemIds?.length || 0}`);
        } else {
          console.warn(`[PropertyLoansClient] ⚠️ PendingOp non trouvée pour loan ${loanId}, opération: ${data.id ? 'update' : 'create'}`);
        }
      }

      // ✅ Sauvegarder les co-emprunteurs en localDB
      if (data.borrowers && Array.isArray(data.borrowers) && data.borrowers.length > 0) {
        
        // Supprimer les anciens co-emprunteurs pour ce prêt (si en mode édition)
        if (data.id) {
          const existingBorrowers = await db.LoanBorrower
            .where('[organizationId+loanId]')
            .equals([organizationId, loanId])
            .toArray();
          
          // Supprimer les co-emprunteurs qui ne sont plus dans la liste
          for (const existing of existingBorrowers) {
            const stillExists = data.borrowers.some((b: any) => b.id === existing.id);
            if (!stillExists) {
              await db.LoanBorrower.delete(existing.id);
              
              // ✅ Vérifier si une pendingOp de suppression existe déjà pour éviter les doublons
              const existingDeletePendingOp = await db.pendingOperations
                .where('[entity+entityId+operation]')
                .equals(['loanBorrower', existing.id, 'delete'])
                .first();
              
              // Créer une pendingOp pour la suppression seulement si elle n'existe pas déjà
              if (!existingDeletePendingOp) {
                await db.pendingOperations.add({
                  id: crypto.randomUUID(),
                  entity: 'loanBorrower',
                  entityId: existing.id,
                  operation: 'delete',
                  payload: null,
                  organizationId,
                  status: 'pending',
                  error: null,
                  createdAt: now,
                  updatedAt: now,
                });
              }
            }
          }
        }

        // Créer ou mettre à jour les co-emprunteurs
        for (const borrower of data.borrowers) {
          const borrowerId = borrower.id || crypto.randomUUID();
          const borrowerData = {
            id: borrowerId,
            loanId,
            organizationId,
            firstName: borrower.firstName,
            lastName: borrower.lastName,
            birthDate: borrower.birthDate || null,
            email: borrower.email || null,
            phone: borrower.phone || null,
            responsibilityPct: borrower.responsibilityPct || null,
            createdAt: borrower.createdAt || now,
            updatedAt: now,
          };

          // Vérifier si le co-emprunteur existe déjà
          const existing = await db.LoanBorrower.get(borrowerId);
          const isUpdate = !!existing && existing.organizationId === organizationId;

          // Sauvegarder en localDB
          await db.LoanBorrower.put(borrowerData);

          // ✅ Vérifier si une pendingOp existe déjà pour éviter les doublons
          const existingPendingOp = await db.pendingOperations
            .where('[entity+entityId+operation]')
            .equals(['loanBorrower', borrowerId, isUpdate ? 'update' : 'create'])
            .first();

          // Créer une pendingOp seulement si elle n'existe pas déjà
          if (!existingPendingOp) {
            await db.pendingOperations.add({
              id: crypto.randomUUID(),
              entity: 'loanBorrower',
              entityId: borrowerId,
              operation: isUpdate ? 'update' : 'create',
              payload: {
                loanId,
                firstName: borrower.firstName,
                lastName: borrower.lastName,
                birthDate: borrower.birthDate || null,
                email: borrower.email || null,
                phone: borrower.phone || null,
                responsibilityPct: borrower.responsibilityPct || null,
              },
              organizationId,
              status: 'pending',
              error: null,
              createdAt: now,
              updatedAt: now,
            });
          } else {
            // Mettre à jour la pendingOp existante
            await db.pendingOperations.update(existingPendingOp.id, {
              payload: {
                loanId,
                firstName: borrower.firstName,
                lastName: borrower.lastName,
                birthDate: borrower.birthDate || null,
                email: borrower.email || null,
                phone: borrower.phone || null,
                responsibilityPct: borrower.responsibilityPct || null,
              },
              updatedAt: now,
              status: 'pending', // Réinitialiser le statut si elle était en erreur
              error: null,
            });
          }
        }
      }

      // ✅ Lier les documents au prêt (stagedDocumentIds et stagedLinkItemIds)
      
      // 1. Finaliser les documents en staging (stagedDocumentIds)
      if (data.stagedDocumentIds && Array.isArray(data.stagedDocumentIds) && data.stagedDocumentIds.length > 0) {
        console.log(`[PropertyLoansClient] 📎 Traitement de ${data.stagedDocumentIds.length} document(s) en staging pour loanId=${loanId}`);
        
        for (const docId of data.stagedDocumentIds) {
          // Mettre à jour le document dans IndexedDB
          const doc = await db.Document.get(docId);
          
          if (!doc) {
            console.warn(`[PropertyLoansClient] ⚠️ Document ${docId} non trouvé dans IndexedDB, il sera synchronisé lors de la prochaine sync`);
            continue;
          }
          
          if (doc.organizationId !== organizationId) {
            console.warn(`[PropertyLoansClient] ⚠️ Document ${docId} appartient à une autre organisation`);
            continue;
          }
          
          console.log(`[PropertyLoansClient] 🔍 Document trouvé: docId=${docId}, status=${doc.status}, loanId actuel=${doc.loanId || 'null'}`);
          
          // ✅ Utiliser put() au lieu de update() pour préserver tous les champs
          await db.Document.put({
            ...doc,
            loanId,
            status: 'active',
            uploadSessionId: null,
            intendedContextType: null,
            intendedContextTempKey: null,
            updatedAt: now,
          });
          
          console.log(`[PropertyLoansClient] ✅ Document mis à jour dans IndexedDB: docId=${docId}, loanId=${loanId}, status=active`);

          // ✅ Créer les liens DocumentLink dans IndexedDB pour ce document
          // Les liens sont : loan, property, global
          const linksToCreate = [
            { documentId: docId, linkedType: 'loan', linkedId: loanId },
            { documentId: docId, linkedType: 'property', linkedId: data.propertyId },
            { documentId: docId, linkedType: 'global', linkedId: 'global' },
          ];

          for (const link of linksToCreate) {
            // Vérifier si le lien n'existe pas déjà
            const existingLink = await db.DocumentLink.get([link.documentId, link.linkedType, link.linkedId]);
            
            if (!existingLink) {
              // Créer le lien dans IndexedDB
              await db.DocumentLink.put(link);
              console.log(`[PropertyLoansClient] ✅ DocumentLink créé dans IndexedDB: ${link.linkedType}/${link.linkedId}`);

              // Créer une pendingOp pour la création du lien
              const linkEntityId = `${link.documentId}-${link.linkedType}-${link.linkedId}`;
              const existingLinkPendingOp = await db.pendingOperations
                .where('[entity+entityId+operation]')
                .equals(['documentLink', linkEntityId, 'create'])
                .first();

              if (!existingLinkPendingOp) {
                await db.pendingOperations.add({
                  id: crypto.randomUUID(),
                  entity: 'documentLink',
                  entityId: linkEntityId,
                  operation: 'create',
                  payload: {
                    documentId: link.documentId,
                    linkedType: link.linkedType,
                    linkedId: link.linkedId,
                  },
                  organizationId,
                  status: 'pending',
                  error: null,
                  createdAt: now,
                  updatedAt: now,
                });
              }
            }
          }

          // Créer une pendingOp pour la mise à jour du document
          const existingDocPendingOp = await db.pendingOperations
            .where('[entity+entityId+operation]')
            .equals(['document', docId, 'update'])
            .first();

          if (!existingDocPendingOp) {
            await db.pendingOperations.add({
              id: crypto.randomUUID(),
              entity: 'document',
              entityId: docId,
              operation: 'update',
              payload: {
                loanId,
                status: 'active',
                uploadSessionId: null,
                intendedContextType: null,
                intendedContextTempKey: null,
              },
              organizationId,
              status: 'pending',
              error: null,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      }

      // 2. Lier les documents existants (stagedLinkItemIds)
      if (data.stagedLinkItemIds && Array.isArray(data.stagedLinkItemIds) && data.stagedLinkItemIds.length > 0) {
        for (const existingDocId of data.stagedLinkItemIds) {
          // ✅ Créer les liens DocumentLink dans IndexedDB pour ce document existant
          // Les liens sont : loan, property, global
          const linksToCreate = [
            { documentId: existingDocId, linkedType: 'loan', linkedId: loanId },
            { documentId: existingDocId, linkedType: 'property', linkedId: data.propertyId },
            { documentId: existingDocId, linkedType: 'global', linkedId: 'global' },
          ];

          for (const link of linksToCreate) {
            // Vérifier si le lien n'existe pas déjà
            const existingLink = await db.DocumentLink.get([link.documentId, link.linkedType, link.linkedId]);
            
            if (!existingLink) {
              // Créer le lien dans IndexedDB
              await db.DocumentLink.put(link);
              console.log(`[PropertyLoansClient] ✅ DocumentLink créé dans IndexedDB pour document existant: ${link.linkedType}/${link.linkedId}`);

              // Créer une pendingOp pour la création du lien
              const linkEntityId = `${link.documentId}-${link.linkedType}-${link.linkedId}`;
              const existingLinkPendingOp = await db.pendingOperations
                .where('[entity+entityId+operation]')
                .equals(['documentLink', linkEntityId, 'create'])
                .first();

              if (!existingLinkPendingOp) {
                await db.pendingOperations.add({
                  id: crypto.randomUUID(),
                  entity: 'documentLink',
                  entityId: linkEntityId,
                  operation: 'create',
                  payload: {
                    documentId: link.documentId,
                    linkedType: link.linkedType,
                    linkedId: link.linkedId,
                  },
                  organizationId,
                  status: 'pending',
                  error: null,
                  createdAt: now,
                  updatedAt: now,
                });
              }
            }
          }
        }
      }

      setIsModalOpen(false);
      notify2.success(data.id ? 'Prêt modifié avec succès' : 'Prêt créé avec succès');
      
      // ✅ Émettre un événement ciblé avec payload scope + propertyId
      window.dispatchEvent(new CustomEvent('loans:refresh', { 
        detail: { scope: 'property', propertyId, reason: 'crud' } 
      }));
      
      // Émettre aussi un événement pour rafraîchir les documents
      window.dispatchEvent(new CustomEvent('documents:refresh'));
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde du prêt:', error);
      notify2.error('Erreur', error.message || 'Erreur lors de la sauvegarde');
    }
  };

  // ✅ APP-SHELL: Suppression/Désactivation via repository offline (local-first)
  const handleConfirmDelete = async (action: 'deactivate' | 'delete') => {
    if (!organizationId || !loanToDelete) {
      notify2.error('Données manquantes');
      return;
    }

    try {
      const loanRepo = getLoanRepositoryOffline();
      
      if (action === 'deactivate') {
        // Désactiver le prêt (mettre isActive à false)
        await loanRepo.upsert({ ...loanToDelete, id: loanToDelete.id, isActive: false, organizationId }, organizationId);
        notify2.success('Prêt désactivé avec succès');
      } else {
        // Supprimer définitivement dans IndexedDB (crée automatiquement une pendingOp)
        await loanRepo.delete(loanToDelete.id, organizationId, 'hard');
        notify2.success('Prêt supprimé avec succès');
      }

      setShowDeleteModal(false);
      setLoanToDelete(null);
      
      // ✅ Émettre un événement ciblé avec payload scope + propertyId
      window.dispatchEvent(new CustomEvent('loans:refresh', { 
        detail: { scope: 'property', propertyId, reason: action === 'delete' ? 'delete' : 'update' } 
      }));
    } catch (error: any) {
      console.error('Erreur lors de l\'opération:', error);
      notify2.error('Erreur', error.message || 'Erreur lors de l\'opération');
    }
  };

  // ✅ APP-SHELL: Suppression multiple via repository offline (local-first)
  const handleConfirmDeleteMultiple = async () => {
    if (!organizationId || selectedLoanIds.length === 0) {
      notify2.error('Aucun prêt sélectionné');
      return;
    }

    try {
      const loanRepo = getLoanRepositoryOffline();
      
      // Supprimer tous les prêts sélectionnés dans IndexedDB
      await Promise.all(
        selectedLoanIds.map(id => loanRepo.delete(id, organizationId))
      );

      setShowDeleteMultipleModal(false);
      setSelectedLoanIds([]);
      notify2.success(`${selectedLoanIds.length} prêt(s) archivé(s) avec succès`);
      
      // ✅ Émettre un événement ciblé avec payload scope + propertyId
      window.dispatchEvent(new CustomEvent('loans:refresh', { 
        detail: { scope: 'property', propertyId, reason: 'delete_multiple' } 
      }));
    } catch (error: any) {
      console.error('Erreur lors de l\'archivage des prêts:', error);
      notify2.error('Erreur', error.message || 'Erreur lors de l\'archivage');
    }
  };

  const handleDeleteMultiple = () => {
    if (selectedLoanIds.length === 0) {
      notify2.warning('Aucun prêt sélectionné');
      return;
    }
    setShowDeleteMultipleModal(true);
  };

  // Sélection
  const handleSelectLoan = (id: string) => {
    setSelectedLoanIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedLoanIds(checked ? loansSortedForTable.map((l) => l.id) : []);
  };

  const cycleWeightColSort = useCallback(() => {
    setWeightColSort((s) => (s === 'none' ? 'desc' : s === 'desc' ? 'asc' : 'none'));
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const renderLoanCashflowWeight = (loan: Loan) => {
    const monthly = loan.loanDisplay?.monthlyPayment ?? loan.monthlyPayment ?? 0;
    const pct = computeLoanWeightInCashflowPct(monthly, propertyCashflowMonthly);
    const d = getLoanCashflowWeightDisplay(pct);
    return (
      <div
        className="inline-flex flex-col items-end gap-1.5 max-w-[168px] ml-auto"
        title={LOAN_CASHFLOW_WEIGHT_TOOLTIP}
      >
        <LoanCashflowWeightProgressBar pct={pct} />
        <span
          className={`inline-flex items-center justify-end gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold tabular-nums max-w-full ${d.badgeClassName}`}
        >
          {d.showWarningIcon ? <span aria-hidden>⚠️</span> : null}
          <span>{d.text}</span>
        </span>
      </div>
    );
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getStatusBadge = (loan: Loan) => {
    const status = loan.loanBusinessStatus || 'inactif';
    if (status === 'actif') return <Badge variant="success">Actif</Badge>;
    if (status === 'solde') return <Badge variant="secondary">Soldé</Badge>;
    return <Badge variant="warning">Inactif</Badge>;
  };

  const pilotageBadgeTitle =
    'Score crédit : taux, durée restante et part de la mensualité dans le cashflow moyen du bien (12 mois)';

  const getPilotageBadge = (loan: Loan) => {
    if (loan.loanBusinessStatus !== 'actif') {
      return (
        <Badge variant="secondary" className="text-xs" title={pilotageBadgeTitle}>
          —
        </Badge>
      );
    }
    const monthly = loan.loanDisplay?.monthlyPayment ?? loan.monthlyPayment ?? 0;
    const weightPct = computeLoanWeightInCashflowPct(monthly, propertyCashflowMonthly);
    const s = getLoanPilotageStatus(loan, weightPct);
    if (s === 'ok') {
      return (
        <Badge variant="success" className="text-xs" title={pilotageBadgeTitle}>
          OK
        </Badge>
      );
    }
    if (s === 'optimisable') {
      return (
        <Badge variant="info" className="text-xs" title={pilotageBadgeTitle}>
          Optimisable
        </Badge>
      );
    }
    return (
      <Badge variant="warning" className="text-xs" title={pilotageBadgeTitle}>
        {loanPilotageStatusLabel('a_surveiller')}
      </Badge>
    );
  };

  // ✅ Mémoriser charts pour éviter les re-renders si chartsData oscille
  const charts = useMemo(() => 
    chartsData || { crdTimeline: [], crdByProperty: [], topCostlyLoans: [] },
    [chartsData]
  ) as { crdTimeline: any[]; crdByProperty: any[]; topCostlyLoans: any[] };

  const chartTimelineData = useMemo(() => {
    const base = charts.crdTimeline;
    if (!base?.length) return [];
    const months = base.map((p: { month: string }) => p.month);
    if (chartLoanId === 'all') return base;

    const loan = pilotageLoans.find((l) => l.id === chartLoanId);
    if (!loan) return base;

    return buildCrdTimelineForLoans(
      [
        {
          startDate: loan.startDate,
          endDate: loan.endDate,
          principal: loan.principal,
          annualRatePct: loan.annualRatePct,
          durationMonths: loan.durationMonths,
          defermentMonths: loan.defermentMonths,
          insurancePct: loan.insurancePct,
          paymentDay: loan.paymentDay,
          isActive: loan.isActive,
        },
      ],
      months,
    );
  }, [charts.crdTimeline, chartLoanId, pilotageLoans]);

  const chartTitle =
    chartLoanId === 'all'
      ? 'Évolution du CRD total'
      : `Évolution du CRD — ${pilotageLoans.find((l) => l.id === chartLoanId)?.label ?? 'Prêt'}`;

  // Mémoriser les actions pour éviter les re-renders inutiles
  const headerActions = useMemo(() => (
    <div className="flex items-center gap-2">
      <button
        onClick={() => navigateToView('biens')}
        className="inline-flex items-center justify-center h-8 w-8 text-orange-600 border border-orange-200 rounded-lg bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
        aria-label="Liste des biens"
      >
        <Home className="h-4 w-4" />
      </button>
      <button
        onClick={handleCreate}
        className="inline-flex items-center justify-center h-8 w-8 text-orange-600 border border-orange-200 rounded-lg bg-white hover:bg-gradient-to-r hover:from-orange-500 hover:to-red-500 hover:text-white transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
        aria-label="Nouveau prêt"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  ), [handleCreate]);

  // ✅ Stabiliser setActions avec useRef pour éviter les boucles de render
  const setActionsRef = useRef(setActions);
  useEffect(() => {
    setActionsRef.current = setActions;
  }, [setActions]);

  // Définir les actions dans le header
  useEffect(() => {
    setActionsRef.current(headerActions);
    
    return () => {
      setActionsRef.current(null);
    };
  }, [headerActions]);

  return (
    <div className="space-y-5">
      <PropertyFinancingSummaryBlock
        propertyCashflowMonthly={propertyCashflowMonthly}
        mensualiteTotale={pilotageAgg.mensualiteTotale}
        cashflowNet={cashflowNet}
        crdTotal={pilotageAgg.crdTotal}
        coutRestant={pilotageAgg.coutRestant}
        isLoadingCashflow={txKpisLoading}
        formatCurrency={formatCurrency}
        aggregates={pilotageAgg}
      />

      <div className="grid grid-cols-1 gap-3">
        {activeLoansOnProperty.length > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
            <label htmlFor="property-loan-chart-scope" className="text-xs text-muted-foreground sm:mr-1">
              Courbe CRD
            </label>
            <select
              id="property-loan-chart-scope"
              value={chartLoanId}
              onChange={(e) => setChartLoanId(e.target.value === 'all' ? 'all' : e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white max-w-full sm:max-w-xs"
            >
              <option value="all">Tous les prêts (CRD total)</option>
              {activeLoansOnProperty.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <LoansCRDTimelineChart
          data={chartTimelineData}
          isLoading={chartsLoading}
          title={chartTitle}
          subtitle="Capital restant dû sur la période (IndexedDB)"
          legendLabel={chartLoanId === 'all' ? 'CRD total' : 'CRD prêt'}
          cardClassName="w-full"
        />
      </div>

      {/* Filtres */}
      <LoansFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onResetFilters={handleResetFilters}
        properties={properties}
        periodStart={periodStart || ''}
        periodEnd={periodEnd || ''}
        onPeriodChange={handlePeriodChange}
        hidePropertyFilter={true}
      />

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-gray-200">
            {/* Header du tableau */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Liste des prêts</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Détail et actions sur chaque financement
                  </p>
                </div>
                <div className="text-sm text-gray-600">
                  {allLoans.length} prêt{allLoans.length > 1 ? 's' : ''} au total
                </div>
              </div>

              {/* Sélection multiple */}
              {selectedLoanIds.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">
                    {selectedLoanIds.length} prêt(s) sélectionné(s)
                  </span>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleDeleteMultiple}
                    className="ml-auto"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Archiver la sélection
                  </Button>
                </div>
              )}
            </div>

            {/* Vue mobile : Cards */}
            <div className="lg:hidden space-y-3 p-4">
              {isLoading && allLoans.length === 0 ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white border rounded-lg p-4 shadow-sm">
                    <div className="h-12 bg-gray-100 rounded animate-pulse"></div>
                  </div>
                ))
              ) : allLoans.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  Aucun prêt trouvé pour ce bien
                </div>
              ) : (
                <>
                  {loansSortedForTable.slice(0, mobileLimit).map((loan) => (
                    <div
                      key={loan.id}
                      onClick={() => handleRowClick(loan)}
                      className="bg-white border rounded-lg p-4 shadow-sm transition-all hover:shadow-md cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              checked={selectedLoanIds.includes(loan.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleSelectLoan(loan.id);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-gray-300 flex-shrink-0"
                            />
                            <h4 className="text-sm font-semibold text-gray-900 truncate">{loan.label}</h4>
                          </div>
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            {getStatusBadge(loan)}
                            {getPilotageBadge(loan)}
                          </div>
                          <div className="space-y-1 mb-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">Impact mensuel:</span>
                              <span className="font-semibold text-cyan-600">
                                {formatCurrency(loan.loanDisplay?.monthlyPayment || loan.monthlyPayment || 0)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600" title={LOAN_CASHFLOW_WEIGHT_TOOLTIP}>
                                Poids dans cashflow:
                              </span>
                              {renderLoanCashflowWeight(loan)}
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">CRD actuel:</span>
                              <span className="font-medium text-gray-900">{formatCurrency(loan.loanDisplay?.currentCRD || 0)}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">Taux:</span>
                              <span className="text-gray-900">{loan.annualRatePct}%</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-600">Durée restante:</span>
                              <span className="text-gray-900">{loan.loanDisplay?.remainingMonths ?? 0} mois</span>
                            </div>
                            {typeof loan.loanDisplay?.repaidPercent === 'number' && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">% remboursé:</span>
                                <span className="text-gray-900">{Math.round(loan.loanDisplay.repaidPercent)}%</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(loan);
                            }}
                            title="Éditer"
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(loan);
                          }}
                          title="Supprimer"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {allLoans.length > mobileLimit && (
                    <button
                      onClick={() => setMobileLimit(prev => prev + 10)}
                      className="w-full py-2 text-sm font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg border border-orange-200 transition-colors"
                    >
                      Voir plus ({allLoans.length - mobileLimit} restantes)
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Table Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={
                          loansSortedForTable.length > 0 &&
                          loansSortedForTable.every((l) => selectedLoanIds.includes(l.id))
                        }
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Libellé</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Impact mensuel</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      <button
                        type="button"
                        className="inline-flex w-full items-center justify-end gap-1 hover:text-gray-800"
                        title={`${LOAN_CASHFLOW_WEIGHT_TOOLTIP} — clic : trier`}
                        onClick={(e) => {
                          e.stopPropagation();
                          cycleWeightColSort();
                        }}
                      >
                        <span>Poids dans cashflow</span>
                        {weightColSort === 'desc' ? (
                          <ArrowDown className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                        ) : weightColSort === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                        ) : (
                          <ArrowDownUp className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">CRD actuel</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Taux</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Durée restante</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Pilotage</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {isLoading && allLoans.length === 0 ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i}>
                        <td colSpan={10} className="px-4 py-3">
                          <div className="h-12 bg-gray-100 rounded animate-pulse"></div>
                        </td>
                      </tr>
                    ))
                  ) : allLoans.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                        Aucun prêt trouvé pour ce bien
                      </td>
                    </tr>
                  ) : (
                    loansSortedForTable.map((loan) => (
                      <tr
                        key={loan.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleRowClick(loan)}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedLoanIds.includes(loan.id)}
                            onChange={() => handleSelectLoan(loan.id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{loan.label}</td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-cyan-600">
                          {formatCurrency(loan.loanDisplay?.monthlyPayment || loan.monthlyPayment || 0)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">{renderLoanCashflowWeight(loan)}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                          {formatCurrency(loan.loanDisplay?.currentCRD || 0)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">{loan.annualRatePct}%</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">{loan.loanDisplay?.remainingMonths ?? 0} mois</td>
                        <td className="px-4 py-3 text-center">
                          {getStatusBadge(loan)}
                        </td>
                        <td className="px-4 py-3 text-center">{getPilotageBadge(loan)}</td>
                        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(loan);
                              }}
                              title="Éditer"
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(loan);
                              }}
                              title="Supprimer"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
      </div>

      {/* Modal de formulaire */}
      <LoanModalV2
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        properties={properties}
        initialData={selectedLoan ? selectedLoan : { propertyId }}
        onSubmit={handleFormSubmit}
        mode={modalMode === 'duplicate' ? 'create' : modalMode}
        lockPropertyId={true} // Verrouiller le champ "Bien" car on est dans le contexte d'un bien spécifique
      />

      {/* Drawer lecture seule */}
      <LoanDrawer
        loan={selectedLoan}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        propertyId={propertyId}
      />

      {/* Modal suppression/désactivation */}
      <ConfirmDeleteLoanModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setLoanToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        loanId={loanToDelete?.id || ''}
        loanLabel={loanToDelete?.label}
      />

      {/* Modal suppression multiple */}
      <ConfirmDeleteMultipleLoansModal
        isOpen={showDeleteMultipleModal}
        onClose={() => setShowDeleteMultipleModal(false)}
        onConfirm={handleConfirmDeleteMultiple}
        loanIds={selectedLoanIds}
      />
    </div>
  );
}

