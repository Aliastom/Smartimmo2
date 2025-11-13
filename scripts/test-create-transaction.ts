import { prisma } from '@/lib/prisma';

/**
 * Script pour tester la création d'une transaction avec documents
 */
async function main() {
  console.log('🧪 Test de création d\'une transaction avec documents...\n');
  
  try {
    // 1. Récupérer un bien et un bail
    const property = await prisma.property.findFirst({
      include: { leases: { take: 1 } }
    });
    
    if (!property || property.leases.length === 0) {
      console.log('❌ Aucun bien avec bail trouvé');
      return;
    }
    
    const lease = property.leases[0];
    console.log(`🏠 Bien: ${property.address}`);
    console.log(`📋 Bail: ${lease.id} (${lease.status})`);
    
    // 2. Créer un document de test (simulation d'upload)
    const documentType = await prisma.documentType.findFirst({
      where: { isActive: true }
    });
    
    if (!documentType) {
      console.log('❌ Aucun type de document trouvé');
      return;
    }
    
    console.log(`📄 Type de document: ${documentType.label}`);
    
    // 3. Créer un document de test
    const testDocument = await prisma.document.create({
      data: {
        filenameOriginal: 'test-quittance-loyer.pdf',
        fileName: 'test-quittance-loyer.pdf',
        mime: 'application/pdf',
        size: 1024,
        fileSha256: 'test-sha256-' + Date.now(),
        documentTypeId: documentType.id,
        status: 'active',
        source: 'upload',
        uploadedAt: new Date(),
        bucketKey: '/test/test-quittance-loyer.pdf',
        url: '/test/test-quittance-loyer.pdf',
        propertyId: property.id,
        leaseId: lease.id
      }
    });
    
    console.log(`✅ Document de test créé: ${testDocument.id}`);
    
    // 4. Créer une transaction
    const transaction = await prisma.transaction.create({
      data: {
        amount: 800.00,
        nature: 'LOYER',
        date: new Date(),
        label: 'Loyer octobre 2025',
        propertyId: property.id,
        leaseId: lease.id,
        month: 10,
        year: 2025,
        source: 'MANUAL'
      }
    });
    
    console.log(`✅ Transaction créée: ${transaction.id} (${transaction.amount}€)`);
    
    // 5. Tester le nouveau système de liens
    const { createDocumentLinks } = await import('@/lib/services/documentLinkService');
    
    console.log('\n🔗 Test du nouveau système de liens...');
    await createDocumentLinks(testDocument.id, transaction);
    
    // 6. Vérifier les liens créés
    const links = await prisma.documentLink.findMany({
      where: { documentId: testDocument.id }
    });
    
    console.log(`\n📋 ${links.length} liens créés:`);
    links.forEach((link, index) => {
      console.log(`   ${index + 1}. ${link.linkedType} → ${link.linkedId}`);
    });
    
    // 7. Vérifier que le document est visible partout
    console.log('\n🔍 Vérification de la visibilité:');
    
    // Page Documents (global)
    const globalLinks = await prisma.documentLink.count({
      where: { linkedType: 'global', documentId: testDocument.id }
    });
    console.log(`   Page Documents: ${globalLinks > 0 ? '✅ Visible' : '❌ Non visible'}`);
    
    // Section Documents du bien
    const propertyLinks = await prisma.documentLink.count({
      where: { linkedType: 'property', linkedId: property.id, documentId: testDocument.id }
    });
    console.log(`   Section Bien: ${propertyLinks > 0 ? '✅ Visible' : '❌ Non visible'}`);
    
    // Section Documents du bail
    const leaseLinks = await prisma.documentLink.count({
      where: { linkedType: 'lease', linkedId: lease.id, documentId: testDocument.id }
    });
    console.log(`   Section Bail: ${leaseLinks > 0 ? '✅ Visible' : '❌ Non visible'}`);
    
    // Section Documents de la transaction
    const transactionLinks = await prisma.documentLink.count({
      where: { linkedType: 'transaction', linkedId: transaction.id, documentId: testDocument.id }
    });
    console.log(`   Section Transaction: ${transactionLinks > 0 ? '✅ Visible' : '❌ Non visible'}`);
    
    console.log('\n🎉 Test terminé avec succès !');
    console.log('\n📝 Le nouveau système de liens fonctionne correctement.');
    
  } catch (error: any) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
