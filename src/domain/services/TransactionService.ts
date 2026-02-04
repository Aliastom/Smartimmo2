/**
 * Service métier pour les transactions
 * Contient TOUTE la logique métier (commissions, cascade, documents, validations)
 * Indépendant de Prisma/Dexie grâce à l'injection de dépendances
 */

import type { ITransactionRepository, Transaction, CreateTransactionData } from '../repositories/interfaces/ITransactionRepository';
import { logToServer } from '@/lib/utils/logger';
import type { IPropertyRepository } from '../repositories/interfaces/IPropertyRepository';
import type { ILeaseRepository } from '../repositories/interfaces/ILeaseRepository';
import type { ICategoryRepository } from '../repositories/interfaces/ICategoryRepository';
import type { IDocumentRepository } from '../repositories/interfaces/IDocumentRepository';
import type { IDocumentLinkRepository } from '../repositories/interfaces/IDocumentLinkRepository';
import type { INatureRepository } from '../repositories/interfaces/INatureRepository';
import { calcCommission, type ModeCalcul } from '@/lib/gestion/calcCommission';
import { addMonthsYYYYMM, formatMonthlyLabel, extractBaseLabel } from '@/lib/utils/monthUtils';

export interface TransactionServiceDependencies {
  transactionRepo: ITransactionRepository;
  propertyRepo: IPropertyRepository;
  leaseRepo: ILeaseRepository;
  categoryRepo: ICategoryRepository;
  documentRepo: IDocumentRepository;
  documentLinkRepo: IDocumentLinkRepository;
  natureRepo: INatureRepository;
}

export interface CreateTransactionParams {
  organizationId: string;
  propertyId: string;
  leaseId?: string | null;
  bailId?: string | null;
  categoryId: string;
  natureId?: string;
  nature?: string;
  label: string;
  amount: number;
  date: Date | string;
  reference?: string | null;
  notes?: string | null;
  paidAt?: Date | string | null;
  method?: string | null;
  accountingMonth?: string | null;
  periodStart?: string | null;
  periodMonth?: number | null;
  periodYear?: number | null;
  monthsCovered?: number | string;
  rapprochementStatus?: string;
  bankRef?: string | null;
  montantLoyer?: number | null;
  chargesRecup?: number | null;
  chargesNonRecup?: number | null;
  isAutoAmount?: boolean | null;
  stagedDocumentIds?: string[];
  stagedLinkItemIds?: string[];
  factures?: Array<{
    date?: string;
    numero?: string;
    fournisseur?: string;
    dateService?: string;
    description?: string;
    montant: number;
  }>;
  // Settings pour gestion déléguée (injectés depuis appSettings)
  gestionEnabled?: boolean;
  gestionCodes?: {
    rentNature?: string;
    mgmtNature?: string;
    mgmtCategory?: string;
  };
  // Option B: En mode app-shell offline, ne pas créer les commissions auto (server-only)
  skipAutoCommissions?: boolean;
}

export interface UpdateTransactionParams {
  propertyId?: string;
  leaseId?: string | null;
  categoryId?: string | null;
  natureId?: string;
  nature?: string;
  label?: string;
  amount?: number;
  date?: Date | string;
  reference?: string | null;
  notes?: string | null;
  paidAt?: Date | string | null;
  method?: string | null;
  accountingMonth?: string | null;
  monthsCovered?: string | null;
  rapprochementStatus?: string;
  bankRef?: string | null;
  montantLoyer?: number | null;
  chargesRecup?: number | null;
  chargesNonRecup?: number | null;
  isAutoAmount?: boolean | null;
  stagedDocumentIds?: string[];
  stagedLinkItemIds?: string[];
  // Settings pour gestion déléguée
  gestionEnabled?: boolean;
  gestionCodes?: {
    rentNature?: string;
    mgmtNature?: string;
    mgmtCategory?: string;
  };
}

export interface DeleteTransactionParams {
  mode?: 'delete_docs' | 'keep_docs_globalize';
  deleteChildren?: boolean;
}

export interface CreateTransactionResult {
  transaction: Transaction;
  totalCreated: number;
  allTransactions: Transaction[];
  commissionTransaction?: Transaction;
}

export interface UpdateTransactionResult {
  transaction: Transaction;
  commissionUpdated?: boolean;
  commissionNewValue?: number;
  warningLocked?: boolean;
}

export interface DeleteTransactionResult {
  success: boolean;
  mode: string;
  documentsAffected: number;
  autoDeleted?: number;
  nonAutoKept?: number;
  hasNonAutoChildren?: boolean;
}

export class TransactionService {
  constructor(private deps: TransactionServiceDependencies) {}

