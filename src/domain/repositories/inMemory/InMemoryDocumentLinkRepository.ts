/**
 * Implémentation in-memory du repository de liens de documents
 */

import type {
  IDocumentLinkRepository,
  DocumentLink,
  CreateDocumentLinkData,
  DocumentLinkWhere,
} from '../interfaces/IDocumentLinkRepository';

export class InMemoryDocumentLinkRepository implements IDocumentLinkRepository {
  private links: Map<string, DocumentLink> = new Map();

  private getKey(link: { documentId: string; linkedType: string; linkedId: string }): string {
    return `${link.documentId}::${link.linkedType}::${link.linkedId}`;
  }

  async findMany(where: DocumentLinkWhere): Promise<DocumentLink[]> {
    let results = Array.from(this.links.values());

    if (where.documentId) {
      results = results.filter(link => link.documentId === where.documentId);
    }
    if (where.linkedType) {
      results = results.filter(link => link.linkedType === where.linkedType);
    }
    if (where.linkedId) {
      results = results.filter(link => link.linkedId === where.linkedId);
    }
    if (where.linkedType_linkedId) {
      results = results.filter(
        link =>
          link.linkedType === where.linkedType_linkedId!.linkedType &&
          link.linkedId === where.linkedType_linkedId!.linkedId
      );
    }

    return results;
  }

  async create(data: CreateDocumentLinkData): Promise<DocumentLink> {
    const key = this.getKey(data);
    if (this.links.has(key)) {
      // Lien déjà existant, retourner l'existant
      return this.links.get(key)!;
    }

    const link: DocumentLink = {
      documentId: data.documentId,
      linkedType: data.linkedType,
      linkedId: data.linkedId,
      entityName: data.entityName ?? null,
    };

    this.links.set(key, link);
    return link;
  }

  async deleteMany(where: DocumentLinkWhere): Promise<void> {
    const toDelete = await this.findMany(where);
    for (const link of toDelete) {
      const key = this.getKey(link);
      this.links.delete(key);
    }
  }

  // Méthodes utilitaires pour les tests
  clear(): void {
    this.links.clear();
  }

  seed(links: DocumentLink[]): void {
    for (const link of links) {
      const key = this.getKey(link);
      this.links.set(key, link);
    }
  }

  getAll(): DocumentLink[] {
    return Array.from(this.links.values());
  }
}

