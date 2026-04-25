/**
 * Service unifié pour gérer les documents liés aux transactions (et autres entités)
 * En mode App Shell, lit UNIQUEMENT depuis IndexedDB
 * 
 * Source de vérité : table documentLinks + documents (métadonnées)
 */

import { getLocalDB } from '../db';
import type { LocalDocument, LocalDocumentLink } from '../db';
import { txPerfMeasureZone } from '@/lib/utils/logger';

export interface LinkedDocument {
  id: string;
  filenameOriginal: string;
  fileName: string;
  mime: string;
  size: number;
  url: string;
  documentTypeId?: string | null;
  uploadedAt: string;
  createdAt: string;
  status: string;
  // Informations supplémentaires pour l'affichage
  documentTypeLabel?: string;
  entityName?: string | null;
}

/**
 * Récupère tous les documents liés à une transaction depuis IndexedDB
 * @param transactionId ID de la transaction
 * @param organizationId ID de l'organisation (pour filtrer)
 * @returns Liste des documents liés avec leurs métadonnées
 * @returns __missingDocumentIds (propriété cachée) : IDs des documents manquants
 */
export async function getLinkedDocumentsForTransaction(
  transactionId: string,
  organizationId: string
): Promise<LinkedDocument[] & { __missingDocumentIds?: string[] }> {
  const db = await getLocalDB();

  // 0. Déterminer si la transaction doit aussi hériter des PJ de sa transaction mère
  // (cas commissions auto de gestion)
  let transaction: any = null;
  try {
    const txTable =
      db?.Transaction && typeof db.Transaction.get === 'function'
        ? db.Transaction
        : db?.tables?.find((t: any) => t?.name === 'Transaction' && typeof t?.get === 'function');
    transaction = txTable ? await txTable.get(transactionId) : null;
  } catch {
    transaction = null;
  }
  const parentTransactionId = transaction?.parentTransactionId ? String(transaction.parentTransactionId) : '';
  const autoSource = String(transaction?.autoSource || '').toLowerCase();
  const isAutoCommission =
    autoSource === 'gestion' &&
    !!parentTransactionId &&
    (
      transaction?.isAuto === true ||
      transaction?.isAuto === 1 ||
      String(transaction?.label || '').toLowerCase().includes('commission')
    );

  const linkedIds = isAutoCommission ? [transactionId, parentTransactionId] : [transactionId];

  // 1. Récupérer tous les liens document_links pour cette transaction (et parent si commission auto)
  // Note: Dexie ne supporte pas directement les requêtes sur clés composites
  // On filtre manuellement après récupération
  // ⚠️ Normaliser linkedType: peut être en majuscules (TRANSACTION) ou minuscules (transaction)
  const allLinks = await db.DocumentLink.toArray();
  const links = allLinks.filter(link => 
    link.linkedType.toLowerCase() === 'transaction' && linkedIds.includes(String(link.linkedId))
  );
  
  if (links.length === 0) {
    return [];
  }
  
  // 2. Récupérer les métadonnées des documents correspondants
  const documentIds = links.map(link => link.documentId);
  const documents = await db.Document
    .where('id')
    .anyOf(documentIds)
    .filter(doc => doc.organizationId === organizationId && !doc.deletedAt)
    .toArray();
  
  // 3. Récupérer les types de documents pour enrichir les labels
  const documentTypeIds = documents
    .map(doc => doc.documentTypeId)
    .filter((id): id is string => id !== null && id !== undefined);
  
  const documentTypes = documentTypeIds.length > 0
    ? await db.DocumentType
        .where('id')
        .anyOf(documentTypeIds)
        .toArray()
    : [];
  
  const documentTypeMap = new Map(documentTypes.map(dt => [dt.id, dt.label]));
  
  // 4. Construire le résultat en combinant links + documents + types
  const result: LinkedDocument[] = [];
  const missingDocumentIds: string[] = [];
  
  for (const link of links) {
    const document = documents.find(doc => doc.id === link.documentId);
    
    if (!document) {
      // Document manquant : état "non synchronisé"
      // Le lien existe mais la métadonnée du document n'est pas présente en local
      missingDocumentIds.push(link.documentId);
      continue;
    }
    
    result.push({
      id: document.id,
      filenameOriginal: document.filenameOriginal,
      fileName: document.fileName,
      mime: document.mime,
      size: document.size,
      url: document.url,
      documentTypeId: document.documentTypeId,
      uploadedAt: document.uploadedAt,
      createdAt: document.createdAt,
      status: document.status,
      documentTypeLabel: document.documentTypeId 
        ? documentTypeMap.get(document.documentTypeId) || 'Non classé'
        : 'Non classé',
      entityName: link.entityName || null,
    });
  }
  
  // Stocker les IDs manquants dans le résultat pour détection (propriété cachée)
  if (missingDocumentIds.length > 0) {
    (result as any).__missingDocumentIds = missingDocumentIds;
  }
  
  return result as LinkedDocument[] & { __missingDocumentIds?: string[] };
}

