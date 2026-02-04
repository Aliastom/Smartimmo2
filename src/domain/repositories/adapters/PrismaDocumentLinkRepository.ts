/**
 * Adapter Prisma pour IDocumentLinkRepository
 */

import { prisma } from '@/lib/prisma';
import type {
  IDocumentLinkRepository,
  DocumentLink,
  CreateDocumentLinkData,
  DocumentLinkWhere,
} from '../interfaces/IDocumentLinkRepository';

export class PrismaDocumentLinkRepository implements IDocumentLinkRepository {
  async findMany(where: DocumentLinkWhere): Promise<DocumentLink[]> {
    const prismaWhere: any = {};

    if (where.documentId) {
      prismaWhere.documentId = where.documentId;
    }
    if (where.linkedType) {
      prismaWhere.linkedType = where.linkedType;
    }
    if (where.linkedId) {
      prismaWhere.linkedId = where.linkedId;
    }
    if (where.linkedType_linkedId) {
      prismaWhere.linkedType = where.linkedType_linkedId.linkedType;
      prismaWhere.linkedId = where.linkedType_linkedId.linkedId;
    }

    const results = await prisma.documentLink.findMany({
      where: prismaWhere,
      select: {
        documentId: true,
        linkedType: true,
        linkedId: true,
        entityName: true,
      },
    });

    return results.map(link => ({
      documentId: link.documentId,
      linkedType: link.linkedType,
      linkedId: link.linkedId,
      entityName: link.entityName,
    }));
  }

  async create(data: CreateDocumentLinkData): Promise<DocumentLink> {
    // Vérifier si le lien existe déjà (clé composite)
    const existing = await prisma.documentLink.findUnique({
      where: {
        documentId_linkedType_linkedId: {
          documentId: data.documentId,
          linkedType: data.linkedType,
          linkedId: data.linkedId,
        },
      },
    });

    if (existing) {
      return {
        documentId: existing.documentId,
        linkedType: existing.linkedType,
        linkedId: existing.linkedId,
        entityName: existing.entityName,
      };
    }

    const result = await prisma.documentLink.create({
      data: {
        documentId: data.documentId,
        linkedType: data.linkedType,
        linkedId: data.linkedId,
        entityName: data.entityName ?? null,
      },
    });

    return {
      documentId: result.documentId,
      linkedType: result.linkedType,
      linkedId: result.linkedId,
      entityName: result.entityName,
    };
  }

  async deleteMany(where: DocumentLinkWhere): Promise<void> {
    const prismaWhere: any = {};

    if (where.documentId) {
      prismaWhere.documentId = where.documentId;
    }
    if (where.linkedType) {
      prismaWhere.linkedType = where.linkedType;
    }
    if (where.linkedId) {
      prismaWhere.linkedId = where.linkedId;
    }
    if (where.linkedType_linkedId) {
      prismaWhere.linkedType = where.linkedType_linkedId.linkedType;
      prismaWhere.linkedId = where.linkedType_linkedId.linkedId;
    }

    await prisma.documentLink.deleteMany({
      where: prismaWhere,
    });
  }
}
