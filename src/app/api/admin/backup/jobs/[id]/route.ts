import { NextRequest, NextResponse } from 'next/server';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';
import { adminBackupJobService } from '@/services/AdminBackupJobService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/backup/jobs/:id
 * Retourne l'état d'un job de backup.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const job = await adminBackupJobService.getJobById(params.id);
    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job introuvable' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: job,
    });
  } catch (error) {
    console.error('Error fetching backup job:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération du job' },
      { status: 500 }
    );
  }
}
