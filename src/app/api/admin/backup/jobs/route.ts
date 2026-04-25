import { NextRequest, NextResponse } from 'next/server';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { adminBackupJobService } from '@/services/AdminBackupJobService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/backup/jobs
 * Lance un job asynchrone de backup admin.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export async function POST(request: NextRequest) {
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const contentType = request.headers.get('content-type') || '';
    let jobId: string;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const type = String(formData.get('type') || 'import');
      if (!['import', 'restore-v2-full-upload'].includes(type)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Multipart supporté uniquement pour import et restore-v2-full-upload',
          },
          { status: 400 }
        );
      }

      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json(
          { success: false, error: 'Fichier ZIP manquant' },
          { status: 400 }
        );
      }
      const MAX_SIZE = type === 'import' ? 25 * 1024 * 1024 : 250 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        return NextResponse.json(
          {
            success: false,
            error:
              type === 'import'
                ? 'Fichier trop volumineux (max 25 Mo)'
                : 'Fichier trop volumineux (max 250 Mo)',
          },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const archiveBuffer = Buffer.from(arrayBuffer);

      if (type === 'import') {
        const mode = String(formData.get('mode') || 'apply') as 'validate' | 'dry-run' | 'apply';
        const strategy = String(formData.get('strategy') || 'merge') as 'merge' | 'replace';
        if (!['validate', 'dry-run', 'apply'].includes(mode)) {
          return NextResponse.json({ success: false, error: 'Mode invalide' }, { status: 400 });
        }
        if (!['merge', 'replace'].includes(strategy)) {
          return NextResponse.json({ success: false, error: 'Stratégie invalide' }, { status: 400 });
        }

        jobId = await adminBackupJobService.startImportJob({
          userId: user.id,
          archiveBuffer,
          options: { mode, strategy },
        });
      } else {
        const mode = String(formData.get('mode') || 'full-replace');
        if (mode !== 'full-replace') {
          return NextResponse.json(
            { success: false, error: 'Seul le mode full-replace est autorisé pour restore-v2-full-upload' },
            { status: 400 }
          );
        }
        jobId = await adminBackupJobService.startRestoreV2FullUploadJob({
          userId: user.id,
          userEmail: user.email || undefined,
          archiveBuffer,
          sourceFileName: file.name || 'backup-upload.zip',
          mode: 'full-replace',
        });
      }
    } else {
      const body = await request.json().catch(() => ({}));
      const type = body?.type || 'export';
      const scope = body?.scope || 'admin';
      const includeSensitive = body?.includeSensitive === true;

      if (type === 'export') {
        if (scope !== 'admin') {
          return NextResponse.json(
            { success: false, error: 'Scope invalide' },
            { status: 400 }
          );
        }
        jobId = await adminBackupJobService.startExportJob({
          userId: user.id,
          options: { scope: 'admin', includeSensitive },
        });
      } else if (type === 'export-v2') {
        jobId = await adminBackupJobService.startExportV2Job({
          userId: user.id,
          userEmail: user.email || undefined,
        });
      } else if (type === 'restore') {
        const backupId = String(body?.backupId || '');
        const mode = (body?.mode || 'apply') as 'validate' | 'dry-run' | 'apply';
        const strategy = (body?.strategy || 'replace') as 'merge' | 'replace';

        if (!backupId) {
          return NextResponse.json(
            { success: false, error: 'backupId requis pour un job restore' },
            { status: 400 }
          );
        }
        if (!['validate', 'dry-run', 'apply'].includes(mode)) {
          return NextResponse.json({ success: false, error: 'Mode invalide' }, { status: 400 });
        }
        if (!['merge', 'replace'].includes(strategy)) {
          return NextResponse.json({ success: false, error: 'Stratégie invalide' }, { status: 400 });
        }

        jobId = await adminBackupJobService.startRestoreJob({
          userId: user.id,
          backupId,
          options: { mode, strategy },
        });
      } else if (type === 'restore-v2-db') {
        const backupId = String(body?.backupId || '');
        const mode = String(body?.mode || '');
        if (!backupId) {
          return NextResponse.json(
            { success: false, error: 'backupId requis pour un job restore-v2-db' },
            { status: 400 }
          );
        }
        if (!mode) {
          return NextResponse.json(
            { success: false, error: 'mode requis pour un job restore-v2-db' },
            { status: 400 }
          );
        }
        if (mode !== 'full-replace') {
          return NextResponse.json(
            { success: false, error: 'Seul le mode full-replace est autorisé pour restore-v2-db' },
            { status: 400 }
          );
        }

        jobId = await adminBackupJobService.startRestoreV2DbJob({
          userId: user.id,
          backupId,
          mode: 'full-replace',
        });
      } else if (type === 'restore-v2-full') {
        const backupId = String(body?.backupId || '');
        const mode = String(body?.mode || '');
        if (!backupId) {
          return NextResponse.json(
            { success: false, error: 'backupId requis pour un job restore-v2-full' },
            { status: 400 }
          );
        }
        if (!mode) {
          return NextResponse.json(
            { success: false, error: 'mode requis pour un job restore-v2-full' },
            { status: 400 }
          );
        }
        if (mode !== 'full-replace') {
          return NextResponse.json(
            { success: false, error: 'Seul le mode full-replace est autorisé pour restore-v2-full' },
            { status: 400 }
          );
        }

        jobId = await adminBackupJobService.startRestoreV2FullJob({
          userId: user.id,
          userEmail: user.email || undefined,
          backupId,
          mode: 'full-replace',
        });
      } else {
        return NextResponse.json(
          { success: false, error: 'Type de job non supporté' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: { jobId },
    });
  } catch (error) {
    console.error('Error starting backup job:', error);
    const message = error instanceof Error ? error.message : 'Erreur lors du lancement du job';
    const status = message.startsWith('Opération bloquée') ? 409 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
