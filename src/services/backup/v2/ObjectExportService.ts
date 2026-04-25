import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getStorageService } from '@/services/storage.service';
import {
  BackupV2ValidationIssue,
  ObjectIndexEntryV2,
} from './BackupV2Contract';

interface ExportedObjectPayload {
  relativePath: string;
  buffer: Buffer;
  indexEntry: ObjectIndexEntryV2;
}

interface ExportObjectsOptions {
  strictMissingFiles?: boolean;
  onObject: (payload: ExportedObjectPayload) => Promise<void> | void;
}

export interface ObjectExportSummary {
  objectCount: number;
  bytesObjects: number;
  indexEntries: ObjectIndexEntryV2[];
  warnings: BackupV2ValidationIssue[];
}

interface DocumentRow {
  id: string;
  organizationId: string;
  bucketKey: string;
  filenameOriginal: string;
  fileName: string;
  mime: string;
  createdAt: Date;
  status: string;
  deletedAt: Date | null;
  DocumentLink: Array<{
    linkedType: string;
    linkedId: string;
  }>;
}

interface PhotoRow {
  id: string;
  organizationId: string;
  propertyId: string;
  fileName: string;
  mime: string;
  url: string;
  size: number;
  createdAt: Date;
}

interface PaymentAttachmentRow {
  id: string;
  paymentId: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: Date;
  Payment: {
    organizationId: string;
  };
}

