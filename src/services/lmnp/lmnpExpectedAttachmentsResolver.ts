/**
 * Périmètre PJ pour export LMNP serveur : indépendant du classement LMNP / buckets.
 * Transactions = bien + exercice (accounting_month OU date si mois comptable vide).
 */

import type { Prisma } from '@prisma/client';
import type { Document, PrismaClient, Transaction } from '@prisma/client';
import {
  buildDocIdToTransactionIds,
  buildDocLinksByExportedTransaction,
  buildParentTransactionMap,
  expandTransactionIdsForLmnpDocuments,
  isTransactionLinkType,
  LMNP_LOAN_LINK_TYPES,
  LMNP_TRANSACTION_LINK_TYPES,
  pickPrimaryTransactionIdForDocument,
} from '@/services/lmnp/lmnpExportAttachments';

export const LMNP_PROPERTY_LINK_TYPES = ['property', 'Property', 'PROPERTY'] as const;

export function transactionWhereExerciseYearOnProperties(
  organizationId: string,
  propertyIds: string[],
  exerciseYear: number
): Prisma.TransactionWhereInput {
  const yearStart = new Date(Date.UTC(exerciseYear, 0, 1, 0, 0, 0, 0));
  const yearEnd = new Date(Date.UTC(exerciseYear, 11, 31, 23, 59, 59, 999));
  const prefix = `${exerciseYear}-`;
  return {
    organizationId,
    propertyId: { in: propertyIds },
    OR: [
      { accounting_month: { startsWith: prefix } },
      {
        AND: [
          { date: { gte: yearStart, lte: yearEnd } },
          { OR: [{ accounting_month: null }, { accounting_month: '' }] },
        ],
      },
    ],
  };
}

export type LmnpExpectedAttachmentDebugRow = {
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  documentTitle?: string;
  documentTypeCode?: string;
  documentTransactionIdFk: string | null;
  linkedTransactionIds: string[];
  sources: Array<'document_link' | 'document_transaction_fk' | 'parent_inheritance'>;
  status: 'expected' | 'written' | 'missing_blob' | 'filtered_out' | 'orphan_link' | 'duplicate';
  reason: string;
  propertyIdsFromTransactions: string[];
};

export type LmnpDebugAttachmentsScope = {
  generatedAt: string;
  exerciseYear: number;
  organizationId: string;
  propertyIds: string[];
  noteIndexedDb: string;
  transactions: Array<{
    transactionId: string;
    propertyId: string;
    date: string;
    accounting_month: string | null;
    label: string | null;
    amount: unknown;
    nature: string | null;
    categorySlug: string | null;
    categoryLabel: string | null;
    includedInExerciseScope: boolean;
    inclusionReason: string;
    documentIdsFromLinks: string[];
    documentIdsFromFk: string[];
    documentIdsInheritedFromParent: string[];
    lmnpClassificationNote: string;
    /** Renseigné à l’export : mapping fiscal LMNP (règle / override) ou fallback A_CLASSER. */
    includedInLmnp?: boolean;
    includedInLmnpReason?: string;
  }>;
  documents: LmnpExpectedAttachmentDebugRow[];
  perProperty: Record<
    string,
    {
      propertyName?: string;
      transactionsInScope: number;
      transactionsWithAtLeastOneExpectedAttachment: number;
      attachmentsExpected: number;
      attachmentsWritten: number;
      attachmentsMissing: number;
      transactionsWithAttachmentsWritten: number;
    }
  >;
};

export type LmnpTransactionWithRel = Transaction & {
  Category: { id: string; slug: string; label: string } | null;
  Property: { id: string; name: string } | null;
};

export type LmnpDocumentWithType = Document & {
  DocumentType: { code: string; label: string } | null;
};

