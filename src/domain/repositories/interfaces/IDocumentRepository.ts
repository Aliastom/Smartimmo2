/**
 * Interface pour le repository de documents
 */

export interface Document {
  id: string;
  organizationId: string;
  fileName: string;
  filenameOriginal?: string | null;
  fileSha256?: string | null;
  textSha256?: string | null;
  status?: string;
  bucketKey?: string | null;
  isFavorite?: boolean;
}

export interface DocumentWhere {
  id?: string | { in: string[] };
  organizationId?: string;
  status?: string;
  fileSha256?: string | { in: string[] };
  textSha256?: string | null;
}

export interface DuplicateCheckResult {
  hasExactDuplicate: boolean;
  exactDuplicate?: Document | null;
}

export interface IDocumentRepository {
  findMany(where: DocumentWhere): Promise<Document[]>;
  updateMany(where: DocumentWhere, data: Partial<Document>): Promise<void>;
  delete(id: string, organizationId?: string): Promise<void>; // organizationId optionnel pour pendingOp
  checkDuplicates(params: { fileSha256?: string; textSha256?: string; organizationId: string }): Promise<DuplicateCheckResult>;
}

