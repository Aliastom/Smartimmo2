import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { Decimal } from '@prisma/client/runtime/library';

export const dynamic = 'force-dynamic';

const borrowerSchema = z.object({
  firstName: z.string().min(1, 'Le prénom est requis'),
  lastName: z.string().min(1, 'Le nom est requis'),
  birthDate: z.string().datetime().optional().nullable(),
  email: z.string().email('Email invalide').optional().nullable(),
  phone: z.string().optional().nullable(),
  responsibilityPct: z.number().min(0).max(100).optional().nullable(),
});

/**
 * PATCH /api/loans/borrowers/[id]
 * Met à jour un co-emprunteur
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const borrowerId = params.id;
    const body = await request.json();

    const validation = borrowerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validation.error.errors },
        { status: 400 }
      );
    }

    const borrower = await prisma.loanBorrower.findFirst({
      where: { id: borrowerId, organizationId: user.organizationId },
    });

    if (!borrower) {
      return NextResponse.json(
        { error: 'Co-emprunteur non trouvé' },
        { status: 404 }
      );
    }

    const data = validation.data;
    const updated = await prisma.loanBorrower.update({
      where: { id: borrowerId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        email: data.email,
        phone: data.phone,
        responsibilityPct: data.responsibilityPct != null ? new Decimal(data.responsibilityPct) : null,
      },
    });

    return NextResponse.json({
      id: updated.id,
      firstName: updated.firstName,
      lastName: updated.lastName,
      birthDate: updated.birthDate?.toISOString() || null,
      email: updated.email,
      phone: updated.phone,
      responsibilityPct: updated.responsibilityPct ? Number(updated.responsibilityPct) : null,
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du co-emprunteur:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du co-emprunteur' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/loans/borrowers/[id]
 * Supprime un co-emprunteur
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const borrowerId = params.id;

    const borrower = await prisma.loanBorrower.findFirst({
      where: { id: borrowerId, organizationId: user.organizationId },
    });

    if (!borrower) {
      return NextResponse.json(
        { error: 'Co-emprunteur non trouvé' },
        { status: 404 }
      );
    }

    await prisma.loanBorrower.delete({
      where: { id: borrowerId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la suppression du co-emprunteur:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du co-emprunteur' },
      { status: 500 }
    );
  }
}

