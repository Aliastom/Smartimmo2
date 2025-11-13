export type DocType = 'invoice' | 'receipt' | 'lease' | 'loan' | 'tax' | 'photo' | 'other';

export interface Document {
  id: string;
  fileName: string;
  mime: string;
  size: number;
  url: string;
  sha256?: string;
  docType: DocType;
  tagsJson?: string; // JSON string for SQLite
  propertyId?: string;
  transactionId?: string;
  leaseId?: string;
  loanId?: string;
  createdAt: Date;
  updatedAt: Date;
}
