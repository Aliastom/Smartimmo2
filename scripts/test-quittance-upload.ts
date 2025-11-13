#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { writeFile } from 'fs/promises';
import { join } from 'path';

const prisma = new PrismaClient();

async function testQuittanceUpload() {
  console.log('🧪 Test d\'upload de quittance...');
  
  try {
    // 1. Créer un document de test de type QUITTANCE
    console.log('📄 Création d\'un document QUITTANCE...');
    
    const testContent = 'Quittance de loyer - Test de duplication';
    const bucketKey = `test-quittance-${Date.now()}.pdf`;
    const filePath = join(process.cwd(), 'storage', 'documents', bucketKey);
    await writeFile(filePath, testContent);
    
    // Créer le document en base
    const document = await prisma.document.create({
      data: {
        ownerId: 'default',
        bucketKey,
        filenameOriginal: 'test-quittance.pdf',
        fileName: 'test-quittance.pdf',
        mime: 'application/pdf',
        size: testContent.length,
        url: `/storage/documents/${bucketKey}`,
        status: 'classified',
        source: 'test',
        uploadedBy: 'test-user',
        documentType: {
          connect: { code: 'QUITTANCE' }
        }
      }
    });
    
    console.log(`✅ Document créé: ${document.id}`);
    
    // 2. Simuler le processus de finalisation avec DocumentAutoLinkingServiceServer
    console.log('🔗 Création des liens automatiques...');
    
    const { DocumentAutoLinkingServiceServer } = await import('@/lib/services/documentAutoLinkingService.server');
    
    // Contexte GLOBAL (pas de propriété, bail, locataire)
    const context = {};
    
    await DocumentAutoLinkingServiceServer.createAutoLinks(
      document.id,
      'QUITTANCE',
      context
    );
    
    // 3. Vérifier les liens créés
    const links = await prisma.documentLink.findMany({
      where: { documentId: document.id },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        role: true,
        entityName: true
      },
      orderBy: { createdAt: 'asc' }
    });
    
    console.log(`📊 Liens créés: ${links.length}`);
    links.forEach((link, index) => {
      console.log(`  ${index + 1}. ${link.targetType} - ${link.targetId || 'null'} (${link.role})`);
    });
    
    // 4. Nettoyer
    await prisma.documentLink.deleteMany({ where: { documentId: document.id } });
    await prisma.document.delete({ where: { id: document.id } });
    await import('fs/promises').then(fs => fs.unlink(filePath));
    
    console.log('🧹 Nettoyage terminé');
    
    if (links.length > 1) {
      console.log('❌ PROBLÈME: Plusieurs liens créés pour une quittance en contexte GLOBAL');
    } else {
      console.log('✅ OK: Un seul lien créé');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testQuittanceUpload();
