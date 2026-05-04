/**
 * Résolution centralisée des documents / PJ pour l’export LMNP (serveur).
 * Couvre : liens DocumentLink (casse hétérogène), FK Document.transactionId,
 * et pièces rattachées à la transaction mère (commissions auto).
 */

export const LMNP_TRANSACTION_LINK_TYPES = ['transaction', 'Transaction', 'TRANSACTION'] as const;

export const LMNP_LOAN_LINK_TYPES = ['loan', 'Loan', 'LOAN'] as const;

export function isTransactionLinkType(linkedType: string | null | undefined): boolean {
  return String(linkedType || '').toLowerCase() === 'transaction';
}

/** Même heuristique que documentLinksService (IndexedDB) pour hériter des PJ parent. */
export function shouldIncludeParentTransactionDocuments(tx: {
  parentTransactionId?: string | null;
  isAuto?: boolean | null;
  autoSource?: string | null;
  label?: string | null;
}): boolean {
  if (!tx.parentTransactionId) return false;
  const autoSource = String(tx.autoSource || '').toLowerCase();
  if (tx.isAuto === true) return true;
  if (autoSource.includes('commission')) return true;
  if (String(tx.label || '').toLowerCase().includes('commission')) return true;
  return false;
}

/**
 * IDs de transactions à interroger pour liens + FK document.transactionId
 * (exportées + parents éventuels pour commissions auto).
 */
export function expandTransactionIdsForLmnpDocuments(
  transactions: Array<{
    id: string;
    parentTransactionId?: string | null;
    isAuto?: boolean | null;
    autoSource?: string | null;
    label?: string | null;
  }>
): string[] {
  const ids = new Set<string>();
  for (const t of transactions) {
    ids.add(t.id);
    if (shouldIncludeParentTransactionDocuments(t) && t.parentTransactionId) {
      ids.add(t.parentTransactionId);
    }
  }
  return [...ids];
}

export function buildParentTransactionMap(
  transactions: Array<{
    id: string;
    parentTransactionId?: string | null;
    isAuto?: boolean | null;
    autoSource?: string | null;
    label?: string | null;
  }>
): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of transactions) {
    if (shouldIncludeParentTransactionDocuments(t) && t.parentTransactionId) {
      m.set(t.id, t.parentTransactionId);
    }
  }
  return m;
}

/**
 * Pour chaque transaction **exportée**, liste des documentIds (liens + FK + héritage parent).
 */
export function buildDocLinksByExportedTransaction(
  exportedTxIds: string[],
  parentByChild: Map<string, string>,
  allTxLinks: ReadonlyArray<{ documentId: string; linkedId: string; linkedType: string }>,
  documents: ReadonlyArray<{ id: string; transactionId: string | null }>
): Map<string, string[]> {
  const out = new Map<string, Set<string>>();
  for (const id of exportedTxIds) out.set(id, new Set());

  for (const l of allTxLinks) {
    if (!isTransactionLinkType(l.linkedType)) continue;
    for (const txId of exportedTxIds) {
      if (l.linkedId === txId) {
        out.get(txId)!.add(l.documentId);
      }
      const parentId = parentByChild.get(txId);
      if (parentId && l.linkedId === parentId) {
        out.get(txId)!.add(l.documentId);
      }
    }
  }

  for (const d of documents) {
    if (!d.transactionId) continue;
    for (const txId of exportedTxIds) {
      if (d.transactionId === txId) out.get(txId)!.add(d.id);
      const parentId = parentByChild.get(txId);
      if (parentId && d.transactionId === parentId) {
        out.get(txId)!.add(d.id);
      }
    }
  }

  return new Map([...out].map(([k, set]) => [k, [...set]]));
}

export function pickPrimaryTransactionIdForDocument(
  doc: { id: string; transactionId: string | null },
  exportedTxIds: string[],
  docLinksByTx: Map<string, string[]>
): string | undefined {
  if (doc.transactionId && exportedTxIds.includes(doc.transactionId)) {
    return doc.transactionId;
  }
  for (const txId of exportedTxIds) {
    if ((docLinksByTx.get(txId) || []).includes(doc.id)) return txId;
  }
  return doc.transactionId || undefined;
}

export function buildDocIdToTransactionIds(
  documents: ReadonlyArray<{ id: string; transactionId: string | null }>,
  allTxLinks: ReadonlyArray<{ documentId: string; linkedId: string; linkedType: string }>
): Map<string, string[]> {
  const m = new Map<string, Set<string>>();
  for (const d of documents) {
    if (!m.has(d.id)) m.set(d.id, new Set());
    if (d.transactionId) m.get(d.id)!.add(d.transactionId);
  }
  for (const l of allTxLinks) {
    if (!isTransactionLinkType(l.linkedType)) continue;
    if (!m.has(l.documentId)) m.set(l.documentId, new Set());
    m.get(l.documentId)!.add(l.linkedId);
  }
  return new Map([...m].map(([k, s]) => [k, [...s]]));
}

export type LmnpAttachmentExportSummary = {
  transactionsExported: number;
  documentsLinkedDistinct: number;
  attachmentsExpected: number;
  attachmentsWritten: number;
  attachmentsMissing: number;
  attachmentsDeduplicated: number;
  missing: Array<{
    transactionId?: string;
    documentId: string;
    reason: 'blob_unreadable' | 'document_deleted_or_filtered' | 'orphan_link';
    detail?: string;
  }>;
};
