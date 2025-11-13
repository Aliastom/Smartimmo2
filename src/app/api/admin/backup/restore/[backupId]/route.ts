import { NextRequest, NextResponse } from 'next/server';
import { adminBackupService } from '@/services/AdminBackupService';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';

/**
 * POST /api/admin/backup/restore/:backupId
 * 
 * Restaure un backup existant depuis l'historique
 * Query params:
 * - mode: "validate" | "dry-run" | "apply"
 * - strategy: "merge" | "replace"
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { backupId: string } }
) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    // TODO: Activer l'authentification en production
    // const session = await getServerSession();
    // if (!session || !session.user) {
    //   return NextResponse.json(
    //     { success: false, error: 'Non authentifié' },
    //     { status: 401 }
    //   );
    // }

    // const user = await prisma.user.findUnique({
    //   where: { email: session.user.email || '' },
    // });

    // if (!user || user.role !== 'ADMIN') {
    //   return NextResponse.json(
    //     { success: false, error: 'Permissions insuffisantes' },
    //     { status: 403 }
    //   );
    // }
    
    // Pour le développement, utiliser un user par défaut
    const user = { id: 'dev-user', role: 'ADMIN' };

    // 2. Parser les paramètres
    const searchParams = request.nextUrl.searchParams;
    const mode = (searchParams.get('mode') || 'validate') as 'validate' | 'dry-run' | 'apply';
    const strategy = (searchParams.get('strategy') || 'merge') as 'merge' | 'replace';

    // 3. Récupérer le backup record
    const backupRecord = await adminBackupService.getBackupById(params.backupId);

    if (!backupRecord) {
      return NextResponse.json(
        { success: false, error: 'Backup introuvable' },
        { status: 404 }
      );
    }

    // 4. Charger le fichier (depuis le stockage local ou S3)
    // Pour l'instant, on suppose un stockage local
    const backupPath = path.join(process.cwd(), 'backups', backupRecord.fileUrl);
    
    let buffer: Buffer;
    try {
      buffer = await fs.readFile(backupPath);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'Fichier de backup non trouvé sur le disque' },
        { status: 404 }
      );
    }

    // 5. Importer
    const result = await adminBackupService.importAdmin(
      buffer,
      { mode, strategy },
      user.id
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'Erreur lors de la restauration', details: result.errors },
        { status: 400 }
      );
    }

    // 6. Audit log
    await prisma.appConfig.upsert({
      where: { key: 'last_backup_restore' },
      update: {
        value: JSON.stringify({
          timestamp: new Date().toISOString(),
          userId: user.id,
          backupId: params.backupId,
          mode,
          strategy,
        }),
      },
      create: {
        key: 'last_backup_restore',
        value: JSON.stringify({
          timestamp: new Date().toISOString(),
          userId: user.id,
          backupId: params.backupId,
          mode,
          strategy,
        }),
        description: 'Dernière restauration de backup admin',
      },
    });

    // 7. Retourner le résultat
    return NextResponse.json({
      success: true,
      data: {
        backupId: params.backupId,
        mode,
        strategy,
        diff: result.diff,
        applied: result.applied,
      },
    });
  } catch (error) {
    console.error('Error restoring backup:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de la restauration',
        details: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}

