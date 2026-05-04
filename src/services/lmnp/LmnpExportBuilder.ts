import { createHash } from 'crypto';
import AdmZip from 'adm-zip';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getStorageService } from '@/services/storage.service';
import { buildSchedule } from '@/lib/finance/amortization';
import { aggregateLoanInterestsForProperties } from '@/services/tax/LoanInterestYearAggregator';
import {
  classifyLmnpDocument,
  classifyLmnpTransaction,
  type LmnpClassificationResolutionSource,
  type LmnpClassifierRuleInput,
} from '@/services/lmnp/LmnpExportClassifier';
import { computeLmnpSuggestion } from '@/services/lmnp/LmnpSuggestionEngine';
import { buildLmnpDocumentStorageKeyCandidates } from '@/services/lmnp/lmnpDocumentStorageKeys';
import {
  buildLmnpZipDocumentName,
  ensureUniqueJustificatifRelPath,
  ensureUniqueZipName,
  resolveJustificatifPropertySubfolder,
} from '@/services/lmnp/lmnpZipDocumentNaming';
import {
  fetchLearningPatternsForOrganization,
  incrementLearningPatternUsage,
} from '@/services/lmnp/LmnpLearningService';
import {
  buildFecSimplifiedRowsForTransaction,
  formatBalanceComptableCsv,
  formatFecSimplifiedCsv,
  type LmnpFecSimplifiedRow,
  pieceRefFromLinkedDocuments,
  readableTransactionLabelForExport,
} from '@/services/lmnp/LmnpAccountingExport';
import {
  buildDocIdToTransactionIds,
  isTransactionLinkType,
  pickPrimaryTransactionIdForDocument,
  type LmnpAttachmentExportSummary,
} from '@/services/lmnp/lmnpExportAttachments';
import {
  type LmnpDebugAttachmentsScope,
  fetchLmnpAttachmentScopeCore,
  finalizeLmnpAttachmentResolution,
} from '@/services/lmnp/lmnpExpectedAttachmentsResolver';
import {
  buildLmnpZipIntegrityV2Files,
  type LmnpJustificatifMeta,
  type LmnpZipStagingFile,
} from '@/services/lmnp/LmnpZipIntegrityV2';

export type LmnpExportMode = 'dryRun' | 'final';

export interface LmnpExportManifest {
  schemaVersion: 1;
  propertyId: string;
  propertyName: string;
  exerciseYear: number;
  organizationId: string;
  mappingVersion: string;
  generatedAt: string;
  transactionCount: number;
  documentCount: number;
  loanCount: number;
  coverageRate: number;
  anomalyCount: number;
  blockingAnomalyCount: number;
  dryRunPayloadHash: string;
  /** Intérêts d’emprunt (€ / an) depuis l’échéancier sur le périmètre export — utilisés au pilotage pour ne pas dépendre uniquement des écritures. */
  loanInterestsFromSchedule?: number;
  /** Assurance emprunteur (€ / an) depuis l’échéancier (montant assurance du modèle de prêt). */
  loanInsuranceFromSchedule?: number;
  /** Résumé par bucket LMNP */
  bucketCounts: Record<string, number>;
  exportVersion?: string;
  accountingEntriesCount?: number;
  fecBalanced?: boolean;
  fallback658Count?: number;
  files?: Array<{ filename: string; type: string; description: string }>;
  compliance?: {
    fec_format: boolean;
    double_entry: boolean;
    utf8_bom: boolean;
    balanced: boolean;
  };
  /** Résumé pièces jointes (export final / diagnostic). */
  attachmentExportSummary?: LmnpAttachmentExportSummary;
  /** Compteurs alignés sur le périmètre réel (fetch PJ), utile pour un bien isolé (ex. Deauville). */
  attachmentsExpectedForProperty?: number;
  attachmentsWrittenForProperty?: number;
  attachmentsMissingForProperty?: number;
  transactionsWithAttachmentsExpected?: number;
  transactionsWithAttachmentsWritten?: number;
  /** Multi-biens : détail par propertyId */
  attachmentCountersByPropertyId?: Record<
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
  /** Alignement liste JSON ↔ fichiers réellement ajoutés au ZIP (02_justificatifs/). */
  justificatifListedCount?: number;
  justificatifWrittenFileCount?: number;
  /** True si des PJ listées dans _lmnp_documents.json n’ont pas été écrites sans raison explicite dans export-file-integrity. */
  justificatifIntegrityMismatch?: boolean;
}

export interface LmnpExportAnomalyRow {
  entityType: string;
  entityId: string;
  severity: 'blocking' | 'warning';
  message: string;
  /** Présent quand la classification LMNP est connue (dry run / JSON API — non persisté en base sur LmnpExportAnomaly). */
  resolutionSource?: string;
  lmnpBucket?: string;
  lmnpLabel?: string;
}

export interface LmnpExportRecentRunHint {
  id: string;
  createdAt: string;
  status: string;
  anomalyCount: number;
}

/** Issue détaillée pour lmnp/v2/export-file-integrity.json — aucune PJ listée ne doit rester sans outcome explicite. */
export type LmnpJustificatifZipOutcome =
  | 'written'
  | 'missing_blob'
  | 'storage_key_missing'
  | 'read_blob_failed'
  | 'skipped_by_filter'
  | 'path_collision_resolved'
  | 'not_added_to_zip';

export interface LmnpExportDryRunResult {
  mode: 'dryRun';
  manifest: LmnpExportManifest;
  anomalies: LmnpExportAnomalyRow[];
  dryRunPayloadHash: string;
  ecrituresPreview: Array<Record<string, unknown>>;
  mappingVersion: string;
  /** Dernier run enregistré pour ce bien / exercice (information seule). */
  recentRun: LmnpExportRecentRunHint | null;
}

export interface LmnpExportFinalResult {
  mode: 'final';
  zipBuffer: Buffer;
  filename: string;
  runId: string;
  manifest: LmnpExportManifest;
}

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvEscape).join(';');
}

function withUtf8Bom(csv: string): string {
  return `\uFEFF${csv}`;
}

function displayNature(nature: string | null | undefined, amount: number): string {
  const n = (nature || '').toUpperCase();
  if (n === 'DEPENSE_LOYER' || amount < 0) return 'Dépense';
  if (n === 'RECETTE_LOYER' || amount > 0) return 'Recette';
  return n || '—';
}

