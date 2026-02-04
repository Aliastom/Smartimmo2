/**
 * Smoke tests pour les routes API Leases
 * Vérifie le wiring : routes -> LeaseService -> mapping erreurs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock des dépendances
vi.mock('@/lib/auth/getCurrentUser', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/domain/services/leaseServiceFactory', () => ({
  createLeaseServicePrisma: vi.fn(),
}));

vi.mock('@/infra/repositories/leaseRepository', () => ({
  leaseRepository: {
    findByPropertyId: vi.fn(),
  },
}));

vi.mock('@/lib/services/leasesService', () => ({
  LeasesService: {},
}));

describe('API Routes - Leases (Smoke Tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/leases', () => {
    it('devrait appeler LeaseService.createLease via factory', async () => {
      const { requireAuth } = await import('@/lib/auth/getCurrentUser');
      const { createLeaseServicePrisma } = await import('@/domain/services/leaseServiceFactory');
      
      const mockService = {
        createLease: vi.fn().mockResolvedValue({
          lease: { id: 'lease1', propertyId: 'prop1', tenantId: 'tenant1' },
        }),
      };
      
      vi.mocked(createLeaseServicePrisma).mockReturnValue(mockService as any);
      vi.mocked(requireAuth).mockResolvedValue({
        id: 'user1',
        organizationId: 'org1',
        email: 'test@example.com',
      } as any);

      const { POST } = await import('@/app/api/leases/route');
      const request = new NextRequest('http://localhost:3000/api/leases', {
        method: 'POST',
        body: JSON.stringify({
          propertyId: 'prop1',
          tenantId: 'tenant1',
          type: 'residential',
          startDate: '2024-01-01',
          rentAmount: 1000,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);
      expect(mockService.createLease).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org1',
          propertyId: 'prop1',
          tenantId: 'tenant1',
        })
      );
    });

    it('devrait mapper les erreurs LeaseService vers status HTTP', async () => {
      const { requireAuth } = await import('@/lib/auth/getCurrentUser');
      const { createLeaseServicePrisma } = await import('@/domain/services/leaseServiceFactory');
      
      const mockService = {
        createLease: vi.fn().mockRejectedValue(new Error('Un autre bail actif existe sur cette période pour ce bien')),
      };
      
      vi.mocked(createLeaseServicePrisma).mockReturnValue(mockService as any);
      vi.mocked(requireAuth).mockResolvedValue({
        id: 'user1',
        organizationId: 'org1',
        email: 'test@example.com',
      } as any);

      const { POST } = await import('@/app/api/leases/route');
      const request = new NextRequest('http://localhost:3000/api/leases', {
        method: 'POST',
        body: JSON.stringify({
          propertyId: 'prop1',
          tenantId: 'tenant1',
          type: 'residential',
          startDate: '2024-01-01',
          rentAmount: 1000,
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400); // mapLeaseServiceErrorToHttpStatus devrait retourner 400 pour chevauchement
    });
  });

  describe('PUT /api/leases/[id]', () => {
    it('devrait appeler LeaseService.updateLease via factory', async () => {
      const { requireAuth } = await import('@/lib/auth/getCurrentUser');
      const { createLeaseServicePrisma } = await import('@/domain/services/leaseServiceFactory');
      
      const mockService = {
        updateLease: vi.fn().mockResolvedValue({
          lease: { id: 'lease1', rentAmount: 1200 },
        }),
      };
      
      vi.mocked(createLeaseServicePrisma).mockReturnValue(mockService as any);
      vi.mocked(requireAuth).mockResolvedValue({
        id: 'user1',
        organizationId: 'org1',
        email: 'test@example.com',
      } as any);

      const { PUT } = await import('@/app/api/leases/[id]/route');
      const request = new NextRequest('http://localhost:3000/api/leases/lease1', {
        method: 'PUT',
        body: JSON.stringify({
          rentAmount: 1200,
        }),
      });

      const response = await PUT(request, { params: { id: 'lease1' } });
      expect(response.status).toBe(200);
      expect(mockService.updateLease).toHaveBeenCalledWith(
        'lease1',
        'org1',
        expect.objectContaining({
          rentAmount: 1200,
        })
      );
    });
  });

  describe('DELETE /api/leases/[id]', () => {
    it('devrait appeler LeaseService.deleteLease via factory', async () => {
      const { requireAuth } = await import('@/lib/auth/getCurrentUser');
      const { createLeaseServicePrisma } = await import('@/domain/services/leaseServiceFactory');
      
      const mockService = {
        deleteLease: vi.fn().mockResolvedValue({
          success: true,
        }),
      };
      
      vi.mocked(createLeaseServicePrisma).mockReturnValue(mockService as any);
      vi.mocked(requireAuth).mockResolvedValue({
        id: 'user1',
        organizationId: 'org1',
        email: 'test@example.com',
      } as any);

      const { DELETE } = await import('@/app/api/leases/[id]/route');
      const request = new NextRequest('http://localhost:3000/api/leases/lease1', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: { id: 'lease1' } });
      expect(response.status).toBe(200);
      expect(mockService.deleteLease).toHaveBeenCalledWith('lease1', 'org1');
    });
  });
});

