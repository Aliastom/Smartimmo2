import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';

// POST /api/admin/signals/[id]/clone - Cloner un signal

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const { id } = params;
    const body = await request.json();
    const { newCode } = body;

    // Récupérer le signal source
    const sourceSignal = await prisma.signal.findUnique({
      where: { id }
    });

    if (!sourceSignal) {
      return NextResponse.json(
        { success: false, error: 'Signal source non trouvé' },
        { status: 404 }
      );
    }

    // Générer un code pour le clone si non fourni
    const cloneCode = newCode || `${sourceSignal.code}__copy`;

    // Vérifier l'unicité du code
    const existing = await prisma.signal.findUnique({
      where: { code: cloneCode }
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Un signal avec le code "${cloneCode}" existe déjà` },
        { status: 400 }
      );
    }

    // Créer le clone
    const clonedSignal = await prisma.signal.create({
      data: {
        code: cloneCode,
        label: `${sourceSignal.label} (copie)`,
        regex: sourceSignal.regex,
        flags: sourceSignal.flags,
        description: sourceSignal.description ? `${sourceSignal.description} (copie)` : undefined
      }
    });

    return NextResponse.json({
      success: true,
      data: clonedSignal,
    });
  } catch (error) {
    console.error('Error cloning signal:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors du clonage du signal' },
      { status: 500 }
    );
  }
}

