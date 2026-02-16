/**
 * Hook pour la modale "Lier document existant".
 * Pagination serveur (online) ou IndexedDB (offline), recherche par nom/type, filtre par type, tri par date décroissante.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { getLocalDB } from '@/lib/offline/db';
import type { LocalDocument } from '@/lib/offline/db';
import type { CachedDocumentType } from '@/lib/offline/db';

const PAGE_SIZE = 20;

export interface DocumentForLink {
  id: string;
  fileName: string;
  filenameOriginal: string | null;
  documentTypeId: string | null;
  typeLabel: string;
  uploadedAt: string;
  status?: string;
  mime?: string;
}

export interface UseDocumentsForLinkModalOptions {
  mode: 'normal' | 'app-shell';
  organizationId: string | null;
  /** IDs à exclure (déjà liés) */
  excludeIds?: string[];
  /** Déclencher le chargement (ex: modal ouverte) */
  enabled?: boolean;
}

export interface UseDocumentsForLinkModalResult {
  documents: DocumentForLink[];
  documentTypes: { id: string; code: string; label: string }[];
  loading: boolean;
  error: string | null;
  page: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
  setPage: (p: number) => void;
  setQuery: (q: string) => void;
  setTypeId: (id: string) => void;
  query: string;
  typeId: string;
  refetch: () => void;
}

export function useDocumentsForLinkModal(
  options: UseDocumentsForLinkModalOptions
): UseDocumentsForLinkModalResult {
  const {
    mode,
    organizationId,
    excludeIds = [],
    enabled = true,
  } = options;

  const [documents, setDocuments] = useState<DocumentForLink[]>([]);
  const [documentTypes, setDocumentTypes] = useState<{ id: string; code: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [typeId, setTypeId] = useState('');
  const [total, setTotal] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!enabled || !organizationId) {
      setDocuments([]);
      setTotal(0);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (mode === 'app-shell') {
          const db = await getLocalDB();
          const excludeSet = new Set(excludeIds);

          // Charger les types pour le filtre
          const types = await db.DocumentType.toArray();
          const typeList = types
            .filter((t: CachedDocumentType) => t.isActive !== false)
            .map((t: CachedDocumentType) => ({ id: t.id, code: t.code, label: t.label || t.code }));
          if (!cancelled) setDocumentTypes(typeList);

          let q = db.Document.where('organizationId').equals(organizationId)
            .filter((doc: LocalDocument) => !doc.deletedAt && !excludeSet.has(doc.id));

          if (query.trim()) {
            const searchLower = query.trim().toLowerCase();
            q = q.filter((doc: LocalDocument) =>
              (doc.fileName?.toLowerCase().includes(searchLower)) ||
              (doc.filenameOriginal?.toLowerCase().includes(searchLower)) ||
              (doc.tags?.toLowerCase().includes(searchLower))
            );
          }
          if (typeId) {
            q = q.filter((doc: LocalDocument) => doc.documentTypeId === typeId);
          }

          const all = await q.toArray();
          all.sort((a: LocalDocument, b: LocalDocument) => {
            const da = new Date(a.uploadedAt || a.createdAt || 0).getTime();
            const db_ = new Date(b.uploadedAt || b.createdAt || 0).getTime();
            return db_ - da;
          });

          const totalCount = all.length;
          const offset = (page - 1) * PAGE_SIZE;
          const pageDocs = all.slice(offset, offset + PAGE_SIZE);

          const typeMap = new Map(typeList.map((t) => [t.id, t.label]));
          const items: DocumentForLink[] = pageDocs.map((doc: LocalDocument) => ({
            id: doc.id,
            fileName: doc.fileName || doc.filenameOriginal || '',
            filenameOriginal: doc.filenameOriginal ?? null,
            documentTypeId: doc.documentTypeId ?? null,
            typeLabel: (doc.documentTypeId && typeMap.get(doc.documentTypeId)) || 'Non classé',
            uploadedAt: doc.uploadedAt || doc.createdAt || new Date().toISOString(),
            status: doc.status,
            mime: doc.mime,
          }));

          if (!cancelled) {
            setDocuments(items);
            setTotal(totalCount);
          }
        } else {
          // Online: charger les types une fois (pour filtre et labels)
          let typesForFetch = documentTypes;
          if (documentTypes.length === 0) {
            const typeRes = await fetch('/api/document-types');
            if (typeRes.ok) {
              const typeData = await typeRes.json();
              const list = typeData.documentTypes ?? typeData.data ?? (Array.isArray(typeData) ? typeData : []);
              typesForFetch = list
                .filter((t: any) => t.isActive !== false)
                .map((t: any) => ({ id: t.id, code: t.code || t.id, label: t.label || t.code || t.id }));
              if (!cancelled) setDocumentTypes(typesForFetch);
            }
          }

          const params = new URLSearchParams();
          params.set('limit', String(PAGE_SIZE));
          params.set('offset', String((page - 1) * PAGE_SIZE));
          if (query.trim()) params.set('query', query.trim());
          if (typeId && typesForFetch.length > 0) {
            const typeCode = typesForFetch.find((t) => t.id === typeId)?.code;
            if (typeCode) params.set('type', typeCode);
          }

          const res = await fetch(`/api/documents?${params.toString()}`);
          if (!res.ok) throw new Error('Erreur chargement documents');
          const data = await res.json();

          const rawDocs = data.documents ?? data.data ?? (Array.isArray(data) ? data : []);
          const totalCount = data.pagination?.total ?? data.total ?? rawDocs.length;

          const items: DocumentForLink[] = rawDocs
            .filter((d: any) => !excludeIds.includes(d.id))
            .map((d: any) => ({
              id: d.id,
              fileName: d.fileName ?? d.filenameOriginal ?? '',
              filenameOriginal: d.filenameOriginal ?? d.fileName ?? null,
              documentTypeId: d.documentTypeId ?? d.DocumentType?.id ?? null,
              typeLabel: d.DocumentType?.label ?? d.typeLabel ?? 'Non classé',
              uploadedAt: d.uploadedAt ?? d.createdAt ?? new Date().toISOString(),
              status: d.status,
              mime: d.mime,
            }));

          if (!cancelled) {
            setDocuments(items);
            setTotal(totalCount);
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? 'Erreur chargement');
          setDocuments([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [mode, organizationId, enabled, page, query, typeId, excludeIds.join(','), refreshKey]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasMore = page < totalPages;

  return {
    documents,
    documentTypes,
    loading,
    error,
    page,
    total,
    totalPages,
    hasMore,
    setPage,
    setQuery,
    setTypeId,
    query,
    typeId,
    refetch,
  };
}