export type LmnpAttachmentScopeCore = {
  organizationId: string;
  propertyIds: string[];
  exerciseYear: number;
  transactions: LmnpTransactionWithRel[];
  txIds: string[];
  txIdsForDocumentScope: string[];
  parentByChild: Map<string, string>;
  documents: LmnpDocumentWithType[];
  docById: Map<string, LmnpDocumentWithType>;
  docIdSet: Set<string>;
  allTxLinks: Array<{ linkedId: string; documentId: string; linkedType: string }>;
  docLinksByTx: Map<string, string[]>;
  docIdToTxIds: Map<string, string[]>;
  txDocLinks: Map<string, Set<string>>;
  txDocFk: Map<string, Set<string>>;
  txDocInherited: Map<string, Set<string>>;
};

export type ResolveLmnpExpectedAttachmentsResult = {
  transactions: LmnpTransactionWithRel[];
  txIds: string[];
  txIdsForDocumentScope: string[];
  parentByChild: Map<string, string>;
  documents: LmnpDocumentWithType[];
  docById: Map<string, LmnpDocumentWithType>;
  docIdSet: Set<string>;
  allTxLinks: Array<{ linkedId: string; documentId: string; linkedType: string }>;
  docLinksByTx: Map<string, string[]>;
  docIdToTxIds: Map<string, string[]>;
  debugScope: LmnpDebugAttachmentsScope;
  counters: {
    attachmentsExpected: number;
    attachmentsWritten: number;
    attachmentsMissing: number;
    transactionsWithAttachmentsExpected: number;
    transactionsWithAttachmentsWritten: number;
    byProperty: Record<
      string,
      {
        propertyName?: string;
        attachmentsExpected: number;
        attachmentsWritten: number;
        attachmentsMissing: number;
        transactionsWithAttachmentsExpected: number;
        transactionsWithAttachmentsWritten: number;
      }
    >;
  };
};

function documentTouchesProperty(
  docId: string,
  propertyId: string,
  transactions: Array<{ id: string; propertyId: string }>,
  docLinksByTx: Map<string, string[]>,
  documents: Array<{ id: string; transactionId: string | null }>
): boolean {
  const txIdsOfProp = new Set(transactions.filter((t) => t.propertyId === propertyId).map((t) => t.id));
  const doc = documents.find((d) => d.id === docId);
  if (!doc) return false;
  if (doc.transactionId && txIdsOfProp.has(doc.transactionId)) return true;
  for (const tid of txIdsOfProp) {
    if ((docLinksByTx.get(tid) || []).includes(docId)) return true;
  }
  return false;
}

