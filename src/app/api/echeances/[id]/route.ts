import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { EcheanceType, Periodicite, SensEcheance } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Schema de validation pour PATCH (partial)
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

const UpdateEcheanceSchema = z.object({
  label: z.string().min(1).optional(),
  type: z.nativeEnum(EcheanceType).optional(),
  periodicite: z.nativeEnum(Periodicite).optional(),
  montant: z.number().positive().optional(),
  recuperable: z.boolean().optional(),
  sens: z.nativeEnum(SensEcheance).optional(),
  propertyId: z.string().nullable().optional(),
  leaseId: z.string().nullable().optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
}).refine(
  (data) => {
    // Si endAt et startAt sont fournis, endAt doit être >= startAt
    if (data.endAt && data.startAt) {
      return new Date(data.endAt) >= new Date(data.startAt);
    }
    return true;
  },
  { message: "La date de fin doit être supérieure ou égale à la date de début" }
);

/**
 * PATCH /api/echeances/:id
 * Mise à jour partielle d'une échéance récurrente
 * 
 * Permissions: ADMIN = tout, USER = lecture seule (pas d'accès à ce endpoint)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // TODO: Ajouter protection authentification RBAC (ADMIN uniquement)
    
    const body = await request.json();
    const validation = UpdateEcheanceSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Vérifier que l'échéance existe
    const existing = await prisma.echeanceRecurrente.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Échéance introuvable' },
        { status: 404 }
      );
    }

    // Préparer les données pour Prisma
    const updateData: any = { ...data };
    
    // Convertir montant en Decimal si fourni
    if (data.montant !== undefined) {
      updateData.montant = new Decimal(data.montant);
    }

    // Convertir les dates si fournies
    if (data.startAt) {
      updateData.startAt = new Date(data.startAt);
    }
    if (data.endAt !== undefined) {
      updateData.endAt = data.endAt ? new Date(data.endAt) : null;
    }

    // Mettre à jour
    const updated = await prisma.echeanceRecurrente.update({
      where: { id: params.id },
      data: updateData,
      include: {
        Property: {
          select: { id: true, name: true },
        },
        Lease: {
          select: { id: true, type: true, status: true },
        },
      },
    });

    // Convertir Decimal pour JSON
    const result = {
      ...updated,
      montant: typeof updated.montant === 'object' && 'toNumber' in updated.montant
        ? (updated.montant as any).toNumber()
        : parseFloat(updated.montant.toString()),
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API] Error in PATCH /api/echeances/:id:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la mise à jour' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/echeances/:id
 * Suppression logique par défaut (isActive=false, endAt=now si null)
 * 
 * Query param: hard=1 pour suppression définitive (ADMIN uniquement)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // TODO: Ajouter protection authentification RBAC (ADMIN uniquement)
    
    const { searchParams } = new URL(request.url);
    const hard = searchParams.get('hard') === '1';

    // Vérifier que l'échéance existe
    const existing = await prisma.echeanceRecurrente.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Échéance introuvable' },
        { status: 404 }
      );
    }

    if (hard) {
      // Suppression définitive (hard delete)
      await prisma.echeanceRecurrente.delete({
        where: { id: params.id },
      });

      return NextResponse.json({
        message: 'Échéance supprimée définitivement',
        deleted: true,
      });
    } else {
      // Suppression logique (soft delete)
      const now = new Date();
      const updateData: any = {
        isActive: false,
      };

      // Si endAt est null, le fixer à maintenant pour arrêter la projection
      if (!existing.endAt) {
        updateData.endAt = now;
      }

      const updated = await prisma.echeanceRecurrente.update({
        where: { id: params.id },
        data: updateData,
      });

      return NextResponse.json({
        message: 'Échéance archivée',
        archived: true,
        echeance: {
          ...updated,
          montant: typeof updated.montant === 'object' && 'toNumber' in updated.montant
            ? (updated.montant as any).toNumber()
            : parseFloat(updated.montant.toString()),
        },
      });
    }
  } catch (error: any) {
    console.error('[API] Error in DELETE /api/echeances/:id:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur lors de la suppression' },
      { status: 500 }
    );
  }
}