/**
 * Compte le nombre de documents liés à une transaction depuis IndexedDB
 * @param transactionId ID de la transaction
 * @param organizationId ID de l'organisation
 * @returns Nombre de documents liés (avec métadonnées présentes)
 */
export async function getDocumentCountForTransaction(
  transactionId: string,
  organizationId: string
): Promise<number> {
  const db = await getLocalDB();

  // 0. Même logique que getLinkedDocumentsForTransaction: fallback transaction mère pour commission auto.
  let transaction: any = null;
  try {
    const txTable =
      db?.Transaction && typeof db.Transaction.get === 'function'
        ? db.Transaction
        : db?.tables?.find((t: any) => t?.name === 'Transaction' && typeof t?.get === 'function');
    transaction = txTable ? await txTable.get(transactionId) : null;
  } catch {
    transaction = null;
  }
  const parentTransactionId = transaction?.parentTransactionId ? String(transaction.parentTransactionId) : '';
  const autoSource = String(transaction?.autoSource || '').toLowerCase();
  const isAutoCommission =
    autoSource === 'gestion' &&
    !!parentTransactionId &&
    (
      transaction?.isAuto === true ||
      transaction?.isAuto === 1 ||
      String(transaction?.label || '').toLowerCase().includes('commission')
    );
  const linkedIds = isAutoCommission ? [transactionId, parentTransactionId] : [transactionId];

  // 1. Compter les liens (normaliser linkedType: peut être en majuscules ou minuscules)
  const allLinks = await db.DocumentLink.toArray();
  const links = allLinks.filter(link => 
    link.linkedType.toLowerCase() === 'transaction' && linkedIds.includes(String(link.linkedId))
  );
  
  if (links.length === 0) {
    return 0;
  }
  
  // 2. Vérifier que les documents existent et ne sont pas supprimés
  const documentIds = links.map(link => link.documentId);
  const existingDocuments = await db.Document
    .where('id')
    .anyOf(documentIds)
    .filter(doc => doc.organizationId === organizationId && !doc.deletedAt)
    .toArray();
  
  return existingDocuments.length;
}

/**
 * Récupère tous les documents liés à un prêt depuis IndexedDB
 * @param loanId ID du prêt
 * @param organizationId ID de l'organisation (pour filtrer)
 * @returns Liste des documents liés avec leurs métadonnées
 * @returns __missingDocumentIds (propriété cachée) : IDs des documents manquants
 */
