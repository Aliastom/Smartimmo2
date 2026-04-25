import { NextRequest, NextResponse } from 'next/server';
import AdmZip from 'adm-zip';
import { adminBackupService } from '@/services/AdminBackupService';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/backup/download/:backupId/documents-map
 * Télécharge reports/documents-map.csv depuis une archive backup existante.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export async function GET(
  _request: NextRequest,
  { params }: { params: { backupId: string } }
) {
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const backupRecord = await adminBackupService.getBackupById(params.backupId);
    if (!backupRecord) {
      return NextResponse.json(
        { success: false, error: 'Backup introuvable' },
        { status: 404 }
      );
    }

    const archiveBuffer = await adminBackupService.readArchiveFromFileUrl(backupRecord.fileUrl);
    const zip = new AdmZip(archiveBuffer);
    const entry = zip.getEntry('reports/documents-map.csv');
    if (!entry) {
      return NextResponse.json(
        {
          success: false,
          error: 'documents-map.csv introuvable dans cette archive (backup V2 requis)',
        },
        { status: 404 }
      );
    }

    const csvBuffer = entry.getData();
    const filename = `smartimmo-documents-map-${backupRecord.createdAt
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19)}.csv`;

    return new NextResponse(csvBuffer, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': csvBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error downloading documents map:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors du téléchargement de documents-map.csv' },
      { status: 500 }
    );
  }
}
