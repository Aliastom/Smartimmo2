import { NextRequest, NextResponse } from 'next/server';
import { adminBackupService } from '@/services/AdminBackupService';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';

/**
 * POST /api/admin/backup/import
 * 
 * Importe une archive de backup admin
 * Query params:
 * - mode: "validate" | "dry-run" | "apply"
 * - strategy: "merge" | "replace"
 * 
 * Body: multipart/form-data avec fichier .zip
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
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

    if (!['validate', 'dry-run', 'apply'].includes(mode)) {
      return NextResponse.json(
        { success: false, error: 'Mode invalide' },
        { status: 400 }
      );
    }

    if (!['merge', 'replace'].includes(strategy)) {
      return NextResponse.json(
        { success: false, error: 'Stratégie invalide' },
        { status: 400 }
      );
    }

    // 3. Récupérer le fichier
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Fichier manquant' },
        { status: 400 }
      );
    }

    // Vérifier la taille (max 25 Mo)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Fichier trop volumineux (max 25 Mo)' },
        { status: 400 }
      );
    }

    // Convertir en Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. Importer
    const result = await adminBackupService.importAdmin(
      buffer,
      { mode, strategy },
      user.id
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'Erreur lors de l\'import', details: result.errors },
        { status: 400 }
      );
    }

    // 5. Audit log
    await prisma.appConfig.upsert({
      where: { key: 'last_backup_import' },
      update: {
        value: JSON.stringify({
          timestamp: new Date().toISOString(),
          userId: user.id,
          mode,
          strategy,
          backupRecordId: result.backupRecordId,
        }),
      },
      create: {
        key: 'last_backup_import',
        value: JSON.stringify({
          timestamp: new Date().toISOString(),
          userId: user.id,
          mode,
          strategy,
          backupRecordId: result.backupRecordId,
        }),
        description: 'Dernier import de backup admin',
      },
    });

    // 6. Retourner le résultat
    return NextResponse.json({
      success: true,
      data: {
        mode,
        strategy,
        diff: result.diff,
        applied: result.applied,
        backupRecordId: result.backupRecordId,
      },
    });
  } catch (error) {
    console.error('Error importing backup:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de l\'import',
        details: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}

