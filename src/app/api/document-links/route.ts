/**
 * GET /api/document-links
 * Récupère tous les DocumentLink pour une organisation
 * Utilisé pour la synchronisation App Shell
 * 
 * POST /api/document-links
 * Crée un nouveau DocumentLink
 * Utilisé pour la synchronisation App Shell (pending operations)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { z } from 'zod';

// Force dynamic rendering (requires authentication via cookies)
export const dynamic = 'force-dynamic';

const createDocumentLinkSchema = z.object({
  documentId: z.string().min(1, 'L\'ID du document est requis'),
  linkedType: z.string().min(1, 'Le type de liaison est requis'),
  linkedId: z.string().min(1, 'L\'ID de l\'entité liée est requis'),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;

    // Récupérer tous les DocumentLink via les documents de l'organisation
    // (DocumentLink n'a pas organizationId directement, mais on filtre via Document)
    const documentLinks = await prisma.documentLink.findMany({
      where: {
        Document: {
          organizationId,
        },
      },
      select: {
        documentId: true,
        linkedType: true,
        linkedId: true,
        entityName: true,
      },
      orderBy: [
        { linkedType: 'asc' },
        { linkedId: 'asc' },
      ],
    });

    return NextResponse.json({
      data: documentLinks,
      total: documentLinks.length,
    });
  } catch (error: any) {
    console.error('[API] Erreur lors de la récupération des document_links:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des document_links', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/document-links
 * Crée un nouveau DocumentLink
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const body = await request.json();
    const validation = createDocumentLinkSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Vérifier que le document existe et appartient à l'organisation
    const document = await prisma.document.findFirst({
      where: {
        id: data.documentId,
        organizationId,
      },
      select: {
        id: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document non trouvé ou non autorisé' },
        { status: 404 }
      );
    }

    // Vérifier si le lien existe déjà
    const existingLink = await prisma.documentLink.findUnique({
      where: {
        documentId_linkedType_linkedId: {
          documentId: data.documentId,
          linkedType: data.linkedType,
          linkedId: data.linkedId,
        },
      },
    });

    if (existingLink) {
      // Le lien existe déjà, retourner succès (idempotent)
      return NextResponse.json({
        documentId: existingLink.documentId,
        linkedType: existingLink.linkedType,
        linkedId: existingLink.linkedId,
      }, { status: 200 });
    }

    // Créer le lien
    const link = await prisma.documentLink.create({
      data: {
        documentId: data.documentId,
        linkedType: data.linkedType,
        linkedId: data.linkedId,
      },
    });

    return NextResponse.json({
      documentId: link.documentId,
      linkedType: link.linkedType,
      linkedId: link.linkedId,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[API] Erreur lors de la création du document_link:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du document_link', details: error.message },
      { status: 500 }
    );
  }
}

