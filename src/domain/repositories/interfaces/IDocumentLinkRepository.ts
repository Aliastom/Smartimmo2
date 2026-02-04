/**
 * Interface pour le repository de liens de documents
 */

export interface DocumentLink {
  documentId: string;
  linkedType: string;
  linkedId: string;
  entityName?: string | null;
}

export interface CreateDocumentLinkData {
  documentId: string;
  linkedType: string;
  linkedId: string;
  entityName?: string | null;
}

export interface DocumentLinkWhere {
  documentId?: string;
  linkedType?: string;
  linkedId?: string;
  linkedType_linkedId?: { linkedType: string; linkedId: string };
}

export interface IDocumentLinkRepository {
  findMany(where: DocumentLinkWhere): Promise<DocumentLink[]>;
  create(data: CreateDocumentLinkData): Promise<DocumentLink>;
  deleteMany(where: DocumentLinkWhere): Promise<void>;
}

