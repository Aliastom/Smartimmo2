import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

/**
 * Service de stockage de documents
 * Implémentation locale pour développement, Supabase Storage pour production
 * 
 * Variables d'environnement requises pour Supabase:
 * - NEXT_PUBLIC_SUPABASE_URL: URL de votre projet Supabase
 * - SUPABASE_SERVICE_ROLE_KEY: Clé service role (côté serveur uniquement)
 * - SUPABASE_STORAGE_BUCKET: Nom du bucket (par défaut: "documents")
 * - STORAGE_TYPE: "local" (dev) ou "supabase" (prod)
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
    // Si la clé commence par "storage/", utiliser directement
    // (ancien format: "storage/documents/filename.pdf")
    if (key.startsWith('storage/')) {
      return path.join(process.cwd(), key);
    }
    // Si la clé commence par "documents/", construire le chemin complet
    // (nouveau format unifié: "documents/{documentId}/{filename}")
    if (key.startsWith('documents/')) {
      return path.join(process.cwd(), 'storage', key);
    }
    // Sinon, utiliser le basePath (fallback pour compatibilité)
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
 * Implémentation Supabase Storage pour la production
 */
class SupabaseStorageProvider implements StorageProvider {
  private supabase: ReturnType<typeof createClient>;
  private bucket: string;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucketName = process.env.SUPABASE_STORAGE_BUCKET || 'documents';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        'Variables Supabase manquantes: NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises pour SupabaseStorageProvider'
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    this.bucket = bucketName;
  }

  /**
   * Normalise la clé pour Supabase Storage
   * Enlève le préfixe "storage/" ou "documents/" si présent pour éviter les doublons
   */
  private normalizeKey(key: string): string {
    // Si la clé commence par "storage/documents/", on enlève "storage/"
    if (key.startsWith('storage/documents/')) {
      return key.replace('storage/', '');
    }
    // Si la clé commence par "documents/", on la garde telle quelle
    if (key.startsWith('documents/')) {
      return key;
    }
    // Sinon, on ajoute "documents/" au début
    return `documents/${key}`;
  }

  async upload(buffer: Buffer, key: string, mime: string): Promise<string> {
    const normalizedKey = this.normalizeKey(key);
    
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .upload(normalizedKey, buffer, {
        contentType: mime,
        upsert: true, // Écrase si le fichier existe déjà
      });

    if (error) {
      console.error('[SupabaseStorage] Erreur upload:', error);
      throw new Error(`Échec de l'upload vers Supabase: ${error.message}`);
    }

    return normalizedKey;
  }

  async download(key: string): Promise<Buffer> {
    const normalizedKey = this.normalizeKey(key);
    
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .download(normalizedKey);

    if (error) {
      console.error('[SupabaseStorage] Erreur download:', error);
      throw new Error(`Échec du téléchargement depuis Supabase: ${error.message}`);
    }

    if (!data) {
      throw new Error(`Fichier non trouvé dans Supabase: ${normalizedKey}`);
    }

    // Convertir Blob en Buffer
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async delete(key: string): Promise<void> {
    const normalizedKey = this.normalizeKey(key);
    
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .remove([normalizedKey]);

    if (error) {
      // Ne pas faire échouer si le fichier n'existe pas
      if (error.message.includes('not found') || error.message.includes('No such file')) {
        console.warn(`[SupabaseStorage] Fichier déjà supprimé: ${normalizedKey}`);
        return;
      }
      console.error('[SupabaseStorage] Erreur delete:', error);
      throw new Error(`Échec de la suppression depuis Supabase: ${error.message}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    const normalizedKey = this.normalizeKey(key);
    
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .list(path.dirname(normalizedKey) || '', {
        limit: 1000,
        search: path.basename(normalizedKey),
      });

    if (error) {
      console.error('[SupabaseStorage] Erreur exists:', error);
      return false;
    }

    return data?.some((file) => file.name === path.basename(normalizedKey)) ?? false;
  }

  async getPublicUrl(key: string): Promise<string> {
    const normalizedKey = this.normalizeKey(key);
    
    // Générer une URL signée valide 1 an (pour les documents privés)
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUrl(normalizedKey, 31536000); // 1 an en secondes

    if (error || !data) {
      console.error('[SupabaseStorage] Erreur getPublicUrl:', error);
      // Fallback: URL publique (si le bucket est public)
      const { data: publicData } = this.supabase.storage
        .from(this.bucket)
        .getPublicUrl(normalizedKey);
      return publicData.publicUrl;
    }

    return data.signedUrl;
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
   * Format unifié: documents/{documentId}/{filename}
   * Compatible avec LocalStorageProvider et SupabaseStorageProvider
   */
  generateStorageKey(documentId: string, filename: string): string {
    // Nettoyer le nom de fichier (enlever les caractères spéciaux)
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `documents/${documentId}/${sanitizedFilename}`;
  }

  /**
   * Génère la clé pour le preview (thumbnail)
   */
  generatePreviewKey(documentId: string): string {
    return `documents/${documentId}/preview.jpg`;
  }

  /**
   * Génère une clé de stockage à partir d'un bucketKey existant (rétrocompatibilité)
   * Normalise les anciens formats vers le nouveau format
   */
  normalizeBucketKey(bucketKey: string, documentId?: string, filename?: string): string {
    // Si déjà au bon format, retourner tel quel
    if (bucketKey.startsWith('documents/')) {
      return bucketKey;
    }

    // Si c'est un ancien format "storage/documents/..."
    if (bucketKey.startsWith('storage/documents/')) {
      const relativePath = bucketKey.replace('storage/documents/', '');
      return `documents/${relativePath}`;
    }

    // Si c'est un format "uploads/..."
    if (bucketKey.startsWith('uploads/')) {
      // Essayer de reconstruire avec documentId et filename si disponibles
      if (documentId && filename) {
        return this.generateStorageKey(documentId, filename);
      }
      // Sinon, migrer vers documents/
      return `documents/${bucketKey.replace('uploads/', '')}`;
    }

    // Format inconnu, essayer de le normaliser
    if (documentId && filename) {
      return this.generateStorageKey(documentId, filename);
    }

    // Dernier recours: ajouter le préfixe documents/
    return bucketKey.startsWith('documents/') ? bucketKey : `documents/${bucketKey}`;
  }

  /**
   * Upload un document
   */
  async uploadDocument(
    buffer: Buffer,
    documentId: string,
    filename: string,
    mime: string
  ): Promise<{ key: string; sha256: string; url: string }> {
    const sha256 = this.calculateSha256(buffer);
    const key = this.generateStorageKey(documentId, filename);
    
    await this.provider.upload(buffer, key, mime);
    const url = await this.provider.getPublicUrl(key);

    return { key, sha256, url };
  }

  /**
   * Upload un preview (thumbnail)
   */
  async uploadPreview(
    buffer: Buffer,
    documentId: string
  ): Promise<string> {
    const key = this.generatePreviewKey(documentId);
    await this.provider.upload(buffer, key, 'image/jpeg');
    return await this.provider.getPublicUrl(key);
  }

  /**
   * Upload un document avec une clé spécifique (pour remplacement)
   */
  async uploadWithKey(
    buffer: Buffer,
    key: string,
    mime: string
  ): Promise<string> {
    await this.provider.upload(buffer, key, mime);
    return key;
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

    let provider: StorageProvider;

    if (storageType === 'supabase') {
      try {
        provider = new SupabaseStorageProvider();
        console.log('[Storage] Utilisation de SupabaseStorageProvider');
      } catch (error) {
        console.error('[Storage] Erreur lors de l\'initialisation de SupabaseStorageProvider:', error);
        console.warn('[Storage] Fallback vers LocalStorageProvider');
        provider = new LocalStorageProvider();
      }
    } else {
      provider = new LocalStorageProvider();
      console.log('[Storage] Utilisation de LocalStorageProvider');
    }

    storageServiceInstance = new StorageService(provider);
  }

  return storageServiceInstance;
}

export default StorageService;

