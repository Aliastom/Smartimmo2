import { describe, it, expect } from 'vitest';
import {
  ensureUniqueJustificatifRelPath,
  resolveJustificatifPropertySubfolder,
} from '@/services/lmnp/lmnpZipDocumentNaming';

describe('resolveJustificatifPropertySubfolder', () => {
  it('utilise doc.propertyId si tx est null (export activité multi-biens)', () => {
    const folder = resolveJustificatifPropertySubfolder({
      doc: { propertyId: 'p-deauville' },
      tx: null,
      selectedProperties: [
        { id: 'p-deauville', name: 'Deauville' },
        { id: 'p2', name: 'Paris' },
      ],
      scopeName: 'Activité',
    });
    expect(folder).toBe('Deauville/');
  });

  it('mono-bien : sous-dossier même sans transaction résolue', () => {
    const folder = resolveJustificatifPropertySubfolder({
      doc: { propertyId: null },
      tx: null,
      selectedProperties: [{ id: 'p1', name: 'Deauville' }],
      scopeName: 'X',
    });
    expect(folder).toBe('Deauville/');
  });
});

describe('ensureUniqueJustificatifRelPath', () => {
  it('résout une collision de chemin complet', () => {
    const used = new Set<string>();
    const a = ensureUniqueJustificatifRelPath('02_justificatifs/Deauville/f.pdf', used);
    const b = ensureUniqueJustificatifRelPath('02_justificatifs/Deauville/f.pdf', used);
    expect(a.path).toBe('02_justificatifs/Deauville/f.pdf');
    expect(b.collisionResolved).toBe(true);
    expect(b.path).toBe('02_justificatifs/Deauville/f_2.pdf');
  });
});
