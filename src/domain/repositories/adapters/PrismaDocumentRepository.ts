/**
 * Adapter Prisma pour IDocumentRepository
 */

import { prisma } from '@/lib/prisma';
import type {
  IDocumentRepository,
  Document,
  DocumentWhere,
  DuplicateCheckResult,
} from '../interfaces/IDocumentRepository';

export class PrismaDocumentRepository implements IDocumentRepository {
  async findMany(where: DocumentWhere): Promise<Document[]> {
    const prismaWhere: any = {};

    if (where.organizationId) {
      prismaWhere.organizationId = where.organizationId;
    }
    if (where.id) {
      if (typeof where.id === 'string') {
        prismaWhere.id = where.id;
      } else if (typeof where.id === 'object' && 'in' in where.id) {
        prismaWhere.id = { in: where.id.in };
      }
    }
    if (where.status) {
      prismaWhere.status = where.status;
    }
    if (where.fileSha256) {
      if (typeof where.fileSha256 === 'string') {
        prismaWhere.fileSha256 = where.fileSha256;
      } else if (typeof where.fileSha256 === 'object' && 'in' in where.fileSha256) {
        prismaWhere.fileSha256 = { in: where.fileSha256.in };
      }
    }

    const results = await prisma.document.findMany({
      where: prismaWhere,
      select: {
        id: true,
        organizationId: true,
        fileName: true,
        filenameOriginal: true,
        fileSha256: true,
        textSha256: true,
        status: true,
        bucketKey: true,
        isFavorite: true,
      },
    });

    return results.map(doc => ({
      id: doc.id,
      organizationId: doc.organizationId,
      fileName: doc.fileName,
      filenameOriginal: doc.filenameOriginal,
      fileSha256: doc.fileSha256,
      textSha256: doc.textSha256,
      status: doc.status,
      bucketKey: doc.bucketKey,
      isFavorite: doc.isFavorite ?? false,
    }));
  }

  async updateMany(where: DocumentWhere, data: Partial<Document>): Promise<void> {
    const prismaWhere: any = {};

    if (where.organizationId) {
      prismaWhere.organizationId = where.organizationId;
    }
    if (where.id) {
      if (typeof where.id === 'string') {
        prismaWhere.id = where.id;
      } else if (typeof where.id === 'object' && 'in' in where.id) {
        prismaWhere.id = { in: where.id.in };
      }
    }
    if (where.status) {
      prismaWhere.status = where.status;
    }

    // ⚠️ Construire le data avec tous les champs modifiables
    const updateData: any = {};
    if (data.filenameOriginal !== undefined) {
      updateData.filenameOriginal = data.filenameOriginal;
    }
    if (data.documentTypeId !== undefined) {
      updateData.documentTypeId = data.documentTypeId;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }
    if (data.bucketKey !== undefined) {
      updateData.bucketKey = data.bucketKey;
    }
    if (data.isFavorite !== undefined) {
      updateData.isFavorite = data.isFavorite;
    }

    await prisma.document.updateMany({
      where: prismaWhere,
      data: updateData,
    });
  }

  async delete(id: string, organizationId?: string): Promise<void> {
    // organizationId non utilisé en mode Prisma (pas de pendingOp)
    await prisma.document.delete({
      where: { id },
    });
  }

  async checkDuplicates(params: { fileSha256?: string; textSha256?: string; organizationId: string }): Promise<DuplicateCheckResult> {
    if (!params.fileSha256) {
      return {
        hasExactDuplicate: false,
        exactDuplicate: null,
      };
    }

    const duplicate = await prisma.document.findFirst({
      where: {
        fileSha256: params.fileSha256,
        status: 'active',
        organizationId: params.organizationId,
      },
      select: {
        id: true,
        organizationId: true,
        fileName: true,
        filenameOriginal: true,
        fileSha256: true,
        textSha256: true,
        status: true,
        bucketKey: true,
      },
    });

    if (duplicate) {
      return {
        hasExactDuplicate: true,
        exactDuplicate: {
          id: duplicate.id,
          organizationId: duplicate.organizationId,
          fileName: duplicate.fileName,
          filenameOriginal: duplicate.filenameOriginal,
          fileSha256: duplicate.fileSha256,
          textSha256: duplicate.textSha256,
          status: duplicate.status,
          bucketKey: duplicate.bucketKey,
        },
      };
    }

    return {
      hasExactDuplicate: false,
      exactDuplicate: null,
    };
  }
}
