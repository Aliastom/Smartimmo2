import type { LocalDocument } from '@/lib/offline/db';

export type DocumentPilotageProblemKind = 'ocr_failed' | 'missing_file' | 'orphan' | 'unclassified';

export interface DocumentPilotagePreviewItem {
  documentId: string;
  /** Ligne 1 : nom fichier ou intitulé du manque */
  titleLine: string;
  /** Ligne 2 contexte : bien / bail */
  contextLine: string;
  problemKind: DocumentPilotageProblemKind;
  problemLine: string;
  badge: 'danger' | 'warning';
  /** « ajouter » = lien / compléter dossier ; « corriger » = OCR / classement / fichier */
  cta: 'ajouter' | 'corriger';
  priority: number;
}

export interface DocumentPilotageCounts {
  /** Documents sans aucun DocumentLink (hors supprimés). */
  sansLiaison: number;
  ocrEchoue: number;
  sansPiece: number;
  nonClasses: number;
}

const SCORE: Record<DocumentPilotageProblemKind, number> = {
  ocr_failed: 100,
  missing_file: 85,
  orphan: 55,
  unclassified: 40,
};

function isMissingFile(doc: LocalDocument): boolean {
  return !doc.url || String(doc.url).trim() === '';
}

function isOrphan(docId: string, documentsWithLinks: Set<string>): boolean {
  return !documentsWithLinks.has(docId);
}

function isUnclassified(doc: LocalDocument, orphan: boolean): boolean {
  if (doc.deletedAt || doc.status === 'draft') return false;
  if (orphan) return false;
  return doc.status === 'pending' || (doc.status === 'active' && !doc.documentTypeId);
}

/**
 * Compteurs globaux + jusqu’à `maxItems` lignes prioritaires (qualité des données).
 */
export function buildDocumentPilotagePreview(
  allDocuments: LocalDocument[],
  documentsWithLinks: Set<string>,
  maxItems = 5
): { counts: DocumentPilotageCounts; items: DocumentPilotagePreviewItem[] } {
  const activeNotDeleted = allDocuments.filter((d) => !d.deletedAt);

  let sansLiaison = 0;
  let ocrEchoue = 0;
  let sansPiece = 0;
  let nonClasses = 0;

  const candidates: DocumentPilotagePreviewItem[] = [];

  for (const doc of activeNotDeleted) {
    const orphan = isOrphan(doc.id, documentsWithLinks);
    const missing = isMissingFile(doc);
    const ocrFail = doc.ocrStatus === 'failed';
    const uncl = isUnclassified(doc, orphan) && !missing;

    if (orphan) sansLiaison += 1;
    if (ocrFail) ocrEchoue += 1;
    if (missing) sansPiece += 1;
    if (
      !orphan &&
      !missing &&
      (doc.status === 'pending' || (doc.status === 'active' && !doc.documentTypeId))
    ) {
      nonClasses += 1;
    }

    let kind: DocumentPilotageProblemKind | null = null;
    if (ocrFail) kind = 'ocr_failed';
    else if (missing) kind = 'missing_file';
    else if (orphan) kind = 'orphan';
    else if (uncl) kind = 'unclassified';

    if (!kind) continue;

    const titleLine =
      doc.filenameOriginal || doc.fileName || 'Document sans titre';

    const problemLine =
      kind === 'ocr_failed'
        ? 'OCR échoué'
        : kind === 'missing_file'
          ? 'Aucune pièce jointe'
          : kind === 'orphan'
            ? 'Non rattaché à un bien ou un bail'
            : 'Document non classé';

    const badge: 'danger' | 'warning' =
      kind === 'ocr_failed' || kind === 'missing_file' ? 'danger' : 'warning';

    const cta: 'ajouter' | 'corriger' = kind === 'orphan' ? 'ajouter' : 'corriger';

    const uploaded = new Date(doc.uploadedAt || doc.createdAt || 0).getTime();

    candidates.push({
      documentId: doc.id,
      titleLine,
      contextLine: '—',
      problemKind: kind,
      problemLine,
      badge,
      cta,
      priority: SCORE[kind] * 1e10 + uploaded,
    });
  }

  candidates.sort((a, b) => b.priority - a.priority);

  const seen = new Set<string>();
  const items: DocumentPilotagePreviewItem[] = [];
  for (const row of candidates) {
    if (items.length >= maxItems) break;
    if (seen.has(row.documentId)) continue;
    seen.add(row.documentId);
    items.push(row);
  }

  return {
    counts: { sansLiaison, ocrEchoue, sansPiece, nonClasses },
    items,
  };
}
