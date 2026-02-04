/**
 * Tests de conformité TransactionService (Normal vs AppShell)
 * Utilise des repositories in-memory pour éviter Dexie/fake-indexeddb
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTransactionService, type TransactionServiceDependencies } from '@/domain/services/TransactionService';
import { InMemoryTransactionRepository } from '@/domain/repositories/inMemory/InMemoryTransactionRepository';
import { InMemoryPropertyRepository } from '@/domain/repositories/inMemory/InMemoryPropertyRepository';
import { InMemoryLeaseRepository } from '@/domain/repositories/inMemory/InMemoryLeaseRepository';
import { InMemoryCategoryRepository } from '@/domain/repositories/inMemory/InMemoryCategoryRepository';
import { InMemoryDocumentRepository } from '@/domain/repositories/inMemory/InMemoryDocumentRepository';
import { InMemoryDocumentLinkRepository } from '@/domain/repositories/inMemory/InMemoryDocumentLinkRepository';
import { InMemoryNatureRepository } from '@/domain/repositories/inMemory/InMemoryNatureRepository';
import type { Transaction } from '@/domain/repositories/interfaces/ITransactionRepository';
import type { Property, ManagementCompany } from '@/domain/repositories/interfaces/IPropertyRepository';
import type { Lease } from '@/domain/repositories/interfaces/ILeaseRepository';
import type { Category } from '@/domain/repositories/interfaces/ICategoryRepository';
import type { Document } from '@/domain/repositories/interfaces/IDocumentRepository';
import type { DocumentLink } from '@/domain/repositories/interfaces/IDocumentLinkRepository';
import type { NatureEntity } from '@/domain/repositories/interfaces/INatureRepository';

/**
 * Crée un dataset minimal pour les tests
 */
function createTestDataset(organizationId: string) {
  const property: Property = {
    id: 'prop1',
    organizationId,
    name: 'Bien test',
    managementCompanyId: 'mgmt1',
  };

  const managementCompany: ManagementCompany = {
    id: 'mgmt1',
    organizationId,
    nom: 'Société de gestion test',
    modeCalcul: 'LOYERS_UNIQUEMENT',
    taux: 0.06, // 6%
    fraisMin: null,
    tvaApplicable: false,
    tauxTva: null,
    actif: true,
  };

  const lease: Lease = {
    id: 'lease1',
    organizationId,
    propertyId: 'prop1',
    tenantId: 'tenant1',
    status: 'ACTIF',
  };

  const categoryLoyer: Category = {
    id: 'cat_loyer',
    slug: 'loyer',
    label: 'Loyer',
    type: 'INCOME',
    actif: true,
  };

  const categoryFraisGestion: Category = {
    id: 'cat_frais_gestion',
    slug: 'frais-gestion',
    label: 'Frais de gestion',
    type: 'EXPENSE',
    actif: true,
  };

  const natureLoyer: NatureEntity = {
    code: 'RECETTE_LOYER',
    label: 'Recette loyer',
    flow: 'INCOME',
  };

  const natureFraisGestion: NatureEntity = {
    code: 'FRAIS_GESTION',
    label: 'Frais de gestion',
    flow: 'EXPENSE',
  };

  return {
    property,
    managementCompany,
    lease,
    categoryLoyer,
    categoryFraisGestion,
    natureLoyer,
    natureFraisGestion,
  };
}

/**
 * Crée les repositories avec le dataset
 */
function createRepositories(organizationId: string) {
  const dataset = createTestDataset(organizationId);

  const transactionRepo = new InMemoryTransactionRepository();
  const propertyRepo = new InMemoryPropertyRepository();
  const leaseRepo = new InMemoryLeaseRepository();
  const categoryRepo = new InMemoryCategoryRepository();
  const documentRepo = new InMemoryDocumentRepository();
  const documentLinkRepo = new InMemoryDocumentLinkRepository();
  const natureRepo = new InMemoryNatureRepository();

  // Seed les données de référence
  propertyRepo.seedProperty(dataset.property);
  propertyRepo.seedManagementCompany(dataset.managementCompany);
  leaseRepo.seed([dataset.lease]);
  categoryRepo.seed([dataset.categoryLoyer, dataset.categoryFraisGestion]);
  natureRepo.seed([dataset.natureLoyer, dataset.natureFraisGestion]);

  return {
    transactionRepo,
    propertyRepo,
    leaseRepo,
    categoryRepo,
    documentRepo,
    documentLinkRepo,
    natureRepo,
  };
}

