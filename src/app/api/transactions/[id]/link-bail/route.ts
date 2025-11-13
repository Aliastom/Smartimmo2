import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { bailId } = body;

    if (!bailId) {
      return NextResponse.json(
        { error: 'bailId est requis' },
        { status: 400 }
      );
    }

    // Vérifier que la transaction existe
    const existingTransaction = await prisma.transaction.findUnique({
      where: { id: params.id },
      select: { id: true, bailId: true }
    });

    if (!existingTransaction) {
      return NextResponse.json(
        { error: 'Transaction non trouvée' },
        { status: 404 }
      );
    }

    // Vérifier que la transaction n'a pas déjà un bailId
    if (existingTransaction.bailId) {
      return NextResponse.json(
        { error: 'Cette transaction a déjà un bail lié' },
        { status: 400 }
      );
    }

    // Vérifier que le bail existe
    const bail = await prisma.lease.findUnique({
      where: { id: bailId },
      select: { id: true, status: true }
    });

    if (!bail) {
      return NextResponse.json(
        { error: 'Bail non trouvé' },
        { status: 404 }
      );
    }

    // Lier le bail à la transaction
    const updatedTransaction = await prisma.transaction.update({
      where: { id: params.id },
      data: { bailId: bailId },
      include: {
        Property: {
          select: {
            id: true,
            name: true,
            address: true
          }
        },
        Lease_Transaction_bailIdToLease: {
          select: {
            id: true,
            status: true,
            Tenant: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedTransaction,
      message: 'Bail lié avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la liaison du bail:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
