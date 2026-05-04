import { describe, it, expect } from 'vitest';
import { formatStorageError } from '@/lib/storage/formatStorageError';

describe('formatStorageError', () => {
  it('ne retourne pas “{}” pour une Error classique', () => {
    expect(formatStorageError(new Error('fichier introuvable'))).toContain('fichier introuvable');
  });

  it('accepte un objet type StorageError minimal', () => {
    const o = { name: 'StorageApiError', message: 'Object not found', statusCode: '404' };
    const s = formatStorageError(o);
    expect(s.length).toBeGreaterThan(3);
    expect(s).not.toBe('{}');
  });
});
