'use client';

import { useCallback, useEffect, useState } from 'react';
import { getLocalDB } from '@/lib/offline/db';
import type { LocalDocument } from '@/lib/offline/db';
import {
  buildDocumentPilotagePreview,
  type DocumentPilotageCounts,
  type DocumentPilotagePreviewItem,
} from '@/features/documents/utils/buildDocumentPilotagePreview';
import type { DocumentTableRow } from '@/features/documents/hooks/useDocumentsData';

export interface UseDocumentsPilotagePreviewResult {
  counts: DocumentPilotageCounts;
  items: DocumentPilotagePreviewItem[];
  /** Pour ouvrir le drawer / édition même si le doc n’est pas sur la page courante */
  docRowsById: Record<string, DocumentTableRow>;
  loading: boolean;
  refresh: () => void;
}

function contextFromLinks(
  docId: string,
  links: Array<{ documentId: string; linkedType: string; linkedId: string; entityName?: string | null }>,
  propertyNames: Map<string, string>,
  leaseLabels: Map<string, string>
): string {
  const docLinks = links.filter((l) => l.documentId === docId);
  if (docLinks.length === 0) return 'Aucune liaison';

  const parts: string[] = [];
  for (const link of docLinks) {
    const t = (link.linkedType || '').toLowerCase();
    const id = link.linkedId;
    if (!id || id === 'global') continue;

    if (link.entityName) {
      parts.push(link.entityName);
      continue;
    }
    if (t === 'property') {
      parts.push(propertyNames.get(id) ?? 'Bien');
    } else if (t === 'lease') {
      parts.push(leaseLabels.get(id) ?? 'Bail');
    } else if (t === 'transaction') {
      parts.push('Transaction');
    } else {
      parts.push(t);
    }
  }

  if (parts.length === 0) return 'Liaison incomplète';
  return [...new Set(parts)].slice(0, 2).join(' · ');
}

