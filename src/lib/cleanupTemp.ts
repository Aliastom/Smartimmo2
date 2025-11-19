import { readdir, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { getStorageService } from '@/services/storage.service';

/**
 * Nettoie les fichiers temporaires expirés
 * Supprime les fichiers dont expiresAt < Date.now()
 * Gère à la fois les fichiers locaux et ceux dans Supabase Storage (préfixe tmp/)
 */
export async function cleanupExpiredTemps(): Promise<{ cleaned: number; errors: number }> {
  let cleaned = 0;
  let errors = 0;

  try {
    const tempDir = join(tmpdir(), 'smartimmo', 'uploads');
    
    // Lire tous les fichiers .meta.json
    const files = await readdir(tempDir).catch(() => []);
    const metaFiles = files.filter(f => f.endsWith('.meta.json'));

    for (const metaFile of metaFiles) {
      try {
        const metaPath = join(tempDir, metaFile);
        const content = await readFile(metaPath, 'utf-8');
        const meta = JSON.parse(content);

        // Vérifier si expiré
        if (meta.expiresAt && meta.expiresAt < Date.now()) {
          const tempId = meta.tempId;
          
          // Supprimer le fichier principal
          if (meta.filePath) {
            if (meta.filePath.startsWith('tmp/')) {
              // Fichier temporaire dans Supabase Storage
              try {
                const storageService = getStorageService();
                await storageService.deleteDocument(meta.filePath);
                console.log(`[CleanupTemp] Fichier temporaire Supabase supprimé: ${meta.filePath}`);
              } catch (storageError) {
                console.warn(`[CleanupTemp] Erreur suppression fichier Supabase ${meta.filePath}:`, storageError);
                errors++;
              }
            } else {
              // Fichier temporaire local
              await unlink(meta.filePath).catch(() => {});
            }
          }
          
          // Supprimer le meta.json
          await unlink(metaPath).catch(() => {});
          
          cleaned++;
          console.log(`[CleanupTemp] Supprimé fichier expiré: ${tempId}`);
        }
      } catch (error) {
        errors++;
        console.error(`[CleanupTemp] Erreur lors du nettoyage de ${metaFile}:`, error);
      }
    }

    if (cleaned > 0) {
      console.log(`[CleanupTemp] ${cleaned} fichier(s) temporaire(s) nettoyé(s)`);
    }

  } catch (error) {
    console.error('[CleanupTemp] Erreur générale:', error);
  }

  return { cleaned, errors };
}

/**
 * Génère un ID temporaire aléatoire
 */
export function generateTempId(): string {
  const bytes = Buffer.allocUnsafe(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return 'tmp_' + bytes.toString('hex');
}

