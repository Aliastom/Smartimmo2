/**
 * Service de synchronisation bidirectionnelle
 * Gère la sync distante → locale et locale → distante
 */

import { getLocalDB } from './db';
import { PendingOperation, SyncMeta } from './types';
import { createBrowserClient } from '@/lib/supabase';
import type { Property } from '@prisma/client';

export interface SyncResult {
  success: boolean;
  synced: number;
  errors: number;
  error?: string;
}

/**
 * Service de synchronisation pour les biens (Property)
 */
export class PropertySyncService {
  private _dbPromise: Promise<any> | null = null;

  private async getDb() {
    if (!this._dbPromise) {
      this._dbPromise = getLocalDB();
    }
    return this._dbPromise;
  }
  private supabase = createBrowserClient();

  /**
   * Synchronise les données depuis Supabase vers la DB locale
   * Récupère uniquement les données modifiées depuis lastSyncAt
   */
  async syncFromRemote(organizationId: string): Promise<SyncResult> {
    const db = await this.getDb();
    try {
      // Récupérer la métadonnée de sync
      const syncMeta = await db.syncMeta.get('Property');
      const lastSyncAt = syncMeta?.lastSyncAt 
        ? new Date(syncMeta.lastSyncAt) 
        : new Date(0); // Sync complète si jamais synchronisé

      // Récupérer les propriétés depuis l'API Next.js
      // Note: On utilise l'API Next.js plutôt que directement Supabase pour respecter l'architecture existante
      const response = await fetch(`/api/properties?limit=10000&includeArchived=true`);
      
      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }

      const data = await response.json();
      const properties = data.data || data.properties || [];

      let synced = 0;
      let errors = 0;

      // Traiter chaque propriété
      for (const property of properties) {
        try {
          // Convertir les dates en ISO strings
          const localProperty = this.convertToLocalProperty(property);
          
          // Utiliser lastSyncAt pour déterminer si on doit mettre à jour
          const remoteUpdatedAt = new Date(localProperty.updatedAt);
          
          if (remoteUpdatedAt > lastSyncAt) {
            // Upsert dans la DB locale
            await db.Property.put(localProperty);
            synced++;
          }
        } catch (error) {
          console.error('[Sync] Erreur lors de la sync d\'un bien:', error);
          errors++;
        }
      }

      // Mettre à jour lastSyncAt
      await db.syncMeta.put({
        table: 'Property',
        lastSyncAt: new Date().toISOString(),
      });

      return { success: true, synced, errors };
    } catch (error: any) {
      console.error('[Sync] Erreur lors de la sync depuis le serveur:', error);
      const db = await this.getDb();
      
      // Enregistrer l'erreur dans syncMeta
      await db.syncMeta.put({
        table: 'Property',
        lastSyncAt: null,
        lastSyncError: error.message || 'Erreur inconnue',
      });

      return {
        success: false,
        synced: 0,
        errors: 0,
        error: error.message || 'Erreur lors de la synchronisation',
      };
    }
  }

  /**
   * Synchronise les opérations en attente vers Supabase
   */
  async syncPendingToRemote(organizationId: string): Promise<SyncResult> {
    const db = await this.getDb();
    try {
      // Récupérer les opérations en attente pour les biens
      const pendingOps = await db.pendingOperations
        .where('[entity+status]')
        .equals(['property', 'pending'])
        .toArray();

      if (pendingOps.length === 0) {
        return { success: true, synced: 0, errors: 0 };
      }

      let synced = 0;
      let errors = 0;

      for (const op of pendingOps) {
        try {
          // Marquer comme "syncing" pour éviter les doublons
          await db.pendingOperations.update(op.id, { 
            status: 'syncing',
            updatedAt: new Date().toISOString(),
          });

          // Exécuter l'opération selon le type
          let success = false;

          if (op.operation === 'create') {
            success = await this.createRemote(op.payload, organizationId);
          } else if (op.operation === 'update') {
            success = await this.updateRemote(op.entityId, op.payload, organizationId);
          } else if (op.operation === 'delete') {
            success = await this.deleteRemote(op.entityId, organizationId);
          }

          if (success) {
            // Marquer comme synchronisé
            await db.pendingOperations.update(op.id, {
              status: 'synced',
              updatedAt: new Date().toISOString(),
              errorMessage: undefined,
            });

            // Supprimer l'opération après un délai (cleanup)
            setTimeout(() => {
              db.pendingOperations.delete(op.id).catch(console.error);
            }, 24 * 60 * 60 * 1000); // 24 heures

            synced++;
          } else {
            throw new Error('Opération échouée');
          }
        } catch (error: any) {
          console.error('[Sync] Erreur lors de la sync d\'une opération:', error);
          console.error('[Sync] Opération qui a échoué:', {
            id: op.id,
            entity: op.entity,
            entityId: op.entityId,
            operation: op.operation,
            payload: op.payload,
          });
          
          // Extraire le message d'erreur détaillé
          let errorMessage = error.message || 'Erreur inconnue';
          if (error.response) {
            try {
              const errorData = await error.response.json();
              errorMessage = errorData.error || errorData.message || errorMessage;
              if (errorData.details) {
                errorMessage += ` - Détails: ${JSON.stringify(errorData.details)}`;
              }
            } catch {
              // Ignorer si on ne peut pas parser l'erreur
            }
          }
          
          // Marquer comme erreur et incrémenter retryCount
          const retryCount = (op.retryCount || 0) + 1;
          await db.pendingOperations.update(op.id, {
            status: 'error', // Marquer comme erreur si trop de retries
            errorMessage,
            retryCount,
            updatedAt: new Date().toISOString(),
          });

          // Si moins de 3 tentatives, remettre en pending pour retry
          if (retryCount < 3) {
            await db.pendingOperations.update(op.id, {
              status: 'pending',
            });
          }

          errors++;
        }
      }

      return { success: errors === 0, synced, errors };
    } catch (error: any) {
      console.error('[Sync] Erreur lors de la sync des opérations:', error);
      return {
        success: false,
        synced: 0,
        errors: 0,
        error: error.message || 'Erreur lors de la synchronisation',
      };
    }
  }

  /**
   * Crée un bien sur le serveur
   */
  private async createRemote(payload: any, organizationId: string): Promise<boolean> {
    try {
      // Transformer le payload local en format API
      const apiPayload = this.transformLocalToApiFormat(payload, false);
      
      console.log('[Sync] Création bien - Payload API:', JSON.stringify(apiPayload, null, 2));
      
      const response = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Sync] Erreur API création:', {
          status: response.status,
          error: errorData,
          payload: apiPayload,
        });
        const errorMessage = errorData.error || errorData.message || `Erreur ${response.status}`;
        const errorDetails = errorData.details ? JSON.stringify(errorData.details) : '';
        throw new Error(`${errorMessage}${errorDetails ? ` - ${errorDetails}` : ''}`);
      }

      const created = await response.json();
      console.log('[Sync] Bien créé avec succès:', created.id);
      
      // Mettre à jour l'ID local avec l'ID serveur si nécessaire
      if (payload.id && payload.id !== created.id) {
        const db = await this.getDb();
        await db.Property.update(payload.id, { id: created.id });
        // Mettre à jour aussi l'opération en attente
        await db.pendingOperations
          .where('entityId')
          .equals(payload.id)
          .modify(op => {
            op.entityId = created.id;
            op.payload = { ...op.payload, id: created.id };
          });
      }

      return true;
    } catch (error: any) {
      console.error('[Sync] Erreur createRemote:', error);
      throw error;
    }
  }

  /**
   * Met à jour un bien sur le serveur
   */
  private async updateRemote(id: string, payload: any, organizationId: string): Promise<boolean> {
    // Transformer le payload local en format API
    const apiPayload = this.transformLocalToApiFormat(payload, true);
    
    const response = await fetch(`/api/properties/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiPayload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || errorData.message || `Erreur ${response.status}`;
      const errorDetails = errorData.details ? JSON.stringify(errorData.details) : '';
      throw new Error(`${errorMessage}${errorDetails ? ` - ${errorDetails}` : ''}`);
    }

    return true;
  }

  /**
   * Supprime un bien sur le serveur
   */
  private async deleteRemote(id: string, organizationId: string): Promise<boolean> {
    const response = await fetch(`/api/properties/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'archive' }), // Utiliser le mode archive par défaut
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Erreur ${response.status}`);
    }

    return true;
  }

  /**
   * Convertit une propriété serveur en propriété locale
   */
  private convertToLocalProperty(property: any): any {
    return {
      ...property,
      acquisitionDate: property.acquisitionDate ? new Date(property.acquisitionDate).toISOString() : new Date().toISOString(),
      archivedAt: property.archivedAt ? new Date(property.archivedAt).toISOString() : null,
      createdAt: property.createdAt ? new Date(property.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: property.updatedAt ? new Date(property.updatedAt).toISOString() : new Date().toISOString(),
      evalDate: property.evalDate ? new Date(property.evalDate).toISOString() : null,
    };
  }

  /**
   * Transforme un payload local (IndexedDB) vers le format attendu par l'API
   */
  private transformLocalToApiFormat(localPayload: any, isUpdate: boolean): any {
    // Exclure les métadonnées de sync et les champs calculés
    const {
      _localUpdatedAt,
      _syncedAt,
      createdAt, // Ne pas envoyer createdAt en création/mise à jour (géré par le serveur)
      updatedAt, // Ne pas envoyer updatedAt (géré par le serveur)
      id, // Ne pas envoyer id en création (l'API le génère)
      ...payload
    } = localPayload;

    // Préparer le payload API avec seulement les champs attendus
    const apiPayload: any = {};

    // Champs requis (toujours présents)
    apiPayload.name = payload.name || '';
    apiPayload.type = payload.type || 'apartment';
    apiPayload.address = payload.address || '';
    apiPayload.postalCode = payload.postalCode || '';
    apiPayload.city = payload.city || '';
    
    // Nombres (convertir depuis string si nécessaire, avec validation)
    apiPayload.surface = this.parseNumber(payload.surface, 0);
    apiPayload.rooms = this.parseInt(payload.rooms, 1);
    apiPayload.acquisitionPrice = this.parseNumber(payload.acquisitionPrice, 0);
    apiPayload.notaryFees = this.parseNumber(payload.notaryFees, 0);
    apiPayload.currentValue = this.parseNumber(payload.currentValue, payload.acquisitionPrice || 0);
    
    // Dates (string ISO pour l'API - le schéma attend une string)
    if (payload.acquisitionDate) {
      apiPayload.acquisitionDate = typeof payload.acquisitionDate === 'string' 
        ? payload.acquisitionDate 
        : new Date(payload.acquisitionDate).toISOString();
    } else {
      apiPayload.acquisitionDate = new Date().toISOString();
    }
    
    // Champs optionnels (ne les inclure que s'ils ont une valeur)
    if (payload.status !== undefined && payload.status !== null && payload.status !== '') {
      apiPayload.status = payload.status;
    }
    if (payload.occupation !== undefined && payload.occupation !== null && payload.occupation !== '') {
      apiPayload.occupation = payload.occupation;
    }
    if (payload.statusMode !== undefined && payload.statusMode !== null && payload.statusMode !== '') {
      apiPayload.statusMode = payload.statusMode;
    }
    if (payload.statusManual !== undefined && payload.statusManual !== null && payload.statusManual !== '') {
      apiPayload.statusManual = payload.statusManual;
    }
    if (payload.notes !== undefined && payload.notes !== null && payload.notes !== '') {
      apiPayload.notes = payload.notes;
    }
    if (payload.managementCompanyId !== undefined && payload.managementCompanyId !== null && payload.managementCompanyId !== '') {
      apiPayload.managementCompanyId = payload.managementCompanyId;
    }
    if (payload.fiscalTypeId !== undefined && payload.fiscalTypeId !== null && payload.fiscalTypeId !== '') {
      apiPayload.fiscalTypeId = payload.fiscalTypeId;
    }
    if (payload.fiscalRegimeId !== undefined && payload.fiscalRegimeId !== null && payload.fiscalRegimeId !== '') {
      apiPayload.fiscalRegimeId = payload.fiscalRegimeId;
    }
    if (payload.lmnpActivityId !== undefined && payload.lmnpActivityId !== null && payload.lmnpActivityId !== '') {
      apiPayload.lmnpActivityId = payload.lmnpActivityId;
    }
    if (payload.rentalMode !== undefined && payload.rentalMode !== null && payload.rentalMode !== '') {
      apiPayload.rentalMode = payload.rentalMode;
    }
    if (payload.airbnbListingId !== undefined && payload.airbnbListingId !== null && payload.airbnbListingId !== '') {
      apiPayload.airbnbListingId = payload.airbnbListingId;
    }
    if (payload.exitFeesRate !== undefined && payload.exitFeesRate !== null) {
      apiPayload.exitFeesRate = this.parseNumber(payload.exitFeesRate, null);
      if (apiPayload.exitFeesRate === null) {
        delete apiPayload.exitFeesRate;
      }
    }
    if (payload.evalSource !== undefined && payload.evalSource !== null && payload.evalSource !== '') {
      apiPayload.evalSource = payload.evalSource;
    }
    if (payload.evalDate !== undefined && payload.evalDate !== null) {
      apiPayload.evalDate = typeof payload.evalDate === 'string' 
        ? payload.evalDate 
        : new Date(payload.evalDate).toISOString();
    }

    return apiPayload;
  }

  /**
   * Parse un nombre avec gestion des erreurs
   */
  private parseNumber(value: any, defaultValue: number | null = 0): number {
    if (value === null || value === undefined) return defaultValue || 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? (defaultValue || 0) : parsed;
    }
    return defaultValue || 0;
  }

  /**
   * Parse un entier avec gestion des erreurs
   */
  private parseInt(value: any, defaultValue: number = 0): number {
    if (value === null || value === undefined) return defaultValue;
    if (typeof value === 'number') return Math.floor(value);
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? defaultValue : parsed;
    }
    return defaultValue;
  }
}

// Instance singleton
let syncServiceInstance: PropertySyncService | null = null;

export function getPropertySyncService(): PropertySyncService {
  if (typeof window === 'undefined') {
    throw new Error('SyncService ne peut être utilisé que côté client');
  }

  if (!syncServiceInstance) {
    syncServiceInstance = new PropertySyncService();
  }

  return syncServiceInstance;
}