  /**
   * Crée une ou plusieurs transactions (multi-mois) avec gestion déléguée et documents
   */
  async createTransaction(params: CreateTransactionParams): Promise<CreateTransactionResult> {
    // Validation
    if (!params.propertyId) {
      throw new Error('PropertyId est requis');
    }
    if (!params.nature && !params.natureId) {
      throw new Error('Nature est requise');
    }
    if (!params.categoryId) {
      throw new Error('CategoryId est requis');
    }
    if (!params.amount) {
      throw new Error('Amount est requis');
    }

    // Vérifier ownership property
    const property = await this.deps.propertyRepo.findFirst({
      id: params.propertyId,
      organizationId: params.organizationId,
    });
    if (!property) {
      throw new Error('Propriété introuvable');
    }

    // Vérifier category
    const category = await this.deps.categoryRepo.findUnique({ id: params.categoryId });
    if (!category) {
      throw new Error('Catégorie introuvable');
    }

    // Vérifier lease si fourni
    if (params.leaseId) {
      const lease = await this.deps.leaseRepo.findFirst({
        id: params.leaseId,
        organizationId: params.organizationId,
      });
      if (!lease) {
        throw new Error('Bail introuvable pour ce compte');
      }
    }

    // Construire accountingMonth
    let accountingMonth: string | null = null;
    if (params.accountingMonth) {
      accountingMonth = params.accountingMonth;
    } else if (params.periodStart) {
      accountingMonth = params.periodStart;
    } else if (params.periodMonth && params.periodYear) {
      const month = String(params.periodMonth).padStart(2, '0');
      accountingMonth = `${params.periodYear}-${month}`;
    }

    // Extraire baseLabel
    const rawLabel = params.label || 'Transaction';
    const baseLabel = extractBaseLabel(rawLabel);
    const startMonth = accountingMonth || (params.periodYear && params.periodMonth
      ? `${params.periodYear}-${String(params.periodMonth).padStart(2, '0')}`
      : null);

    if (!startMonth) {
      throw new Error('Période comptable requise (accountingMonth, periodStart, ou periodMonth+periodYear)');
    }

    // Créer les transactions (1 ou N selon monthsCovered)
    const monthsCovered = params.monthsCovered ? (typeof params.monthsCovered === 'string' ? parseInt(params.monthsCovered) : params.monthsCovered) : 1;
    const transactions: Transaction[] = [];
    let commissionTransaction: Transaction | undefined;

    for (let i = 0; i < monthsCovered; i++) {
      const currentMonth = addMonthsYYYYMM(startMonth, i);
      const label = formatMonthlyLabel(baseLabel, currentMonth);

      const transactionData: CreateTransactionData = {
        organizationId: params.organizationId,
        propertyId: params.propertyId,
        leaseId: params.leaseId || null,
        bailId: params.bailId || null,
        categoryId: params.categoryId,
        label: label,
        amount: parseFloat(String(params.amount)),
        date: typeof params.date === 'string' ? new Date(params.date) : params.date,
        reference: params.reference || null,
        notes: params.notes || null,
        paidAt: params.paidAt ? (typeof params.paidAt === 'string' ? new Date(params.paidAt) : params.paidAt) : null,
        method: params.method || null,
        accounting_month: currentMonth,
        monthsCovered: String(monthsCovered),
        moisIndex: monthsCovered > 1 ? i + 1 : null,
        moisTotal: monthsCovered > 1 ? monthsCovered : null,
        rapprochementStatus: params.rapprochementStatus || 'non_rapprochee',
        dateRapprochement: params.rapprochementStatus === 'rapprochee' ? new Date() : null,
        bankRef: params.bankRef || null,
        montantLoyer: params.montantLoyer ? parseFloat(String(params.montantLoyer)) : null,
        chargesRecup: params.chargesRecup ? parseFloat(String(params.chargesRecup)) : null,
        chargesNonRecup: params.chargesNonRecup ? parseFloat(String(params.chargesNonRecup)) : null,
        isAutoAmount: params.isAutoAmount ?? null,
        nature: params.natureId || params.nature || null,
        parentTransactionId: null,
        source: 'MANUAL',
      };

      const transaction = await this.deps.transactionRepo.create(transactionData);
      transactions.push(transaction);

      // ⚙️ GESTION DÉLÉGUÉE: Créer la commission si applicable
      // ⚠️ OPTION B: En mode app-shell offline, skipAutoCommissions=true pour éviter les doublons
      // Le serveur créera la commission lors de la sync (server-only creation)
      if (!params.skipAutoCommissions && params.gestionEnabled !== false) {
        const gestionEnabled = params.gestionEnabled ?? true;
        const codes = params.gestionCodes || {};

        if (gestionEnabled) {
          const isRentNature =
            transaction.nature === codes.rentNature ||
            transaction.nature?.includes('LOYER') ||
            transaction.nature?.includes('RECETTE_LOYER');

          if (isRentNature && params.montantLoyer) {
            try {
              const propertyWithCompany = await this.deps.propertyRepo.findFirstWithManagementCompany({
                id: params.propertyId,
                organizationId: params.organizationId,
              });

              if (propertyWithCompany?.ManagementCompany && propertyWithCompany.ManagementCompany.actif) {
                const company = propertyWithCompany.ManagementCompany;

                // Calculer la commission
                const { commissionTTC: commissionBase } = calcCommission({
                  montantLoyer: params.montantLoyer,
                  chargesRecup: params.chargesRecup || 0,
                  modeCalcul: (company.modeCalcul || 'LOYERS_UNIQUEMENT') as ModeCalcul,
                  taux: company.taux || 0,
                  fraisMin: company.fraisMin ?? undefined,
                  tvaApplicable: company.tvaApplicable || false,
                  tauxTva: company.tauxTva ?? undefined,
                });

                // Ajouter le montant des factures
                const montantFactures = params.factures?.reduce((sum, f) => sum + f.montant, 0) || 0;
                const commissionTTC = commissionBase + montantFactures;

                if (commissionTTC > 0) {
                  // Récupérer la catégorie de commission
                  const fraisGestionCategory = await this.deps.categoryRepo.findFirst({
                    slug: codes.mgmtCategory || 'frais-gestion',
                    actif: true,
                  });

                  if (fraisGestionCategory) {
                    // Construire le libellé
                    let commissionLabel = `Commission de gestion`;
                    let commissionNotes = params.notes || '';

                    if (params.factures && params.factures.length > 0) {
                      commissionLabel = `Commission de gestion dont facture - ${company.nom}`;
                      const facturesDetails = params.factures.map(f => {
                        const parts: string[] = [];
                        if (f.numero) parts.push(`Facture ${f.numero}`);
                        if (f.fournisseur) parts.push(f.fournisseur);
                        if (f.dateService) parts.push(`du ${f.dateService}`);
                        if (f.description) parts.push(f.description);
                        return parts.join(' ');
                      }).join(' ; ');

                      if (commissionNotes) {
                        commissionNotes = `${commissionNotes}\n\nComprend la ${facturesDetails}`;
                      } else {
                        commissionNotes = `Comprend la ${facturesDetails}`;
                      }
                    } else {
                      commissionLabel = `Commission de gestion - ${company.nom}`;
                    }

                    // Créer la transaction de commission
                    const commissionData: CreateTransactionData = {
                      organizationId: params.organizationId,
                      propertyId: params.propertyId,
                      leaseId: transaction.leaseId || null,
                      bailId: transaction.bailId || null,
                      categoryId: fraisGestionCategory.id,
                      label: commissionLabel,
                      amount: -commissionTTC, // Négatif car dépense
                      date: typeof params.date === 'string' ? new Date(params.date) : params.date,
                      accounting_month: currentMonth,
                      nature: codes.mgmtNature || null,
                      parentTransactionId: transaction.id,
                      managementCompanyId: company.id,
                      isAuto: true,
                      autoSource: 'gestion',
                      isAutoAmount: false,
                      reference: params.reference || null,
                      paidAt: params.paidAt ? (typeof params.paidAt === 'string' ? new Date(params.paidAt) : params.paidAt) : null,
                      method: params.method || null,
                      notes: commissionNotes,
                      rapprochementStatus: params.rapprochementStatus || 'non_rapprochee',
                      bankRef: params.bankRef || null,
                      source: 'MANUAL',
                    };

                    commissionTransaction = await this.deps.transactionRepo.create(commissionData);
                    transactions.push(commissionTransaction);
                  }
                }
              }
            } catch (error) {
              // Erreur lors de la création automatique de commission - log supprimé
              // Ne pas bloquer la création de la transaction
            }
          }
        }
      }
    }

    // Gérer les documents (stagedDocumentIds)
    // ⚠️ PROBLÈME 2: En mode app-shell online, les documents peuvent ne pas exister dans IndexedDB
    // (ils sont créés côté serveur via /api/upload-staged). Le serveur créera les liens lors de la sync.
    // On ne traite les documents localement que s'ils existent dans IndexedDB.
    if (params.stagedDocumentIds && params.stagedDocumentIds.length > 0) {
      await logToServer(`[TransactionService] 📎 Traitement stagedDocumentIds: ${params.stagedDocumentIds.length} document(s) - IDs: ${params.stagedDocumentIds.join(', ')} - Transaction IDs: ${transactions.map(t => t.id).join(', ')}`);
      
      // Vérifier quels documents existent localement
      // 🔍 DIAGNOSTIC: Log AVANT recherche des documents
      await logToServer(`[TransactionService] 🔍 RECHERCHE documents - stagedDocumentIds: ${params.stagedDocumentIds.join(', ')}`);
      
      // ⚠️ CRITIQUE: Vérifier d'abord TOUS les documents par ID (sans filtre status) pour diagnostiquer
      const { getLocalDB } = await import('@/lib/offline/db');
      const db = await getLocalDB();
      for (const docId of params.stagedDocumentIds) {
        const docCheck = await db.Document.get(docId);
        await logToServer(`[TransactionService] 🔍 VÉRIFICATION docId=${docId} - status=${docCheck?.status || 'NOT_FOUND'}, documentTypeId=${docCheck?.documentTypeId || 'null'}, fileName=${docCheck?.fileName || 'N/A'}`);
      }
      
      const existingDocs = await this.deps.documentRepo.findMany({
        id: { in: params.stagedDocumentIds },
        organizationId: params.organizationId,
        status: 'draft', // ⚠️ Filtrer strictement par status='draft' (ne pas cacher le bug)
      });

      // 🔍 DIAGNOSTIC: Log l'état de chaque document trouvé AVANT finalisation
      for (const doc of existingDocs) {
        await logToServer(`[TransactionService] 🔍 AVANT finalisation (draft→active) - docId=${doc.id}, status=${doc.status}, documentTypeId=${doc.documentTypeId}, fileName=${doc.fileName}`);
      }

      await logToServer(`[TransactionService] 📎 Documents brouillons trouvés localement: ${existingDocs.length}/${params.stagedDocumentIds.length} - Trouvés: ${existingDocs.map(d => d.id).join(', ')} - Demandés: ${params.stagedDocumentIds.join(', ')}`);

      // ⚠️ PROBLÈME 2: Ne traiter que les documents qui existent localement
      // Les autres seront gérés par le serveur lors de la création de la transaction
      if (existingDocs.length > 0) {
        // Vérifier les doublons
        for (const doc of existingDocs) {
          if (doc.fileSha256) {
            const duplicateCheck = await this.deps.documentRepo.checkDuplicates({
              fileSha256: doc.fileSha256,
              textSha256: doc.textSha256 || undefined,
              organizationId: params.organizationId,
            });

            if (duplicateCheck.hasExactDuplicate && duplicateCheck.exactDuplicate) {
              throw new Error(`Document "${doc.fileName}" est maintenant un doublon exact`);
            }
          }
        }

        // Finaliser les documents (draft → active) - uniquement ceux qui existent localement
        const localDocIds = existingDocs.map(doc => doc.id);
        await logToServer(`[TransactionService] 🔍 APPEL updateMany (draft→active) - docIds: ${localDocIds.join(', ')}`);
        
        await this.deps.documentRepo.updateMany(
          {
            id: { in: localDocIds },
            organizationId: params.organizationId,
            status: 'draft',
          },
          {
            status: 'active',
          }
        );
        
        // 🔍 DIAGNOSTIC: Log APRÈS finalisation (vérification dans IndexedDB)
        for (const docId of localDocIds) {
          const docAfter = await db.Document.get(docId);
          await logToServer(`[TransactionService] 🔍 APRÈS finalisation (draft→active) - docId=${docId}, status=${docAfter?.status || 'NOT_FOUND'}, documentTypeId=${docAfter?.documentTypeId || 'null'}, fileName=${docAfter?.fileName || 'N/A'}`);
          
          // ⚠️ VÉRIFICATION CRITIQUE: S'assurer que le status est bien 'active' dans IndexedDB
          if (docAfter?.status !== 'active') {
            await logToServer(`[TransactionService] ❌ ERREUR: Le document ${docId} devrait être 'active' mais est '${docAfter?.status}' - Vérifiez la table Document dans IndexedDB`, 'error');
          } else {
            await logToServer(`[TransactionService] ✅ CONFIRMATION: Le document ${docId} est bien en 'active' dans IndexedDB (table Document)`);
          }
        }

        // Créer les liens vers toutes les transactions créées - uniquement pour les documents locaux
        await logToServer(`[TransactionService] 🔗 Finalisation et création de liens pour ${localDocIds.length} document(s) - DocIds: ${localDocIds.join(', ')}`);
        for (const transaction of transactions) {
          for (const docId of localDocIds) {
            try {
              await logToServer(`[TransactionService] 🔗 Création lien transaction: docId=${docId}, transactionId=${transaction.id}`);
            await this.deps.documentLinkRepo.create({
              documentId: docId,
              linkedType: 'transaction',
              linkedId: transaction.id,
            });
              
            if (transaction.propertyId) {
                await logToServer(`[TransactionService] 🔗 Création lien property: docId=${docId}, propertyId=${transaction.propertyId}`);
              await this.deps.documentLinkRepo.create({
                documentId: docId,
                linkedType: 'property',
                linkedId: transaction.propertyId,
              });
            }
            if (transaction.leaseId) {
                await logToServer(`[TransactionService] 🔗 Création lien lease: docId=${docId}, leaseId=${transaction.leaseId}`);
              await this.deps.documentLinkRepo.create({
                documentId: docId,
                linkedType: 'lease',
                linkedId: transaction.leaseId,
              });
            }
              
              await logToServer(`[TransactionService] 🔗 Création lien global: docId=${docId}`);
            await this.deps.documentLinkRepo.create({
              documentId: docId,
              linkedType: 'global',
              linkedId: 'global',
            });
              
              await logToServer(`[TransactionService] ✅ Tous les liens créés pour docId=${docId}, transactionId=${transaction.id}`);
            } catch (linkError: any) {
              await logToServer(`[TransactionService] ❌ Erreur lors de la création des liens pour docId=${docId}, transactionId=${transaction.id}, erreur=${linkError.message || linkError}`, 'error');
              throw linkError;
          }
        }
        }
        await logToServer(`[TransactionService] ✅ Finalisation et création de liens terminée pour ${localDocIds.length} document(s)`);
      } else {
        // ⚠️ PROBLÈME 2: Aucun document local trouvé (documents créés côté serveur uniquement)
        // Les liens seront créés par le serveur lors de la création de la transaction
        // et seront récupérés lors du pull des documentLinks
        await logToServer(`[TransactionService] ⚠️ Aucun document brouillon local trouvé pour stagedDocumentIds - Demandés: ${params.stagedDocumentIds.join(', ')} - Les documents sont probablement uniquement côté serveur, les liens seront créés lors du push vers le serveur`, 'warn');
      }
    }

    // Gérer les liens vers documents existants (stagedLinkItemIds)
    if (params.stagedLinkItemIds && params.stagedLinkItemIds.length > 0) {
      await logToServer(`[TransactionService] 📎 Traitement stagedLinkItemIds: ${params.stagedLinkItemIds.length} document(s) - IDs: ${params.stagedLinkItemIds.join(', ')} - Transaction IDs: ${transactions.map(t => t.id).join(', ')}`);
      
      // ✅ Vérifier quels documents existent localement dans IndexedDB
      // (les documents peuvent exister côté serveur mais pas encore dans IndexedDB si pas sync)
      const existingDocs = await this.deps.documentRepo.findMany({
        id: { in: params.stagedLinkItemIds },
        organizationId: params.organizationId,
      });
      
      await logToServer(`[TransactionService] 📎 Documents trouvés localement: ${existingDocs.length}/${params.stagedLinkItemIds.length} - Trouvés: ${existingDocs.map(d => d.id).join(', ')} - Demandés: ${params.stagedLinkItemIds.join(', ')}`);
      
      const existingDocIds = new Set(existingDocs.map(doc => doc.id));
      
      // ⚠️ Filtrer pour ne créer des liens que pour les documents qui existent localement
      const docIdsToLink = params.stagedLinkItemIds.filter(docId => existingDocIds.has(docId));
      
      if (docIdsToLink.length === 0) {
        await logToServer(`[TransactionService] ⚠️ Aucun document local trouvé pour stagedLinkItemIds - Demandés: ${params.stagedLinkItemIds.join(', ')} - Trouvés: ${existingDocs.map(d => d.id).join(', ')} - Les liens seront créés par le serveur lors de la sync`, 'warn');
      } else {
        await logToServer(`[TransactionService] ✅ Création de liens pour ${docIdsToLink.length} document(s) local(aux) existant(s) - DocIds: ${docIdsToLink.join(', ')} - TransactionIds: ${transactions.map(t => t.id).join(', ')}`);
        // Créer les liens uniquement pour les documents qui existent localement
        for (const docId of docIdsToLink) {
        for (const transaction of transactions) {
            await logToServer(`[TransactionService] 📎 Création lien: docId=${docId}, transactionId=${transaction.id}`);
            try {
              const linkResult = await this.deps.documentLinkRepo.create({
            documentId: docId,
            linkedType: 'transaction',
            linkedId: transaction.id,
          });
              await logToServer(`[TransactionService] ✅ Lien transaction créé avec succès: docId=${linkResult.documentId}, linkedType=${linkResult.linkedType}, linkedId=${linkResult.linkedId}`);
            } catch (linkError: any) {
              await logToServer(`[TransactionService] ❌ Erreur lors de la création du lien: docId=${docId}, transactionId=${transaction.id}, erreur=${linkError.message || linkError}`, 'error');
              throw linkError;
            }
            
          if (transaction.propertyId) {
            await this.deps.documentLinkRepo.create({
              documentId: docId,
              linkedType: 'property',
              linkedId: transaction.propertyId,
            });
          }
          if (transaction.leaseId) {
            await this.deps.documentLinkRepo.create({
              documentId: docId,
              linkedType: 'lease',
              linkedId: transaction.leaseId,
            });
          }
          await this.deps.documentLinkRepo.create({
            documentId: docId,
            linkedType: 'global',
            linkedId: 'global',
          });
        }
      }
        await logToServer(`[TransactionService] ✅ Liens créés avec succès pour ${docIdsToLink.length} document(s)`);
      }
    } else {
      await logToServer('[TransactionService] ℹ️ Aucun stagedLinkItemIds fourni');
    }

    // Séparer les transactions principales des commissions
    const mainTransactions = transactions.filter(tx => !tx.isAuto || tx.autoSource !== 'gestion');
    
    return {
      transaction: mainTransactions[0],
      totalCreated: mainTransactions.length, // Seulement les principales
      allTransactions: transactions, // Toutes (principales + commissions) pour compatibilité API
      commissionTransaction,
    };
  }

