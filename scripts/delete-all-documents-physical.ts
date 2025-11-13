#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { unlink } from 'fs/promises';
import { join } from 'path';

const prisma = new PrismaClient();

async function deleteAllDocumentsPhysical() {
  console.log('🗑️  Suppression physique de tous les documents...');
  
  try {
    // 1. Récupérer tous les documents avec leurs fichiers
    const documents = await prisma.document.findMany({
      select: {
        id: true,
        fileName: true,
        bucketKey: true
      }
    });
    
    console.log(`📄 Trouvé ${documents.length} documents à supprimer`);
    
    // 2. Supprimer les fichiers physiques
    for (const doc of documents) {
      if (doc.bucketKey) {
        try {
          const filePath = join(process.cwd(), 'storage', 'documents', doc.bucketKey);
          await unlink(filePath);
          console.log(`✅ Fichier supprimé: ${doc.fileName}`);
        } catch (error) {
          console.log(`⚠️  Fichier non trouvé: ${doc.fileName} (${doc.bucketKey})`);
        }
      }
    }
    
    // 3. Supprimer tous les liens DocumentLink
    const deletedLinks = await prisma.documentLink.deleteMany({});
    console.log(`🔗 ${deletedLinks.count} liens DocumentLink supprimés`);
    
    // 4. Supprimer tous les documents
    const deletedDocs = await prisma.document.deleteMany({});
    console.log(`📄 ${deletedDocs.count} documents supprimés`);
    
    console.log('🎉 Suppression physique terminée !');
    
  } catch (error) {
    console.error('❌ Erreur lors de la suppression:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllDocumentsPhysical();