export async function getLinkedDocumentsForLoan(
  loanId: string,
  organizationId: string
): Promise<LinkedDocument[] & { __missingDocumentIds?: string[] }> {
  const db = await getLocalDB();
  
  // 1. Récupérer tous les liens document_links pour ce prêt
  // Note: Dexie ne supporte pas directement les requêtes sur clés composites
  // On filtre manuellement après récupération
  // ⚠️ Normaliser linkedType: peut être en majuscules (LOAN) ou minuscules (loan)
  const allLinks = await db.DocumentLink.toArray();
  const links = allLinks.filter(link => 
    link.linkedType.toLowerCase() === 'loan' && link.linkedId === loanId
  );
  
  // 2. Récupérer aussi les documents directement liés via loanId dans la table Document
  const directDocuments = await db.Document
    .where('organizationId')
    .equals(organizationId)
    .filter(doc => doc.loanId === loanId && !doc.deletedAt)
    .toArray();
  
  // Combiner les deux sources (éviter les doublons)
  const documentIdsFromLinks = new Set(links.map(link => link.documentId));
  const directDocumentIds = directDocuments.map(doc => doc.id);
  const allDocumentIds = new Set([...documentIdsFromLinks, ...directDocumentIds]);
  
  if (allDocumentIds.size === 0) {
    return [];
  }
  
  // 3. Récupérer les métadonnées des documents correspondants
  const documents = await db.Document
    .where('id')
    .anyOf(Array.from(allDocumentIds))
    .filter(doc => doc.organizationId === organizationId && !doc.deletedAt)
    .toArray();
  
  // 4. Récupérer les types de documents pour enrichir les labels
  const documentTypeIds = documents
    .map(doc => doc.documentTypeId)
    .filter((id): id is string => id !== null && id !== undefined);
  
  const documentTypes = documentTypeIds.length > 0
    ? await db.DocumentType
        .where('id')
        .anyOf(documentTypeIds)
        .toArray()
    : [];
  
  const documentTypeMap = new Map(documentTypes.map(dt => [dt.id, dt.label]));
  
  // 5. Construire le résultat en combinant documents + types
  const result: LinkedDocument[] = [];
  const missingDocumentIds: string[] = [];
  
  for (const documentId of allDocumentIds) {
    const document = documents.find(doc => doc.id === documentId);
    
    if (!document) {
      // Document manquant : état "non synchronisé"
      missingDocumentIds.push(documentId);
      continue;
    }
    
    result.push({
      id: document.id,
      filenameOriginal: document.filenameOriginal,
      fileName: document.fileName,
      mime: document.mime,
      size: document.size,
      url: document.url,
      documentTypeId: document.documentTypeId,
      uploadedAt: document.uploadedAt,
      createdAt: document.createdAt,
      status: document.status,
      documentTypeLabel: document.documentTypeId 
        ? documentTypeMap.get(document.documentTypeId) || 'Non classé'
        : 'Non classé',
      entityName: null,
    });
  }
  
  // Stocker les IDs manquants dans le résultat pour détection (propriété cachée)
  if (missingDocumentIds.length > 0) {
    (result as any).__missingDocumentIds = missingDocumentIds;
  }
  
  return result as LinkedDocument[] & { __missingDocumentIds?: string[] };
}

/**
 * Compte le nombre de documents liés à un prêt depuis IndexedDB
 * @param loanId ID du prêt
 * @param organizationId ID de l'organisation
 * @returns Nombre de documents liés (avec métadonnées présentes)
 */
export async function getDocumentCountForLoan(
  loanId: string,
  organizationId: string
): Promise<number> {
  const db = await getLocalDB();
  
  // 1. Compter les liens (normaliser linkedType: peut être en majuscules ou minuscules)
  const allLinks = await db.DocumentLink.toArray();
  const links = allLinks.filter(link => 
    link.linkedType.toLowerCase() === 'loan' && link.linkedId === loanId
  );
  
  // 2. Compter aussi les documents directement liés via loanId
  const directDocuments = await db.Document
    .where('organizationId')
    .equals(organizationId)
    .filter(doc => doc.loanId === loanId && !doc.deletedAt)
    .toArray();
  
  // Combiner les deux sources (éviter les doublons)
  const documentIdsFromLinks = new Set(links.map(link => link.documentId));
  const directDocumentIds = directDocuments.map(doc => doc.id);
  const allDocumentIds = new Set([...documentIdsFromLinks, ...directDocumentIds]);
  
  if (allDocumentIds.size === 0) {
    return 0;
  }
  
  // 3. Vérifier que les documents existent et ne sont pas supprimés
  const existingDocuments = await db.Document
    .where('id')
    .anyOf(Array.from(allDocumentIds))
    .filter(doc => doc.organizationId === organizationId && !doc.deletedAt)
    .toArray();
  
  return existingDocuments.length;
}