  /**
   * Met à jour une transaction avec gestion déléguée et documents
   */
  async updateTransaction(id: string, params: UpdateTransactionParams): Promise<UpdateTransactionResult> {
    // Vérifier que la transaction existe
    const existingTransaction = await this.deps.transactionRepo.findById(id);
    if (!existingTransaction) {
      throw new Error('Transaction non trouvée');
    }

    // Vérifier ownership property si modifiée
    if (params.propertyId) {
      const property = await this.deps.propertyRepo.findFirst({
        id: params.propertyId,
        organizationId: existingTransaction.organizationId,
      });
      if (!property) {
        throw new Error('Propriété introuvable');
      }
    }

    // Vérifier lease si modifié
    if (params.leaseId !== undefined) {
      if (params.leaseId) {
        const lease = await this.deps.leaseRepo.findFirst({
          id: params.leaseId,
          organizationId: existingTransaction.organizationId,
        });
        if (!lease) {
          throw new Error('Bail introuvable');
        }
      }
    }

    // Mettre à jour la transaction
    const updateData: any = {};
    if (params.propertyId !== undefined) updateData.propertyId = params.propertyId;
    if (params.leaseId !== undefined) updateData.leaseId = params.leaseId;
    if (params.categoryId !== undefined) updateData.categoryId = params.categoryId;
    if (params.label !== undefined) updateData.label = params.label;
    if (params.amount !== undefined) updateData.amount = parseFloat(String(params.amount));
    if (params.date !== undefined) updateData.date = typeof params.date === 'string' ? new Date(params.date) : params.date;
    if (params.reference !== undefined) updateData.reference = params.reference;
    if (params.notes !== undefined) updateData.notes = params.notes;
    if (params.paidAt !== undefined) {
      // ⚙️ NORMALISATION: IndexedDB stocke les dates comme des strings ISO, pas des objets Date
      // Le repository IndexedDB va gérer la conversion Date → string ISO si nécessaire
      // Ici, on garde paidAt tel quel (string ISO ou Date, le repository s'en occupera)
      updateData.paidAt = params.paidAt;
      const { logToServer } = await import('@/lib/utils/logger');
      await logToServer(`[TransactionService] 🔍 updateTransaction - paidAt inclus dans updateData: ${updateData.paidAt} (type: ${typeof updateData.paidAt}, isDate: ${updateData.paidAt instanceof Date})`);
    }
    if (params.method !== undefined) {
      updateData.method = params.method;
      // 🔍 DIAGNOSTIC: Log pour tracer le champ method
      const { logToServer } = await import('@/lib/utils/logger');
      await logToServer(`[TransactionService] 🔍 updateTransaction - method inclus dans updateData: ${params.method} (type: ${typeof params.method})`);
    } else {
      const { logToServer } = await import('@/lib/utils/logger');
      await logToServer(`[TransactionService] 🔍 updateTransaction - method NON inclus (params.method est undefined)`);
    }
    if (params.accountingMonth !== undefined) updateData.accounting_month = params.accountingMonth;
    if (params.monthsCovered !== undefined) updateData.monthsCovered = params.monthsCovered;
    if (params.rapprochementStatus !== undefined) {
      updateData.rapprochementStatus = params.rapprochementStatus;
      updateData.dateRapprochement = params.rapprochementStatus === 'rapprochee' ? new Date() : null;
    }
    if (params.bankRef !== undefined) updateData.bankRef = params.bankRef;
    if (params.montantLoyer !== undefined) updateData.montantLoyer = params.montantLoyer ? parseFloat(String(params.montantLoyer)) : null;
    if (params.chargesRecup !== undefined) updateData.chargesRecup = params.chargesRecup ? parseFloat(String(params.chargesRecup)) : null;
    if (params.chargesNonRecup !== undefined) updateData.chargesNonRecup = params.chargesNonRecup ? parseFloat(String(params.chargesNonRecup)) : null;
    if (params.isAutoAmount !== undefined) updateData.isAutoAmount = params.isAutoAmount;
    if (params.natureId !== undefined || params.nature !== undefined) {
      updateData.nature = params.natureId || params.nature;
    }

    const transaction = await this.deps.transactionRepo.update(id, updateData);

    // ⚙️ GESTION DÉLÉGUÉE: Mettre à jour la commission si applicable
    // ⚠️ OPTION B: En mode app-shell offline, skipAutoCommissions=true pour éviter les doublons
    // Le serveur créera/mettra à jour la commission lors de la sync (server-only creation)
    let commissionUpdateResult: { commissionUpdated?: boolean; commissionNewValue?: number; warningLocked?: boolean } = {};

    if (!params.skipAutoCommissions && params.gestionEnabled !== false) {
      const gestionEnabled = params.gestionEnabled ?? true;
      const codes = params.gestionCodes || {};

      if (gestionEnabled) {
        const isRentNature =
          transaction.nature === codes.rentNature ||
          transaction.nature?.includes('LOYER') ||
          transaction.nature?.includes('RECETTE_LOYER');

        if (isRentNature && params.montantLoyer) {
          // Chercher d'abord la commission existante
          const existingCommission = await this.deps.transactionRepo.findFirst({
            parentTransactionId: transaction.id,
            isAuto: true,
            autoSource: 'gestion',
            organizationId: transaction.organizationId,
          });

          const propertyWithCompany = await this.deps.propertyRepo.findFirstWithManagementCompany({
            id: transaction.propertyId,
            organizationId: transaction.organizationId,
          });

          if (propertyWithCompany?.ManagementCompany && propertyWithCompany.ManagementCompany.actif) {
            // Le bien a une société active
            if (existingCommission) {
              if (existingCommission.isAuto) {
                // Recalculer la commission
                const company = propertyWithCompany.ManagementCompany;
                const { commissionTTC } = calcCommission({
                  montantLoyer: params.montantLoyer,
                  chargesRecup: params.chargesRecup || 0,
                  modeCalcul: (company.modeCalcul || 'LOYERS_UNIQUEMENT') as ModeCalcul,
                  taux: company.taux || 0,
                  fraisMin: company.fraisMin ?? undefined,
                  tvaApplicable: company.tvaApplicable || false,
                  tauxTva: company.tauxTva ?? undefined,
                });

                // Mettre à jour la commission
                await this.deps.transactionRepo.update(existingCommission.id, {
                  amount: -commissionTTC,
                });

                commissionUpdateResult = {
                  commissionUpdated: true,
                  commissionNewValue: commissionTTC,
                };
              } else {
                // Commission verrouillée manuellement
                commissionUpdateResult = { warningLocked: true };
              }
            } else {
              // Pas de commission existante, la créer (cas legacy)
              try {
                let accountingMonth = transaction.accounting_month;
                if (!accountingMonth && transaction.date) {
                  const d = new Date(transaction.date);
                  accountingMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                }

                if (accountingMonth) {
                  const company = propertyWithCompany.ManagementCompany;
                  const { commissionTTC } = calcCommission({
                    montantLoyer: params.montantLoyer,
                    chargesRecup: params.chargesRecup || 0,
                    modeCalcul: (company.modeCalcul || 'LOYERS_UNIQUEMENT') as ModeCalcul,
                    taux: company.taux || 0,
                    fraisMin: company.fraisMin ?? undefined,
                    tvaApplicable: company.tvaApplicable || false,
                    tauxTva: company.tauxTva ?? undefined,
                  });

                  if (commissionTTC > 0) {
                    const fraisGestionCategory = await this.deps.categoryRepo.findFirst({
                      slug: codes.mgmtCategory || 'frais-gestion',
                      actif: true,
                    });

                    if (fraisGestionCategory) {
                      await this.deps.transactionRepo.create({
                        organizationId: transaction.organizationId,
                        propertyId: transaction.propertyId,
                        leaseId: transaction.leaseId || null,
                        bailId: transaction.bailId || null,
                        categoryId: fraisGestionCategory.id,
                        label: `Commission de gestion - ${company.nom}`,
                        amount: -commissionTTC,
                        date: transaction.date,
                        accounting_month: accountingMonth,
                        nature: codes.mgmtNature || null,
                        parentTransactionId: transaction.id,
                        managementCompanyId: company.id,
                        isAuto: true,
                        autoSource: 'gestion',
                        isAutoAmount: false,
                        reference: transaction.reference || null,
                        paidAt: transaction.paidAt || null,
                        method: transaction.method || null,
                        notes: transaction.notes || null,
                        rapprochementStatus: transaction.rapprochementStatus || 'non_rapprochee',
                        bankRef: transaction.bankRef || null,
                        source: 'MANUAL',
                      });

                      commissionUpdateResult = { commissionUpdated: true };
                    }
                  }
                }
              } catch (error) {
                // Erreur création commission en édition - log supprimé
              }
            }
          } else if (existingCommission?.isAuto) {
            // Le bien n'a plus de société, supprimer la commission auto
            await this.deps.transactionRepo.delete(existingCommission.id);
          }
        }
      }
    }

    // Gérer les documents (stagedDocumentIds)
    if (params.stagedDocumentIds && params.stagedDocumentIds.length > 0) {
      // Vérifier les doublons
      const existingDocs = await this.deps.documentRepo.findMany({
        id: { in: params.stagedDocumentIds },
        organizationId: transaction.organizationId,
        status: 'draft',
      });

      for (const doc of existingDocs) {
        if (doc.fileSha256) {
          const duplicateCheck = await this.deps.documentRepo.checkDuplicates({
            fileSha256: doc.fileSha256,
            textSha256: doc.textSha256 || undefined,
            organizationId: transaction.organizationId,
          });

          if (duplicateCheck.hasExactDuplicate && duplicateCheck.exactDuplicate) {
            throw new Error(`Document "${doc.fileName}" est maintenant un doublon exact`);
          }
        }
      }

      // Finaliser les documents
      await this.deps.documentRepo.updateMany(
        {
          id: { in: params.stagedDocumentIds },
          organizationId: transaction.organizationId,
          status: 'draft',
        },
        {
          status: 'active',
        }
      );

      // Créer les liens
      for (const docId of params.stagedDocumentIds) {
        await this.deps.documentLinkRepo.create({
          documentId: docId,
          linkedType: 'transaction',
          linkedId: transaction.id,
        });
        if (transaction.propertyId) {
          await this.deps.documentLinkRepo.create({
            documentId: docId,
            linkedType: 'property',
            linkedId: transaction.propertyId,
          });
        }
        if (transaction.leaseId) {
          await this.deps.documentLinkRepo.create({
            documentId: docId,
            linkedType: 'lease',
            linkedId: transaction.leaseId,
          });
        }
        await this.deps.documentLinkRepo.create({
          documentId: docId,
          linkedType: 'global',
          linkedId: 'global',
        });
      }
    }

    // Gérer les liens vers documents existants
    if (params.stagedLinkItemIds && params.stagedLinkItemIds.length > 0) {
      for (const docId of params.stagedLinkItemIds) {
        await this.deps.documentLinkRepo.create({
          documentId: docId,
          linkedType: 'transaction',
          linkedId: transaction.id,
        });
        if (transaction.propertyId) {
          await this.deps.documentLinkRepo.create({
            documentId: docId,
            linkedType: 'property',
            linkedId: transaction.propertyId,
          });
        }
        if (transaction.leaseId) {
          await this.deps.documentLinkRepo.create({
            documentId: docId,
            linkedType: 'lease',
            linkedId: transaction.leaseId,
          });
        }
        await this.deps.documentLinkRepo.create({
          documentId: docId,
          linkedType: 'global',
          linkedId: 'global',
        });
      }
    }

    return {
      transaction,
      ...commissionUpdateResult,
    };
  }

