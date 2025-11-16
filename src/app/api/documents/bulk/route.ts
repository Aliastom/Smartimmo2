import { NextRequest, NextResponse } from 'next/server';
import { BulkDocumentOperationSchema } from '@/types/documents';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth/getCurrentUser';



/**
 * POST /api/documents/bulk - OpÃ©rations en masse sur les documents
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const body = await request.json();
    const validated = BulkDocumentOperationSchema.parse(body);

    const { documentIds, operation, data } = validated;

    let result: any = { success: true };

    switch (operation) {
      case 'delete':
        // Soft-delete
        await prisma.document.updateMany({
          where: { id: { in: documentIds }, organizationId },
          data: {
            deletedAt: new Date(),
            deletedBy: user.id,
          },
        });
        result.message = `${documentIds.length} documents deleted`;
        break;

      case 'restore':
        // Restore soft-deleted documents
        await prisma.document.updateMany({
          where: { id: { in: documentIds }, organizationId },
          data: {
            deletedAt: null,
            deletedBy: null,
          },
        });
        result.message = `${documentIds.length} documents restored`;
        break;

      case 'update_type':
        if (!data?.documentTypeId) {
          return NextResponse.json(
            { error: 'documentTypeId required for update_type operation' },
            { status: 400 }
          );
        }
        await prisma.document.updateMany({
          where: { id: { in: documentIds }, organizationId },
          data: {
            documentTypeId: data.documentTypeId,
            typeConfidence: 1.0,
            typeAlternatives: null,
          },
        });
        result.message = `${documentIds.length} documents updated`;
        break;

      case 'add_tags':
        if (!data?.tags || !Array.isArray(data.tags)) {
          return NextResponse.json(
            { error: 'tags array required for add_tags operation' },
            { status: 400 }
          );
        }

        // Pour chaque document, ajouter les tags
        for (const docId of documentIds) {
          const doc = await prisma.document.findFirst({
            where: { id: docId, organizationId },
            select: { tagsJson: true },
          });

          if (doc) {
            const existingTags = doc.tagsJson ? JSON.parse(doc.tagsJson) : [];
            const newTags = [...new Set([...existingTags, ...data.tags])];

            await prisma.document.update({
              where: { id: docId },
              data: {
                tags: newTags.join(','),
                tagsJson: JSON.stringify(newTags),
              },
            });
          }
        }
        result.message = `Tags added to ${documentIds.length} documents`;
        break;

      case 'remove_tags':
        if (!data?.tags || !Array.isArray(data.tags)) {
          return NextResponse.json(
            { error: 'tags array required for remove_tags operation' },
            { status: 400 }
          );
        }

        // Pour chaque document, retirer les tags
        for (const docId of documentIds) {
          const doc = await prisma.document.findFirst({
            where: { id: docId, organizationId },
            select: { tagsJson: true },
          });

          if (doc) {
            const existingTags = doc.tagsJson ? JSON.parse(doc.tagsJson) : [];
            const newTags = existingTags.filter((t: string) => !data.tags.includes(t));

            await prisma.document.update({
              where: { id: docId },
              data: {
                tags: newTags.join(','),
                tagsJson: JSON.stringify(newTags),
              },
            });
          }
        }
        result.message = `Tags removed from ${documentIds.length} documents`;
        break;

      default:
        return NextResponse.json(
          { error: `Unknown operation: ${operation}` },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in bulk operation:', error);
    return NextResponse.json(
      { error: 'Bulk operation failed', details: error.message },
      { status: 500 }
    );
  }
}

