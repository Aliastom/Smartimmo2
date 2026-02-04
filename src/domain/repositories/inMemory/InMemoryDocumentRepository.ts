/**
 * Implémentation in-memory du repository de documents
 */

import type {
  IDocumentRepository,
  Document,
  DocumentWhere,
  DuplicateCheckResult,
} from '../interfaces/IDocumentRepository';

export class InMemoryDocumentRepository implements IDocumentRepository {
  private documents: Map<string, Document> = new Map();

  async findMany(where: DocumentWhere): Promise<Document[]> {
    let results = Array.from(this.documents.values());

    if (where.organizationId) {
      results = results.filter(doc => doc.organizationId === where.organizationId);
    }
    if (where.id) {
      if (typeof where.id === 'string') {
        results = results.filter(doc => doc.id === where.id);
      } else if ('in' in where.id) {
        results = results.filter(doc => where.id && 'in' in where.id && where.id.in.includes(doc.id));
      }
    }
    if (where.status) {
      results = results.filter(doc => doc.status === where.status);
    }
    if (where.fileSha256) {
      if (typeof where.fileSha256 === 'string') {
        results = results.filter(doc => doc.fileSha256 === where.fileSha256);
      } else if ('in' in where.fileSha256) {
        results = results.filter(doc => doc.fileSha256 && where.fileSha256 && 'in' in where.fileSha256 && where.fileSha256.in.includes(doc.fileSha256));
      }
    }

    return results;
  }

  async updateMany(where: DocumentWhere, data: Partial<Document>): Promise<void> {
    const toUpdate = await this.findMany(where);
    for (const doc of toUpdate) {
      const updated = { ...doc, ...data };
      this.documents.set(doc.id, updated);
    }
  }

  async delete(id: string): Promise<void> {
    if (!this.documents.has(id)) {
      throw new Error(`Document ${id} not found`);
    }
    this.documents.delete(id);
  }

  async checkDuplicates(params: { fileSha256?: string; textSha256?: string; organizationId: string }): Promise<DuplicateCheckResult> {
    let duplicates: Document[] = [];

    if (params.fileSha256) {
      duplicates = Array.from(this.documents.values()).filter(
        doc => doc.fileSha256 === params.fileSha256 &&
               doc.organizationId === params.organizationId &&
               doc.status === 'active'
      );
    }

    if (duplicates.length > 0) {
      return {
        hasExactDuplicate: true,
        exactDuplicate: duplicates[0],
      };
    }

    return {
      hasExactDuplicate: false,
      exactDuplicate: null,
    };
  }

  // Méthodes utilitaires pour les tests
  clear(): void {
    this.documents.clear();
  }

  seed(documents: Document[]): void {
    for (const doc of documents) {
      this.documents.set(doc.id, doc);
    }
  }

  getAll(): Document[] {
    return Array.from(this.documents.values());
  }
}

