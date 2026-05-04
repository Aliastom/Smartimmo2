import { describe, it, expect } from 'vitest';
import {
  finalizeLmnpAttachmentResolution,
  transactionWhereExerciseYearOnProperties,
  type LmnpAttachmentScopeCore,
  type LmnpTransactionWithRel,
  type LmnpDocumentWithType,
} from '@/services/lmnp/lmnpExpectedAttachmentsResolver';

function minimalTx(id: string, propertyId: string): LmnpTransactionWithRel {
  return {
    id,
    propertyId,
    date: new Date('2025-06-15'),
    accounting_month: '2025-06',
    label: 'Test',
    amount: 100,
    nature: 'DEPENSE',
    Category: { id: 'c', slug: 'cat', label: 'Cat' },
    Property: { id: propertyId, name: 'Bien' },
  } as LmnpTransactionWithRel;
}

function minimalDoc(
  id: string,
  tid: string | null,
  overrides: Partial<LmnpDocumentWithType> = {}
): LmnpDocumentWithType {
  return {
    id,
    transactionId: tid,
    filenameOriginal: `${id}.pdf`,
    fileName: `${id}.pdf`,
    mime: 'application/pdf',
    size: 12,
    bucketKey: `org/doc/${id}`,
    DocumentType: { code: 'FACTURE', label: 'Facture' },
    ...overrides,
  } as LmnpDocumentWithType;
}

describe('transactionWhereExerciseYearOnProperties', () => {
  it('accepte accounting_month préfixe année OU date dans l’année avec mois comptable vide', () => {
    const w = transactionWhereExerciseYearOnProperties('org-1', ['p1'], 2025);
    expect(w.organizationId).toBe('org-1');
    expect(w.propertyId).toEqual({ in: ['p1'] });
    expect(Array.isArray(w.OR)).toBe(true);
    expect(w.OR).toHaveLength(2);
  });
});

describe('finalizeLmnpAttachmentResolution', () => {
  it('compte transactionsWithAttachmentsWritten avec PJ uniquement FK (sans DocumentLink)', () => {
    const t1 = minimalTx('t1', 'prop-a');
    const d1 = minimalDoc('d1', 't1');
    const transactions = [t1];
    const docById = new Map([[d1.id, d1]]);
    const docLinksByTx = new Map<string, string[]>([['t1', []]]);
    const txDocLinks = new Map<string, Set<string>>([['t1', new Set()]]);
    const txDocFk = new Map<string, Set<string>>([['t1', new Set(['d1'])]]);
    const txDocInherited = new Map<string, Set<string>>([['t1', new Set()]]);

    const core: LmnpAttachmentScopeCore = {
      organizationId: 'org',
      propertyIds: ['prop-a'],
      exerciseYear: 2025,
      transactions,
      txIds: ['t1'],
      txIdsForDocumentScope: ['t1'],
      parentByChild: new Map(),
      documents: [d1],
      docById,
      docIdSet: new Set(['d1']),
      allTxLinks: [],
      docLinksByTx,
      docIdToTxIds: new Map([['d1', ['t1']]]),
      txDocLinks,
      txDocFk,
      txDocInherited,
    };

    const written = new Set(['d1']);
    const missing = new Set<string>();

    const { counters } = finalizeLmnpAttachmentResolution(core, written, missing);

    expect(counters.attachmentsWritten).toBe(1);
    expect(counters.transactionsWithAttachmentsWritten).toBe(1);
    expect(counters.byProperty['prop-a'].transactionsWithAttachmentsWritten).toBe(1);
    expect(counters.byProperty['prop-a'].transactionsWithAttachmentsExpected).toBe(1);
  });
});
