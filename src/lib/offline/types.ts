/**
 * Types pour le système offline-first
 */

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export type PendingOperationType = 'create' | 'update' | 'delete';

export interface PendingOperation {
  id: string;
  entity: string; // 'property', 'lease', etc.
  entityId: string;
  operation: PendingOperationType;
  payload: Record<string, any>;
  status: 'pending' | 'syncing' | 'synced' | 'error';
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  errorMessage?: string;
  retryCount: number;
}

export interface SyncMeta {
  table: string;
  lastSyncAt: string | null; // ISO string ou null
  lastSyncError?: string;
}

export interface SyncState {
  status: SyncStatus;
  pendingOperationsCount: number;
  lastSyncAt: string | null;
  isOnline: boolean;
  error?: string;
}

// Type pour les biens (Property) stockés localement
export interface LocalProperty {
  id: string;
  organizationId: string;
  name: string;
  type: string;
  address: string;
  postalCode: string;
  city: string;
  surface: number;
  rooms: number;
  acquisitionDate: string; // ISO string
  acquisitionPrice: number;
  notaryFees: number;
  currentValue: number;
  status: string;
  statusMode: string;
  statusManual?: string | null;
  occupation: string;
  evalSource?: string | null;
  evalDate?: string | null;
  exitFeesRate?: number | null;
  notes?: string | null;
  managementCompanyId?: string | null;
  fiscalTypeId?: string | null;
  fiscalRegimeId?: string | null;
  rentalMode: string;
  airbnbListingId?: string | null;
  isArchived: boolean;
  archivedAt?: string | null;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  
  // Métadonnées de sync
  _localUpdatedAt?: string; // Pour détecter les modifications locales
  _syncedAt?: string; // Dernière sync réussie
}





