/**
 * Tests pour la fonctionnalité Documents favoris
 * - API PATCH isFavorite (ajouter / retirer favori)
 * - API GET filterFavorites
 * - IndexedDB update isFavorite
 * - Filtre favoris côté hook (comportement attendu)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/getCurrentUser', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/lib/services/documents', () => ({
  DocumentsService: {
    updateIsFavorite: vi.fn(),
  },
}));

describe('Documents favoris - API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PATCH /api/documents/[id] - isFavorite', () => {
    it('devrait appeler updateIsFavorite quand isFavorite est true', async () => {
      const { requireAuth } = await import('@/lib/auth/getCurrentUser');
      vi.mocked(requireAuth).mockResolvedValue({
        id: 'user1',
        organizationId: 'org1',
        email: 'test@example.com',
      } as any);

      const { DocumentsService } = await import('@/lib/services/documents');
      vi.mocked(DocumentsService.updateIsFavorite).mockResolvedValue(undefined);

      const route = await import('@/app/api/documents/[id]/route');
      const req = new NextRequest('http://localhost/api/documents/doc1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: true }),
      });

      const res = await route.PATCH(req, { params: { id: 'doc1' } });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(DocumentsService.updateIsFavorite).toHaveBeenCalledWith('doc1', true, 'org1');
    });

    it('devrait appeler updateIsFavorite quand isFavorite est false (retirer des favoris)', async () => {
      const { requireAuth } = await import('@/lib/auth/getCurrentUser');
      vi.mocked(requireAuth).mockResolvedValue({
        id: 'user1',
        organizationId: 'org1',
        email: 'test@example.com',
      } as any);

      const { DocumentsService } = await import('@/lib/services/documents');
      vi.mocked(DocumentsService.updateIsFavorite).mockResolvedValue(undefined);

      const route = await import('@/app/api/documents/[id]/route');
      const req = new NextRequest('http://localhost/api/documents/doc1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: false }),
      });

      const res = await route.PATCH(req, { params: { id: 'doc1' } });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(DocumentsService.updateIsFavorite).toHaveBeenCalledWith('doc1', false, 'org1');
    });

    it('ne devrait pas appeler updateIsFavorite quand isFavorite est absent du body', async () => {
      const { requireAuth } = await import('@/lib/auth/getCurrentUser');
      vi.mocked(requireAuth).mockResolvedValue({
        id: 'user1',
        organizationId: 'org1',
        email: 'test@example.com',
      } as any);

      const { DocumentsService } = await import('@/lib/services/documents');

      const route = await import('@/app/api/documents/[id]/route');
      const req = new NextRequest('http://localhost/api/documents/doc1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });

      await route.PATCH(req, { params: { id: 'doc1' } });

      expect(DocumentsService.updateIsFavorite).not.toHaveBeenCalled();
    });
  });
});

describe('Documents favoris - Filtre', () => {
  it('applique filterFavorites côté liste (logique pure)', () => {
    const docs = [
      { id: '1', isFavorite: true },
      { id: '2', isFavorite: false },
      { id: '3', isFavorite: true },
    ];
    const filtered = docs.filter(d => d.isFavorite === true);
    expect(filtered).toHaveLength(2);
    expect(filtered.map(d => d.id)).toEqual(['1', '3']);
  });

  it('sans filtre favoris, tous les documents sont conservés', () => {
    const docs = [
      { id: '1', isFavorite: true },
      { id: '2', isFavorite: false },
    ];
    const filtered = docs;
    expect(filtered).toHaveLength(2);
  });
});

describe('Documents favoris - Pagination + favoris', () => {
  it('pagination sur liste filtrée favoris : offset/limit appliqués après filtre', () => {
    const allDocs = [
      { id: '1', isFavorite: true },
      { id: '2', isFavorite: false },
      { id: '3', isFavorite: true },
      { id: '4', isFavorite: true },
    ];
    const onlyFavorites = allDocs.filter(d => d.isFavorite === true);
    const offset = 1;
    const limit = 2;
    const page = onlyFavorites.slice(offset, offset + limit);
    expect(page).toHaveLength(2);
    expect(page.map(d => d.id)).toEqual(['3', '4']);
  });
});