export function useDocumentsPilotagePreview(
  mode: 'normal' | 'app-shell',
  organizationId: string | null
): UseDocumentsPilotagePreviewResult {
  const [counts, setCounts] = useState<DocumentPilotageCounts>({
    sansLiaison: 0,
    ocrEchoue: 0,
    sansPiece: 0,
    nonClasses: 0,
  });
  const [items, setItems] = useState<DocumentPilotagePreviewItem[]>([]);
  const [docRowsState, setDocRowsState] = useState<Record<string, DocumentTableRow>>({});
  const [loading, setLoading] = useState(mode === 'app-shell');

  const load = useCallback(async () => {
    if (mode !== 'app-shell' || !organizationId) {
      setCounts({ sansLiaison: 0, ocrEchoue: 0, sansPiece: 0, nonClasses: 0 });
      setItems([]);
      setDocRowsState({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const db = await getLocalDB();
      const allDocs = await db.Document.where('organizationId').equals(organizationId).toArray();
      const allLinks = await db.DocumentLink.toArray();
      const documentsWithLinks = new Set(allLinks.map((l) => l.documentId));

      const { counts: c, items: raw } = buildDocumentPilotagePreview(allDocs as LocalDocument[], documentsWithLinks, 5);

      const propertyIds = new Set<string>();
      const leaseIds = new Set<string>();
      for (const link of allLinks) {
        const t = link.linkedType?.toLowerCase();
        if (t === 'property' && link.linkedId) propertyIds.add(link.linkedId);
        if (t === 'lease' && link.linkedId) leaseIds.add(link.linkedId);
      }

      const [properties, leases] = await Promise.all([
        propertyIds.size > 0 ? db.Property.where('id').anyOf([...propertyIds]).toArray() : [],
        leaseIds.size > 0 ? db.Lease.where('id').anyOf([...leaseIds]).toArray() : [],
      ]);

      const propertyNames = new Map(properties.map((p) => [p.id, p.name ?? 'Bien']));
      const leaseLabels = new Map(leases.map((l) => [l.id, 'Bail']));

      const enriched = raw.map((row) => ({
        ...row,
        contextLine: contextFromLinks(row.documentId, allLinks as any, propertyNames, leaseLabels),
      }));

      const documentTypeIds = new Set(
        enriched
          .map((row) => allDocs.find((d) => d.id === row.documentId)?.documentTypeId)
          .filter((id): id is string => !!id)
      );
      const documentTypes =
        documentTypeIds.size > 0
          ? await db.DocumentType.where('id').anyOf([...documentTypeIds]).toArray()
          : [];
      const documentTypeMap = new Map(documentTypes.map((dt) => [dt.id, dt]));

      let transactions: any[] = [];
      const transactionIds = new Set<string>();
      for (const link of allLinks) {
        if (link.linkedType?.toLowerCase() === 'transaction' && link.linkedId && link.linkedId !== 'global') {
          transactionIds.add(link.linkedId);
        }
      }
      if (transactionIds.size > 0) {
        try {
          let transactionTable = (db as any).Transaction;
          if (!transactionTable || typeof transactionTable.where !== 'function') {
            const foundTable = db.tables.find((t: any) => t.name === 'Transaction');
            if (foundTable && typeof foundTable.where === 'function') transactionTable = foundTable;
          }
          if (transactionTable && typeof transactionTable.where === 'function') {
            transactions = await transactionTable.where('id').anyOf([...transactionIds]).toArray();
          }
        } catch {
          transactions = [];
        }
      }
      const transactionMap = new Map(transactions.map((t) => [t.id, t.label || `Transaction ${String(t.id).slice(0, 8)}`]));

      const docRowsById: Record<string, DocumentTableRow> = {};
      for (const row of enriched) {
        const doc = allDocs.find((d) => d.id === row.documentId);
        if (!doc) continue;
        const docLinks = allLinks.filter((l) => l.documentId === doc.id);
        const docWithRelations = { ...doc } as any;
        if (doc.documentTypeId && documentTypeMap.has(doc.documentTypeId)) {
          const docType = documentTypeMap.get(doc.documentTypeId)!;
          docWithRelations.DocumentType = { id: docType.id, label: docType.label, code: docType.code };
        }
        if (docLinks.length > 0) {
          docWithRelations.DocumentLink = docLinks.map((link) => {
            const linkedTypeLower = link.linkedType.toLowerCase();
            let entityName = link.entityName;
            if (!entityName && link.linkedId && link.linkedId !== 'global') {
              if (linkedTypeLower === 'transaction') entityName = transactionMap.get(link.linkedId);
              else if (linkedTypeLower === 'property') entityName = propertyNames.get(link.linkedId);
              else if (linkedTypeLower === 'lease') entityName = leaseLabels.get(link.linkedId);
            }
            return {
              id: `${link.documentId}-${link.linkedType}-${link.linkedId}`,
              linkedType: linkedTypeLower,
              linkedId: link.linkedId,
              entityName: entityName || undefined,
            };
          });
        }
        docRowsById[doc.id] = docWithRelations as DocumentTableRow;
      }

      setCounts(c);
      setItems(enriched);
      setDocRowsState(docRowsById);
    } catch (e) {
      console.error('[useDocumentsPilotagePreview]', e);
      setCounts({ sansLiaison: 0, ocrEchoue: 0, sansPiece: 0, nonClasses: 0 });
      setItems([]);
      setDocRowsState({});
    } finally {
      setLoading(false);
    }
  }, [mode, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (mode !== 'app-shell') return;
    const onRefresh = () => void load();
    window.addEventListener('documents:refresh', onRefresh);
    window.addEventListener('sync:refresh', onRefresh);
    return () => {
      window.removeEventListener('documents:refresh', onRefresh);
      window.removeEventListener('sync:refresh', onRefresh);
    };
  }, [mode, load]);

  return { counts, items, docRowsById: docRowsState, loading, refresh: load };
}
