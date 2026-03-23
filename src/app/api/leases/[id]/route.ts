import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { createLeaseServicePrisma } from '@/domain/services/leaseServiceFactory';
import { mapLeaseServiceErrorToHttpStatus } from '@/domain/services/leaseServiceHelpers';

// Schéma de validation pour la mise à jour d'un bail

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

/**
 * GET /api/leases/[id] — lecture d’un bail pour l’organisation courante (préflight, refresh UI, sync).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const id = params.id;

    const lease = await prisma.lease.findFirst({
      where: { id, organizationId },
      include: {
        Property: {
          select: {
            id: true,
            name: true,
            address: true,
            postalCode: true,
            city: true,
            surface: true,
            rooms: true,
          },
        },
        Tenant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            birthDate: true,
          },
        },
      },
    });

    if (lease) {
      return NextResponse.json({
        success: true,
        data: lease,
      });
    }

    const foreign = await prisma.lease.findUnique({
      where: { id },
      select: { id: true, organizationId: true },
    });
    if (foreign && foreign.organizationId !== organizationId) {
      return NextResponse.json(
        { success: false, error: 'Accès non autorisé à ce bail' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: false, error: 'Bail non trouvé' }, { status: 404 });
  } catch (error) {
    console.error('Erreur GET bail:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la lecture du bail' },
      { status: 500 }
    );
  }
}

const updateLeaseSchema = z.object({
  status: z.enum(['BROUILLON', 'ENVOYÉ', 'SIGNÉ', 'ACTIF', 'RÉSILIÉ', 'ARCHIVÉ']).optional(),
  propertyId: z.string().min(1).optional(),
  tenantId: z.string().min(1).optional(),
  type: z.enum(['residential', 'commercial', 'garage']).optional(),
  furnishedType: z.enum(['vide', 'meuble', 'garage']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  rentAmount: z.number().positive().optional(),
  deposit: z.number().nonnegative().optional(),
  paymentDay: z.number().min(1).max(31).optional(),
  indexationType: z.enum(['none', 'insee', 'manual']).optional(),
  notes: z.string().optional(),
  signedPdfUrl: z.string().optional(),
  // Gestion déléguée - Granularité des charges
  chargesRecupMensuelles: z.number().min(0).optional(),
  chargesNonRecupMensuelles: z.number().min(0).optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const body = await request.json();

    // Validation minimale (shape)
    const validatedData = updateLeaseSchema.parse(body);

    // Appel du service (toute la logique métier est dans LeaseService)
    const leaseService = createLeaseServicePrisma();
    const result = await leaseService.updateLease(params.id, organizationId, {
      propertyId: validatedData.propertyId,
      tenantId: validatedData.tenantId,
      type: validatedData.type,
      furnishedType: validatedData.furnishedType,
      startDate: validatedData.startDate,
      endDate: validatedData.endDate,
      rentAmount: validatedData.rentAmount,
      deposit: validatedData.deposit,
      paymentDay: validatedData.paymentDay,
      indexationType: validatedData.indexationType,
      notes: validatedData.notes,
      status: validatedData.status,
      signedPdfUrl: validatedData.signedPdfUrl,
      chargesRecupMensuelles: validatedData.chargesRecupMensuelles,
      chargesNonRecupMensuelles: validatedData.chargesNonRecupMensuelles,
    });

    return NextResponse.json({
      success: true,
      data: result.lease,
      message: 'Bail mis à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour du bail:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Données invalides',
        details: error.errors
      }, { status: 400 });
    }

    if (error instanceof Error) {
      const status = mapLeaseServiceErrorToHttpStatus(error);
      return NextResponse.json({
        error: error.message
      }, { status });
    }

    return NextResponse.json({
      error: 'Erreur lors de la mise à jour du bail'
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;

    // Appel du service (toute la logique métier est dans LeaseService)
    const leaseService = createLeaseServicePrisma();
    await leaseService.deleteLease(params.id, organizationId);

    return NextResponse.json({
      success: true,
      message: 'Bail supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression du bail:', error);
    
    if (error instanceof Error) {
      const status = mapLeaseServiceErrorToHttpStatus(error);
      return NextResponse.json({
        error: error.message
      }, { status });
    }
    
    return NextResponse.json({
      error: 'Erreur lors de la suppression du bail'
    }, { status: 500 });
  }
}