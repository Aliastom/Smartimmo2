import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const ScheduleSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  hour: z.number().min(0).max(23).default(3),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  retentionDays: z.number().min(1).max(365).default(30),
  isActive: z.boolean().default(true),
});

/**
 * GET /api/admin/backup/schedule
 * Récupère la configuration de planification actuelle
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Activer l'authentification en production
    // const session = await getServerSession();
    // if (!session || !session.user) {
    //   return NextResponse.json(
    //     { success: false, error: 'Non authentifié' },
    //     { status: 401 }
    //   );
    // }

    // const user = await prisma.user.findUnique({
    //   where: { email: session.user.email || '' },
    // });

    // if (!user || user.role !== 'ADMIN') {
    //   return NextResponse.json(
    //     { success: false, error: 'Permissions insuffisantes' },
    //     { status: 403 }
    //   );
    // }

    const schedule = await prisma.adminBackupSchedule.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: schedule || null,
    });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération de la planification' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/backup/schedule
 * Crée ou met à jour la planification des backups automatiques
 */
export async function POST(request: NextRequest) {
  try {
    // TODO: Activer l'authentification en production
    // const session = await getServerSession();
    // if (!session || !session.user) {
    //   return NextResponse.json(
    //     { success: false, error: 'Non authentifié' },
    //     { status: 401 }
    //   );
    // }

    // const user = await prisma.user.findUnique({
    //   where: { email: session.user.email || '' },
    // });

    // if (!user || user.role !== 'ADMIN') {
    //   return NextResponse.json(
    //     { success: false, error: 'Permissions insuffisantes' },
    //     { status: 403 }
    //   );
    // }

    const body = await request.json();
    const validated = ScheduleSchema.parse(body);

    // Calculer la prochaine exécution
    const nextRunAt = calculateNextRun(validated);

    // Désactiver les anciennes planifications
    await prisma.adminBackupSchedule.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Créer la nouvelle planification
    const schedule = await prisma.adminBackupSchedule.create({
      data: {
        ...validated,
        nextRunAt,
      },
    });

    return NextResponse.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    console.error('Error creating schedule:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Données invalides', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Erreur lors de la création de la planification' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/backup/schedule
 * Désactive la planification automatique
 */
export async function DELETE(request: NextRequest) {
  try {
    // TODO: Activer l'authentification en production
    // const session = await getServerSession();
    // if (!session || !session.user) {
    //   return NextResponse.json(
    //     { success: false, error: 'Non authentifié' },
    //     { status: 401 }
    //   );
    // }

    // const user = await prisma.user.findUnique({
    //   where: { email: session.user.email || '' },
    // });

    // if (!user || user.role !== 'ADMIN') {
    //   return NextResponse.json(
    //     { success: false, error: 'Permissions insuffisantes' },
    //     { status: 403 }
    //   );
    // }

    await prisma.adminBackupSchedule.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: 'Planification désactivée',
    });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la désactivation' },
      { status: 500 }
    );
  }
}

// Fonction utilitaire pour calculer la prochaine exécution
function calculateNextRun(config: z.infer<typeof ScheduleSchema>): Date {
  const now = new Date();
  const next = new Date();
  next.setHours(config.hour, 0, 0, 0);

  if (config.frequency === 'daily') {
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
  } else if (config.frequency === 'weekly') {
    const targetDay = config.dayOfWeek || 0;
    const currentDay = next.getDay();
    const daysUntilTarget = (targetDay - currentDay + 7) % 7;
    
    next.setDate(next.getDate() + daysUntilTarget);
    
    if (next <= now) {
      next.setDate(next.getDate() + 7);
    }
  } else if (config.frequency === 'monthly') {
    const targetDay = config.dayOfMonth || 1;
    next.setDate(targetDay);
    
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
    }
  }

  return next;
}

