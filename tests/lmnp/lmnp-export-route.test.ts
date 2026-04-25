/**
 * Couche HTTP /api/lmnp/export — buildLmnpExport mocké (pas de Prisma).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth/getCurrentUser', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/services/lmnp/LmnpExportBuilder', () => ({
  buildLmnpExport: vi.fn(),
}));

const baseManifest = {
  schemaVersion: 1 as const,
  propertyId: 'prop1',
  propertyName: 'Test',
  exerciseYear: 2024,
  organizationId: 'org1',
  mappingVersion: '1',
  generatedAt: new Date().toISOString(),
  transactionCount: 2,
  documentCount: 0,
  loanCount: 0,
  coverageRate: 1,
  anomalyCount: 0,
  blockingAnomalyCount: 0,
  dryRunPayloadHash: 'abc',
  bucketCounts: { LOYER: 2 },
};

describe('POST /api/lmnp/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function setupAuth() {
    const { requireAuth } = await import('@/lib/auth/getCurrentUser');
    vi.mocked(requireAuth).mockResolvedValue({
      id: 'user1',
      organizationId: 'org1',
      email: 't@t.com',
    } as any);
  }

  it('dry run : JSON success + manifest + anomalies + recentRun', async () => {
    await setupAuth();
    const { buildLmnpExport } = await import('@/services/lmnp/LmnpExportBuilder');
    vi.mocked(buildLmnpExport).mockResolvedValue({
      mode: 'dryRun',
      manifest: { ...baseManifest, dryRunPayloadHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      anomalies: [],
      dryRunPayloadHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      ecrituresPreview: [],
      mappingVersion: '1',
      recentRun: null,
    });

    const { POST } = await import('@/app/api/lmnp/export/route');
    const req = new NextRequest('http://localhost/api/lmnp/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId: 'prop1', exerciseYear: 2024, mode: 'dryRun' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.dryRunPayloadHash).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(json.recentRun).toBe(null);
    expect(json.manifest.transactionCount).toBe(2);
  });

  it('final : ZIP + en-tête X-LMNP-Run-Id', async () => {
    await setupAuth();
    const { buildLmnpExport } = await import('@/services/lmnp/LmnpExportBuilder');
    const buf = Buffer.from('PK\x03\x04fake', 'utf8');
    vi.mocked(buildLmnpExport).mockResolvedValue({
      mode: 'final',
      zipBuffer: buf,
      filename: 'LMNP_Test_2024.zip',
      runId: 'run_cuid_123',
      manifest: baseManifest,
    });

    const { POST } = await import('@/app/api/lmnp/export/route');
    const req = new NextRequest('http://localhost/api/lmnp/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: 'prop1',
        exerciseYear: 2024,
        mode: 'final',
        dryRunPayloadHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-LMNP-Run-Id')).toBe('run_cuid_123');
    expect(res.headers.get('Content-Type')).toBe('application/zip');
    const ab = await res.arrayBuffer();
    expect(Buffer.from(ab).equals(buf)).toBe(true);
  });

  it('final sans hash → 400', async () => {
    await setupAuth();
    const { POST } = await import('@/app/api/lmnp/export/route');
    const req = new NextRequest('http://localhost/api/lmnp/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId: 'prop1', exerciseYear: 2024, mode: 'final' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it('hash obsolète → 409 + code DRY_RUN_HASH_MISMATCH', async () => {
    await setupAuth();
    const { buildLmnpExport } = await import('@/services/lmnp/LmnpExportBuilder');
    vi.mocked(buildLmnpExport).mockRejectedValue(new Error('DRY_RUN_HASH_MISMATCH'));

    const { POST } = await import('@/app/api/lmnp/export/route');
    const req = new NextRequest('http://localhost/api/lmnp/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: 'prop1',
        exerciseYear: 2024,
        mode: 'final',
        dryRunPayloadHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.code).toBe('DRY_RUN_HASH_MISMATCH');
  });

  it('anomalies bloquantes → 422 + code BLOCKING_ANOMALIES', async () => {
    await setupAuth();
    const { buildLmnpExport } = await import('@/services/lmnp/LmnpExportBuilder');
    vi.mocked(buildLmnpExport).mockRejectedValue(new Error('BLOCKING_ANOMALIES'));

    const { POST } = await import('@/app/api/lmnp/export/route');
    const req = new NextRequest('http://localhost/api/lmnp/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: 'prop1',
        exerciseYear: 2024,
        mode: 'final',
        dryRunPayloadHash: 'cccccccccccccccccccccccccccccccc',
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.code).toBe('BLOCKING_ANOMALIES');
  });

  it('bien introuvable → 404', async () => {
    await setupAuth();
    const { buildLmnpExport } = await import('@/services/lmnp/LmnpExportBuilder');
    vi.mocked(buildLmnpExport).mockRejectedValue(new Error('PROPERTY_NOT_FOUND'));

    const { POST } = await import('@/app/api/lmnp/export/route');
    const req = new NextRequest('http://localhost/api/lmnp/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId: 'x', exerciseYear: 2024, mode: 'dryRun' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});