function sanitizeFilenamePart(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'bien';
}

function computeDryRunPayloadHash(input: {
  propertyId: string;
  exerciseYear: number;
  mappingVersion: string;
  classifications: Array<{ id: string; bucket: string; label: string }>;
}): string {
  const parts = input.classifications
    .map((c) => `${c.id}:${c.bucket}:${c.label}`)
    .sort();
  const payload = JSON.stringify({
    propertyId: input.propertyId,
    exerciseYear: input.exerciseYear,
    mappingVersion: input.mappingVersion,
    classification: parts,
  });
  return createHash('sha256').update(payload).digest('hex');
}

export async function buildLmnpExport(input: {
  organizationId: string;
  propertyId?: string | null;
  lmnpActivityId?: string | null;
  exerciseYear: number;
  mode: LmnpExportMode;
  dryRunPayloadHash?: string | null;
  createdByUserId?: string | null;
  transientTxOverrides?: Array<{ transactionId: string; lmnpBucket: string; lmnpLabel: string }>;
  /** Inclure `lmnp/v2/debug-attachments-scope.json` (défaut true). */
  includeDebugAttachmentScope?: boolean;
}): Promise<LmnpExportDryRunResult | LmnpExportFinalResult> {
  const { organizationId, exerciseYear, mode } = input;
  const includeDebugAttachmentScope = input.includeDebugAttachmentScope !== false;
  const requestedPropertyId = input.propertyId ?? null;
  const requestedActivityId = input.lmnpActivityId ?? null;

  let scopeName = '';
  let scopeHashId = '';
  let representativePropertyId = '';
  let selectedProperties: Array<{ id: string; name: string }> = [];

  if (requestedActivityId) {
    const activity = await prisma.lmnpActivity.findFirst({
      where: { id: requestedActivityId, organizationId },
      select: { id: true, name: true, siret: true },
    });
    if (!activity) throw new Error('LMNP_ACTIVITY_NOT_FOUND');
    if (!/^\d{14}$/.test(String(activity.siret || ''))) throw new Error('LMNP_NO_SIRET_CONFIGURED');
    const props = await prisma.property.findMany({
      where: { organizationId, lmnpActivityId: requestedActivityId, isArchived: false },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    if (props.length === 0) throw new Error('LMNP_ACTIVITY_NO_PROPERTIES');
    selectedProperties = props;
    representativePropertyId = props[0].id;
    scopeName = activity.name;
    scopeHashId = `activity:${activity.id}`;
  } else if (requestedPropertyId) {
    const property = await prisma.property.findFirst({
      where: { id: requestedPropertyId, organizationId },
      select: { id: true, name: true },
    });
    if (!property) throw new Error('PROPERTY_NOT_FOUND');
    selectedProperties = [property];
    representativePropertyId = property.id;
    scopeName = property.name;
    scopeHashId = property.id;
  } else {
    throw new Error('PROPERTY_NOT_FOUND');
  }
  const propertyIds = selectedProperties.map((p) => p.id);

  const [attachmentCore, rulesDb, loans] = await Promise.all([
    fetchLmnpAttachmentScopeCore({
      prisma,
      organizationId,
      propertyIds,
      exerciseYear,
    }),
    prisma.lmnpExportMappingRule.findMany({
      where: {
        organizationId,
        exerciseYear,
        active: true,
        OR: [{ propertyId: null }, { propertyId: { in: propertyIds } }],
      },
    }),
    prisma.loan.findMany({
      where: { organizationId, propertyId: { in: propertyIds } },
      include: { LoanBorrower: true },
    }),
  ]);

  const transactions = attachmentCore.transactions;
  const txIds = attachmentCore.txIds;
  const txIdsForDocumentScope = attachmentCore.txIdsForDocumentScope;
  const parentByChild = attachmentCore.parentByChild;
  const documents = attachmentCore.documents;
  const docById = attachmentCore.docById;
  const docIdSet = attachmentCore.docIdSet;
  const docIdList = [...docIdSet];
  const allTxLinks = attachmentCore.allTxLinks;
  const docLinksByTx = attachmentCore.docLinksByTx;
  const docIdToTxIds = attachmentCore.docIdToTxIds;

  const mappingVersion =
    rulesDb.length > 0
      ? [...new Set(rulesDb.map((r) => r.mappingVersion))].sort().join(',') || '1'
      : '1';

  const rules: LmnpClassifierRuleInput[] = rulesDb.map((r) => ({
    id: r.id,
    propertyId: r.propertyId,
    natureCode: r.natureCode,
    categoryId: r.categoryId,
    lmnpBucket: r.lmnpBucket,
    lmnpLabel: r.lmnpLabel,
    priority: r.priority,
  }));

  const loanIds = loans.map((l) => l.id);

  const overrideOr: Prisma.LmnpExportOverrideWhereInput[] = [];
  if (txIds.length > 0) overrideOr.push({ transactionId: { in: txIds } });
  if (loanIds.length > 0) overrideOr.push({ loanId: { in: loanIds } });
  if (docIdList.length > 0) overrideOr.push({ documentId: { in: docIdList } });

  const overridesDb =
    overrideOr.length > 0
      ? await prisma.lmnpExportOverride.findMany({
          where: { organizationId, OR: overrideOr },
        })
      : [];

  const overridesByTransactionId = new Map<string, { lmnpBucket: string; lmnpLabel: string }>();
  const overridesByDocumentId = new Map<string, { lmnpBucket: string; lmnpLabel: string }>();
  for (const o of overridesDb) {
    if (o.transactionId) {
      overridesByTransactionId.set(o.transactionId, { lmnpBucket: o.lmnpBucket, lmnpLabel: o.lmnpLabel });
    }
    if (o.documentId) {
      overridesByDocumentId.set(o.documentId, { lmnpBucket: o.lmnpBucket, lmnpLabel: o.lmnpLabel });
    }
  }
  // Overrides transitoires (stateless) prioritaires sur les règles persistées.
  for (const o of input.transientTxOverrides || []) {
    overridesByTransactionId.set(o.transactionId, { lmnpBucket: o.lmnpBucket, lmnpLabel: o.lmnpLabel });
  }

  const learningPatterns = await fetchLearningPatternsForOrganization(organizationId).catch(() => []);

  const txByDocId = new Map<string, string>();
  for (const d of documents) {
    const primary = pickPrimaryTransactionIdForDocument(d, txIds, docLinksByTx);
    if (primary) txByDocId.set(d.id, primary);
  }

  for (const l of allTxLinks) {
    if (!isTransactionLinkType(l.linkedType)) continue;
    if (!docById.has(l.documentId)) {
      anomalies.push({
        entityType: 'document_link',
        entityId: `${l.documentId}_${l.linkedId}`,
        severity: 'warning',
        message: `Lien transaction → document orphelin : document « ${l.documentId} » absent de l’export (transaction liée ${l.linkedId}).`,
      });
    }
  }

  const docPieceRefById = new Map(
    [...docById.entries()].map(([id, d]) => [
      id,
      { filenameOriginal: d.filenameOriginal, fileName: d.fileName },
    ]),
  );

  const ecrituresRows: string[] = [];
  /** Lignes type FEC simplifié (ZIP final uniquement). */
  const fecSimplifiedRows: LmnpFecSimplifiedRow[] = [];
  const ecrituresPreview: Array<Record<string, unknown>> = [];
  const classificationByTxId = new Map<
    string,
    { bucket: string; label: string; resolutionSource: LmnpClassificationResolutionSource }
  >();
  const header = buildCsvRow([
    'Date',
    'Libellé',
    'Montant',
    'Type',
    'Catégorie',
  ]);
  ecrituresRows.push(header);

  const classifications: Array<{ id: string; bucket: string; label: string }> = [];
  const bucketCounts: Record<string, number> = {};
  const anomalies: LmnpExportAnomalyRow[] = [];
  const learningUsageIds: string[] = [];

  for (const tx of transactions) {
    const cls = classifyLmnpTransaction(
      {
        id: tx.id,
        propertyId: tx.propertyId,
        nature: tx.nature,
        categoryId: tx.categoryId,
      },
      overridesByTransactionId,
      rules
    );
    classifications.push({ id: tx.id, bucket: cls.bucket, label: cls.label });
    classificationByTxId.set(tx.id, {
      bucket: cls.bucket,
      label: cls.label,
      resolutionSource: cls.resolutionSource,
    });
    bucketCounts[cls.bucket] = (bucketCounts[cls.bucket] || 0) + 1;

    if (cls.resolutionSource === 'fallback') {
      anomalies.push({
        entityType: 'transaction',
        entityId: tx.id,
        severity: 'blocking',
        message: `Aucune règle LMNP ne couvre cette transaction pour l’exercice ${exerciseYear}. Nature « ${tx.nature ?? '—'} », catégorie « ${tx.categoryId ?? '—'} ». Ajoutez une règle de mapping (admin) ou un override pour exporter.`,
        resolutionSource: cls.resolutionSource,
        lmnpBucket: cls.bucket,
        lmnpLabel: cls.label,
      });
    }

    const linkedDocIds = docLinksByTx.get(tx.id) || [];

    const linkedDocs = linkedDocIds
      .map((docId) => docById.get(docId))
      .filter((d): d is NonNullable<typeof d> => Boolean(d))
      .map((d) => ({
        id: d.id,
        filename: d.filenameOriginal || d.fileName,
        documentTypeCode: d.DocumentType?.code || undefined,
        documentTypeLabel: d.DocumentType?.label || undefined,
        ocrTextPreview: d.extractedText ? d.extractedText.slice(0, 180) : undefined,
        confidence: d.ocrConfidence ?? undefined,
      }));

    const suggestion = computeLmnpSuggestion({
      natureCode: tx.nature,
      categoryId: tx.categoryId,
      categorySlug: tx.Category?.slug,
      transactionLabel: tx.label,
      linkedDocuments: linkedDocs.map((d) => ({
        id: d.id,
        filename: d.filename,
        documentTypeCode: d.documentTypeCode,
        documentTypeLabel: d.documentTypeLabel,
        ocrText: d.ocrTextPreview,
      })),
      learningPatterns,
    });
    if (suggestion.matchedLearningPatternId) {
      learningUsageIds.push(suggestion.matchedLearningPatternId);
    }

    const row = buildCsvRow([
      tx.date.toISOString().slice(0, 10),
      readableTransactionLabelForExport({
        label: tx.label,
        transaction_label: tx.label,
        accounting_month: tx.accounting_month,
        date: tx.date,
        amount: tx.amount,
        Category: tx.Category,
      }),
      tx.amount,
      displayNature(tx.nature, Number(tx.amount) || 0),
      tx.Category?.label ?? '',
    ]);
    ecrituresRows.push(row);
    if (ecrituresPreview.length < 100) {
      ecrituresPreview.push({
        transaction_id: tx.id,
        accounting_month: tx.accounting_month ?? '',
        transaction_label: tx.label,
        amount: tx.amount,
        nature_code: tx.nature ?? '',
        category_id: tx.categoryId ?? '',
        category_slug: tx.Category?.slug ?? '',
        category_label: tx.Category?.label ?? '',
        lmnp_bucket: cls.bucket,
        lmnp_label: cls.label,
        resolution_source: cls.resolutionSource,
        linkedDocuments: linkedDocs,
        suggestion: {
          suggestedBucket: suggestion.suggestedBucket,
          suggestedLabel: suggestion.suggestedLabel,
          suggestedNatureCode: suggestion.suggestedNatureCode,
          suggestedCategoryId: suggestion.suggestedCategoryId,
          confidence: suggestion.confidence,
          reason: suggestion.reason,
          source: suggestion.source,
        },
      });
    }
  }

  if (learningUsageIds.length > 0) {
    await incrementLearningPatternUsage(learningUsageIds).catch(() => {});
  }

  const classificationBlockingCount = anomalies.filter((a) => a.severity === 'blocking').length;
  const coverageRate =
    transactions.length === 0
      ? 1
      : (transactions.length - classificationBlockingCount) / transactions.length;

  const storage = getStorageService();
  const justificatifFiles: Array<{ path: string; buffer: Buffer }> = [];
  const justificatifMetaSuccess: LmnpJustificatifMeta[] = [];
  const missingAttachmentRows: LmnpAttachmentExportSummary['missing'] = [];
  const documentLmnpMeta: Array<{
    document_id: string;
    original_filename: string;
    zip_filename: string;
    expected_zip_path: string;
    document_type_code?: string;
    document_type_label?: string;
    transaction_id?: string;
    transaction_label?: string;
    transaction_amount?: number;
    linked_transaction_ids?: string[];
    lmnp_bucket: string;
    lmnp_label: string;
    confidence: number;
    classification_source: string;
  }> = [];
  const usedZipDocNames = new Set<string>();
  const usedJustificatifRelPaths = new Set<string>();
  const firstZipNameByTxId = new Map<string, string>();
  const firstDocDateByTxId = new Map<string, Date>();
  const writtenDocumentIds = new Set<string>();
  const missingDocumentIds = new Set<string>();
  const justificatifIntegrityRows: Array<{
    documentId: string;
    zip_filename: string;
    expectedPath: string;
    actualPath?: string;
    storageKey?: string;
    keyUsed?: string;
    storageKeysAttempted?: string[];
    bucket?: string;
    /** Backing réel côté serveur ; `indexeddb` uniquement après réparation client. */
    sourceAttempted: 'supabase' | 'local_fs';
    fallbackUsed: boolean;
    originalFilename?: string;
    errorMessage?: string;
    downloadAttempts?: Array<{ key: string; error: string }>;
    outcome: LmnpJustificatifZipOutcome;
    detail?: string;
  }> = [];

  const storageBackingLabel: 'supabase' | 'local_fs' =
    (process.env.STORAGE_TYPE || 'local') === 'supabase' ? 'supabase' : 'local_fs';
  const bucketLabel =
    storageBackingLabel === 'supabase'
      ? process.env.SUPABASE_STORAGE_BUCKET || 'documents'
      : 'local_storage';

  for (const doc of documents) {
    const fallbackLabel = doc.DocumentType?.label || doc.filenameOriginal || doc.fileName;
    const docCls = classifyLmnpDocument(doc.id, overridesByDocumentId, fallbackLabel);
    const txId = txByDocId.get(doc.id) || doc.transactionId || undefined;
    const tx = txId ? transactions.find((t) => t.id === txId) : null;
    const propertyNameForZip =
      tx?.Property?.name ||
      (doc.propertyId
        ? selectedProperties.find((p) => p.id === doc.propertyId)?.name
        : undefined) ||
      scopeName ||
      'LMNP';
    const suggestedZipBase = buildLmnpZipDocumentName({
      accountingMonth: tx?.accounting_month ?? null,
      transactionDate: tx?.date ?? null,
      exerciseYear,
      transactionAmount: typeof tx?.amount === 'number' ? tx.amount : null,
      propertyName: propertyNameForZip,
      documentTypeLabel: doc.DocumentType?.label || undefined,
      originalFilename: doc.filenameOriginal || doc.fileName || 'fichier.pdf',
    });
    const uniqueZipName = ensureUniqueZipName(suggestedZipBase, usedZipDocNames);
    const propertyFolder = resolveJustificatifPropertySubfolder({
      doc,
      tx,
      selectedProperties,
      scopeName,
    });
    const relPathBase = `02_justificatifs/${propertyFolder}${uniqueZipName}`;
    const { path: relPath, collisionResolved } = ensureUniqueJustificatifRelPath(
      relPathBase,
      usedJustificatifRelPaths,
    );
    const zipFilenameFinal = relPath.slice(relPath.lastIndexOf('/') + 1);
    if (txId && !firstZipNameByTxId.has(txId)) {
      firstZipNameByTxId.set(txId, zipFilenameFinal);
    }
    if (txId && !firstDocDateByTxId.has(txId)) {
      firstDocDateByTxId.set(txId, doc.uploadedAt);
    }
    const linkedTxIds = docIdToTxIds.get(doc.id) || [];
    documentLmnpMeta.push({
      document_id: doc.id,
      original_filename: doc.filenameOriginal || doc.fileName,
      zip_filename: zipFilenameFinal,
      expected_zip_path: relPath,
      document_type_code: doc.DocumentType?.code || undefined,
      document_type_label: doc.DocumentType?.label || undefined,
      transaction_id: tx?.id || undefined,
      transaction_label: tx?.label || undefined,
      transaction_amount: typeof tx?.amount === 'number' ? tx.amount : undefined,
      linked_transaction_ids: linkedTxIds,
      lmnp_bucket: docCls.bucket,
      lmnp_label: docCls.label,
      confidence: docCls.confidence,
      classification_source: docCls.resolutionSource,
    });

    const pushIntegrity = (
      outcome: LmnpJustificatifZipOutcome,
      extra?: Partial<(typeof justificatifIntegrityRows)[number]>,
    ) => {
      justificatifIntegrityRows.push({
        documentId: doc.id,
        zip_filename: zipFilenameFinal,
        expectedPath: relPath,
        sourceAttempted: storageBackingLabel,
        bucket: bucketLabel,
        fallbackUsed: false,
        originalFilename: doc.filenameOriginal || doc.fileName,
        outcome,
        ...extra,
      });
    };

    if (!doc.bucketKey || String(doc.bucketKey).trim() === '') {
      missingDocumentIds.add(doc.id);
      missingAttachmentRows.push({
        transactionId: txId,
        documentId: doc.id,
        reason: 'storage_key_missing',
        detail: 'bucketKey absent pour lecture stockage',
      });
      pushIntegrity('storage_key_missing', {
        detail: 'Document sans bucketKey — fichier distant introuvable.',
        storageKeysAttempted: [],
        errorMessage: 'bucketKey absent',
      });
      anomalies.push({
        entityType: 'document',
        entityId: doc.id,
        severity: 'warning',
        message: `Clé de stockage absente pour le document ${doc.id} (${doc.fileName}) — pièce non incluse dans le ZIP.`,
        resolutionSource: docCls.resolutionSource,
        lmnpBucket: docCls.bucket,
        lmnpLabel: docCls.label,
      });
      continue;
    }

    const keyCandidates = buildLmnpDocumentStorageKeyCandidates({
      bucketKey: doc.bucketKey,
      documentId: doc.id,
      filenameOriginal: doc.filenameOriginal,
      fileName: doc.fileName,
      normalizeBucketKey: (k, id, fn) => storage.normalizeBucketKey(k, id, fn),
      generateStorageKey: (id, fn) => storage.generateStorageKey(id, fn),
    });

    const primaryKeyHint = storage.normalizeBucketKey(
      doc.bucketKey,
      doc.id,
      doc.filenameOriginal || doc.fileName,
    );

    const dl = await storage.downloadDocumentFirstKeyWorking(keyCandidates, {
      documentId: doc.id,
      originalFilename: doc.filenameOriginal || doc.fileName,
    });

    if (dl.ok) {
      writtenDocumentIds.add(doc.id);
      justificatifFiles.push({ path: relPath, buffer: dl.buffer });
      justificatifMetaSuccess.push({
        zipPath: relPath,
        documentId: doc.id,
        organizationId,
        storageKey: dl.keyUsed,
        filename: doc.filenameOriginal || doc.fileName,
        mime: doc.mime,
        primaryTransactionId: txId,
        linkedTransactionIds: linkedTxIds,
        buffer: dl.buffer,
      });
      pushIntegrity(collisionResolved ? 'path_collision_resolved' : 'written', {
        actualPath: relPath,
        storageKey: primaryKeyHint,
        keyUsed: dl.keyUsed,
        storageKeysAttempted: keyCandidates,
        downloadAttempts: dl.attempts.map((a) => ({
          key: a.key,
          error: a.error || 'ok',
        })),
        detail: collisionResolved
          ? `Chemin rendu unique pour éviter écrasement dans le ZIP. Clé lue : ${dl.keyUsed}`
          : `Clé stockage utilisée : ${dl.keyUsed}`,
      });
    } else {
      missingDocumentIds.add(doc.id);
      const attempts = dl.attempts;
      const readableErr = attempts.map((a) => `${a.key} → ${a.error}`).join(' | ');
      missingAttachmentRows.push({
        transactionId: txId,
        documentId: doc.id,
        reason: 'blob_unreadable',
        detail: readableErr.slice(0, 2000),
      });
      pushIntegrity('read_blob_failed', {
        storageKey: primaryKeyHint,
        storageKeysAttempted: keyCandidates,
        downloadAttempts: attempts,
        errorMessage: readableErr.slice(0, 4000),
        detail: readableErr.slice(0, 2000),
      });
      anomalies.push({
        entityType: 'document',
        entityId: doc.id,
        severity: 'warning',
        message: `Stockage : impossible de lire le document ${doc.id} (${doc.fileName}). Bucket « ${bucketLabel} ». Tentatives : ${readableErr.slice(0, 500)}`,
        resolutionSource: docCls.resolutionSource,
        lmnpBucket: docCls.bucket,
        lmnpLabel: docCls.label,
      });
    }
  }

  const justificatifListedCount = documentLmnpMeta.length;
  const justificatifWrittenFileCount = justificatifFiles.length;
  const successOutcomes: LmnpJustificatifZipOutcome[] = ['written', 'path_collision_resolved'];
  const writtenPathsFromIntegrity = new Set(
    justificatifIntegrityRows
      .filter((r) => successOutcomes.includes(r.outcome))
      .map((r) => r.actualPath || r.expectedPath),
  );
  let justificatifIntegrityInternalError = false;
  if (justificatifIntegrityRows.length !== documents.length || justificatifIntegrityRows.length !== justificatifListedCount) {
    justificatifIntegrityInternalError = true;
    anomalies.push({
      entityType: 'export_lmnp',
      entityId: 'justificatif_integrity',
      severity: 'blocking',
      message: `Bug export LMNP : nombre de lignes d’intégrité (${justificatifIntegrityRows.length}) ≠ documents (${documents.length}).`,
    });
  }
  const nSuccessRows = justificatifIntegrityRows.filter((r) => successOutcomes.includes(r.outcome)).length;
  if (nSuccessRows !== justificatifWrittenFileCount) {
    justificatifIntegrityInternalError = true;
    anomalies.push({
      entityType: 'export_lmnp',
      entityId: 'justificatif_integrity',
      severity: 'blocking',
      message: `Incohérence interne : ${nSuccessRows} PJ marquées écrites dans l’intégrité vs ${justificatifWrittenFileCount} fichier(s) dans le ZIP.`,
    });
  }
  for (const f of justificatifFiles) {
    if (!writtenPathsFromIntegrity.has(f.path)) {
      justificatifIntegrityInternalError = true;
      anomalies.push({
        entityType: 'export_lmnp',
        entityId: 'justificatif_zip',
        severity: 'blocking',
        message: `Fichier ZIP sans trace d’intégrité : ${f.path}`,
      });
    }
  }
  for (const r of justificatifIntegrityRows) {
    if (!successOutcomes.includes(r.outcome)) continue;
    const p = r.actualPath || r.expectedPath;
    if (!justificatifFiles.some((x) => x.path === p)) {
      justificatifIntegrityInternalError = true;
      anomalies.push({
        entityType: 'export_lmnp',
        entityId: r.documentId,
        severity: 'blocking',
        message: `Intégrité annonce l’écriture de ${p} mais le buffer est absent du tableau justificatifFiles.`,
      });
    }
  }

  const exportFileIntegrityJson = JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      exerciseYear,
      organizationId,
      storageEnv: {
        STORAGE_TYPE: process.env.STORAGE_TYPE || 'local',
        bucket: bucketLabel,
        hasSupabaseServiceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      },
      listedDocuments: documentLmnpMeta.map((m) => ({
        documentId: m.document_id,
        zip_filename: m.zip_filename,
        expectedPath: m.expected_zip_path,
      })),
      writtenFiles: justificatifFiles.map((f) => f.path),
      missingFiles: justificatifIntegrityRows
        .filter((r) => r.outcome !== 'written' && r.outcome !== 'path_collision_resolved')
        .map((r) => ({
          documentId: r.documentId,
          expectedPath: r.expectedPath,
          reason: r.outcome,
          detail: r.detail ?? null,
          storageKey: r.storageKey ?? null,
          keyUsed: r.keyUsed ?? null,
          storageKeysAttempted: r.storageKeysAttempted ?? null,
          errorMessage: r.errorMessage ?? null,
          sourceAttempted: r.sourceAttempted,
          bucket: r.bucket,
          fallbackUsed: r.fallbackUsed,
        })),
      missingByReason: justificatifIntegrityRows.reduce<Record<string, number>>((acc, r) => {
        if (r.outcome === 'written' || r.outcome === 'path_collision_resolved') return acc;
        acc[r.outcome] = (acc[r.outcome] || 0) + 1;
        return acc;
      }, {}),
      rows: justificatifIntegrityRows,
      summary: {
        documentsListedCount: justificatifListedCount,
        justificatifFilesWrittenCount: justificatifWrittenFileCount,
      },
    },
    null,
    2,
  );

  const totalLinkRefs = [...docLinksByTx.values()].reduce((acc, arr) => acc + arr.length, 0);
  const uniqueLinkedDocs = new Set([...docLinksByTx.values()].flat()).size;
  const attachmentFinalize = finalizeLmnpAttachmentResolution(
    attachmentCore,
    writtenDocumentIds,
    missingDocumentIds
  );

  const debugAttachmentScope: LmnpDebugAttachmentsScope = {
    ...attachmentFinalize.debugScope,
    transactions: attachmentFinalize.debugScope.transactions.map((row) => {
      const cls = classificationByTxId.get(row.transactionId);
      if (!cls) {
        return {
          ...row,
          includedInLmnp: false,
          includedInLmnpReason: 'Transaction absente du classifieur (anomalie interne).',
        };
      }
      return {
        ...row,
        includedInLmnp: cls.resolutionSource !== 'fallback',
        includedInLmnpReason:
          cls.resolutionSource === 'fallback'
            ? 'Aucune règle LMNP (bucket A_CLASSER) — les pièces jointes restent exportées si présentes en base.'
            : `Classée LMNP : ${cls.bucket} / ${cls.label} (source ${cls.resolutionSource}).`,
      };
    }),
  };

  const attachmentSummary: LmnpAttachmentExportSummary = {
    transactionsExported: transactions.length,
    documentsLinkedDistinct: documents.length,
    attachmentsExpected: attachmentFinalize.counters.attachmentsExpected,
    attachmentsWritten: attachmentFinalize.counters.attachmentsWritten,
    attachmentsMissing: attachmentFinalize.counters.attachmentsMissing,
    attachmentsDeduplicated: Math.max(0, totalLinkRefs - uniqueLinkedDocs),
    missing: missingAttachmentRows,
  };

  if (process.env.NODE_ENV === 'development') {
    console.log('[LmnpExport] pièces jointes', attachmentSummary, attachmentFinalize.debugScope.perProperty);
  }

  // Construction FEC après nommage des justificatifs pour garantir PieceRef = nom exact du ZIP.
  let ecritureNum = 1;
  for (const tx of transactions) {
    const cls = classificationByTxId.get(tx.id);
    if (!cls) continue;
    const linkedDocIds = docLinksByTx.get(tx.id) || [];
    const fallbackPieceRef = pieceRefFromLinkedDocuments(linkedDocIds, docPieceRefById);
    const pieceRef = firstZipNameByTxId.get(tx.id) || fallbackPieceRef;
    const entries = buildFecSimplifiedRowsForTransaction(
      {
        label: tx.label,
        transaction_label: tx.label,
        accounting_month: tx.accounting_month,
        date: tx.date,
        paidAt: tx.paidAt ?? null,
        pieceDate: firstDocDateByTxId.get(tx.id) ?? null,
        lmnpBucket: cls.bucket,
        amount: tx.amount,
        Category: tx.Category,
      },
      cls.bucket,
      pieceRef,
      `LMNP-${exerciseYear}-${String(ecritureNum).padStart(4, '0')}`,
    );
    fecSimplifiedRows.push(...entries);
    ecritureNum += 1;
  }

  const fecTotals = fecSimplifiedRows.reduce(
    (acc, row) => {
      acc.debit += Number(row.debit) || 0;
      acc.credit += Number(row.credit) || 0;
      if (row.compteNum === '658') acc.fallback658Count += 1;
      return acc;
    },
    { debit: 0, credit: 0, fallback658Count: 0 },
  );
  const totalDebit = Math.round((fecTotals.debit + Number.EPSILON) * 100) / 100;
  const totalCredit = Math.round((fecTotals.credit + Number.EPSILON) * 100) / 100;
  const fecBalanced = Math.abs(totalDebit - totalCredit) < 0.005;

  const pretLines: string[] = [];
  pretLines.push(
    buildCsvRow([
      'loan_id',
      'label',
      'schedule_date',
      'payment_total',
      'payment_interest',
      'payment_principal',
      'payment_insurance',
      'remaining_capital',
    ])
  );

  for (const loan of loans) {
    const principal = Number(loan.principal);
    const annualRatePct = Number(loan.annualRatePct);
    const insurancePct = loan.insurancePct != null ? Number(loan.insurancePct) : 0;
    try {
      const schedule = buildSchedule({
        principal,
        annualRatePct,
        durationMonths: loan.durationMonths,
        defermentMonths: loan.defermentMonths ?? 0,
        insurancePct,
        startDate: loan.startDate,
        paymentDay: loan.paymentDay ?? undefined,
      });
      for (const row of schedule) {
        if (!row.date.startsWith(String(exerciseYear))) continue;
        pretLines.push(
          buildCsvRow([
            loan.id,
            loan.label,
            row.date,
            row.paymentTotal,
            row.paymentInterest,
            row.paymentPrincipal,
            row.paymentInsurance,
            row.remainingCapital,
          ])
        );
      }
    } catch {
      anomalies.push({
        entityType: 'loan',
        entityId: loan.id,
        severity: 'warning',
        message: `Échéancier non généré pour le prêt ${loan.id} (${loan.label}).`,
      });
    }
  }

  const interestAgg = aggregateLoanInterestsForProperties(
    loans.map((l) => ({
      id: l.id,
      propertyId: l.propertyId,
      label: l.label,
      principal: l.principal,
      annualRatePct: l.annualRatePct,
      durationMonths: l.durationMonths,
      defermentMonths: l.defermentMonths,
      insurancePct: l.insurancePct,
      startDate: l.startDate,
      endDate: l.endDate,
      paymentDay: l.paymentDay,
      repaymentType: l.repaymentType,
      amortizationProfile: l.amortizationProfile,
      rateType: l.rateType,
    })),
    exerciseYear,
    propertyIds,
  );

  const resumePretJson = JSON.stringify(
    {
      exerciseYear,
      propertyId: representativePropertyId,
      aggregation: interestAgg,
    },
    null,
    2
  );

  const anomalyCsvRows: string[] = [];
  anomalyCsvRows.push(buildCsvRow(['entity_type', 'entity_id', 'severity', 'message']));
  for (const a of anomalies) {
    anomalyCsvRows.push(buildCsvRow([a.entityType, a.entityId, a.severity, a.message]));
  }

  const dryRunPayloadHash = computeDryRunPayloadHash({
    propertyId: scopeHashId,
    exerciseYear,
    mappingVersion,
    classifications,
  });

  const blockingAnomalyCount = anomalies.filter((a) => a.severity === 'blocking').length;

  const manifest: LmnpExportManifest = {
    schemaVersion: 1,
    exportVersion: '2.0-expert-ready',
    propertyId: representativePropertyId,
    propertyName: scopeName,
    exerciseYear,
    organizationId,
    mappingVersion,
    generatedAt: new Date().toISOString(),
    transactionCount: transactions.length,
    documentCount: documents.length,
    loanCount: loans.length,
    loanInterestsFromSchedule: interestAgg.totalInteretsEmprunt,
    loanInsuranceFromSchedule: interestAgg.totalAssuranceEmprunteur,
    coverageRate,
    anomalyCount: anomalies.length,
    blockingAnomalyCount: blockingAnomalyCount,
    dryRunPayloadHash,
    bucketCounts,
    accountingEntriesCount: fecSimplifiedRows.length,
    fecBalanced,
    fallback658Count: fecTotals.fallback658Count,
    compliance: {
      fec_format: true,
      double_entry: true,
      utf8_bom: true,
      balanced: fecBalanced,
    },
    attachmentExportSummary: attachmentSummary,
    justificatifListedCount,
    justificatifWrittenFileCount,
    justificatifIntegrityMismatch: justificatifIntegrityInternalError,
    attachmentCountersByPropertyId: attachmentFinalize.counters.byProperty,
    attachmentsExpectedForProperty:
      attachmentFinalize.counters.byProperty[representativePropertyId]?.attachmentsExpected,
    attachmentsWrittenForProperty:
      attachmentFinalize.counters.byProperty[representativePropertyId]?.attachmentsWritten,
    attachmentsMissingForProperty:
      attachmentFinalize.counters.byProperty[representativePropertyId]?.attachmentsMissing,
    transactionsWithAttachmentsExpected:
      attachmentFinalize.counters.byProperty[representativePropertyId]?.transactionsWithAttachmentsExpected,
    transactionsWithAttachmentsWritten:
      attachmentFinalize.counters.byProperty[representativePropertyId]?.transactionsWithAttachmentsWritten,
    files: [
      { filename: '01_ecritures.csv', type: 'transactions', description: 'Export lisible des écritures LMNP' },
      { filename: '02_justificatifs/', type: 'documents', description: 'Pièces justificatives renommées' },
      { filename: '03_pret/echeancier_lignes.csv', type: 'loans', description: 'Échéancier des prêts' },
      { filename: '04_anomalies.csv', type: 'quality', description: 'Anomalies détectées pendant l’export' },
      { filename: '05_ecritures_comptables.csv', type: 'accounting', description: 'FEC simplifié en double écriture' },
      { filename: '06_balance_comptable.csv', type: 'accounting', description: 'Balance par compte avec solde' },
      { filename: '00_CONTROLE_EXPORT_LMNP.csv', type: 'quality', description: 'Contrôles automatiques de cohérence' },
      { filename: '07_resume_lmnp.csv', type: 'summary', description: 'Synthèse loyers / charges / résultat net' },
      { filename: 'manifest.json', type: 'metadata', description: 'Métadonnées de génération de l’export' },
      { filename: 'lmnp/v2/manifest.v2.json', type: 'integrity', description: 'Manifest d’intégrité export LMNP (V2)' },
      { filename: 'lmnp/v2/checksums.sha256', type: 'integrity', description: 'Empreintes SHA-256 des fichiers du ZIP (hors manifest V2)' },
      { filename: 'lmnp/v2/objects/index.ndjson', type: 'integrity', description: 'Index objets (pièces jointes)' },
      { filename: 'lmnp/v2/attachment_report.json', type: 'integrity', description: 'Rapport pièces jointes attendues / écrites / manquantes' },
      {
        filename: 'lmnp/v2/export-file-integrity.json',
        type: 'integrity',
        description: 'Liste des PJ listées vs fichiers réellement écrits dans le ZIP (par raison si manquant)',
      },
      ...(includeDebugAttachmentScope
        ? [
            {
              filename: 'lmnp/v2/debug-attachments-scope.json',
              type: 'debug',
              description: 'Diagnostic périmètre transactions / documents / PJ',
            },
          ]
        : []),
    ],
  };

  const manifestJson = JSON.stringify(manifest, null, 2);
  const globalStatus =
    blockingAnomalyCount > 0 ? 'ERROR' : fecTotals.fallback658Count > 0 ? 'WARNING' : 'OK';
  const controleRows: string[] = [];
  controleRows.push(buildCsvRow(['Statut global', globalStatus, globalStatus]));
  controleRows.push(buildCsvRow(['Controle', 'Statut', 'Detail']));
  controleRows.push(buildCsvRow(['Encodage UTF-8 BOM', 'OK', 'CSV exportés avec BOM UTF-8']));
  controleRows.push(buildCsvRow(['Nombre de transactions exportées', 'OK', String(transactions.length)]));
  controleRows.push(
    buildCsvRow([
      'Pièces jointes écrites / attendues',
      attachmentSummary.attachmentsMissing === 0 ? 'OK' : 'A vérifier',
      `${attachmentSummary.attachmentsWritten}/${attachmentSummary.attachmentsExpected} (dédup liens: ${attachmentSummary.attachmentsDeduplicated})`,
    ]),
  );
  controleRows.push(
    buildCsvRow([
      '_lmnp_documents.json vs fichiers binaires ZIP',
      justificatifIntegrityInternalError ? 'KO' : 'OK',
      `${justificatifWrittenFileCount}/${justificatifListedCount} fichier(s) ; détail lmnp/v2/export-file-integrity.json`,
    ]),
  );
  controleRows.push(buildCsvRow(['Nombre d’écritures comptables', 'OK', String(fecSimplifiedRows.length)]));
  controleRows.push(
    buildCsvRow([
      'Equilibre FEC',
      fecBalanced ? 'OK' : 'KO',
      `Debit=${totalDebit.toFixed(2)} Credit=${totalCredit.toFixed(2)}`,
    ]),
  );
  controleRows.push(
    buildCsvRow([
      'Fallback 658',
      fecTotals.fallback658Count === 0 ? 'OK' : 'A vérifier',
      `${fecTotals.fallback658Count} ligne(s)`,
    ]),
  );
  controleRows.push(
    buildCsvRow([
      'Anomalies bloquantes',
      blockingAnomalyCount === 0 ? 'OK' : 'KO',
      String(blockingAnomalyCount),
    ]),
  );
  controleRows.push(buildCsvRow(['Génération du manifest', 'OK', 'manifest.json']));

  const totalLoyers = Math.round(
    (transactions
      .filter((t) => (classificationByTxId.get(t.id)?.bucket || '').includes('RECETTES'))
      .reduce((s, t) => s + Math.max(Number(t.amount) || 0, 0), 0) *
      100 +
      Number.EPSILON) /
      100,
  );
  const totalCharges = Math.round(
    (transactions
      .filter((t) => (classificationByTxId.get(t.id)?.bucket || '').includes('CHARGES'))
      .reduce((s, t) => s + Math.abs(Math.min(Number(t.amount) || 0, 0)), 0) *
      100 +
      Number.EPSILON) /
      100,
  );
  const resumeRows: string[] = [];
  resumeRows.push(buildCsvRow(['Indicateur', 'Montant']));
  resumeRows.push(buildCsvRow(['Loyers encaissés', totalLoyers]));
  resumeRows.push(buildCsvRow(['Charges totales', totalCharges]));
  resumeRows.push(buildCsvRow(['Résultat net', Math.round((totalLoyers - totalCharges) * 100) / 100]));

  if (mode === 'dryRun') {
    const lastRun = await prisma.lmnpExportRun.findFirst({
      where: { organizationId, propertyId: representativePropertyId, exerciseYear },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, status: true, anomalyCount: true },
    });

    return {
      mode: 'dryRun',
      manifest,
      anomalies,
      dryRunPayloadHash,
      ecrituresPreview,
      mappingVersion,
      recentRun: lastRun
        ? {
            id: lastRun.id,
            createdAt: lastRun.createdAt.toISOString(),
            status: lastRun.status,
            anomalyCount: lastRun.anomalyCount,
          }
        : null,
    };
  }

  if (!input.dryRunPayloadHash || input.dryRunPayloadHash !== dryRunPayloadHash) {
    throw new Error('DRY_RUN_HASH_MISMATCH');
  }
  if (blockingAnomalyCount > 0) {
    throw new Error('BLOCKING_ANOMALIES');
  }

  const run = await prisma.lmnpExportRun.create({
    data: {
      organizationId,
      propertyId: representativePropertyId,
      exerciseYear,
      mappingVersion,
      status: 'completed',
      coverageRate,
      anomalyCount: anomalies.length,
      manifestJson,
      createdByUserId: input.createdByUserId ?? null,
      Anomalies: {
        create: anomalies.map((a) => ({
          entityType: a.entityType,
          entityId: a.entityId,
          severity: a.severity,
          message: a.message,
        })),
      },
    },
  });

  const zipStagingCore: LmnpZipStagingFile[] = [
    { path: '01_ecritures.csv', buffer: Buffer.from(withUtf8Bom(ecrituresRows.join('\n')), 'utf8') },
    { path: '00_CONTROLE_EXPORT_LMNP.csv', buffer: Buffer.from(withUtf8Bom(controleRows.join('\n')), 'utf8') },
    { path: '07_resume_lmnp.csv', buffer: Buffer.from(withUtf8Bom(resumeRows.join('\n')), 'utf8') },
    {
      path: '05_ecritures_comptables.csv',
      buffer: Buffer.from(withUtf8Bom(formatFecSimplifiedCsv(fecSimplifiedRows, buildCsvRow)), 'utf8'),
    },
    {
      path: '06_balance_comptable.csv',
      buffer: Buffer.from(withUtf8Bom(formatBalanceComptableCsv(fecSimplifiedRows, buildCsvRow)), 'utf8'),
    },
    { path: '04_anomalies.csv', buffer: Buffer.from(withUtf8Bom(anomalyCsvRows.join('\n')), 'utf8') },
    { path: 'manifest.json', buffer: Buffer.from(manifestJson, 'utf8') },
    { path: '03_pret/resume_interets_assurance.json', buffer: Buffer.from(resumePretJson, 'utf8') },
    { path: '03_pret/echeancier_lignes.csv', buffer: Buffer.from(withUtf8Bom(pretLines.join('\n')), 'utf8') },
    {
      path: '02_justificatifs/_lmnp_documents.json',
      buffer: Buffer.from(JSON.stringify(documentLmnpMeta, null, 2), 'utf8'),
    },
    ...justificatifFiles,
    {
      path: 'lmnp/v2/export-file-integrity.json',
      buffer: Buffer.from(exportFileIntegrityJson, 'utf8'),
    },
    ...(includeDebugAttachmentScope
      ? [
          {
            path: 'lmnp/v2/debug-attachments-scope.json',
            buffer: Buffer.from(JSON.stringify(debugAttachmentScope, null, 2), 'utf8'),
          },
        ]
      : []),
  ];

  const lmnpV2Files = buildLmnpZipIntegrityV2Files({
    stagingFiles: zipStagingCore,
    justificatifs: justificatifMetaSuccess,
    organizationId,
    exerciseYear,
    summary: attachmentSummary,
  });

  const zip = new AdmZip();
  for (const f of [...zipStagingCore, ...lmnpV2Files]) {
    zip.addFile(f.path, f.buffer);
  }

  const filename = `LMNP_${sanitizeFilenamePart(scopeName)}_${exerciseYear}.zip`;
  const zipBuffer = zip.toBuffer();

  return {
    mode: 'final',
    zipBuffer,
    filename,
    runId: run.id,
    manifest,
  };
}