export async function fetchLmnpAttachmentScopeCore(input: {
  prisma: PrismaClient;
  organizationId: string;
  propertyIds: string[];
  exerciseYear: number;
}): Promise<LmnpAttachmentScopeCore> {
  const { prisma, organizationId, propertyIds, exerciseYear } = input;

  const transactions = (await prisma.transaction.findMany({
    where: transactionWhereExerciseYearOnProperties(organizationId, propertyIds, exerciseYear),
    include: {
      Category: { select: { id: true, slug: true, label: true } },
      Property: { select: { id: true, name: true } },
    },
    orderBy: [{ accounting_month: 'asc' }, { date: 'asc' }],
  })) as LmnpTransactionWithRel[];

  const txIds = transactions.map((t) => t.id);
  const txIdsForDocumentScope = expandTransactionIdsForLmnpDocuments(transactions);
  const parentByChild = buildParentTransactionMap(transactions);

  const linkOr: Prisma.DocumentLinkWhereInput[] = [];
  if (propertyIds.length === 1) {
    linkOr.push({ linkedType: { in: [...LMNP_PROPERTY_LINK_TYPES] }, linkedId: propertyIds[0] });
  } else {
    linkOr.push({
      linkedType: { in: [...LMNP_PROPERTY_LINK_TYPES] },
      linkedId: { in: propertyIds },
    });
  }
  if (txIdsForDocumentScope.length > 0) {
    linkOr.push({
      linkedType: { in: [...LMNP_TRANSACTION_LINK_TYPES] },
      linkedId: { in: txIdsForDocumentScope },
    });
  }

  const loanRows = await prisma.loan.findMany({
    where: { organizationId, propertyId: { in: propertyIds } },
    select: { id: true },
  });
  const loanIds = loanRows.map((l) => l.id);
  if (loanIds.length > 0) {
    linkOr.push({ linkedType: { in: [...LMNP_LOAN_LINK_TYPES] }, linkedId: { in: loanIds } });
  }

  const documentLinks = await prisma.documentLink.findMany({
    where: { OR: linkOr },
    select: { documentId: true, linkedId: true, linkedType: true },
  });

  const docIdSet = new Set(documentLinks.map((l) => l.documentId));

  if (txIdsForDocumentScope.length > 0) {
    const directTxDocs = await prisma.document.findMany({
      where: {
        organizationId,
        deletedAt: null,
        transactionId: { in: txIdsForDocumentScope },
      },
      select: { id: true },
    });
    for (const d of directTxDocs) docIdSet.add(d.id);
  }

  const documents =
    docIdSet.size > 0
      ? await prisma.document.findMany({
          where: {
            id: { in: [...docIdSet] },
            organizationId,
            deletedAt: null,
          },
          include: {
            DocumentType: { select: { code: true, label: true } },
          },
        })
      : [];

  const docById = new Map(documents.map((d) => [d.id, d]));

  const allTxLinks =
    txIdsForDocumentScope.length > 0
      ? await prisma.documentLink.findMany({
          where: {
            linkedId: { in: txIdsForDocumentScope },
            linkedType: { in: [...LMNP_TRANSACTION_LINK_TYPES] },
          },
          select: { linkedId: true, documentId: true, linkedType: true },
        })
      : [];

  const docLinksByTx = buildDocLinksByExportedTransaction(
    txIds,
    parentByChild,
    allTxLinks,
    documents.map((d) => ({ id: d.id, transactionId: d.transactionId }))
  );

  const docIdToTxIds = buildDocIdToTransactionIds(
    documents.map((d) => ({ id: d.id, transactionId: d.transactionId })),
    allTxLinks
  );

  const txDocLinks = new Map<string, Set<string>>();
  const txDocFk = new Map<string, Set<string>>();
  const txDocInherited = new Map<string, Set<string>>();
  for (const t of transactions) {
    txDocLinks.set(t.id, new Set());
    txDocFk.set(t.id, new Set());
    txDocInherited.set(t.id, new Set());
  }
  for (const l of allTxLinks) {
    if (!isTransactionLinkType(l.linkedType)) continue;
    const doc = docById.get(l.documentId);
    if (!doc) continue;
    for (const tx of transactions) {
      if (l.linkedId === tx.id) txDocLinks.get(tx.id)?.add(l.documentId);
      const p = parentByChild.get(tx.id);
      if (p && l.linkedId === p) txDocInherited.get(tx.id)?.add(l.documentId);
    }
  }
  for (const d of documents) {
    if (!d.transactionId) continue;
    for (const tx of transactions) {
      if (d.transactionId === tx.id) txDocFk.get(tx.id)?.add(d.id);
      const p = parentByChild.get(tx.id);
      if (p && d.transactionId === p) txDocInherited.get(tx.id)?.add(d.id);
    }
  }

  return {
    organizationId,
    propertyIds,
    exerciseYear,
    transactions,
    txIds,
    txIdsForDocumentScope,
    parentByChild,
    documents,
    docById,
    docIdSet,
    allTxLinks,
    docLinksByTx,
    docIdToTxIds,
    txDocLinks,
    txDocFk,
    txDocInherited,
  };
}