/**
 * Vérifie si un prêt a au moins un document lié
 * @param loanId ID du prêt
 * @param organizationId ID de l'organisation
 * @returns true si au moins un document est lié
 */
export async function hasDocumentForLoan(
  loanId: string,
  organizationId: string
): Promise<boolean> {
  const count = await getDocumentCountForLoan(loanId, organizationId);
  return count > 0;
}

/**
 * Vérifie si une transaction a au moins un document lié
 * @param transactionId ID de la transaction
 * @param organizationId ID de l'organisation
 * @returns true si au moins un document est lié
 */
export async function hasDocumentForTransaction(
  transactionId: string,
  organizationId: string
): Promise<boolean> {
  const count = await getDocumentCountForTransaction(transactionId, organizationId);
  return count > 0;
}

/**
 * Récupère les documents liés pour plusieurs transactions en une seule requête (optimisation)
 * @param transactionIds Liste des IDs de transactions
 * @param organizationId ID de l'organisation
 * @returns Map transactionId -> LinkedDocument[]
 */
export async function getLinkedDocumentsForTransactions(
  transactionIds: string[],
  organizationId: string
): Promise<Map<string, LinkedDocument[]>> {
  const db = await getLocalDB();
  const result = new Map<string, LinkedDocument[]>();
  
  if (transactionIds.length === 0) {
    return result;
  }
  
  // 1. Récupérer tous les liens pour ces transactions
  const allLinks = await db.DocumentLink
    .where('linkedType')
    .equals('transaction')
    .filter(link => transactionIds.includes(link.linkedId))
    .toArray();
  
  if (allLinks.length === 0) {
    // Initialiser toutes les transactions avec un tableau vide
    transactionIds.forEach(id => result.set(id, []));
    return result;
  }
  
  // 2. Grouper les liens par transactionId
  const linksByTransaction = new Map<string, LocalDocumentLink[]>();
  filteredLinks.forEach(link => {
    if (!linksByTransaction.has(link.linkedId)) {
      linksByTransaction.set(link.linkedId, []);
    }
    linksByTransaction.get(link.linkedId)!.push(link);
  });
  
  // 3. Récupérer tous les documents uniques
  const allDocumentIds = Array.from(new Set(filteredLinks.map(link => link.documentId)));
  const documents = await db.Document
    .where('id')
    .anyOf(allDocumentIds)
    .filter(doc => doc.organizationId === organizationId && !doc.deletedAt)
    .toArray();
  
  const documentMap = new Map(documents.map(doc => [doc.id, doc]));
  
  // 4. Récupérer les types de documents
  const documentTypeIds = documents
    .map(doc => doc.documentTypeId)
    .filter((id): id is string => id !== null && id !== undefined);
  
  const documentTypes = documentTypeIds.length > 0
    ? await db.DocumentType
        .where('id')
        .anyOf(documentTypeIds)
        .toArray()
    : [];
  
  const documentTypeMap = new Map(documentTypes.map(dt => [dt.id, dt.label]));
  
  // 5. Construire le résultat pour chaque transaction
  transactionIds.forEach(transactionId => {
    const links = linksByTransaction.get(transactionId) || [];
    const linkedDocs: LinkedDocument[] = [];
    
    for (const link of links) {
      const document = documentMap.get(link.documentId);
      
      if (!document) {
        // Document manquant (non synchronisé)
        continue;
      }
      
      linkedDocs.push({
        id: document.id,
        filenameOriginal: document.filenameOriginal,
        fileName: document.fileName,
        mime: document.mime,
        size: document.size,
        url: document.url,
        documentTypeId: document.documentTypeId,
        uploadedAt: document.uploadedAt,
        createdAt: document.createdAt,
        status: document.status,
        documentTypeLabel: document.documentTypeId 
          ? documentTypeMap.get(document.documentTypeId) || 'Non classé'
          : 'Non classé',
        entityName: link.entityName || null,
      });
    }
    
    result.set(transactionId, linkedDocs);
  });
  
  return result;
}

