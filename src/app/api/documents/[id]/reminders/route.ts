import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ReminderCreateSchema } from '@/types/documents';
import { getDocumentQueueService } from '@/services/jobs/document-queue.service';
import { requireAuth } from '@/lib/auth/getCurrentUser';




// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: {
    id: string;
  };
}

/**
 * GET /api/documents/:id/reminders - Liste les rappels d'un document
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const { id } = context.params;

    const document = await prisma.document.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document introuvable' },
        { status: 404 }
      );
    }

    const reminders = await prisma.reminder.findMany({
      where: { documentId: id, organizationId },
      orderBy: { dueDate: 'asc' },
    });

    return NextResponse.json({ reminders });
  } catch (error: any) {
    console.error('Error fetching reminders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reminders', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/documents/:id/reminders - Crée des rappels pour un document
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const { id } = context.params;
    const body = await request.json();

    const document = await prisma.document.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document introuvable' },
        { status: 404 }
      );
    }

    // Deux modes: auto (relancer le job) ou manuel (créer un rappel custom)
    if (body.auto) {
      // Relancer le job de création automatique des rappels
      const queueService = getDocumentQueueService();
      await queueService.addJob('reminders', id);

      return NextResponse.json({
        success: true,
        message: 'Reminder creation job queued',
      });
    } else {
      // Créer un rappel manuel
      const validated = ReminderCreateSchema.parse(body);

      const reminder = await prisma.reminder.create({
        data: {
          ownerId: user.id,
          organizationId,
          documentId: id,
          kind: validated.kind,
          title: validated.title,
          description: validated.description,
          dueDate: new Date(validated.dueDate),
          alertDays: validated.alertDays ? JSON.stringify(validated.alertDays) : null,
          metadata: validated.metadata ? JSON.stringify(validated.metadata) : null,
          autoCreated: false,
          status: 'open',
        },
      });

      return NextResponse.json({
        success: true,
        reminder,
      });
    }
  } catch (error: any) {
    console.error('Error creating reminder:', error);
    return NextResponse.json(
      { error: 'Failed to create reminder', details: error.message },
      { status: 500 }
    );
  }
}

