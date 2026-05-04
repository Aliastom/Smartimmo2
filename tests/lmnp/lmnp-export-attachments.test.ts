import { describe, it, expect } from 'vitest';
import {
  buildDocIdToTransactionIds,
  buildDocLinksByExportedTransaction,
  expandTransactionIdsForLmnpDocuments,
  shouldIncludeParentTransactionDocuments,
} from '@/services/lmnp/lmnpExportAttachments';
import { buildLmnpZipIntegrityV2Files } from '@/services/lmnp/LmnpZipIntegrityV2';
import { createHash } from 'crypto';

function sha256(buf: Buffer) {
  return createHash('sha256').update(buf).digest('hex');
}

describe('lmnpExportAttachments', () => {
  it('expandTransactionIdsForLmnpDocuments inclut le parent pour commission auto', () => {
    const ids = expandTransactionIdsForLmnpDocuments([
      { id: 'c1', parentTransactionId: 'p1', isAuto: true, autoSource: null, label: 'x' },
    ]);
    expect(ids.sort()).toEqual(['c1', 'p1']);
  });

  it('buildDocLinksByExportedTransaction : plusieurs docs par transaction + héritage parent', () => {
    const parentByChild = new Map([['c1', 'p1']]);
    const allTxLinks = [
      { documentId: 'd1', linkedId: 'c1', linkedType: 'transaction' },
      { documentId: 'd2', linkedId: 'c1', linkedType: 'Transaction' },
      { documentId: 'd3', linkedId: 'p1', linkedType: 'TRANSACTION' },
    ];
    const documents = [
      { id: 'd4', transactionId: 'c1' },
      { id: 'd5', transactionId: 'p1' },
    ];
    const m = buildDocLinksByExportedTransaction(['c1'], parentByChild, allTxLinks, documents);
    const set = new Set(m.get('c1') || []);
    expect(set.has('d1')).toBe(true);
    expect(set.has('d2')).toBe(true);
    expect(set.has('d3')).toBe(true);
    expect(set.has('d4')).toBe(true);
    expect(set.has('d5')).toBe(true);
  });

  it('buildDocIdToTransactionIds fusionne liens et FK', () => {
    const m = buildDocIdToTransactionIds(
      [{ id: 'd1', transactionId: 't1' }],
      [
        { documentId: 'd1', linkedId: 't2', linkedType: 'transaction' },
        { documentId: 'd1', linkedId: 't1', linkedType: 'bad' },
      ],
    );
    expect((m.get('d1') || []).sort()).toEqual(['t1', 't2']);
  });

  it('shouldIncludeParentTransactionDocuments : label commission', () => {
    expect(
      shouldIncludeParentTransactionDocuments({
        parentTransactionId: 'p',
        isAuto: false,
        autoSource: null,
        label: 'Commission Airbnb',
      }),
    ).toBe(true);
  });
});

describe('buildLmnpZipIntegrityV2Files', () => {
  it('manifest globalSha256 correspond au fichier checksums', () => {
    const a = Buffer.from('a', 'utf8');
    const b = Buffer.from('b', 'utf8');
    const staging: Array<{ path: string; buffer: Buffer }> = [
      { path: 'a.txt', buffer: a },
      { path: 'b/b.txt', buffer: b },
    ];
    const just = [
      {
        zipPath: '02_justificatifs/x.pdf',
        documentId: 'doc1',
        organizationId: 'org',
        storageKey: 'k',
        filename: 'x.pdf',
        mime: 'application/pdf',
        primaryTransactionId: 't1',
        linkedTransactionIds: ['t1'],
        buffer: Buffer.from('pdf', 'utf8'),
      },
    ];
    const out = buildLmnpZipIntegrityV2Files({
      stagingFiles: staging,
      justificatifs: just,
      organizationId: 'org',
      exerciseYear: 2025,
      summary: {
        transactionsExported: 1,
        documentsLinkedDistinct: 1,
        attachmentsExpected: 1,
        attachmentsWritten: 1,
        attachmentsMissing: 0,
        attachmentsDeduplicated: 0,
        missing: [],
      },
    });
    const byPath = new Map(out.map((f) => [f.path, f.buffer]));
    const manifestRaw = byPath.get('lmnp/v2/manifest.v2.json');
    const checksumsRaw = byPath.get('lmnp/v2/checksums.sha256');
    expect(manifestRaw && checksumsRaw).toBeTruthy();
    const manifest = JSON.parse(manifestRaw!.toString('utf8')) as {
      checksums: { globalSha256: string };
    };
    const globalExpected = sha256(checksumsRaw!);
    expect(manifest.checksums.globalSha256).toBe(globalExpected);
    const checksumText = checksumsRaw!.toString('utf8');
    expect(checksumText.includes('a.txt')).toBe(true);
    expect(checksumText.includes('lmnp/v2/objects/index.ndjson')).toBe(true);
    expect(checksumText.includes('lmnp/v2/manifest.v2.json')).toBe(false);
  });
});
