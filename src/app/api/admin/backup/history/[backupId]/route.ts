import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { prisma } from '@/lib/prisma';
import { adminBackupService } from '@/services/AdminBackupService';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';

export const dynamic = 'force-dynamic';

const SAFETY_PROTECTION_WINDOW_MS = 24 * 60 * 60 * 1000;

// eslint-disable-next-line @typescript-eslint/naming-convention
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { backupId: string } }
) {
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const backup = await prisma.adminBackupRecord.findUnique({
      where: { id: params.backupId },
    });
    if (!backup) {
      return NextResponse.json(
        { success: false, error: 'Sauvegarde introuvable' },
        { status: 404 }
      );
    }

    const now = Date.now();
    const isRecentSafetyBackup =
      backup.scope === 'full-v2-safety' &&
      now - backup.createdAt.getTime() < SAFETY_PROTECTION_WINDOW_MS;
    if (isRecentSafetyBackup) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Suppression refusée: backup safety récent protégé pendant 24h pour sécuriser les rollbacks',
        },
        { status: 409 }
      );
    }

    const activeJobUsingBackup = await prisma.adminBackupJob.findFirst({
      where: {
        state: { in: ['pending', 'running'] },
        backupRecordId: params.backupId,
      },
      select: { id: true, type: true, state: true },
    });
    if (activeJobUsingBackup) {
      return NextResponse.json(
        {
          success: false,
          error: `Suppression refusée: backup utilisé par un job ${activeJobUsingBackup.type} ${activeJobUsingBackup.state}`,
        },
        { status: 409 }
      );
    }

    let archiveMissing = false;
    try {
      const absolutePath = adminBackupService.resolveBackupAbsolutePath(backup.fileUrl);
      await fs.unlink(absolutePath);
    } catch (error) {
      const code =
        typeof error === 'object' && error && 'code' in error
          ? String((error as { code?: string }).code)
          : '';
      if (code === 'ENOENT') {
        archiveMissing = true;
      } else {
        return NextResponse.json(
          {
            success: false,
            error: 'Suppression interrompue: impossible de supprimer physiquement l’archive ZIP',
          },
          { status: 500 }
        );
      }
    }

    await prisma.adminBackupRecord.delete({
      where: { id: params.backupId },
    });

    return NextResponse.json({
      success: true,
      data: {
        deletedBackupId: params.backupId,
        archiveMissing,
        warning: archiveMissing
          ? 'Archive ZIP absente sur disque: entrée BDD nettoyée'
          : null,
      },
    });
  } catch (error) {
    console.error('Error deleting backup record:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la suppression de la sauvegarde' },
      { status: 500 }
    );
  }
}
