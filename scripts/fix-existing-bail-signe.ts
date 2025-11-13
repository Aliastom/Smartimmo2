import { prisma } from '@/lib/prisma';

/**
 * Script pour corriger le document BAIL_SIGNE existant
 */
async function main() {
  const documentId = 'cmgy2fyu80003if005246p4dh'; // ID du document trouvé
  
  console.log(`🔧 Correction du document ${documentId}...\n`);
  
  try {
    // 1. Vérifier que le document existe
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        documentType: { select: { code: true, label: true } },
        links: true
      }
    });
    
    if (!document) {
      console.log('❌ Document non trouvé !');
      return;
    }
    
    console.log(`📄 Document trouvé: ${document.filenameOriginal}`);
    console.log(`   Type actuel: ${document.documentType?.label || 'Non classé'} (${document.documentType?.code || 'N/A'})`);
    console.log(`   Liens actuels: ${document.links.length}`);
    
    // 2. Corriger le type de document
    const bailSigneType = await prisma.documentType.findUnique({
      where: { code: 'BAIL_SIGNE' }
    });
    
    if (bailSigneType && document.documentTypeId !== bailSigneType.id) {
      await prisma.document.update({
        where: { id: documentId },
        data: { documentTypeId: bailSigneType.id }
      });
      console.log(`✅ Type de document corrigé: ${bailSigneType.label}`);
    }
    
    // 3. Supprimer les anciens liens
    if (document.links.length > 0) {
      await prisma.documentLink.deleteMany({
        where: { documentId: documentId }
      });
      console.log(`🗑️  ${document.links.length} anciens liens supprimés`);
    }
    
    // 4. Récupérer les infos du bail
    if (!document.leaseId) {
      console.log('❌ Aucun leaseId trouvé sur le document');
      return;
    }
    
    const lease = await prisma.lease.findUnique({
      where: { id: document.leaseId },
      include: { tenant: true, property: true }
    });
    
    if (!lease) {
      console.log('❌ Bail non trouvé');
      return;
    }
    
    console.log(`🏠 Bail trouvé: ${lease.id}`);
    console.log(`   Propriété: ${lease.property?.address || 'N/A'} (${lease.propertyId})`);
    console.log(`   Locataire: ${lease.tenant?.firstName || 'N/A'} ${lease.tenant?.lastName || 'N/A'} (${lease.tenantId})`);
    
    // 5. Créer les nouveaux liens
    const linksToCreate = [
      { documentId: documentId, linkedType: 'lease', linkedId: lease.id },
      { documentId: documentId, linkedType: 'property', linkedId: lease.propertyId },
      { documentId: documentId, linkedType: 'tenant', linkedId: lease.tenantId },
      { documentId: documentId, linkedType: 'global', linkedId: 'global' }
    ];
    
    let createdLinks = 0;
    for (const link of linksToCreate) {
      try {
        await prisma.documentLink.create({ data: link });
        console.log(`✅ Lien créé: ${link.linkedType} → ${link.linkedId}`);
        createdLinks++;
      } catch (error: any) {
        console.error(`❌ Erreur création lien ${link.linkedType}:`, error.message);
      }
    }
    
    console.log(`\n🎉 ${createdLinks} liens créés !`);
    console.log('\n📝 Le document devrait maintenant être visible partout.');
    
  } catch (error: any) {
    console.error('❌ Erreur lors de la correction:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