/**
 * Compteur PJ pour le tableau : les liens restent sur la transaction mère ;
 * la ligne commission auto gestion réaffiche le même total que la mère.
 */
export function transactionDocumentsCountForTableRow(
  trans: {
    id: string;
    parentTransactionId?: string | null;
    isAuto?: boolean | null;
    autoSource?: string | null;
    label?: string | null;
  },
  counts: Map<string, number>
): number {
  const own = counts.get(trans.id) || 0;
  if (own > 0) return own;
  const pid = trans.parentTransactionId ? String(trans.parentTransactionId) : '';
  if (!pid) return 0;
  const parentCount = counts.get(pid) || 0;
  if (parentCount <= 0) return 0;

  const src = String(trans.autoSource || '').toLowerCase();
  const gestion = src === 'gestion';
  const lbl = String(trans.label || '').toLowerCase();
  const looksCommissionByLabel = lbl.includes('commission');
  const auto =
    trans.isAuto === true || (trans as { isAuto?: unknown }).isAuto === 1;

  // Commission serveur : gestion + (isAuto ou libellé) ; repli si isAuto absent après sync partielle
  if (gestion && (auto || looksCommissionByLabel)) {
    return parentCount;
  }
  if (looksCommissionByLabel) {
    return parentCount;
  }
  return 0;
}

/**
 * Compte les documents pour plusieurs transactions en une seule requête (optimisation)
 * @param transactionIds Liste des IDs de transactions
 * @param organizationId ID de l'organisation
 * @returns Map transactionId -> count
 */
export async function getDocumentCountsForTransactions(
  transactionIds: string[],
  organizationId: string
): Promise<Map<string, number>> {
  const endMeasure = txPerfMeasureZone('tx:getDocumentCountsForTransactions');
  try {
  const db = await getLocalDB();
  const result = new Map<string, number>();
  
  if (transactionIds.length === 0) {
    return result;
  }
  
  // 1. Liens ciblés par linkedId (index Dexie sur linkedId) — évite DocumentLink.toArray() sur toute la table
  const filteredLinks = await db.DocumentLink
    .where('linkedId')
    .anyOf(transactionIds)
    .filter((link) => link.linkedType.toLowerCase() === 'transaction')
    .toArray();
  
  // 2. Grouper les liens par transactionId
  const linksByTransaction = new Map<string, string[]>(); // transactionId -> documentIds[]
  filteredLinks.forEach(link => {
    if (!linksByTransaction.has(link.linkedId)) {
      linksByTransaction.set(link.linkedId, []);
    }
    linksByTransaction.get(link.linkedId)!.push(link.documentId);
  });
  
  // 3. Récupérer tous les documents uniques et vérifier qu'ils existent
  const allDocumentIds = Array.from(new Set(filteredLinks.map(link => link.documentId)));
  const existingDocuments = await db.Document
    .where('id')
    .anyOf(allDocumentIds)
    .filter(doc => doc.organizationId === organizationId && !doc.deletedAt)
    .toArray();
  
  const existingDocumentIds = new Set(existingDocuments.map(doc => doc.id));
  
  // 4. Compter pour chaque transaction
  transactionIds.forEach(transactionId => {
    const documentIds = linksByTransaction.get(transactionId) || [];
    const count = documentIds.filter(id => existingDocumentIds.has(id)).length;
    result.set(transactionId, count);
  });
  
  return result;
  } finally {
    endMeasure();
  }
}