export function finalizeLmnpAttachmentResolution(
  core: LmnpAttachmentScopeCore,
  writtenDocumentIds: ReadonlySet<string>,
  missingDocumentIds: ReadonlySet<string>
): Pick<ResolveLmnpExpectedAttachmentsResult, 'debugScope' | 'counters'> {
  const {
    transactions,
    documents,
    docById,
    docLinksByTx,
    docIdToTxIds,
    allTxLinks,
    parentByChild,
    txIds,
    txDocLinks,
    txDocFk,
    txDocInherited,
    organizationId,
    propertyIds,
    exerciseYear,
  } = core;

  const debugDocuments: LmnpExpectedAttachmentDebugRow[] = [];
  for (const doc of documents) {
    const linkedTxIds = docIdToTxIds.get(doc.id) || [];
    const hasLink = allTxLinks.some(
      (l) => l.documentId === doc.id && isTransactionLinkType(l.linkedType)
    );
    const hasFk = Boolean(doc.transactionId);
    const sources: LmnpExpectedAttachmentDebugRow['sources'] = [];
    if (hasLink) sources.push('document_link');
    if (hasFk) sources.push('document_transaction_fk');
    if (
      doc.transactionId &&
      [...parentByChild.values()].includes(doc.transactionId) &&
      !txIds.includes(doc.transactionId)
    ) {
      sources.push('parent_inheritance');
    }

    let status: LmnpExpectedAttachmentDebugRow['status'] = 'expected';
    let reason = 'Document dans le périmètre export.';
    if (missingDocumentIds.has(doc.id)) {
      status = 'missing_blob';
      reason = 'Blob illisible ou vide côté storage.';
    } else if (writtenDocumentIds.has(doc.id)) {
      status = 'written';
      reason = 'Fichier écrit dans le ZIP.';
    }

    const propsFromTx = linkedTxIds
      .map((tid) => transactions.find((x) => x.id === tid)?.propertyId)
      .filter(Boolean) as string[];

    debugDocuments.push({
      documentId: doc.id,
      filename: doc.filenameOriginal || doc.fileName,
      mimeType: doc.mime,
      size: doc.size,
      storageKey: doc.bucketKey,
      documentTitle: doc.DocumentType?.label || undefined,
      documentTypeCode: doc.DocumentType?.code || undefined,
      documentTransactionIdFk: doc.transactionId,
      linkedTransactionIds: linkedTxIds,
      sources,
      status,
      reason,
      propertyIdsFromTransactions: [...new Set(propsFromTx)],
    });
  }

  const debugTransactions = transactions.map((t) => ({
    transactionId: t.id,
    propertyId: t.propertyId,
    date: t.date.toISOString(),
    accounting_month: t.accounting_month ?? null,
    label: t.label,
    amount: t.amount,
    nature: t.nature,
    categorySlug: t.Category?.slug ?? null,
    categoryLabel: t.Category?.label ?? null,
    includedInExerciseScope: true,
    inclusionReason:
      t.accounting_month && t.accounting_month.startsWith(`${exerciseYear}-`)
        ? `accounting_month commence par ${exerciseYear}-`
        : 'date dans l’exercice et accounting_month vide ou absent (fallback)',
    documentIdsFromLinks: [...(txDocLinks.get(t.id) || [])],
    documentIdsFromFk: [...(txDocFk.get(t.id) || [])],
    documentIdsInheritedFromParent: [...(txDocInherited.get(t.id) || [])],
    lmnpClassificationNote:
      'Le périmètre PJ est indépendant du classement LMNP (bucket, déductibilité, anomalies export).',
  }));

  const propertyNameById = new Map<string, string | undefined>();
  for (const t of transactions) {
    if (t.propertyId) propertyNameById.set(t.propertyId, t.Property?.name || undefined);
  }

  const perProperty: LmnpDebugAttachmentsScope['perProperty'] = {};
  const byProperty: ResolveLmnpExpectedAttachmentsResult['counters']['byProperty'] = {};

  for (const pid of propertyIds) {
    const txsProp = transactions.filter((t) => t.propertyId === pid);
    const txIdSet = new Set(txsProp.map((t) => t.id));

    const docIdsForProp = new Set<string>();
    for (const doc of documents) {
      if (documentTouchesProperty(doc.id, pid, transactions, docLinksByTx, documents)) {
        docIdsForProp.add(doc.id);
      }
    }

    let written = 0;
    let missing = 0;
    for (const did of docIdsForProp) {
      if (writtenDocumentIds.has(did)) written += 1;
      if (missingDocumentIds.has(did)) missing += 1;
    }

    const txWithExpected = [...txIdSet].filter((tid) => {
      const fromLinks = (docLinksByTx.get(tid) || []).length > 0;
      const fromFk = documents.some((d) => d.transactionId === tid);
      return fromLinks || fromFk;
    }).length;

    const txWithWritten = [...txIdSet].filter((tid) => {
      const linkWritten = (docLinksByTx.get(tid) || []).some((did) => writtenDocumentIds.has(did));
      const fkWritten = documents.some(
        (d) => d.transactionId === tid && writtenDocumentIds.has(d.id)
      );
      return linkWritten || fkWritten;
    }).length;

    perProperty[pid] = {
      propertyName: propertyNameById.get(pid),
      transactionsInScope: txsProp.length,
      transactionsWithAtLeastOneExpectedAttachment: txWithExpected,
      attachmentsExpected: docIdsForProp.size,
      attachmentsWritten: written,
      attachmentsMissing: missing,
      transactionsWithAttachmentsWritten: txWithWritten,
    };

    byProperty[pid] = {
      propertyName: propertyNameById.get(pid),
      attachmentsExpected: docIdsForProp.size,
      attachmentsWritten: written,
      attachmentsMissing: missing,
      transactionsWithAttachmentsExpected: txWithExpected,
      transactionsWithAttachmentsWritten: txWithWritten,
    };
  }

  const debugScope: LmnpDebugAttachmentsScope = {
    generatedAt: new Date().toISOString(),
    exerciseYear,
    organizationId,
    propertyIds,
    noteIndexedDb:
      'Export serveur Prisma/Storage uniquement. Les liaisons exclusivement locales (IndexedDB non synchronisées) n’apparaissent pas ici.',
    transactions: debugTransactions,
    documents: debugDocuments,
    perProperty,
  };

  const counters: ResolveLmnpExpectedAttachmentsResult['counters'] = {
    attachmentsExpected: documents.length,
    attachmentsWritten: writtenDocumentIds.size,
    attachmentsMissing: missingDocumentIds.size,
    transactionsWithAttachmentsExpected: txIds.filter(
      (tid) => (docLinksByTx.get(tid) || []).length > 0 || documents.some((d) => d.transactionId === tid)
    ).length,
    transactionsWithAttachmentsWritten: txIds.filter((tid) => {
      const linkWritten = (docLinksByTx.get(tid) || []).some((did) => writtenDocumentIds.has(did));
      const fkWritten = documents.some(
        (d) => d.transactionId === tid && writtenDocumentIds.has(d.id)
      );
      return linkWritten || fkWritten;
    }).length,
    byProperty,
  };

  return { debugScope, counters };
}

export async function resolveLmnpExpectedAttachmentsForPropertyYear(input: {
  prisma: PrismaClient;
  organizationId: string;
  propertyIds: string[];
  exerciseYear: number;
  writtenDocumentIds: ReadonlySet<string>;
  missingDocumentIds: ReadonlySet<string>;
}): Promise<ResolveLmnpExpectedAttachmentsResult> {
  const core = await fetchLmnpAttachmentScopeCore(input);
  const { debugScope, counters } = finalizeLmnpAttachmentResolution(
    core,
    input.writtenDocumentIds,
    input.missingDocumentIds
  );
  return {
    transactions: core.transactions,
    txIds: core.txIds,
    txIdsForDocumentScope: core.txIdsForDocumentScope,
    parentByChild: core.parentByChild,
    documents: core.documents,
    docById: core.docById,
    docIdSet: core.docIdSet,
    allTxLinks: core.allTxLinks,
    docLinksByTx: core.docLinksByTx,
    docIdToTxIds: core.docIdToTxIds,
    debugScope,
    counters,
  };
}