  /**
   * Supprime une transaction avec gestion cascade (commissions, documents)
   */
  async deleteTransaction(id: string, params: DeleteTransactionParams = {}): Promise<DeleteTransactionResult> {
    const mode = params.mode || 'keep_docs_globalize';
    const deleteChildren = params.deleteChildren || false;

    // Vérifier que la transaction existe
    const existingTransaction = await this.deps.transactionRepo.findById(id);
    if (!existingTransaction) {
      throw new Error('Transaction non trouvée');
    }

    // Vérifier les documents liés
    const documentLinks = await this.deps.documentLinkRepo.findMany({
      linkedType: 'transaction',
      linkedId: id,
    });

    const hasDocuments = documentLinks.length > 0;

    // ⚙️ GESTION DÉLÉGUÉE: Gérer les enfants (commissions) avant suppression
    let childrenInfo = { autoDeleted: 0, nonAutoKept: 0, hasNonAutoChildren: false };

    const children = await this.deps.transactionRepo.findMany({
      parentTransactionId: id,
      organizationId: existingTransaction.organizationId,
    });

    if (children.length > 0) {
      // Filtrer par autoSource='gestion' pour ne prendre que les commissions
      const gestionChildren = children.filter(c => c.autoSource === 'gestion');
      const autoChildren = gestionChildren.filter(c => c.isAuto);
      const nonAutoChildren = gestionChildren.filter(c => !c.isAuto);

      // Vérifier d'abord s'il y a des enfants non-auto qui bloquent
      if (nonAutoChildren.length > 0 && !deleteChildren) {
        // Ne pas supprimer les auto si on va lever une exception
        childrenInfo.hasNonAutoChildren = true;
        childrenInfo.nonAutoKept = nonAutoChildren.length;
        throw new Error('Cette transaction a des commissions liées non automatiques. Utilisez deleteChildren=true pour les supprimer également.');
      }

      // Supprimer systématiquement les enfants auto (seulement si pas d'exception)
      if (autoChildren.length > 0) {
        // ⚠️ APP-SHELL: En mode app-shell, les commissions auto sont server-only
        // Le serveur gère la suppression en cascade, donc on ne crée pas de pendingOp DELETE
        // On supprime localement uniquement pour nettoyer l'UI
        const isAppShell = typeof this.deps.transactionRepo.deleteLocalOnly === 'function';
        
        for (const child of autoChildren) {
          if (isAppShell) {
            // App-shell: suppression locale uniquement (pas de pendingOp)
            // Le serveur supprimera la commission en cascade lors de la suppression de la mère
            await this.deps.transactionRepo.deleteLocalOnly!(child.id);
          } else {
            // Mode normal: suppression via repository (crée pendingOp ou appelle API)
          await this.deps.transactionRepo.delete(child.id);
          }
        }
        childrenInfo.autoDeleted = autoChildren.length;
      }

      // Gérer les enfants non-auto (seulement si deleteChildren=true)
      if (nonAutoChildren.length > 0 && deleteChildren) {
        // Supprimer aussi les enfants non-auto
        for (const child of nonAutoChildren) {
          await this.deps.transactionRepo.delete(child.id);
        }
      }
    }

    // Gérer les documents selon le mode
    if (hasDocuments) {
      if (mode === 'delete_docs') {
        // Supprimer les documents
        for (const link of documentLinks) {
          await this.deps.documentRepo.delete(link.documentId);
        }
      } else {
        // keep_docs_globalize: retirer toutes les liaisons non-globales puis créer une liaison globale
        const docIds = Array.from(new Set(documentLinks.map(link => link.documentId)));
        
        // Supprimer toutes les liaisons existantes
        for (const docId of docIds) {
          await this.deps.documentLinkRepo.deleteMany({
            documentId: docId,
          });
        }
        
        // Créer une liaison globale explicite pour chaque document
        for (const docId of docIds) {
          await this.deps.documentLinkRepo.create({
            documentId: docId,
            linkedType: 'global',
            linkedId: 'global',
          });
        }
      }
    }

    // Supprimer la transaction
    await this.deps.transactionRepo.delete(id);

    return {
      success: true,
      mode,
      documentsAffected: documentLinks.length,
      ...childrenInfo,
    };
  }
}

/**
 * Factory pour créer TransactionService avec dépendances
 */
export function createTransactionService(deps: TransactionServiceDependencies): TransactionService {
  return new TransactionService(deps);
}

