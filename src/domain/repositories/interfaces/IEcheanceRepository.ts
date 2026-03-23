/**
 * Interface pour le repository d'échéances récurrentes
 */

export interface Echeance {
  id: string;
  organizationId: string;
  propertyId?: string | null;
  leaseId?: string | null;
  label: string;
  type: string;
  natureCode?: string | null;
  defaultCategoryId?: string | null;
  periodicite: string;
  montant: number;
  recuperable: boolean;
  sens: string;
  startAt: Date | string;
  endAt?: Date | string | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateEcheanceData {
  organizationId: string;
  propertyId?: string | null;
  leaseId?: string | null;
  label: string;
  type: string;
  natureCode?: string | null;
  defaultCategoryId?: string | null;
  periodicite: string;
  montant: number;
  recuperable: boolean;
  sens: string;
  startAt: Date | string;
  endAt?: Date | string | null;
  isActive: boolean;
}

export interface UpdateEcheanceData {
  propertyId?: string | null;
  leaseId?: string | null;
  label?: string;
  type?: string;
  natureCode?: string | null;
  defaultCategoryId?: string | null;
  periodicite?: string;
  montant?: number;
  recuperable?: boolean;
  sens?: string;
  startAt?: Date | string;
  endAt?: Date | string | null;
  isActive?: boolean;
}

export interface IEcheanceRepository {
  findFirst(params: { id: string; organizationId: string }): Promise<Echeance | null>;
  create(data: CreateEcheanceData): Promise<Echeance>;
  update(id: string, data: UpdateEcheanceData, organizationId: string): Promise<Echeance>;
  delete(id: string, organizationId: string, mode?: 'soft' | 'hard'): Promise<void>;
  getAll(organizationId: string, filters?: { propertyId?: string; leaseId?: string; type?: string; isActive?: boolean }): Promise<Echeance[]>;
}

