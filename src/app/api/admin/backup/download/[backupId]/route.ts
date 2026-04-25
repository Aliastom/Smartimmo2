import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { adminBackupService } from '@/services/AdminBackupService';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/backup/download/:backupId
 * Télécharge une archive de sauvegarde depuis l'historique.
 */
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

    const absolutePath = adminBackupService.resolveBackupAbsolutePath(backupRecord.fileUrl);
    const buffer = await fs.readFile(absolutePath);
    const filename = `smartimmo-admin-backup-${backupRecord.createdAt.toISOString().replace(/[:.]/g, '-').slice(0, 19)}.zip`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error downloading backup:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors du téléchargement du backup' },
      { status: 500 }
    );
  }
}
