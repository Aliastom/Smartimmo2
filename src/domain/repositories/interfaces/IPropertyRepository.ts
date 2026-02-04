/**
 * Interface pour le repository de propriétés
 */

export interface Property {
  id: string;
  organizationId: string;
  name: string;
  type?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  surface?: number | null;
  rooms?: number | null;
  acquisitionDate?: Date | null;
  acquisitionPrice?: number | null;
  notaryFees?: number | null;
  currentValue?: number | null;
  status?: string | null;
  occupation?: string | null;
  notes?: string | null;
  managementCompanyId?: string | null;
  fiscalTypeId?: string | null;
  fiscalRegimeId?: string | null;
  rentalMode?: string | null;
  airbnbListingId?: string | null;
  isArchived?: boolean;
  archivedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  ManagementCompany?: ManagementCompany | null;
}

export interface ManagementCompany {
  id: string;
  organizationId: string;
  nom: string;
  modeCalcul?: string;
  taux?: number;
  fraisMin?: number | null;
  tvaApplicable?: boolean;
  tauxTva?: number | null;
  actif?: boolean;
}

export interface PropertyWithCompany extends Property {
  ManagementCompany: ManagementCompany | null;
}

export interface CreatePropertyData {
  organizationId: string;
  name: string;
  type: string;
  address: string;
  postalCode: string;
  city: string;
  surface: number;
  rooms: number;
  acquisitionDate: Date;
  acquisitionPrice: number;
  notaryFees?: number | null;
  currentValue?: number | null;
  status?: string | null;
  occupation?: string | null;
  notes?: string | null;
  managementCompanyId?: string | null;
  fiscalTypeId?: string | null;
  fiscalRegimeId?: string | null;
  rentalMode?: string | null;
  airbnbListingId?: string | null;
}

export interface UpdatePropertyData {
  name?: string;
  type?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  surface?: number;
  rooms?: number;
  acquisitionDate?: Date;
  acquisitionPrice?: number;
  notaryFees?: number | null;
  currentValue?: number | null;
  status?: string | null;
  occupation?: string | null;
  notes?: string | null;
  managementCompanyId?: string | null;
  fiscalTypeId?: string | null;
  fiscalRegimeId?: string | null;
  rentalMode?: string | null;
  airbnbListingId?: string | null;
  isArchived?: boolean;
  archivedAt?: Date | null;
}

export interface PropertyStats {
  leases: number;
  transactions: number;
  documents: number;
  echeances: number;
  loans: number;
}

export interface IPropertyRepository {
  // CRUD
  create(data: CreatePropertyData): Promise<Property>;
  update(id: string, data: UpdatePropertyData): Promise<Property>;
  delete(id: string, mode?: 'archive' | 'cascade'): Promise<void>;
  
  // Queries
  findById(id: string, organizationId: string): Promise<Property | null>;
  findFirst(where: { id: string; organizationId: string }): Promise<Property | null>;
  findFirstWithManagementCompany(where: { id: string; organizationId: string }): Promise<PropertyWithCompany | null>;
  
  // Stats
  getStats(propertyId: string, organizationId: string): Promise<PropertyStats>;
  
  // Reassign (pour mode reassign)
  reassignLeases(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void>;
  reassignTransactions(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void>;
  reassignDocuments(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void>;
  reassignEcheances(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void>;
  reassignLoans(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void>;
  reassignPayments(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void>;
  reassignPhotos(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void>;
  reassignOccupancyHistory(sourcePropertyId: string, targetPropertyId: string, organizationId: string): Promise<void>;
}