export class ObjectExportService {
  async exportObjects(options: ExportObjectsOptions): Promise<ObjectExportSummary> {
    const strictMissingFiles = options.strictMissingFiles !== false;
    const storageService = getStorageService();
    const sourceProvider = this.resolveSourceProvider();
    const indexEntries: ObjectIndexEntryV2[] = [];
    const warnings: BackupV2ValidationIssue[] = [];
    let objectCount = 0;
    let bytesObjects = 0;

    const emittedObjectPaths = new Set<string>();
    const emittedPathBySha = new Map<string, string>();

    const emitObject = async (entry: ObjectIndexEntryV2, keyToRead: string) => {
      try {
        const buffer = await storageService.downloadDocument(keyToRead);
        const sha256 = this.sha256(buffer);
        const existingRelativePath = emittedPathBySha.get(sha256);
        const relativePath =
          existingRelativePath ||
          this.buildRelativeObjectPath(sha256, entry.filename);

        const fullEntry: ObjectIndexEntryV2 = {
          ...entry,
          relativePath,
          sha256,
          size: buffer.byteLength,
          hashAlgorithm: 'sha256',
          sourceProvider,
        };

        indexEntries.push(fullEntry);
        objectCount += 1;
        bytesObjects += buffer.byteLength;

        if (!emittedObjectPaths.has(relativePath)) {
          await options.onObject({
            relativePath,
            buffer,
            indexEntry: fullEntry,
          });
          emittedObjectPaths.add(relativePath);
          emittedPathBySha.set(sha256, relativePath);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erreur inconnue';
        const issue: BackupV2ValidationIssue = {
          code: 'OBJECT_STORAGE_MISSING',
          severity: strictMissingFiles ? 'blocking' : 'warning',
          path: keyToRead,
          message: `Objet référencé mais introuvable dans le stockage: ${message}`,
          context: {
            objectId: entry.objectId,
            kind: entry.kind,
          },
        };
        if (strictMissingFiles) {
          throw new Error(`${issue.code}: ${issue.message}`);
        }
        warnings.push(issue);
      }
    };

    const documents = await prisma.document.findMany({
      where: {
        deletedAt: null,
        status: { not: 'draft' },
        bucketKey: { not: '' },
      },
      select: {
        id: true,
        organizationId: true,
        bucketKey: true,
        filenameOriginal: true,
        fileName: true,
        mime: true,
        createdAt: true,
        status: true,
        deletedAt: true,
        DocumentLink: {
          select: {
            linkedType: true,
            linkedId: true,
          },
          orderBy: {
            linkedType: 'asc',
          },
        },
      },
    }) as DocumentRow[];

    for (const doc of documents) {
      if (!doc.bucketKey || doc.bucketKey.startsWith('tmp/')) {
        continue;
      }

      const normalizedKey = storageService.normalizeBucketKey(
        doc.bucketKey,
        doc.id,
        doc.filenameOriginal || doc.fileName
      );
      const firstLink = doc.DocumentLink[0];

      await emitObject(
        {
          objectId: `document:${doc.id}`,
          storageKey: normalizedKey,
          relativePath: '',
          sha256: '',
          size: 0,
          mime: doc.mime,
          kind: 'document',
          organizationId: doc.organizationId,
          documentId: doc.id,
          filename: doc.filenameOriginal || doc.fileName,
          linkedType: firstLink?.linkedType,
          linkedId: firstLink?.linkedId,
          createdAt: doc.createdAt.toISOString(),
        },
        normalizedKey
      );
    }

    const photos = await prisma.photo.findMany({
      select: {
        id: true,
        organizationId: true,
        propertyId: true,
        fileName: true,
        mime: true,
        url: true,
        size: true,
        createdAt: true,
      },
    }) as PhotoRow[];

    for (const photo of photos) {
      const storageKey = this.resolvePhotoStorageKey(photo);
      if (!storageKey) {
        const issue: BackupV2ValidationIssue = {
          code: 'PHOTO_STORAGE_KEY_UNRESOLVED',
          severity: strictMissingFiles ? 'blocking' : 'warning',
          message: 'Impossible de résoudre la clé de stockage pour une photo',
          context: {
            photoId: photo.id,
            url: photo.url,
          },
        };
        if (strictMissingFiles) {
          throw new Error(`${issue.code}: ${issue.message}`);
        }
        warnings.push(issue);
        continue;
      }

      await emitObject(
        {
          objectId: `photo:${photo.id}`,
          storageKey,
          relativePath: '',
          sha256: '',
          size: 0,
          mime: photo.mime,
          kind: 'photo',
          organizationId: photo.organizationId,
          filename: photo.fileName,
          createdAt: photo.createdAt.toISOString(),
        },
        storageKey
      );
    }

    const paymentAttachments = await prisma.paymentAttachment.findMany({
      select: {
        id: true,
        paymentId: true,
        filename: true,
        mimeType: true,
        size: true,
        url: true,
        createdAt: true,
        Payment: {
          select: {
            organizationId: true,
          },
        },
      },
    }) as PaymentAttachmentRow[];

    for (const attachment of paymentAttachments) {
      const storageKey = this.resolvePaymentAttachmentStorageKey(attachment);
      if (!storageKey) {
        const issue: BackupV2ValidationIssue = {
          code: 'PAYMENT_ATTACHMENT_STORAGE_KEY_UNRESOLVED',
          severity: strictMissingFiles ? 'blocking' : 'warning',
          message: 'Impossible de résoudre la clé de stockage pour une pièce jointe de paiement',
          context: {
            attachmentId: attachment.id,
            url: attachment.url,
          },
        };
        if (strictMissingFiles) {
          throw new Error(`${issue.code}: ${issue.message}`);
        }
        warnings.push(issue);
        continue;
      }

      await emitObject(
        {
          objectId: `payment_attachment:${attachment.id}`,
          storageKey,
          relativePath: '',
          sha256: '',
          size: 0,
          mime: attachment.mimeType,
          kind: 'payment_attachment',
          organizationId: attachment.Payment.organizationId,
          filename: attachment.filename,
          createdAt: attachment.createdAt.toISOString(),
          metadata: {
            paymentId: attachment.paymentId,
          },
        },
        storageKey
      );
    }

    return {
      objectCount,
      bytesObjects,
      indexEntries,
      warnings,
    };
  }

  private buildRelativeObjectPath(sha256: string, filename?: string): string {
    const safeName = this.sanitizeFilename(filename);
    if (safeName) {
      return `objects/files/${sha256.slice(0, 2)}/${sha256}__${safeName}`;
    }
    return `objects/files/${sha256.slice(0, 2)}/${sha256}__file.bin`;
  }

  private sanitizeFilename(filename?: string): string {
    if (!filename) return '';
    const base = filename
      .trim()
      .replace(/[/\\]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!base) return '';
    return base.slice(0, 120);
  }

  private resolveSourceProvider(): 'local' | 'supabase' | 'unknown' {
    const type = process.env.STORAGE_TYPE;
    if (type === 'local') return 'local';
    if (type === 'supabase') return 'supabase';
    return 'unknown';
  }

  private resolvePhotoStorageKey(photo: PhotoRow): string | null {
    const supabaseKey = this.extractStorageKeyFromSupabaseUrl(photo.url);
    if (supabaseKey) return supabaseKey;

    const apiKey = this.extractStorageKeyFromLegacyApiUrl(photo.url, 'photos');
    if (apiKey) return apiKey;

    return `photos/${photo.propertyId}/${photo.fileName}`;
  }

  private resolvePaymentAttachmentStorageKey(attachment: PaymentAttachmentRow): string | null {
    const supabaseKey = this.extractStorageKeyFromSupabaseUrl(attachment.url);
    if (supabaseKey) return supabaseKey;

    const apiKey = this.extractStorageKeyFromLegacyApiUrl(attachment.url, 'payments');
    if (apiKey) return apiKey;

    return `payments/${attachment.paymentId}/${attachment.filename}`;
  }

  private extractStorageKeyFromSupabaseUrl(urlValue: string): string | null {
    try {
      const parsed = new URL(urlValue);
      const pathname = parsed.pathname;
      const signMarker = '/storage/v1/object/sign/';
      const publicMarker = '/storage/v1/object/public/';
      if (pathname.includes(signMarker)) {
        const raw = pathname.split(signMarker)[1];
        if (!raw) return null;
        const parts = raw.split('/');
        if (parts.length <= 1) return null;
        return decodeURIComponent(parts.slice(1).join('/'));
      }
      if (pathname.includes(publicMarker)) {
        const raw = pathname.split(publicMarker)[1];
        if (!raw) return null;
        const parts = raw.split('/');
        if (parts.length <= 1) return null;
        return decodeURIComponent(parts.slice(1).join('/'));
      }
      return null;
    } catch {
      return null;
    }
  }

  private extractStorageKeyFromLegacyApiUrl(urlValue: string, kind: 'photos' | 'payments'): string | null {
    try {
      const decoded = decodeURIComponent(urlValue);
      if (kind === 'photos' && decoded.includes('/api/photos/files/')) {
        const marker = '/api/photos/files/';
        const parts = decoded.split(marker)[1]?.split('/');
        if (!parts || parts.length < 2) return null;
        return `photos/${parts[0]}/${parts.slice(1).join('/')}`;
      }
      if (kind === 'payments' && decoded.includes('/api/payments/')) {
        const marker = '/api/payments/';
        const tail = decoded.split(marker)[1];
        if (!tail) return null;
        const segments = tail.split('/');
        const paymentId = segments[0];
        const attachmentIdx = segments.findIndex((segment) => segment === 'attachment');
        if (!paymentId || attachmentIdx === -1 || attachmentIdx + 1 >= segments.length) return null;
        const fileName = segments.slice(attachmentIdx + 1).join('/');
        return `payments/${paymentId}/${fileName}`;
      }
      return null;
    } catch {
      return null;
    }
  }

  private sha256(content: Buffer): string {
    return createHash('sha256').update(content).digest('hex');
  }
}

export const objectExportService = new ObjectExportService();
