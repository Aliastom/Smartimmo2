/**
 * API Route : Duplication d'une simulation fiscale
 *
 * POST /api/fiscal/simulations/[id]/duplicate
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const userId = user.id;
    const createdBy = user.email || user.name || userId;
    const { id } = context.params;

    const body = await request.json().catch(() => ({}));
    const requestedName = typeof body?.name === 'string' ? body.name.trim() : '';

    const existing = await prisma.fiscalSimulation.findFirst({
      where: {
        id,
        organizationId,
        userId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Simulation source introuvable' },
        { status: 404 }
      );
    }

    const duplicateName = requestedName || `Copie de ${existing.name}`;

    const created = await prisma.fiscalSimulation.create({
      data: {
        organizationId,
        userId,
        name: duplicateName,
        year: existing.year,
        fiscalVersionId: existing.fiscalVersionId,
        inputsJson: existing.inputsJson,
        resultJson: existing.resultJson,
        createdBy,
      },
      select: {
        id: true,
        name: true,
        year: true,
        fiscalVersionId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      simulation: created,
      message: 'Simulation dupliquée avec succès',
    });
  } catch (error: any) {
    console.error('[API Simulations duplicate] Erreur:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erreur lors de la duplication de la simulation',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
