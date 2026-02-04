/**
 * Repository offline-first pour les profils utilisateur (UserProfile)
 * Lecture depuis la DB locale (instantané), écriture locale + sync en arrière-plan
 */

import { BaseOfflineRepository, BaseEntity } from './BaseOfflineRepository';
import { LocalUserProfile } from '../db';

export class UserProfileRepositoryOffline extends BaseOfflineRepository<LocalUserProfile> {
  constructor() {
    super({
      entityName: 'userProfile',
      tableName: 'UserProfile',
      apiRoute: '/api/profiles',
      idField: 'id',
    });
  }

  /**
   * Récupère le profil d'une organisation (il n'y a qu'un seul profil par organisation)
   */
  async getByOrganizationId(organizationId: string): Promise<LocalUserProfile | null> {
    const profiles = await this.getAll(organizationId);
    return profiles.length > 0 ? profiles[0] : null;
  }

  /**
   * Normalise les données pour le stockage local
   */
  protected async normalizeForLocal(
    data: Partial<LocalUserProfile>,
    isUpdate: boolean
  ): Promise<Partial<LocalUserProfile>> {
    // S'assurer que les champs requis ont des valeurs par défaut
    return {
      ...data,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      email: data.email || '',
    };
  }
}

// Singleton
let instance: UserProfileRepositoryOffline | null = null;

export function getUserProfileRepositoryOffline(): UserProfileRepositoryOffline {
  if (!instance) {
    instance = new UserProfileRepositoryOffline();
  }
  return instance;
}

