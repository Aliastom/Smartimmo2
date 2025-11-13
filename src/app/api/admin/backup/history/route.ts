import { NextRequest, NextResponse } from 'next/server';
import { adminBackupService } from '@/services/AdminBackupService';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/backup/history
 * 
 * Récupère l'historique des backups
 * Query params:
 * - limit: number (20 par défaut)
 */
export async function GET(request: NextRequest) {
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

    // 2. Parser les paramètres
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // 3. Récupérer l'historique
    const history = await adminBackupService.getBackupHistory(limit);

    // 4. Enrichir avec les infos utilisateur
    const enrichedHistory = await Promise.all(
      history.map(async (backup) => {
        const creator = await prisma.user.findUnique({
          where: { id: backup.createdById },
          select: { name: true, email: true },
        });

        return {
          id: backup.id,
          createdAt: backup.createdAt,
          createdBy: creator?.name || creator?.email || 'Inconnu',
          scope: backup.scope,
          sizeBytes: backup.sizeBytes,
          checksum: backup.checksum,
          note: backup.note,
          meta: backup.meta,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: enrichedHistory,
    });
  } catch (error) {
    console.error('Error fetching backup history:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération de l\'historique' },
      { status: 500 }
    );
  }
}

