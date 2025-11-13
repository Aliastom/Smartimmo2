#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { DocumentsService } from '@/lib/services/documents';
import { writeFile } from 'fs/promises';
import { join } from 'path';

const prisma = new PrismaClient();

async function testPhysicalDeletion() {
  console.log('🧪 Test de la suppression physique...');
  
  try {
    // 1. Créer un document de test
    console.log('📄 Création d\'un document de test...');
    
    const testContent = 'Ceci est un document de test pour la suppression physique';
    const testFile = new File([testContent], 'test-deletion.txt', { type: 'text/plain' });
    
    // Créer le fichier physique
    const bucketKey = `test-${Date.now()}.txt`;
    const filePath = join(process.cwd(), 'storage', 'documents', bucketKey);
    await writeFile(filePath, testContent);
    
    // Créer le document en base
    const document = await prisma.document.create({
      data: {
        ownerId: 'default',
        bucketKey,
        filenameOriginal: 'test-deletion.txt',
        fileName: 'test-deletion.txt',
        mime: 'text/plain',
        size: testContent.length,
        url: `/storage/documents/${bucketKey}`,
        status: 'classified',
        source: 'test',
        uploadedBy: 'test-user'
      }
    });
    
    console.log(`✅ Document créé: ${document.id}`);
    
    // 2. Vérifier qu'il existe
    const beforeCount = await prisma.document.count();
    console.log(`📊 Documents avant suppression: ${beforeCount}`);
    
    // 3. Supprimer avec le service
    console.log('🗑️  Suppression via DocumentsService...');
    await DocumentsService.deleteSafely(document.id, 'test-user');
    
    // 4. Vérifier qu'il a été supprimé
    const afterCount = await prisma.document.count();
    console.log(`📊 Documents après suppression: ${afterCount}`);
    
    // 5. Vérifier que le fichier physique a été supprimé
    try {
      const { readFile } = await import('fs/promises');
      await readFile(filePath);
      console.log('❌ ERREUR: Le fichier physique existe encore !');
    } catch (error) {
      console.log('✅ Fichier physique supprimé avec succès');
    }
    
    if (beforeCount === 1 && afterCount === 0) {
      console.log('🎉 Test réussi ! La suppression physique fonctionne.');
    } else {
      console.log('❌ Test échoué ! La suppression n\'a pas fonctionné.');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPhysicalDeletion();
