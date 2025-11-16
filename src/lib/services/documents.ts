/**
 * Service unifiÃ© pour la gestion des documents
 * Centralise les opÃ©rations: upload, classification, OCR, versioning, liaison
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { getStorageService } from '@/services/storage.service';
import { getDocumentQueueService } from '@/services/jobs/document-queue.service';
import { prisma } from '@/lib/prisma';



export interface UploadDocumentParams {
  file: File | Buffer;
  fileName: string;
  mimeType: string;
  title?: string;
  linkedTo?: 'global' | 'property' | 'lease' | 'transaction' | 'loan' | 'tenant';
  linkedId?: string;
  hintedTypeKey?: string;
  tags?: string[];
  ownerId?: string;
  source?: 'upload' | 'email' | 'scan' | 'api';
  uploadedBy?: string;
  organizationId?: string;
}

export interface RelinkDocumentParams {
  linkedTo: 'global' | 'property' | 'lease' | 'transaction' | 'loan' | 'tenant';
  linkedId?: string;
}

export interface ClassifyAndExtractResult {
  documentTypeId?: string;
  confidence?: number;
  extractedFields: Record<string, any>;
  extractedText?: string;
  ocrVendor?: string;
  ocrConfidence?: number;
}

export class DocumentsService {
  private static async ensureDocumentBelongsToOrg(documentId: string, organizationId?: string) {
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        ...(organizationId ? { organizationId } : {}),
      },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    return document;
  }

  private static async ensureLinkedEntityBelongsToOrg(
    linkedTo?: UploadDocumentParams['linkedTo'],
    linkedId?: string | null,
    organizationId?: string
  ) {
    if (!organizationId || !linkedTo || !linkedId) {
      return;
    }

    let exists: { id: string } | null = null;

    switch (linkedTo) {
      case 'property':
        exists = await prisma.property.findFirst({
          where: { id: linkedId, organizationId },
          select: { id: true },
        });
        break;
      case 'lease':
        exists = await prisma.lease.findFirst({
          where: { id: linkedId, organizationId },
          select: { id: true },
        });
        break;
      case 'transaction':
        exists = await prisma.transaction.findFirst({
          where: { id: linkedId, organizationId },
          select: { id: true },
        });
        break;
      case 'tenant':
        exists = await prisma.tenant.findFirst({
          where: { id: linkedId, organizationId },
          select: { id: true },
        });
        break;
      case 'loan':
        exists = await prisma.loan.findFirst({
          where: { id: linkedId, organizationId },
          select: { id: true },
        });
        break;
      default:
        break;
    }

    if (!exists) {
      throw new Error('Linked entity not found or inaccessible');
    }
  }
  /**
   * Upload et crÃ©ation d'un document
   */
  static async uploadAndCreate(params: UploadDocumentParams): Promise<any> {
    const {
      file,
      fileName,
      mimeType,
      title,
      linkedTo = 'global',
      linkedId,
      hintedTypeKey,
      tags = [],
      ownerId = 'default',
      source = 'upload',
      uploadedBy,
      organizationId = 'default',
    } = params;

    await this.ensureLinkedEntityBelongsToOrg(linkedTo, linkedId, organizationId);

    // Convertir File en Buffer si nÃ©cessaire
    let buffer: Buffer;
    if (file instanceof Buffer) {
      buffer = file;
    } else {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    const storageService = getStorageService();

    // Calculer le SHA256
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    // VÃ©rifier les doublons
    const existingDoc = await prisma.document.findFirst({
      where: { fileSha256: sha256, organizationId },
    });

    if (existingDoc) {
      return {
        id: existingDoc.id,
        isDuplicate: true,
        message: 'Document already exists',
      };
    }

    // DÃ©terminer le type suggÃ©rÃ© si fourni
    let suggestedTypeId: string | undefined;
    if (hintedTypeKey) {
      const docType = await prisma.documentType.findUnique({
        where: { code: hintedTypeKey },
      });
      suggestedTypeId = docType?.id;
    }

    // CrÃ©er l'entrÃ©e document en base
    const document = await prisma.document.create({
      data: {
        ownerId,
        organizationId,
        bucketKey: '', // sera mis Ã  jour aprÃ¨s upload
        filenameOriginal: fileName,
        fileName: fileName, // legacy
        mime: mimeType,
        fileSha256: sha256,
        size: buffer.length,
        url: '', // sera mis Ã  jour aprÃ¨s upload
        ocrStatus: 'pending',
        indexed: false,
        status: 'pending',
        source,
        tags: tags.join(','),
        tagsJson: JSON.stringify(tags),
        linkedTo,
        linkedId: linkedId || null,
        uploadedBy: uploadedBy || ownerId,
        uploadedAt: new Date(),
        documentTypeId: suggestedTypeId || null,
        // Relations optionnelles
        propertyId: linkedTo === 'property' ? linkedId : null,
        leaseId: linkedTo === 'lease' ? linkedId : null,
        transactionId: linkedTo === 'transaction' ? linkedId : null,
        loanId: linkedTo === 'loan' ? linkedId : null,
        tenantId: linkedTo === 'tenant' ? linkedId : null,
      },
    });

    // Upload vers le storage
    const { key, url } = await storageService.uploadDocument(
      buffer,
      ownerId,
      document.id,
      fileName,
      mimeType
    );

    // Mettre Ã  jour avec les infos de storage
    await prisma.document.update({
      where: { id: document.id },
      data: {
        bucketKey: key,
        url,
      },
    });

    // Lancer le pipeline de traitement asynchrone
    const queueService = getDocumentQueueService();
    await queueService.addJob('ocr', document.id);

    return {
      id: document.id,
      filename: fileName,
      size: buffer.length,
      status: 'processing',
      isDuplicate: false,
    };
  }

  /**
   * Classification et extraction de donnÃ©es
   * AppelÃ© aprÃ¨s l'OCR ou manuellement
   * TODO: ImplÃ©menter OCR et classification automatique
   */
  static async classifyAndExtract(documentId: string, organizationId?: string): Promise<ClassifyAndExtractResult> {
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        ...(organizationId ? { organizationId } : {}),
      },
      include: {
        DocumentType: true,
        DocumentTextIndex: true,
      },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Pour l'instant, on retourne juste les donnÃ©es existantes
    // L'OCR et la classification automatique seront implÃ©mentÃ©s plus tard
    console.log(`TODO: ImplÃ©menter OCR et classification pour document ${documentId}`);

    return {
      documentTypeId: document.documentTypeId || undefined,
      confidence: document.typeConfidence || undefined,
      extractedFields: {},
      extractedText: document.extractedText || undefined,
      ocrVendor: document.ocrVendor || undefined,
      ocrConfidence: document.ocrConfidence || undefined,
    };
  }

  /**
   * Indexer le texte d'un document pour la recherche full-text
   */
  static async indexDocumentText(documentId: string, text: string, page: number = 1): Promise<void> {
    await prisma.documentTextIndex.upsert({
      where: {
        documentId_page: {
          documentId,
          page,
        },
      },
      create: {
        documentId,
        page,
        content: text,
      },
      update: {
        content: text,
      },
    });

    // Marquer le document comme indexÃ©
    await prisma.document.update({
      where: { id: documentId },
      data: { indexed: true },
    });
  }

  /**
   * VÃ©rifier les doublons (exact et near-duplicates)
   */
  static async checkDuplicates(opts: { fileSha256?: string; textSha256?: string; organizationId?: string }): Promise<{
    hasExactDuplicate: boolean;
    exactDuplicate?: any;
    nearDuplicates?: Array<{ id: string; similarity: number; fileName: string }>;
  }> {
    // VÃ©rifier les doublons exacts par fileSha256
    const exactDuplicate = opts.fileSha256
      ? await prisma.document.findFirst({
          where: {
            fileSha256: opts.fileSha256,
            status: 'active', // Exclure les drafts
            ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
          },
          select: {
            id: true,
            fileName: true,
            uploadedAt: true,
            DocumentType: {
              select: {
                label: true
              }
            }
          }
        })
      : null;

    if (exactDuplicate) {
      return {
        hasExactDuplicate: true,
        exactDuplicate
      };
    }

    // VÃ©rifier les near-duplicates par textSha256 ou simHash
    let nearDuplicates: Array<{ id: string; similarity: number; fileName: string }> = [];
    
    if (opts.textSha256) {
      // Rechercher des documents avec le mÃªme hash de texte (= contenu identique aprÃ¨s normalisation)
      const textDuplicates = await prisma.document.findMany({
        where: {
          textSha256: opts.textSha256,
          status: 'active',
          ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
        },
        select: {
          id: true,
          fileName: true
        },
        take: 5
      });

      // Ajouter avec similaritÃ© 1.0 (texte identique)
      nearDuplicates = textDuplicates.map(doc => ({
        id: doc.id,
        similarity: 1.0,
        fileName: doc.fileName
      }));
    }

    // TODO: ImplÃ©menter la recherche par simHash pour similaritÃ© < 1.0
    // Pour l'instant, on ne fait que la dÃ©tection exacte du texte

    return {
      hasExactDuplicate: false,
      nearDuplicates: nearDuplicates.length > 0 ? nearDuplicates : undefined
    };
  }


  /**
   * Modifier la liaison d'un document
   */
  static async relink(documentId: string, params: RelinkDocumentParams & { organizationId?: string }): Promise<any> {
    const { linkedTo, linkedId, organizationId } = params;

    await this.ensureDocumentBelongsToOrg(documentId, organizationId);
    await this.ensureLinkedEntityBelongsToOrg(linkedTo, linkedId, organizationId);

    const updateData: any = {
      linkedTo,
      linkedId: linkedId || null,
      // RÃ©initialiser les relations
      propertyId: null,
      leaseId: null,
      transactionId: null,
      loanId: null,
      tenantId: null,
    };

    // Assigner la bonne relation
    switch (linkedTo) {
      case 'property':
        updateData.propertyId = linkedId;
        break;
      case 'lease':
        updateData.leaseId = linkedId;
        break;
      case 'transaction':
        updateData.transactionId = linkedId;
        break;
      case 'loan':
        updateData.loanId = linkedId;
        break;
      case 'tenant':
        updateData.tenantId = linkedId;
        break;
      case 'global':
        // Aucune relation spÃ©cifique
        break;
    }

    const document = await prisma.document.update({
      where: { id: documentId },
      data: updateData,
    });

    return document;
  }

  /**
   * CrÃ©er une nouvelle version d'un document
   */
  static async createNewVersion(
    previousDocumentId: string,
    file: Buffer,
    fileName: string,
    mimeType: string,
    uploadedBy?: string,
    organizationId?: string
  ): Promise<any> {
    const prevDoc = await this.ensureDocumentBelongsToOrg(previousDocumentId, organizationId);

    const newVersion = await this.uploadAndCreate({
      file,
      fileName,
      mimeType,
      linkedTo: prevDoc.linkedTo as any,
      linkedId: prevDoc.linkedId || undefined,
      tags: prevDoc.tags ? prevDoc.tags.split(',') : [],
      ownerId: prevDoc.ownerId,
      organizationId: prevDoc.organizationId,
      source: prevDoc.source as any,
      uploadedBy,
    });

    await prisma.document.update({
      where: { id: newVersion.id },
      data: {
        version: prevDoc.version + 1,
        replacesDocumentId: previousDocumentId,
        documentTypeId: prevDoc.documentTypeId,
      },
    });

    await prisma.document.update({
      where: { id: previousDocumentId },
      data: {
        status: 'archived',
      },
    });

    return newVersion;
  }

  /**
   * Supprimer un document (suppression physique)
   */
  static async deleteSafely(documentId: string, deletedBy?: string, organizationId?: string): Promise<void> {
    const document = await this.ensureDocumentBelongsToOrg(documentId, organizationId);

    // Suppression physique : supprimer d'abord les liens, puis le document
    // Les contraintes CASCADE s'occuperont du reste
    await prisma.document.delete({
      where: { id: documentId },
    });

    // Supprimer le fichier physique
    if (document.bucketKey) {
      try {
        const { unlink } = await import('fs/promises');
        const { join } = await import('path');
        const filePath = join(process.cwd(), 'storage', 'documents', document.bucketKey);
        await unlink(filePath);
        console.log(`âœ… Fichier physique supprimÃ©: ${document.fileName}`);
      } catch (error) {
        console.log(`âš ï¸  Fichier physique non trouvÃ©: ${document.fileName} (${document.bucketKey})`);
        // Ne pas faire Ã©chouer la suppression si le fichier n'existe pas
      }
    }
  }

  /**
   * Restaurer un document supprimÃ©
   */
  static async restore(documentId: string): Promise<void> {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        deletedAt: null,
        deletedBy: null,
      },
    });
  }

  /**
   * RÃ©cupÃ©rer les documents avec filtres
   */
  static async search(filters: {
    query?: string;
    type?: string;
    scope?: 'global' | 'property' | 'lease' | 'transaction';
    status?: 'pending' | 'classified' | 'rejected' | 'archived';
    ocrStatus?: 'pending' | 'processed' | 'failed'; // Filtre sur le statut OCR
    linkedTo?: string;
    linkedId?: string;
    propertyId?: string;
    leaseId?: string;
    tenantId?: string;
    transactionId?: string;
    tags?: string[];
    dateFrom?: Date;
    dateTo?: Date;
    includeDeleted?: boolean;
    limit?: number;
    offset?: number;
    organizationId?: string;
  }) {
    // Construire la requÃªte avec les liens polymorphiques
    let whereClause: any = {};
    if (filters.organizationId) {
      whereClause.organizationId = filters.organizationId;
    }

    if (filters.type) {
      whereClause.DocumentType = { code: filters.type };
    }

    if (filters.status) {
      if (filters.status === 'classified') {
        // Special: "classÃ©s" = possÃ¨de un type de document
        (whereClause as any).isClassified = true;
      } else if (filters.status === 'orphan') {
        // Special: "orphelins" = documents sans liaisons
        (whereClause as any).isOrphan = true;
      } else {
        whereClause.status = filters.status;
      }
    }

    // Filtre sur le statut OCR
    if (filters.ocrStatus) {
      whereClause.ocrStatus = filters.ocrStatus;
    }

    // Gestion des liens polymorphiques
    let linkWhere: any = {};
    let isSpecificEntityFilter = false;
    
    if (filters.propertyId) {
      linkWhere.linkedType = 'property';
      linkWhere.linkedId = filters.propertyId;
      isSpecificEntityFilter = true;
    } else if (filters.leaseId) {
      linkWhere.linkedType = 'lease';
      linkWhere.linkedId = filters.leaseId;
      isSpecificEntityFilter = true;
    } else if (filters.tenantId) {
      linkWhere.linkedType = 'tenant';
      linkWhere.linkedId = filters.tenantId;
      isSpecificEntityFilter = true;
    } else if (filters.transactionId) {
      linkWhere.linkedType = 'transaction';
      linkWhere.linkedId = filters.transactionId;
      isSpecificEntityFilter = true;
    }

    if (filters.dateFrom || filters.dateTo) {
      whereClause.createdAt = {};
      if (filters.dateFrom) {
        whereClause.createdAt.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        whereClause.createdAt.lte = filters.dateTo;
      }
    }

    if (filters.query) {
      whereClause.OR = [
        { filenameOriginal: { contains: filters.query } },
        { filenameNormalized: { contains: filters.query } },
        { tags: { contains: filters.query } },
        // TODO: réactiver la recherche plein texte lorsque textIndex sera supporté dans Prisma
        // {
        //   textIndex: {
        //     some: {
        //       content: { contains: filters.query },
        //     },
        //   },
        // },
      ];
    }

    // Construire la requÃªte avec les liens polymorphiques
    let documents: any[] = [];
    let total = 0;

    if (isSpecificEntityFilter) {
      const linkWhereClause: any = { ...linkWhere };
      if (filters.organizationId) {
        linkWhereClause.Document = { organizationId: filters.organizationId };
      }

      // Recherche pour une entitÃ© spÃ©cifique (ex: onglet Documents d'un bien)
      // Recherche avec liens polymorphiques
      const links = await prisma.documentLink.findMany({
        where: linkWhereClause,
        include: {
          Document: {
            include: {
              DocumentType: true,
              DocumentLink: true,
              DocumentField: true,
              Reminder: {
                where: { status: 'open' },
                orderBy: { dueDate: 'asc' },
              },
            },
          },
        },
      });

      // Filtrer les documents selon les critÃ¨res et appliquer la pagination
      // DÃ©dupliquer les documents (un document peut avoir plusieurs liens)
      const uniqueDocuments = new Map();
      links.forEach(link => {
        if (link.Document && !uniqueDocuments.has(link.Document.id)) {
          uniqueDocuments.set(link.Document.id, link.Document);
        }
      });
      
      let filteredDocuments = Array.from(uniqueDocuments.values())
        .filter(doc => {
          if (!doc) return false;
          
          // Appliquer les filtres sur le document
          if (whereClause.DocumentType && doc.DocumentType?.code !== whereClause.DocumentType.code) return false;
          if (whereClause.status && doc.status !== whereClause.status) return false;
          if (whereClause.ocrStatus && doc.ocrStatus !== whereClause.ocrStatus) return false; // Filtre OCR
          if (whereClause.isClassified && !doc.DocumentType) return false;
          
          // Filtre linkedTo : vÃ©rifier si le document a AUSSI une liaison du type demandÃ©
          if (filters.linkedTo && doc.DocumentLink) {
            if (filters.linkedTo === 'global') {
              // VÃ©rifier si le document a une liaison globale
              const hasGlobalLink = doc.DocumentLink.some((l: any) => l.linkedType === 'global');
              if (!hasGlobalLink) return false;
            } else if (filters.linkedTo === 'none') {
              // Orphelin = aucune liaison (ne devrait pas arriver dans ce contexte)
              if (doc.DocumentLink.length > 0) return false;
            } else {
              // VÃ©rifier si le document a une liaison du type demandÃ© (lease, transaction, tenant)
              const hasLinkType = doc.DocumentLink.some((l: any) => l.linkedType === filters.linkedTo);
              if (!hasLinkType) return false;
            }
          }
          
          if (whereClause.createdAt) {
            if (whereClause.createdAt.gte && doc.createdAt < whereClause.createdAt.gte) return false;
            if (whereClause.createdAt.lte && doc.createdAt > whereClause.createdAt.lte) return false;
          }
          if (whereClause.OR && whereClause.OR.length > 0) {
            const matchesQuery = whereClause.OR.some(condition => {
              if (condition.filenameOriginal?.contains && !doc.filenameOriginal?.includes(condition.filenameOriginal.contains)) return false;
              if (condition.filenameNormalized?.contains && !doc.filenameNormalized?.includes(condition.filenameNormalized.contains)) return false;
              if (condition.tags?.contains && !doc.tags?.includes(condition.tags.contains)) return false;
              return true;
            });
            if (!matchesQuery) return false;
          }
          
          return true;
        });

      total = filteredDocuments.length;
      
      // Appliquer la pagination
      documents = filteredDocuments
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(filters.offset || 0, (filters.offset || 0) + (filters.limit || 50));
    } else {
      // Recherche globale (page Documents gÃ©nÃ©rale)
      const documentWhere: any = { ...whereClause };
      if (documentWhere.isClassified) {
        // Traduire le flag custom en condition Prisma
        delete documentWhere.isClassified;
        documentWhere.documentTypeId = { not: null };
      }

      if (documentWhere.isOrphan) {
        // Documents orphelins = sans liaisons
        delete documentWhere.isOrphan;
        const orphanDocuments = await prisma.document.findMany({
          where: {
            ...documentWhere,
            DocumentLink: { none: {} } // Aucun lien
          },
          include: {
            DocumentType: true,
            DocumentLink: true,
            DocumentField: true,
            Reminder: {
              where: { status: 'open' },
              orderBy: { dueDate: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: filters.offset || 0,
          take: filters.limit || 50,
        });
        
        total = await prisma.document.count({
          where: {
            ...documentWhere,
            DocumentLink: { none: {} }
          }
        });
        
        documents = orphanDocuments;
      } else {
        // Recherche normale - UNIQUEMENT les documents avec liaison GLOBAL
        // Source de vÃ©ritÃ© = DocumentLink WHERE linkedType = global
        const globalLinksWhere = {
          linkedType: 'global',
          Document: documentWhere
        } as any;
        
        total = await prisma.documentLink.count({ 
          where: globalLinksWhere 
        });
        
        const globalLinks = await prisma.documentLink.findMany({
          where: globalLinksWhere,
          include: {
            Document: {
              include: {
                DocumentType: true,
                DocumentLink: true,
                DocumentField: true,
                Reminder: {
                  where: { status: 'open' },
                  orderBy: { dueDate: 'asc' },
                },
              }
            }
          },
          orderBy: { 
            Document: { createdAt: 'desc' }
          },
          skip: filters.offset || 0,
          take: filters.limit || 50,
        });
        
        // Extraire les documents des liens
        documents = globalLinks.map(link => link.Document);
      }
    }

    // Enrichir les liens avec les noms des entitÃ©s
    const enrichedDocuments = await Promise.all(
      documents.map(async (doc) => {
        if (doc.DocumentLink && doc.DocumentLink.length > 0) {
          const enrichedLinks = await Promise.all(
            doc.DocumentLink.map(async (link: any) => {
              let entityName = null;
              
              try {
                switch (link.linkedType) {
                  case 'property':
                    const property = await prisma.property.findUnique({
                      where: { id: link.linkedId },
                      select: { name: true }
                    });
                    entityName = property?.name || null;
                    break;
                    
                  case 'lease':
                    const lease = await prisma.lease.findUnique({
                      where: { id: link.linkedId },
                      select: { 
                        id: true,
                        Property: {
                          select: { name: true }
                        }
                      }
                    });
                    entityName = lease?.Property?.name ? `Bail - ${lease.Property.name}` : null;
                    break;
                    
                  case 'tenant':
                    const tenant = await prisma.tenant.findUnique({
                      where: { id: link.linkedId },
                      select: { 
                        firstName: true, 
                        lastName: true 
                      }
                    });
                    entityName = tenant ? `${tenant.firstName} ${tenant.lastName}` : null;
                    break;
                    
                  case 'transaction':
                    const transaction = await prisma.transaction.findUnique({
                      where: { id: link.linkedId },
                      select: { 
                        id: true,
                        Property: {
                          select: { name: true }
                        }
                      }
                    });
                    entityName = transaction?.Property?.name ? `Transaction - ${transaction.Property.name}` : null;
                    break;
                    
                  case 'global':
                    entityName = 'Global';
                    break;
                }
              } catch (error) {
                console.warn(`Erreur lors de la rÃ©cupÃ©ration de l'entitÃ© ${link.linkedType}:${link.linkedId}:`, error);
              }
              
              return {
                ...link,
                entityName
              };
            })
          );
          
          return {
            ...doc,
            DocumentLink: enrichedLinks,
            // Normaliser pour compatibilité avec le code existant
            documentType: doc.DocumentType || null,
            links: enrichedLinks,
          };
        }
        
        // Normaliser pour compatibilité avec le code existant
        return {
          ...doc,
          documentType: doc.DocumentType || null,
          links: doc.DocumentLink || [],
        };
      })
    );

    return {
      documents: enrichedDocuments,
      pagination: {
        total,
        offset: filters.offset || 0,
        limit: filters.limit || 50,
        hasMore: (filters.offset || 0) + (filters.limit || 50) < total,
      },
    };
  }

  /**
   * Obtenir les statistiques des documents
   */
  static async getStats(organizationId: string, propertyId?: string) {
    if (propertyId) {
      await this.ensureLinkedEntityBelongsToOrg('property', propertyId, organizationId);
    }

    // Construire le where de base
    const baseWhere: any = { organizationId, deletedAt: null, ...(propertyId ? { propertyId } : {}) };

    const [total, pending, classified, withReminders, ocrFailed, drafts, orphans] = await Promise.all([
      prisma.document.count({
        where: baseWhere,
      }),
      prisma.document.count({
        where: { ...baseWhere, status: 'pending' },
      }),
      prisma.document.count({
        where: { ...baseWhere, status: 'classified' },
      }),
      prisma.document.count({
        where: {
          ...baseWhere,
          Reminder: {
            some: {
              status: 'open',
            },
          },
        },
      }),
      prisma.document.count({
        where: { ...baseWhere, ocrStatus: 'failed' },
      }),
      prisma.document.count({
        where: { 
          ...baseWhere, 
          status: 'draft' // TOUS les brouillons, pas seulement les orphelins
        },
      }),
      prisma.document.count({
        where: {
          ...baseWhere,
          DocumentLink: { none: {} } // Documents sans aucune liaison
        },
      }),
    ]);

    return {
      total,
      pending,
      classified,
      withReminders,
      ocrFailed,
      drafts,
      orphans,
    };
  }

  /**
   * RÃ©cupÃ©rer les types de documents requis pour un scope
   */
  static async getRequiredDocumentTypes(scope: 'property' | 'lease' | 'transaction') {
    return await prisma.documentType.findMany({
      where: {
        scope,
        isRequired: true,
        isActive: true,
      },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * VÃ©rifier la complÃ©tude des documents pour une entitÃ©
   */
  static async checkCompleteness(
    scope: 'property' | 'lease' | 'transaction',
    entityId: string,
    organizationId?: string
  ): Promise<{ complete: boolean; missing: any[]; provided: any[] }> {
    const requiredTypes = await this.getRequiredDocumentTypes(scope);

    await this.ensureLinkedEntityBelongsToOrg(scope, entityId, organizationId);

    const linkedField =
      scope === 'property' ? 'propertyId' : scope === 'lease' ? 'leaseId' : 'transactionId';

    const providedDocs = await prisma.document.findMany({
      where: {
        [linkedField]: entityId,
        deletedAt: null,
        ...(organizationId ? { organizationId } : {}),
      },
      include: {
        DocumentType: true,
      },
    });

    const providedTypeIds = new Set(providedDocs.map((d) => d.documentTypeId).filter(Boolean));

    const missing = requiredTypes.filter((type) => !providedTypeIds.has(type.id));
    const provided = requiredTypes.filter((type) => providedTypeIds.has(type.id));

    return {
      complete: missing.length === 0,
      missing,
      provided,
    };
  }

  /**
   * Mettre Ã  jour le nom de fichier d'un document
   */
  static async updateFilename(documentId: string, newFilename: string, organizationId?: string): Promise<void> {
    await this.ensureDocumentBelongsToOrg(documentId, organizationId);

    await prisma.document.update({
      where: { id: documentId },
      data: {
        filenameOriginal: newFilename,
        fileName: newFilename.replace(/[^a-zA-Z0-9._-]/g, '_'), // Nettoyer le nom interne
      },
    });
  }

  /**
   * Mettre Ã  jour le type de document
   */
  static async updateDocumentType(documentId: string, typeCode: string, organizationId?: string): Promise<void> {
    const documentType = await prisma.documentType.findUnique({
      where: { code: typeCode },
      select: { id: true }
    });

    if (!documentType) {
      throw new Error(`Type de document invalide: ${typeCode}`);
    }

    await this.ensureDocumentBelongsToOrg(documentId, organizationId);

    await prisma.document.update({
      where: { id: documentId },
      data: {
        documentTypeId: documentType.id,
        status: 'classified',
      },
    });
  }
}

export default DocumentsService;

