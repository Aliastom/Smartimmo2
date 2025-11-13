import { PrismaClient } from '@prisma/client';
import { getOcrService } from '../ocr.service';
import { getClassificationService } from '../classification.service';
import { getExtractionService } from '../extraction.service';
import { getStorageService } from '../storage.service';
import { ReminderKind } from '@/types/documents';
import { prisma } from '@/lib/prisma';

/**
 * Service de queue pour le traitement des documents
 * ImplÃ©mentation simple en mÃ©moire, extensible vers BullMQ
 */



export type JobType = 'ocr' | 'classify' | 'extract' | 'index' | 'reminders' | 'gc';

export interface Job {
  id: string;
  type: JobType;
  documentId: string;
  data: any;
  status: 'pending' | 'processing' | 'success' | 'failed';
  attempts: number;
  maxAttempts: number;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

class DocumentQueueService {
  private jobs: Map<string, Job> = new Map();
  private processing = false;
  private subscribers: Map<string, Set<(job: Job) => void>> = new Map();

  /**
   * Ajoute un job Ã  la queue
   */
  async addJob(
    type: JobType,
    documentId: string,
    data: any = {},
    priority: number = 0
  ): Promise<string> {
    const jobId = `${type}-${documentId}-${Date.now()}`;

    const job: Job = {
      id: jobId,
      type,
      documentId,
      data,
      status: 'pending',
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
    };

    this.jobs.set(jobId, job);

    // DÃ©marrer le traitement si pas dÃ©jÃ  en cours
    if (!this.processing) {
      this.processQueue();
    }

    return jobId;
  }

  /**
   * Traite la queue
   */
  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.jobs.size > 0) {
      // Trouver le prochain job pending
      const job = Array.from(this.jobs.values()).find(j => j.status === 'pending');
      
      if (!job) break;

      await this.processJob(job);
    }

