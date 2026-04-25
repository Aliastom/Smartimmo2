import { describe, it, expect } from 'vitest';
import { buildLmnpZipDocumentName, ensureUniqueZipName } from '@/services/lmnp/lmnpZipDocumentNaming';

describe('lmnp zip document naming', () => {
  it('retire accents et caractères spéciaux', () => {
    const name = buildLmnpZipDocumentName({
      accountingMonth: '2025-08',
      transactionAmount: 638,
      propertyName: 'Deauville Étoile',
      documentTypeLabel: 'Taxe foncière',
      originalFilename: 'Avis taxes foncières (été).pdf',
    });
    expect(name).toContain('2025-08_TaxeFonciere_638€_Deauville');
    expect(name).toMatch(/\.pdf$/);
  });

  it('gère les doublons avec suffixe', () => {
    const used = new Set<string>();
    const base = '2025-08_TaxeFonciere_638€_Deauville.pdf';
    const n1 = ensureUniqueZipName(base, used);
    const n2 = ensureUniqueZipName(base, used);
    const n3 = ensureUniqueZipName(base, used);
    expect(n1).toBe(base);
    expect(n2).toBe('2025-08_TaxeFonciere_638€_Deauville_2.pdf');
    expect(n3).toBe('2025-08_TaxeFonciere_638€_Deauville_3.pdf');
  });

  it('fallback sans mois : pas de 0000-00', () => {
    const name = buildLmnpZipDocumentName({
      exerciseYear: 2025,
      accountingMonth: null,
      transactionDate: null,
      transactionAmount: 0,
      propertyName: 'Deauville',
      documentTypeLabel: 'Tableau amortissement',
      originalFilename: 'amortissement.pdf',
    });
    expect(name).not.toContain('0000-00');
    expect(name.startsWith('2025_')).toBe(true);
  });
});

