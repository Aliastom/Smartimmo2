/**
 * Interface pour le repository de baux
 */

export interface Lease {
  id: string;
  organizationId: string;
  propertyId: string;
  tenantId: string;
  type?: string | null;
  furnishedType?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  rentAmount?: number | null;
  deposit?: number | null;
  paymentDay?: number | null;
  indexationType?: string | null;
  notes?: string | null;
  status?: string | null;
  signedPdfUrl?: string | null;
  chargesRecupMensuelles?: number | null;
  chargesNonRecupMensuelles?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateLeaseData {
  organizationId: string;
  propertyId: string;
  tenantId: string;
  type: string;
  furnishedType?: string | null;
  startDate: Date;
  endDate?: Date | null;
  rentAmount: number;
  deposit?: number | null;
  paymentDay?: number | null;
  indexationType?: string | null;
  notes?: string | null;
  status?: string | null;
  signedPdfUrl?: string | null;
  chargesRecupMensuelles?: number | null;
  chargesNonRecupMensuelles?: number | null;
}

export interface UpdateLeaseData {
  propertyId?: string;
  tenantId?: string;
  type?: string;
  furnishedType?: string | null;
  startDate?: Date;
  endDate?: Date | null;
  rentAmount?: number;
  deposit?: number | null;
  paymentDay?: number | null;
  indexationType?: string | null;
  notes?: string | null;
  status?: string | null;
  signedPdfUrl?: string | null;
  chargesRecupMensuelles?: number | null;
  chargesNonRecupMensuelles?: number | null;
}

export interface LeaseWhere {
  id?: string;
  organizationId?: string;
  propertyId?: string;
  tenantId?: string;
  status?: string;
}

export interface ILeaseRepository {
  // CRUD
  create(data: CreateLeaseData): Promise<Lease>;
  update(id: string, data: UpdateLeaseData): Promise<Lease>;
  delete(id: string): Promise<void>;
  
  // Queries
  findById(id: string, organizationId: string): Promise<Lease | null>;
  findFirst(where: LeaseWhere): Promise<Lease | null>;
  findByPropertyId(propertyId: string, organizationId: string): Promise<Lease[]>;
  findByTenantId(tenantId: string, organizationId: string): Promise<Lease[]>;
  findMany(where: LeaseWhere): Promise<Lease[]>;
  
  // Utilitaires
  countTransactions(leaseId: string, organizationId: string): Promise<number>;
}

