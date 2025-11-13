import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

/**
 * Service de stockage de documents
 * Implémentation locale pour développement, extensible pour S3/Supabase
 */

export interface StorageProvider {
  upload(buffer: Buffer, key: string, mime: string): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getPublicUrl(key: string): Promise<string>;
}

/**
 * Implémentation locale du stockage (fichiers sur disque)
 */
class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor(basePath: string = './storage/documents') {
    this.basePath = basePath;
  }

  private getFullPath(key: string): string {
    return path.join(process.cwd(), this.basePath, key);
  }

  async upload(buffer: Buffer, key: string, mime: string): Promise<string> {
    const fullPath = this.getFullPath(key);
    const dir = path.dirname(fullPath);

    // Créer les répertoires si nécessaire
    await fs.mkdir(dir, { recursive: true });

    // Écrire le fichier
    await fs.writeFile(fullPath, buffer);

    return key;
  }

  async download(key: string): Promise<Buffer> {
    const fullPath = this.getFullPath(key);
    return await fs.readFile(fullPath);
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.getFullPath(key);
    try {
      await fs.unlink(fullPath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = this.getFullPath(key);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async getPublicUrl(key: string): Promise<string> {
    // En local, retourner un chemin relatif qui sera servi par Next.js
    return `/api/documents/download/${encodeURIComponent(key)}`;
  }
}

/**
 * Stub pour S3/Supabase Storage
 * À implémenter selon le provider choisi
 */
class S3StorageProvider implements StorageProvider {
  private bucket: string;
  private region: string;
  private accessKey: string;
  private secretKey: string;

  constructor(config: {
    bucket: string;
    region: string;
    accessKey: string;
    secretKey: string;
  }) {
    this.bucket = config.bucket;
    this.region = config.region;
    this.accessKey = config.accessKey;
    this.secretKey = config.secretKey;
  }

  async upload(buffer: Buffer, key: string, mime: string): Promise<string> {
    // TODO: Implémenter avec AWS SDK ou Supabase Storage
    throw new Error('S3StorageProvider not implemented yet');
  }

  async download(key: string): Promise<Buffer> {
    throw new Error('S3StorageProvider not implemented yet');
  }

  async delete(key: string): Promise<void> {
    throw new Error('S3StorageProvider not implemented yet');
  }

  async exists(key: string): Promise<boolean> {
    throw new Error('S3StorageProvider not implemented yet');
  }

  async getPublicUrl(key: string): Promise<string> {
    throw new Error('S3StorageProvider not implemented yet');
  }
}

/**
 * Service de stockage principal
 */
export class StorageService {
  private provider: StorageProvider;

  constructor(provider?: StorageProvider) {
    // Utiliser le provider local par défaut
    this.provider = provider || new LocalStorageProvider();
  }

  /**
   * Calcule le hash SHA256 d'un buffer
   */
  calculateSha256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Génère la clé de stockage pour un document
   */
  generateStorageKey(ownerId: string, documentId: string, filename: string): string {
    const ext = path.extname(filename);
    return `documents/${ownerId}/${documentId}/original${ext}`;
  }

  /**
   * Génère la clé pour le preview (thumbnail)
   */
  generatePreviewKey(ownerId: string, documentId: string): string {
    return `documents/${ownerId}/${documentId}/preview.jpg`;
  }

  /**
   * Upload un document
   */
  async uploadDocument(
    buffer: Buffer,
    ownerId: string,
    documentId: string,
    filename: string,
    mime: string
  ): Promise<{ key: string; sha256: string; url: string }> {
    const sha256 = this.calculateSha256(buffer);
    const key = this.generateStorageKey(ownerId, documentId, filename);
    
    await this.provider.upload(buffer, key, mime);
    const url = await this.provider.getPublicUrl(key);

    return { key, sha256, url };
  }

  /**
   * Upload un preview (thumbnail)
   */
  async uploadPreview(
    buffer: Buffer,
    ownerId: string,
    documentId: string
  ): Promise<string> {
    const key = this.generatePreviewKey(ownerId, documentId);
    await this.provider.upload(buffer, key, 'image/jpeg');
    return await this.provider.getPublicUrl(key);
  }

  /**
   * Télécharge un document
   */
  async downloadDocument(key: string): Promise<Buffer> {
    return await this.provider.download(key);
  }

  /**
   * Supprime un document (soft-delete côté DB, hard-delete ici)
   */
  async deleteDocument(key: string): Promise<void> {
    await this.provider.delete(key);
  }

  /**
   * Vérifie si un document existe
   */
  async documentExists(key: string): Promise<boolean> {
    return await this.provider.exists(key);
  }

  /**
   * Obtient l'URL publique d'un document
   */
  async getDocumentUrl(key: string): Promise<string> {
    return await this.provider.getPublicUrl(key);
  }

  /**
   * Détecte les doublons par SHA256
   */
  async findDuplicateBySha256(
    sha256: string,
    ownerId: string
  ): Promise<{ exists: boolean; documentId?: string }> {
    // Cette méthode devrait interagir avec la DB
    // Pour l'instant, on retourne un stub
    return { exists: false };
  }
}

// Instance singleton
let storageServiceInstance: StorageService | null = null;

export function getStorageService(): StorageService {
  if (!storageServiceInstance) {
    // Déterminer le provider en fonction de l'environnement
    const storageType = process.env.STORAGE_TYPE || 'local';

    if (storageType === 's3' || storageType === 'supabase') {
      // TODO: Implémenter la configuration S3/Supabase
      console.warn('S3/Supabase storage not implemented, falling back to local');
      storageServiceInstance = new StorageService();
    } else {
      storageServiceInstance = new StorageService();
    }
  }

  return storageServiceInstance;
}

export default StorageService;