/**
 * Compare deux états de transactions (normalise pour comparaison)
 */
function normalizeTransactions(transactions: Transaction[]): any[] {
  return transactions
    .map(tx => ({
      id: tx.id,
      organizationId: tx.organizationId,
      propertyId: tx.propertyId,
      leaseId: tx.leaseId,
      categoryId: tx.categoryId,
      label: tx.label,
      amount: tx.amount,
      date: tx.date.toISOString(),
      nature: tx.nature,
      parentTransactionId: tx.parentTransactionId,
      isAuto: tx.isAuto,
      autoSource: tx.autoSource,
      montantLoyer: tx.montantLoyer,
      chargesRecup: tx.chargesRecup,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

describe('TransactionService Conformance (Normal vs AppShell)', () => {
  const organizationId = 'org_test';

  beforeEach(() => {
    // Chaque test commence avec un dataset propre
  });

  it('CREATE: même input => mêmes side-effects (transaction + commission)', async () => {
    // Dataset initial identique
    const reposNormal = createRepositories(organizationId);
    const reposAppShell = createRepositories(organizationId);

    const serviceNormal = createTransactionService(reposNormal);
    const serviceAppShell = createTransactionService(reposAppShell);

    // Input identique
    const input = {
      organizationId,
      propertyId: 'prop1',
      leaseId: 'lease1',
      categoryId: 'cat_loyer',
      natureId: 'RECETTE_LOYER',
      label: 'Loyer janvier',
      amount: 1000,
      date: new Date('2025-01-15'),
      accountingMonth: '2025-01',
      montantLoyer: 1000,
      chargesRecup: 100,
      gestionEnabled: true,
      gestionCodes: {
        rentNature: 'RECETTE_LOYER',
        mgmtNature: 'FRAIS_GESTION',
        mgmtCategory: 'frais-gestion',
      },
    };

    // Exécuter via service normal
    const resultNormal = await serviceNormal.createTransaction(input);

    // Exécuter via service app-shell
    const resultAppShell = await serviceAppShell.createTransaction(input);

    // Comparer : transactions créées
    expect(resultNormal.totalCreated).toBe(resultAppShell.totalCreated);
    expect(resultNormal.allTransactions.length).toBe(resultAppShell.allTransactions.length);

    // Comparer : présence de commission
    expect(!!resultNormal.commissionTransaction).toBe(!!resultAppShell.commissionTransaction);

    // Comparer : état final (toutes les transactions)
    // Note: Les IDs seront différents, on compare la structure et les relations
    const allNormal = reposNormal.transactionRepo.getAll();
    const allAppShell = reposAppShell.transactionRepo.getAll();

    expect(allNormal.length).toBe(allAppShell.length);
    expect(allNormal.length).toBe(2); // Transaction principale + commission

    // Vérifier la structure (sans les IDs qui diffèrent)
    const normalMain = allNormal.find(tx => !tx.isAuto);
    const normalCommission = allNormal.find(tx => tx.isAuto && tx.autoSource === 'gestion');
    const appShellMain = allAppShell.find(tx => !tx.isAuto);
    const appShellCommission = allAppShell.find(tx => tx.isAuto && tx.autoSource === 'gestion');

    expect(normalMain).toBeDefined();
    expect(normalCommission).toBeDefined();
    expect(appShellMain).toBeDefined();
    expect(appShellCommission).toBeDefined();

    // Comparer les champs métier (sans ID)
    expect(normalMain!.amount).toBe(appShellMain!.amount);
    expect(normalMain!.label).toBe(appShellMain!.label);
    expect(normalCommission!.amount).toBe(appShellCommission!.amount);
    expect(normalCommission!.parentTransactionId).toBe(normalMain!.id);
    expect(appShellCommission!.parentTransactionId).toBe(appShellMain!.id);

    // Vérifier que la commission a été créée
    expect(resultNormal.commissionTransaction).toBeDefined();
    expect(resultNormal.commissionTransaction?.isAuto).toBe(true);
    expect(resultNormal.commissionTransaction?.autoSource).toBe('gestion');
    expect(resultNormal.commissionTransaction?.parentTransactionId).toBe(resultNormal.transaction.id);
    expect(resultNormal.commissionTransaction?.amount).toBeLessThan(0); // Dépense
  });

  it('CREATE: gestion déléguée désactivée => pas de commission', async () => {
    const repos = createRepositories(organizationId);
    const service = createTransactionService(repos);

    const input = {
      organizationId,
      propertyId: 'prop1',
      leaseId: 'lease1',
      categoryId: 'cat_loyer',
      natureId: 'RECETTE_LOYER',
      label: 'Loyer janvier',
      amount: 1000,
      date: new Date('2025-01-15'),
      accountingMonth: '2025-01',
      montantLoyer: 1000,
      chargesRecup: 100,
      gestionEnabled: false, // Désactivé
      gestionCodes: {
        rentNature: 'RECETTE_LOYER',
        mgmtNature: 'FRAIS_GESTION',
        mgmtCategory: 'frais-gestion',
      },
    };

    const result = await service.createTransaction(input);

    // Vérifier qu'aucune commission n'a été créée
    expect(result.commissionTransaction).toBeUndefined();
    expect(result.totalCreated).toBe(1); // Seulement la transaction principale

    const allTransactions = repos.transactionRepo.getAll();
    const commissions = allTransactions.filter(tx => tx.isAuto && tx.autoSource === 'gestion');
    expect(commissions.length).toBe(0);
  });

  it('UPDATE: même input => mêmes side-effects (recalcul commission)', async () => {
    const reposNormal = createRepositories(organizationId);
    const reposAppShell = createRepositories(organizationId);

    const serviceNormal = createTransactionService(reposNormal);
    const serviceAppShell = createTransactionService(reposAppShell);

    // Créer une transaction initiale avec commission
    const createInput = {
      organizationId,
      propertyId: 'prop1',
      leaseId: 'lease1',
      categoryId: 'cat_loyer',
      natureId: 'RECETTE_LOYER',
      label: 'Loyer janvier',
      amount: 1000,
      date: new Date('2025-01-15'),
      accountingMonth: '2025-01',
      montantLoyer: 1000,
      chargesRecup: 100,
      gestionEnabled: true,
      gestionCodes: {
        rentNature: 'RECETTE_LOYER',
        mgmtNature: 'FRAIS_GESTION',
        mgmtCategory: 'frais-gestion',
      },
    };

    const createdNormal = await serviceNormal.createTransaction(createInput);
    const createdAppShell = await serviceAppShell.createTransaction(createInput);

    const transactionIdNormal = createdNormal.transaction.id;
    const transactionIdAppShell = createdAppShell.transaction.id;

    // Mettre à jour avec nouveau montant
    const updateInput = {
      montantLoyer: 1200, // Augmenté de 1000 à 1200
      chargesRecup: 120,
      gestionEnabled: true,
      gestionCodes: {
        rentNature: 'RECETTE_LOYER',
        mgmtNature: 'FRAIS_GESTION',
        mgmtCategory: 'frais-gestion',
      },
    };

    const updatedNormal = await serviceNormal.updateTransaction(transactionIdNormal, updateInput);
    const updatedAppShell = await serviceAppShell.updateTransaction(transactionIdAppShell, updateInput);

    // Comparer : commission mise à jour
    expect(updatedNormal.commissionUpdated).toBe(updatedAppShell.commissionUpdated);
    expect(updatedNormal.commissionNewValue).toBe(updatedAppShell.commissionNewValue);

    // Vérifier que la commission a été recalculée
    const commissionNormal = reposNormal.transactionRepo.findFirst({
      parentTransactionId: transactionIdNormal,
      isAuto: true,
      autoSource: 'gestion',
    });
    const commissionAppShell = reposAppShell.transactionRepo.findFirst({
      parentTransactionId: transactionIdAppShell,
      isAuto: true,
      autoSource: 'gestion',
    });

    const commNormal = await commissionNormal;
    const commAppShell = await commissionAppShell;

    expect(commNormal).toBeDefined();
    expect(commAppShell).toBeDefined();
    expect(commNormal?.amount).toBe(commAppShell?.amount);
    // Commission = 6% de 1200 = 72€ (négatif car dépense)
    expect(commNormal?.amount).toBe(-72);
  });

  it('DELETE: même input => mêmes side-effects (suppression cascade commissions auto)', async () => {
    const reposNormal = createRepositories(organizationId);
    const reposAppShell = createRepositories(organizationId);

    const serviceNormal = createTransactionService(reposNormal);
    const serviceAppShell = createTransactionService(reposAppShell);

    // Créer une transaction avec commission
    const createInput = {
      organizationId,
      propertyId: 'prop1',
      leaseId: 'lease1',
      categoryId: 'cat_loyer',
      natureId: 'RECETTE_LOYER',
      label: 'Loyer janvier',
      amount: 1000,
      date: new Date('2025-01-15'),
      accountingMonth: '2025-01',
      montantLoyer: 1000,
      chargesRecup: 100,
      gestionEnabled: true,
      gestionCodes: {
        rentNature: 'RECETTE_LOYER',
        mgmtNature: 'FRAIS_GESTION',
        mgmtCategory: 'frais-gestion',
      },
    };

    const createdNormal = await serviceNormal.createTransaction(createInput);
    const createdAppShell = await serviceAppShell.createTransaction(createInput);

    const transactionIdNormal = createdNormal.transaction.id;
    const transactionIdAppShell = createdAppShell.transaction.id;

    // Vérifier que la commission existe avant suppression
    const commissionBeforeNormal = await reposNormal.transactionRepo.findFirst({
      parentTransactionId: transactionIdNormal,
      isAuto: true,
      autoSource: 'gestion',
    });
    const commissionBeforeAppShell = await reposAppShell.transactionRepo.findFirst({
      parentTransactionId: transactionIdAppShell,
      isAuto: true,
      autoSource: 'gestion',
    });

    expect(commissionBeforeNormal).toBeDefined();
    expect(commissionBeforeAppShell).toBeDefined();

    // Supprimer la transaction principale
    const deletedNormal = await serviceNormal.deleteTransaction(transactionIdNormal, {
      mode: 'keep_docs_globalize',
      deleteChildren: false,
    });
    const deletedAppShell = await serviceAppShell.deleteTransaction(transactionIdAppShell, {
      mode: 'keep_docs_globalize',
      deleteChildren: false,
    });

    // Comparer : commissions auto supprimées
    expect(deletedNormal.autoDeleted).toBe(deletedAppShell.autoDeleted);
    expect(deletedNormal.autoDeleted).toBe(1); // Une commission auto supprimée

    // Vérifier que la commission n'existe plus
    const commissionAfterNormal = await reposNormal.transactionRepo.findById(commissionBeforeNormal!.id);
    const commissionAfterAppShell = await reposAppShell.transactionRepo.findById(commissionBeforeAppShell!.id);

    expect(commissionAfterNormal).toBeNull();
    expect(commissionAfterAppShell).toBeNull();

    // Vérifier que la transaction principale n'existe plus
    const transactionAfterNormal = await reposNormal.transactionRepo.findById(transactionIdNormal);
    const transactionAfterAppShell = await reposAppShell.transactionRepo.findById(transactionIdAppShell);

    expect(transactionAfterNormal).toBeNull();
    expect(transactionAfterAppShell).toBeNull();
  });

  it('DELETE: commissions non-auto conservées par défaut', async () => {
    const repos = createRepositories(organizationId);
    const service = createTransactionService(repos);

    // Créer une transaction avec commission auto
    const createInput = {
      organizationId,
      propertyId: 'prop1',
      leaseId: 'lease1',
      categoryId: 'cat_loyer',
      natureId: 'RECETTE_LOYER',
      label: 'Loyer janvier',
      amount: 1000,
      date: new Date('2025-01-15'),
      accountingMonth: '2025-01',
      montantLoyer: 1000,
      chargesRecup: 100,
      gestionEnabled: true,
      gestionCodes: {
        rentNature: 'RECETTE_LOYER',
        mgmtNature: 'FRAIS_GESTION',
        mgmtCategory: 'frais-gestion',
      },
    };

    const created = await service.createTransaction(createInput);
    const transactionId = created.transaction.id;

    // Vérifier qu'une commission auto a été créée
    const commissionAuto = await repos.transactionRepo.findFirst({
      parentTransactionId: transactionId,
      isAuto: true,
      autoSource: 'gestion',
    });
    expect(commissionAuto).toBeDefined();

    // Créer une commission non-auto manuellement
    const commissionNonAuto = await repos.transactionRepo.create({
      organizationId,
      propertyId: 'prop1',
      categoryId: 'cat_frais_gestion',
      label: 'Commission manuelle',
      amount: -50,
      date: new Date('2025-01-15'),
      accounting_month: '2025-01',
      nature: 'FRAIS_GESTION',
      parentTransactionId: transactionId,
      isAuto: false, // Non auto
      autoSource: 'gestion',
      source: 'MANUAL',
    });

    // Tenter de supprimer sans deleteChildren
    try {
      await service.deleteTransaction(transactionId, {
        mode: 'keep_docs_globalize',
        deleteChildren: false,
      });
      expect.fail('Devrait échouer car commission non-auto existe');
    } catch (error: any) {
      expect(error.message).toContain('commissions liées non automatiques');
    }

    // Vérifier que la commission non-auto existe toujours
    const commissionStillExists = await repos.transactionRepo.findById(commissionNonAuto.id);
    expect(commissionStillExists).toBeDefined();

    // Vérifier que la commission auto existe toujours aussi (car suppression bloquée)
    const commissionAutoStillExists = await repos.transactionRepo.findById(commissionAuto!.id);
    expect(commissionAutoStillExists).toBeDefined();

    // Supprimer avec deleteChildren=true
    // Note: La commission auto sera supprimée AVANT la commission non-auto
    const deleted = await service.deleteTransaction(transactionId, {
      mode: 'keep_docs_globalize',
      deleteChildren: true,
    });

    // Vérifier que les commissions ont été supprimées
    expect(deleted.autoDeleted).toBeGreaterThanOrEqual(1); // Au moins une commission auto supprimée
    expect(deleted.nonAutoKept).toBe(0); // Commission non-auto aussi supprimée (pas conservée car deleteChildren=true)

    // Vérifier que la commission non-auto n'existe plus
    const commissionAfter = await repos.transactionRepo.findById(commissionNonAuto.id);
    expect(commissionAfter).toBeNull();

    // Vérifier que la commission auto n'existe plus non plus
    const commissionAutoAfter = await repos.transactionRepo.findById(commissionAuto!.id);
    expect(commissionAutoAfter).toBeNull();
  });

  it('CREATE: multi-mois => transactions multiples créées', async () => {
    const repos = createRepositories(organizationId);
    const service = createTransactionService(repos);

    const input = {
      organizationId,
      propertyId: 'prop1',
      leaseId: 'lease1',
      categoryId: 'cat_loyer',
      natureId: 'RECETTE_LOYER',
      label: 'Loyer',
      amount: 1000,
      date: new Date('2025-01-15'),
      accountingMonth: '2025-01',
      monthsCovered: 3, // 3 mois
      montantLoyer: 1000,
      chargesRecup: 100,
      gestionEnabled: true,
      gestionCodes: {
        rentNature: 'RECETTE_LOYER',
        mgmtNature: 'FRAIS_GESTION',
        mgmtCategory: 'frais-gestion',
      },
    };

    const result = await service.createTransaction(input);

    // Vérifier que 3 transactions principales ont été créées
    // Note: totalCreated contient seulement le nombre de principales
    // allTransactions contient toutes les transactions (principales + commissions) pour compatibilité API
    expect(result.totalCreated).toBe(3);
    
    // Vérifier le total réel dans le repo (principales + commissions)
    const allTransactionsInRepo = repos.transactionRepo.getAll();
    const mainTransactions = allTransactionsInRepo.filter(tx => !tx.isAuto || tx.autoSource !== 'gestion');
    expect(mainTransactions.length).toBe(3);
    
    // allTransactions contient toutes les transactions (principales + commissions)
    expect(result.allTransactions.length).toBe(6); // 3 principales + 3 commissions

    // Filtrer les principales depuis allTransactions pour vérifier les labels
    const mainTransactionsFromResult = result.allTransactions.filter(tx => !tx.isAuto || tx.autoSource !== 'gestion');
    
    // Vérifier les labels avec mois (format: "Loyer – Janvier 2025")
    expect(mainTransactionsFromResult[0].label.toLowerCase()).toContain('janvier');
    expect(mainTransactionsFromResult[1].label.toLowerCase()).toContain('février');
    expect(mainTransactionsFromResult[2].label.toLowerCase()).toContain('mars');

    // Vérifier les accounting_month
    expect(mainTransactionsFromResult[0].accounting_month).toBe('2025-01');
    expect(mainTransactionsFromResult[1].accounting_month).toBe('2025-02');
    expect(mainTransactionsFromResult[2].accounting_month).toBe('2025-03');

    // Vérifier que chaque transaction a sa commission
    const commissions = allTransactionsInRepo.filter(tx => tx.isAuto && tx.autoSource === 'gestion');
    expect(commissions.length).toBe(3); // Une commission par transaction
  });
});

