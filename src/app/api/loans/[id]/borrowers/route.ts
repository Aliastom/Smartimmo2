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
 * GET /api/loans/[id]/borrowers
 * Récupère tous les co-emprunteurs d'un prêt
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const loanId = params.id;

    const loan = await prisma.loan.findFirst({
      where: { id: loanId, organizationId: user.organizationId },
    });

    if (!loan) {
      return NextResponse.json(
        { error: 'Prêt non trouvé' },
        { status: 404 }
      );
    }

    const borrowers = await prisma.loanBorrower.findMany({
      where: { loanId, organizationId: user.organizationId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      borrowers: borrowers.map(b => ({
        id: b.id,
        firstName: b.firstName,
        lastName: b.lastName,
        birthDate: b.birthDate?.toISOString() || null,
        email: b.email,
        phone: b.phone,
        responsibilityPct: b.responsibilityPct ? Number(b.responsibilityPct) : null,
      })),
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des co-emprunteurs:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des co-emprunteurs' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/loans/[id]/borrowers
 * Crée un nouveau co-emprunteur pour un prêt
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const loanId = params.id;
    const body = await request.json();

    const validation = borrowerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validation.error.errors },
        { status: 400 }
      );
    }

    const loan = await prisma.loan.findFirst({
      where: { id: loanId, organizationId: user.organizationId },
    });

    if (!loan) {
      return NextResponse.json(
        { error: 'Prêt non trouvé' },
        { status: 404 }
      );
    }

    const data = validation.data;
    const borrower = await prisma.loanBorrower.create({
      data: {
        loanId,
        organizationId: user.organizationId,
        firstName: data.firstName,
        lastName: data.lastName,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        email: data.email,
        phone: data.phone,
        responsibilityPct: data.responsibilityPct != null ? new Decimal(data.responsibilityPct) : null,
      },
    });

    return NextResponse.json({
      id: borrower.id,
      firstName: borrower.firstName,
      lastName: borrower.lastName,
      birthDate: borrower.birthDate?.toISOString() || null,
      email: borrower.email,
      phone: borrower.phone,
      responsibilityPct: borrower.responsibilityPct ? Number(borrower.responsibilityPct) : null,
    }, { status: 201 });
  } catch (error) {
    console.error('Erreur lors de la création du co-emprunteur:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du co-emprunteur' },
      { status: 500 }
    );
  }
}


