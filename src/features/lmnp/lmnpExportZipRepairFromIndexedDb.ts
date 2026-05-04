'use client';

/**
 * Après export LMNP serveur : réinjecte dans le ZIP les PJ lisibles uniquement en local (IndexedDB / blob URL).
 * Ajoute `lmnp/v2/export-file-integrity-indexeddb-repair.json`.
 */

import type { LocalDocument } from '@/lib/offline/db';

export type LmnpIndexedDbRepairReport = {
  repaired: Array<{ documentId: string; path: string; source: 'indexeddb' }>;
  failed: Array<{ documentId: string; reason: string }>;
};

export async function repairLmnpExportZipWithIndexedDb(zipBlob: Blob): Promise<{
  blob: Blob;
  report: LmnpIndexedDbRepairReport;
}> {
  const report: LmnpIndexedDbRepairReport = { repaired: [], failed: [] };
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());
  const intFile = zip.file('lmnp/v2/export-file-integrity.json');
  if (!intFile) {
    return { blob: zipBlob, report };
  }

  const int = JSON.parse(await intFile.async('string')) as {
    rows?: Array<{
      documentId: string;
      outcome: string;
      expectedPath?: string;
    }>;
    listedDocuments?: Array<{ documentId: string; expectedPath: string }>;
  };

  const { getLocalDB } = await import('@/lib/offline/db');
  const db = await getLocalDB();
  if (!db?.Document) {
    return { blob: zipBlob, report };
  }

  const fixOutcomes = new Set(['read_blob_failed', 'missing_blob', 'storage_key_missing']);
  const rowsToFix = (int.rows || []).filter((r) => fixOutcomes.has(r.outcome));

  for (const row of rowsToFix) {
    const local = (await db.Document.get(row.documentId)) as LocalDocument | undefined;
    if (!local?.url) {
      report.failed.push({
        documentId: row.documentId,
        reason: 'document absent en IndexedDB ou sans URL',
      });
      continue;
    }

    const path =
      row.expectedPath ||
      int.listedDocuments?.find((l) => l.documentId === row.documentId)?.expectedPath;
    if (!path) {
      report.failed.push({ documentId: row.documentId, reason: 'expectedPath inconnu dans le ZIP' });
      continue;
    }

    try {
      let ab: ArrayBuffer;
      if (local.url.startsWith('blob:')) {
        const res = await fetch(local.url);
        if (!res.ok) {
          report.failed.push({ documentId: row.documentId, reason: `blob URL fetch ${res.status}` });
          continue;
        }
        ab = await res.arrayBuffer();
      } else {
        const res = await fetch(local.url, { credentials: 'include', mode: 'cors' });
        if (!res.ok) {
          report.failed.push({
            documentId: row.documentId,
            reason: `fetch distant ${res.status} (IndexedDB pointe une URL serveur identique à l’échec export)`,
          });
          continue;
        }
        ab = await res.arrayBuffer();
      }

      if (!ab || ab.byteLength === 0) {
        report.failed.push({ documentId: row.documentId, reason: 'buffer vide après lecture locale' });
        continue;
      }

      zip.file(path, ab);
      report.repaired.push({ documentId: row.documentId, path, source: 'indexeddb' });
    } catch (e) {
      report.failed.push({
        documentId: row.documentId,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const repairJson = JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      note: 'PJ réinjectées depuis IndexedDB (client) après échec lecture stockage serveur.',
      ...report,
    },
    null,
    2,
  );
  zip.file('lmnp/v2/export-file-integrity-indexeddb-repair.json', repairJson);

  const out = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return { blob: out, report };
}
