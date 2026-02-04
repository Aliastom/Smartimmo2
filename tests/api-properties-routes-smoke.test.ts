/**
 * Smoke tests pour les routes API Properties
 * Vérifie le wiring : routes -> PropertyService -> mapping erreurs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock des dépendances
vi.mock('@/lib/auth/getCurrentUser', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/domain/services/propertyServiceFactory', () => ({
  createPropertyServicePrisma: vi.fn(),
}));

vi.mock('@/lib/db/PropertyRepo', () => ({
  PropertyRepo: {
    findMany: vi.fn(),
  },
}));

describe('API Routes - Properties (Smoke Tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/properties', () => {
    it('devrait appeler PropertyService.createProperty via factory', async () => {
      const { requireAuth } = await import('@/lib/auth/getCurrentUser');
      const { createPropertyServicePrisma } = await import('@/domain/services/propertyServiceFactory');
      
      const mockService = {
        createProperty: vi.fn().mockResolvedValue({
          property: { id: 'prop1', name: 'Test Property' },
        }),
      };
      
      vi.mocked(createPropertyServicePrisma).mockReturnValue(mockService as any);
      vi.mocked(requireAuth).mockResolvedValue({
        id: 'user1',
        organizationId: 'org1',
        email: 'test@example.com',
      } as any);

      const { POST } = await import('@/app/api/properties/route');
      const request = new NextRequest('http://localhost:3000/api/properties', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Property',
          type: 'apartment',
          address: '123 Test St',
          postalCode: '75001',
          city: 'Paris',
          surface: 50,
          rooms: 2,
          acquisitionDate: '2024-01-01',
          acquisitionPrice: 100000,
          notaryFees: 5000,
          currentValue: 120000,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);
      expect(mockService.createProperty).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org1',
          name: 'Test Property',
        })
      );
    });

    it('devrait mapper les erreurs PropertyService vers status HTTP', async () => {
      const { requireAuth } = await import('@/lib/auth/getCurrentUser');
      const { createPropertyServicePrisma } = await import('@/domain/services/propertyServiceFactory');
      
      const mockService = {
        createProperty: vi.fn().mockRejectedValue(new Error('Impossible de supprimer : des éléments sont liés à ce bien')),
      };
      
      vi.mocked(createPropertyServicePrisma).mockReturnValue(mockService as any);
      vi.mocked(requireAuth).mockResolvedValue({
        id: 'user1',
        organizationId: 'org1',
        email: 'test@example.com',
      } as any);

      const { POST } = await import('@/app/api/properties/route');
      const request = new NextRequest('http://localhost:3000/api/properties', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Property',
          type: 'apartment',
          address: '123 Test St',
          postalCode: '75001',
          city: 'Paris',
          surface: 50,
          rooms: 2,
          acquisitionDate: '2024-01-01',
          acquisitionPrice: 100000,
          notaryFees: 0,
          currentValue: 0,
        }),
      });

      const response = await POST(request);
      // Vérifier que le service a été appelé et que l'erreur est mappée (pas 500)
      expect(mockService.createProperty).toHaveBeenCalled();
      expect(response.status).not.toBe(500); // L'erreur doit être mappée, pas 500
      const json = await response.json();
      expect(json.error).toBeDefined();
    });
  });

  describe('PUT /api/properties/[id]', () => {
    it('devrait appeler PropertyService.updateProperty via factory', async () => {
      const { requireAuth } = await import('@/lib/auth/getCurrentUser');
      const { createPropertyServicePrisma } = await import('@/domain/services/propertyServiceFactory');
      
      const mockService = {
        updateProperty: vi.fn().mockResolvedValue({
          property: { id: 'prop1', name: 'Updated Property' },
        }),
      };
      
      vi.mocked(createPropertyServicePrisma).mockReturnValue(mockService as any);
      vi.mocked(requireAuth).mockResolvedValue({
        id: 'user1',
        organizationId: 'org1',
        email: 'test@example.com',
      } as any);

      const { PUT } = await import('@/app/api/properties/[id]/route');
      const request = new NextRequest('http://localhost:3000/api/properties/prop1', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Property',
        }),
      });

      const response = await PUT(request, { params: { id: 'prop1' } });
      expect(response.status).toBe(200);
      expect(mockService.updateProperty).toHaveBeenCalledWith(
        'prop1',
        'org1',
        expect.objectContaining({
          name: 'Updated Property',
        })
      );
    });
  });

  describe('DELETE /api/properties/[id]', () => {
    it('devrait appeler PropertyService.deleteProperty via factory', async () => {
      const { requireAuth } = await import('@/lib/auth/getCurrentUser');
      const { createPropertyServicePrisma } = await import('@/domain/services/propertyServiceFactory');
      
      const mockService = {
        deleteProperty: vi.fn().mockResolvedValue({
          success: true,
          mode: 'archive' as const,
          stats: { leases: 0, transactions: 0, documents: 0, echeances: 0, loans: 0 },
        }),
      };
      
      vi.mocked(createPropertyServicePrisma).mockReturnValue(mockService as any);
      vi.mocked(requireAuth).mockResolvedValue({
        id: 'user1',
        organizationId: 'org1',
        email: 'test@example.com',
      } as any);

      const { DELETE } = await import('@/app/api/properties/[id]/route');
      const request = new NextRequest('http://localhost:3000/api/properties/prop1', {
        method: 'DELETE',
        body: JSON.stringify({ mode: 'archive' }),
      });

      const response = await DELETE(request, { params: { id: 'prop1' } });
      expect(response.status).toBe(200);
      expect(mockService.deleteProperty).toHaveBeenCalledWith(
        'prop1',
        'org1',
        expect.objectContaining({
          mode: 'archive',
        })
      );
    });
  });
});

