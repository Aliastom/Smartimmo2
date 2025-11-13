import { PrismaClient } from '@prisma/client';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import * as path from 'path';

const prisma = new PrismaClient();

/**
 * Calculer le SHA256 d'un fichier
 */
async function calculateFileSha256(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Normaliser et hasher le texte extrait
 */
function calculateTextSha256(text: string): string {
  const normalizedText = text.toLowerCase().replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(normalizedText).digest('hex');
}

/**
 * Script de backfill pour ajouter les hashs aux documents existants
 */
async function backfillDocumentHashes() {
  console.log('🔄 Début du backfill des hashs de documents...');

  try {
    // Trouver tous les documents actifs sans fileSha256
    const documentsWithoutHash = await prisma.document.findMany({
      where: {
        fileSha256: null,
        status: 'active'
      },
      select: {
        id: true,
        fileName: true,
        bucketKey: true,
        url: true,
        extractedText: true
      }
    });

    console.log(`📄 Trouvé ${documentsWithoutHash.length} documents sans hash`);

    let successCount = 0;
    let errorCount = 0;

    for (const doc of documentsWithoutHash) {
      try {
        // Essayer de trouver le fichier
        let filePath = '';
        
        // Essayer différents chemins possibles
        const possiblePaths = [
          path.join(process.cwd(), 'storage', doc.bucketKey),
          path.join(process.cwd(), 'storage', 'documents', doc.fileName),
          path.join(process.cwd(), 'uploads', doc.fileName),
          doc.url.replace(/^\//, '') // Utiliser l'URL relative
        ];

        for (const possPath of possiblePaths) {
          try {
            await fs.access(possPath);
            filePath = possPath;
            break;
          } catch {
            // Fichier non trouvé à cet emplacement, essayer le suivant
            continue;
          }
        }

        if (!filePath) {
          console.warn(`⚠️  Fichier introuvable pour document ${doc.id} (${doc.fileName})`);
          errorCount++;
          continue;
        }

        // Calculer le hash du fichier
        const fileSha256 = await calculateFileSha256(filePath);

        // Calculer le hash du texte si disponible
        let textSha256: string | null = null;
        if (doc.extractedText && doc.extractedText.length > 100) {
          textSha256 = calculateTextSha256(doc.extractedText);
        }

        // Mettre à jour le document
        await prisma.document.update({
          where: { id: doc.id },
          data: {
            fileSha256,
            textSha256
          }
        });

        successCount++;
        console.log(`✅ Hash ajouté pour ${doc.fileName} (${doc.id})`);

      } catch (error) {
        console.error(`❌ Erreur pour document ${doc.id}:`, error);
        errorCount++;
      }
    }

    console.log(`\n🎉 Backfill terminé !`);
    console.log(`   ✅ Succès: ${successCount}`);
    console.log(`   ❌ Erreurs: ${errorCount}`);

  } catch (error) {
    console.error('❌ Erreur lors du backfill:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
if (require.main === module) {
  backfillDocumentHashes()
    .then(() => {
      console.log('✅ Script de backfill terminé avec succès');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erreur lors de l\'exécution du script:', error);
      process.exit(1);
    });
}

export { backfillDocumentHashes };

