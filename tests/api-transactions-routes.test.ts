/**
 * Tests basiques pour les routes API Transactions
 * Vérifie que les routes appellent TransactionService et gèrent correctement les erreurs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createTransactionServicePrisma } from '@/domain/services/transactionServiceFactory';
import { getGestionSettings } from '@/domain/services/transactionServiceHelpers';

// Mock des dépendances
vi.mock('@/lib/auth/getCurrentUser', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/domain/services/transactionServiceFactory', () => ({
  createTransactionServicePrisma: vi.fn(),
}));

vi.mock('@/domain/services/transactionServiceHelpers', async () => {
  const actual = await vi.importActual('@/domain/services/transactionServiceHelpers');
  return {
    ...actual,
    getGestionSettings: vi.fn(),
  };
});

vi.mock('@/lib/prisma', () => ({
  prisma: {
    uploadStagedItem: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    document: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    documentLink: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/services/storage.service', () => ({
  getStorageService: vi.fn(() => ({
    downloadDocument: vi.fn(),
    uploadDocument: vi.fn(),
    deleteDocument: vi.fn(),
    normalizeBucketKey: vi.fn((key: string) => key),
  })),
}));

describe('API Routes - Transactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/transactions', () => {
    it('devrait retourner 400 si propertyId manquant', async () => {
      const { requireAuth } = await import('@/lib/auth/getCurrentUser');
      vi.mocked(requireAuth).mockResolvedValue({
        id: 'user1',
        organizationId: 'org1',
        email: 'test@example.com',
      } as any);

      const { POST } = await import('@/app/api/transactions/route');
      const request = new NextRequest('http://localhost:3000/api/transactions', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: 'cat1',
          nature: 'RECETTE',
          amount: 1000,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain('PropertyId');
    });

    it('devrait retourner 400 si categoryId manquant', async () => {
      const { requireAuth } = await import('@/lib/auth/getCurrentUser');
      vi.mocked(requireAuth).mockResolvedValue({
        id: 'user1',
        organizationId: 'org1',
        email: 'test@example.com',
      } as any);

      const { POST } = await import('@/app/api/transactions/route');
      const request = new NextRequest('http://localhost:3000/api/transactions', {
        method: 'POST',
        body: JSON.stringify({
          propertyId: 'prop1',
          nature: 'RECETTE',
          amount: 1000,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.error).toContain('CategoryId');
    });

    it('devrait appeler TransactionService.createTransaction avec les bons paramètres', async () => {
      const { requireAuth } = await import('@/lib/auth/getCurrentUser');
      vi.mocked(requireAuth).mockResolvedValue({
        id: 'user1',
        organizationId: 'org1',
        email: 'test@example.com',
      } as any);

      const mockService = {
        createTransaction: vi.fn().mockResolvedValue({
          transaction: { id: 'tx1', label: 'Test', amount: 1000 },
          totalCreated: 1,
          allTransactions: [{ id: 'tx1', label: 'Test', amount: 1000 }],
        }),
      };

      vi.mocked(createTransactionServicePrisma).mockReturnValue(mockService as any);
      vi.mocked(getGestionSettings).mockResolvedValue({
        gestionEnabled: true,
        gestionCodes: {
          rentNature: 'RECETTE_LOYER',
          mgmtNature: 'FRAIS_GESTION',
          mgmtCategory: 'frais-gestion',
        },
      });

      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.uploadStagedItem.findMany).mockResolvedValue([]);

      const { POST } = await import('@/app/api/transactions/route');
      const request = new NextRequest('http://localhost:3000/api/transactions', {
        method: 'POST',
        body: JSON.stringify({
          propertyId: 'prop1',
          categoryId: 'cat1',
          nature: 'RECETTE',
          label: 'Test',
          amount: 1000,
          date: '2025-01-15',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      
      // Vérifier que TransactionService.createTransaction a été appelé
      expect(mockService.createTransaction).toHaveBeenCalled();
      const callArgs = mockService.createTransaction.mock.calls[0][0];
      expect(callArgs.organizationId).toBe('org1');
      expect(callArgs.propertyId).toBe('prop1');
      expect(callArgs.categoryId).toBe('cat1');
      expect(callArgs.amount).toBe(1000);
    });
  });

  describe('PUT /api/transactions/[id]', () => {
    it('devrait appeler TransactionService.updateTransaction', async () => {
      const { requireAuth } = await import('@/lib/auth/getCurrentUser');
      vi.mocked(requireAuth).mockResolvedValue({
        id: 'user1',
        organizationId: 'org1',
        email: 'test@example.com',
      } as any);

      const mockService = {
        updateTransaction: vi.fn().mockResolvedValue({
          transaction: { id: 'tx1', label: 'Updated', amount: 1500 },
        }),
      };

      vi.mocked(createTransactionServicePrisma).mockReturnValue(mockService as any);
      vi.mocked(getGestionSettings).mockResolvedValue({
        gestionEnabled: true,
        gestionCodes: {
          rentNature: 'RECETTE_LOYER',
          mgmtNature: 'FRAIS_GESTION',
          mgmtCategory: 'frais-gestion',
        },
      });

      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.uploadStagedItem.findMany).mockResolvedValue([]);

      const { PUT } = await import('@/app/api/transactions/[id]/route');
      const request = new NextRequest('http://localhost:3000/api/transactions/tx1', {
        method: 'PUT',
        body: JSON.stringify({
          propertyId: 'prop1',
          categoryId: 'cat1',
          label: 'Updated',
          amount: 1500,
          date: '2025-01-15',
        }),
      });

      const response = await PUT(request, { params: { id: 'tx1' } });
      expect(response.status).toBe(200);
      
      // Vérifier que TransactionService.updateTransaction a été appelé
      expect(mockService.updateTransaction).toHaveBeenCalledWith('tx1', expect.objectContaining({
        propertyId: 'prop1',
        label: 'Updated',
        amount: 1500,
      }));
    });
  });

  describe('DELETE /api/transactions/[id]', () => {
    it('devrait appeler TransactionService.deleteTransaction', async () => {
      const { requireAuth } = await import('@/lib/auth/getCurrentUser');
      vi.mocked(requireAuth).mockResolvedValue({
        id: 'user1',
        organizationId: 'org1',
        email: 'test@example.com',
      } as any);

      const mockService = {
        deleteTransaction: vi.fn().mockResolvedValue({
          success: true,
          mode: 'keep_docs_globalize',
          documentsAffected: 0,
          autoDeleted: 0,
        }),
      };

      vi.mocked(createTransactionServicePrisma).mockReturnValue(mockService as any);

      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.documentLink.findMany).mockResolvedValue([]);

      const { DELETE } = await import('@/app/api/transactions/[id]/route');
      const request = new NextRequest('http://localhost:3000/api/transactions/tx1?mode=keep_docs_globalize', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { id: 'tx1' } });
      expect(response.status).toBe(200);
      
      // Vérifier que TransactionService.deleteTransaction a été appelé
      expect(mockService.deleteTransaction).toHaveBeenCalledWith('tx1', {
        mode: 'keep_docs_globalize',
        deleteChildren: false,
      });
    });

    it('devrait mapper les erreurs TransactionService vers les bons status HTTP', async () => {
      const { requireAuth } = await import('@/lib/auth/getCurrentUser');
      vi.mocked(requireAuth).mockResolvedValue({
        id: 'user1',
        organizationId: 'org1',
        email: 'test@example.com',
      } as any);

      const mockService = {
        deleteTransaction: vi.fn().mockRejectedValue(new Error('Transaction non trouvée')),
      };

      vi.mocked(createTransactionServicePrisma).mockReturnValue(mockService as any);

      const { prisma } = await import('@/lib/prisma');
      vi.mocked(prisma.documentLink.findMany).mockResolvedValue([]);

      const { DELETE } = await import('@/app/api/transactions/[id]/route');
      const request = new NextRequest('http://localhost:3000/api/transactions/tx1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { id: 'tx1' } });
      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toContain('Transaction non trouvée');
    });
  });
});