    this.processing = false;
  }

  /**
   * Traite un job
   */
  private async processJob(job: Job) {
    job.status = 'processing';
    job.attempts++;
    job.startedAt = new Date();
    this.notifySubscribers(job);

    try {
      switch (job.type) {
        case 'ocr':
          await this.handleOcrJob(job);
          break;
        case 'classify':
          await this.handleClassifyJob(job);
          break;
        case 'extract':
          await this.handleExtractJob(job);
          break;
        case 'index':
          await this.handleIndexJob(job);
          break;
        case 'reminders':
          await this.handleRemindersJob(job);
          break;
        case 'gc':
          await this.handleGcJob(job);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      job.status = 'success';
      job.completedAt = new Date();
      this.notifySubscribers(job);
      this.jobs.delete(job.id);
    } catch (error: any) {
      console.error(`Job ${job.id} failed:`, error);
      job.error = error.message;

      if (job.attempts < job.maxAttempts) {
        // Retry
        job.status = 'pending';
        await new Promise(resolve => setTimeout(resolve, 1000 * job.attempts)); // Backoff
      } else {
        job.status = 'failed';
        job.completedAt = new Date();
        this.jobs.delete(job.id);
      }

      this.notifySubscribers(job);
    }
  }

  /**
   * Job OCR: extrait le texte du document
   */
  private async handleOcrJob(job: Job) {
    const document = await prisma.document.findUnique({
      where: { id: job.documentId },
    });

    if (!document) {
      throw new Error(`Document ${job.documentId} not found`);
    }

    // Mettre Ã  jour le statut
    await prisma.document.update({
      where: { id: job.documentId },
      data: { ocrStatus: 'processing' },
    });

    try {
      // TÃ©lÃ©charger le document
      const storageService = getStorageService();
      const buffer = await storageService.downloadDocument(document.bucketKey);

      // Extraire le texte
      const ocrService = getOcrService();
      const ocrResult = await ocrService.extractText(buffer, document.mime);

      // Sauvegarder le texte indexÃ©
      for (const page of ocrResult.pages) {
        await prisma.documentTextIndex.upsert({
          where: {
            documentId_page: {
              documentId: job.documentId,
              page: page.pageNumber,
            },
          },
          create: {
            documentId: job.documentId,
            page: page.pageNumber,
            content: page.text,
            metadata: page.metadata ? JSON.stringify(page.metadata) : null,
          },
          update: {
            content: page.text,
            metadata: page.metadata ? JSON.stringify(page.metadata) : null,
          },
        });
      }

      // Mettre Ã  jour le document
      await prisma.document.update({
        where: { id: job.documentId },
        data: {
          ocrStatus: 'success',
          ocrError: null,
        },
      });

      // Lancer la classification
      await this.addJob('classify', job.documentId);
    } catch (error: any) {
      await prisma.document.update({
        where: { id: job.documentId },
        data: {
          ocrStatus: 'failed',
          ocrError: error.message,
        },
      });
      throw error;
    }
  }

  /**
   * Job Classification: dÃ©termine le type de document
   */
  private async handleClassifyJob(job: Job) {
    const document = await prisma.document.findUnique({
      where: { id: job.documentId },
      include: { textIndex: true },
    });

    if (!document) {
      throw new Error(`Document ${job.documentId} not found`);
    }

    // ConcatÃ©ner le texte
    const fullText = document.textIndex
      .sort((a, b) => a.page - b.page)
      .map(ti => ti.content)
      .join('\n\n');

    // Classifier
    const classificationService = getClassificationService();
    const result = await classificationService.classify(
      job.documentId,
      fullText,
      document.filenameOriginal
    );

    // Sauvegarder le rÃ©sultat
    await prisma.document.update({
      where: { id: job.documentId },
      data: {
        documentTypeId: result.autoAssigned && result.suggested ? result.suggested.typeId : null,
        typeConfidence: result.suggested?.confidence,
        typeAlternatives: JSON.stringify(result.alternatives),
      },
    });

    // Si auto-assignÃ©, lancer l'extraction
    if (result.autoAssigned && result.suggested) {
      await this.addJob('extract', job.documentId);
    }
  }

  /**
   * Job Extraction: extrait les champs du document
   */
  private async handleExtractJob(job: Job) {
    const document = await prisma.document.findUnique({
      where: { id: job.documentId },
      include: { textIndex: true },
    });

    if (!document || !document.documentTypeId) {
      throw new Error(`Document ${job.documentId} not found or not classified`);
    }

    // ConcatÃ©ner le texte
    const fullText = document.textIndex
      .sort((a, b) => a.page - b.page)
      .map(ti => ti.content)
      .join('\n\n');

    // Extraire les champs
    const extractionService = getExtractionService();
    const result = await extractionService.extractFields(
      job.documentId,
      document.documentTypeId,
      fullText
    );

    // Sauvegarder
    await extractionService.saveExtractedFields(job.documentId, result.DocumentField);

    // Lancer l'indexation
    await this.addJob('index', job.documentId);

    // CrÃ©er les rappels si applicable
    await this.addJob('reminders', job.documentId);
  }

  /**
   * Job Indexation: indexe le document pour la recherche full-text
   */
  private async handleIndexJob(job: Job) {
    // Pour SQLite, on n'a pas de FTS natif performant
    // On marque juste le document comme indexÃ©
    await prisma.document.update({
      where: { id: job.documentId },
      data: { indexed: true },
    });

    // TODO: ImplÃ©menter avec ElasticSearch, Algolia, ou PostgreSQL FTS
  }

  /**
   * Job Reminders: crÃ©e les rappels automatiques
   */
  private async handleRemindersJob(job: Job) {
    const document = await prisma.document.findUnique({
      where: { id: job.documentId },
      include: {
        DocumentType: true,
        fields: true,
      },
    });

    if (!document || !document.DocumentType) {
      return;
    }

    const extractionService = getExtractionService();
    const specificFields = extractionService.extractSpecificFields(
      document.DocumentType.code,
      document.DocumentField
    );

    // CrÃ©er les rappels selon le type de document
    switch (document.DocumentType.code) {
      case 'ATTESTATION_ASSURANCE':
        if (specificFields.expiry_date) {
          const expiryDate = new Date(specificFields.expiry_date);
          
          // Rappel J-30
          await this.createReminder({
            documentId: job.documentId,
            ownerId: document.ownerId,
            kind: ReminderKind.INSURANCE_EXPIRY,
            title: `Attestation d'assurance expire dans 30 jours`,
            dueDate: new Date(expiryDate.getTime() - 30 * 24 * 60 * 60 * 1000),
            alertDays: [30],
          });

          // Rappel J-7
          await this.createReminder({
            documentId: job.documentId,
            ownerId: document.ownerId,
            kind: ReminderKind.INSURANCE_EXPIRY,
            title: `Attestation d'assurance expire dans 7 jours`,
            dueDate: new Date(expiryDate.getTime() - 7 * 24 * 60 * 60 * 1000),
            alertDays: [7],
          });
        }
        break;

      case 'DPE':
        if (specificFields.valid_until) {
          const validUntil = new Date(specificFields.valid_until);
          
          await this.createReminder({
            documentId: job.documentId,
            ownerId: document.ownerId,
            kind: ReminderKind.DPE_EXPIRY,
            title: `DPE expire dans 30 jours`,
            dueDate: new Date(validUntil.getTime() - 30 * 24 * 60 * 60 * 1000),
            alertDays: [30, 7],
          });
        }
        break;

      case 'TAXE_FONCIERE':
        // Rappel de paiement (gÃ©nÃ©ralement octobre)
        if (specificFields.year) {
          const year = specificFields.year;
          const paymentDate = new Date(year, 9, 15); // 15 octobre
          
          await this.createReminder({
            documentId: job.documentId,
            ownerId: document.ownerId,
            kind: ReminderKind.TAX_PAYMENT,
            title: `Paiement de la taxe fonciÃ¨re ${year}`,
            dueDate: paymentDate,
            alertDays: [30, 15, 7],
          });
        }
        break;
    }
  }

  /**
   * Job GC: garbage collection des fichiers supprimÃ©s
   */
  private async handleGcJob(job: Job) {
    // Trouver les documents supprimÃ©s depuis plus de 30 jours
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const deletedDocuments = await prisma.document.findMany({
      where: {
        deletedAt: {
          lte: thirtyDaysAgo,
        },
      },
    });

    const storageService = getStorageService();

    for (const doc of deletedDocuments) {
      try {
        // Supprimer le fichier physique
        await storageService.deleteDocument(doc.bucketKey);

        // Supprimer l'entrÃ©e en base
        await prisma.document.delete({
          where: { id: doc.id },
        });

        console.log(`GC: Deleted document ${doc.id}`);
      } catch (error) {
        console.error(`GC: Failed to delete document ${doc.id}:`, error);
      }
    }
  }

  /**
   * CrÃ©e un rappel
   */
  private async createReminder(data: {
    documentId: string;
    ownerId: string;
    kind: string;
    title: string;
    dueDate: Date;
    alertDays?: number[];
    description?: string;
  }) {
    // VÃ©rifier qu'un rappel similaire n'existe pas dÃ©jÃ 
    const existing = await prisma.reminder.findFirst({
      where: {
        documentId: data.documentId,
        kind: data.kind,
        dueDate: data.dueDate,
      },
    });

    if (existing) {
      return;
    }

    await prisma.reminder.create({
      data: {
        ownerId: data.ownerId,
        documentId: data.documentId,
        kind: data.kind,
        title: data.title,
        description: data.description,
        dueDate: data.dueDate,
        alertDays: data.alertDays ? JSON.stringify(data.alertDays) : null,
        autoCreated: true,
        status: 'open',
      },
    });
  }

  /**
   * Subscribe to job updates
   */
  subscribe(documentId: string, callback: (job: Job) => void) {
    if (!this.subscribers.has(documentId)) {
      this.subscribers.set(documentId, new Set());
    }
    this.subscribers.get(documentId)!.add(callback);
  }

  /**
   * Unsubscribe from job updates
   */
  unsubscribe(documentId: string, callback: (job: Job) => void) {
    const subs = this.subscribers.get(documentId);
    if (subs) {
      subs.delete(callback);
      if (subs.size === 0) {
        this.subscribers.delete(documentId);
      }
    }
  }

  /**
   * Notify subscribers
   */
  private notifySubscribers(job: Job) {
    const subs = this.subscribers.get(job.documentId);
    if (subs) {
      subs.forEach(callback => callback(job));
    }
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs for a document
   */
  getDocumentJobs(documentId: string): Job[] {
    return Array.from(this.jobs.values()).filter(j => j.documentId === documentId);
  }
}

// Instance singleton
let queueServiceInstance: DocumentQueueService | null = null;

export function getDocumentQueueService(): DocumentQueueService {
  if (!queueServiceInstance) {
    queueServiceInstance = new DocumentQueueService();
  }
  return queueServiceInstance;
}

export default DocumentQueueService;

