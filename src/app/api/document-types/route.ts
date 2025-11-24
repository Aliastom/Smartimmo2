import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectRouteWithRole } from '@/lib/auth/protectRouteWithRole';

/**
 * GET /api/document-types - Récupérer les types de documents
 * Accessible aux utilisateurs authentifiés (USER et ADMIN)
 * Retourne les informations nécessaires pour l'utilisation (code, label, openTransaction)
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Vérifier l'authentification (USER et ADMIN peuvent lire)
  const authError = await protectRouteWithRole('GET');
  if (authError) return authError;

  try {
    const searchParams = request.nextUrl.searchParams;
    const scope = searchParams.get('scope');
    const isRequired = searchParams.get('isRequired');
    const isActive = searchParams.get('isActive');

    const where: any = {};

    if (scope) {
      where.scope = scope;
    }

    if (isRequired !== null) {
      where.isRequired = isRequired === 'true';
    }

    if (isActive !== null) {
      where.isActive = isActive !== 'false'; // Par défaut true
    } else {
      where.isActive = true; // Par défaut, ne montrer que les actifs
    }

    const documentTypes = await prisma.documentType.findMany({
      where,
      select: {
        id: true,
        code: true,
        label: true,
        description: true,
        icon: true,
        scope: true,
        isSystem: true,
        isRequired: true,
        order: true,
        isActive: true,
        isSensitive: true,
        autoAssignThreshold: true,
        openTransaction: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { order: 'asc' },
        { label: 'asc' },
      ],
    });

    return NextResponse.json({
      documentTypes,
      total: documentTypes.length,
    });
  } catch (error: any) {
    console.error('Error fetching document types:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document types', details: error.message },
      { status: 500 }
    );
  }
}
