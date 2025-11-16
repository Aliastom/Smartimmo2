import { NextRequest, NextResponse } from 'next/server';
import { adminBackupService } from '@/services/AdminBackupService';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';

/**
 * GET /api/admin/backup/export
 * 
 * Exporte toute la base admin en archive ZIP
 * Query params:
 * - scope: "admin" (fixe)
 * - includeSensitive: boolean (false par défaut)
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Protection ADMIN
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

    // 2. Parser les options
    const searchParams = request.nextUrl.searchParams;
    const scope = searchParams.get('scope') || 'admin';
    const includeSensitive = searchParams.get('includeSensitive') === 'true';

    if (scope !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Scope invalide' },
        { status: 400 }
      );
    }

    // 3. Générer l'export
    const exportStream = await adminBackupService.exportAdmin({
      scope: 'admin',
      includeSensitive,
    });

    // 4. Audit log
    await prisma.appConfig.upsert({
      where: { key: 'last_backup_export' },
      update: {
        value: JSON.stringify({
          timestamp: new Date().toISOString(),
          userId: user.id,
          scope,
        }),
      },
      create: {
        key: 'last_backup_export',
        value: JSON.stringify({
          timestamp: new Date().toISOString(),
          userId: user.id,
          scope,
        }),
        description: 'Dernier export de backup admin',
      },
    });

    // 5. Retourner le stream
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `smartimmo-admin-backup-${timestamp}.zip`;

    // Convertir le stream en Response
    const chunks: Buffer[] = [];
    for await (const chunk of exportStream) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error exporting backup:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de l\'export' },
      { status: 500 }
    );
  }
}

