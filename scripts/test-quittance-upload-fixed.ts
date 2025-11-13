#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function testQuittanceUpload() {
  console.log('🧪 Test upload quittance avec correction des doublons...\n');
  
  // 1. Créer un fichier de test
  const testContent = 'Test quittance content for duplicate fix';
  const testFilePath = join(process.cwd(), 'storage', 'test-quittance-fixed.pdf');
  
  try {
    writeFileSync(testFilePath, testContent);
    console.log('✅ Fichier de test créé');
  } catch (error) {
    console.log('❌ Erreur création fichier:', error);
    return;
  }
  
  // 2. Simuler l'upload via l'API
  const formData = new FormData();
  const file = new File([testContent], 'test-quittance-fixed.pdf', { type: 'application/pdf' });
  formData.append('file', file);
  formData.append('type', 'QUITTANCE');
  formData.append('context', JSON.stringify({
    entityType: 'GLOBAL',
    entityId: undefined
  }));
  
  try {
    const response = await fetch('http://localhost:3000/api/documents/upload', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Erreur API upload:', response.status, errorText);
      return;
    }
    
    const result = await response.json();
    console.log('✅ Upload réussi, document ID:', result.documentId);
    
    // 3. Vérifier les liens créés
    const links = await prisma.documentLink.findMany({
      where: { documentId: result.documentId },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        role: true,
        entityName: true
      }
    });
    
    console.log('\n📋 Liens créés:');
    links.forEach((link, index) => {
      console.log(`  ${index + 1}. ${link.targetType} - ${link.targetId} (${link.role})`);
    });
    
    if (links.length === 1 && links[0].targetType === 'GLOBAL' && links[0].targetId === 'GLOBAL') {
      console.log('\n🎉 SUCCÈS: Un seul lien GLOBAL créé !');
    } else {
      console.log('\n❌ ÉCHEC: Nombre de liens incorrect ou type incorrect');
    }
    
    // 4. Nettoyer
    await prisma.documentLink.deleteMany({ where: { documentId: result.documentId } });
    await prisma.document.delete({ where: { id: result.documentId } });
    unlinkSync(testFilePath);
    console.log('🧹 Nettoyage effectué');
    
  } catch (error) {
    console.log('❌ Erreur test:', error);
  }
  
  await prisma.$disconnect();
}

testQuittanceUpload();
