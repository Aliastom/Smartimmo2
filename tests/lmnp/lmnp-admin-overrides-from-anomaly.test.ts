/**
 * POST /api/admin/lmnp/overrides/from-anomaly — Prisma + auth mockés.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/protectAdminRoute', () => ({
  protectAdminRoute: vi.fn(),
}));

vi.mock('@/lib/auth/getCurrentUser', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    lmnpExportAnomaly: { findUnique: vi.fn() },
    lmnpExportOverride: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

describe('POST /api/admin/lmnp/overrides/from-anomaly', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('crée un override transaction depuis une anomalie valide', async () => {
    const { protectAdminRoute } = await import('@/lib/auth/protectAdminRoute');
    const { getCurrentUser } = await import('@/lib/auth/getCurrentUser');
    const { prisma } = await import('@/lib/prisma');

    vi.mocked(protectAdminRoute).mockResolvedValue(null);
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'u1',
      organizationId: 'org1',
      role: 'ADMIN',
    } as any);

    vi.mocked(prisma.lmnpExportAnomaly.findUnique).mockResolvedValue({
      id: 'anom1',
      runId: 'run1',
      entityType: 'transaction',
      entityId: 'tx99',
      severity: 'blocking',
      message: 'test',
      Run: { organizationId: 'org1' },
    } as any);

    vi.mocked(prisma.lmnpExportOverride.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.lmnpExportOverride.create).mockResolvedValue({
      id: 'ov1',
      organizationId: 'org1',
      transactionId: 'tx99',
      lmnpBucket: 'LOYER',
      lmnpLabel: 'Loyer',
      reason: 'r',
    } as any);

    const { POST } = await import('@/app/api/admin/lmnp/overrides/from-anomaly/route');
    const req = new NextRequest('http://localhost/api', {
      method: 'POST',
      body: JSON.stringify({
        anomalyId: 'anom1',
        lmnpBucket: 'LOYER',
        lmnpLabel: 'Loyer',
        reason: 'r',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.transactionId).toBe('tx99');
    expect(prisma.lmnpExportOverride.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org1',
          transactionId: 'tx99',
          lmnpBucket: 'LOYER',
        }),
      }),
    );
  });

  it('401 si non admin (protectAdminRoute renvoie une réponse)', async () => {
    const { protectAdminRoute } = await import('@/lib/auth/protectAdminRoute');
    vi.mocked(protectAdminRoute).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Accès réservé' }), { status: 403 }) as any,
    );

    const { POST } = await import('@/app/api/admin/lmnp/overrides/from-anomaly/route');
    const req = new NextRequest('http://localhost/api', {
      method: 'POST',
      body: JSON.stringify({ anomalyId: 'a', lmnpBucket: 'x', lmnpLabel: 'y' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});
