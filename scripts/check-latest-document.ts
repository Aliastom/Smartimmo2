import { prisma } from '@/lib/prisma';

/**
 * Script pour vérifier le dernier document créé et ses liens
 */
async function main() {
  console.log('🔍 Vérification du dernier document créé...\n');
  
  try {
    // 1. Récupérer le dernier document créé
    const latestDocument = await prisma.document.findFirst({
      orderBy: { uploadedAt: 'desc' },
      include: {
        documentType: { select: { code: true, label: true } },
        links: true
      }
    });
    
    if (!latestDocument) {
      console.log('❌ Aucun document trouvé dans la base de données');
      return;
    }
    
    console.log('📄 Dernier document créé :');
    console.log(`   Nom: ${latestDocument.filenameOriginal}`);
    console.log(`   Type: ${latestDocument.documentType?.label || 'Non classé'} (${latestDocument.documentType?.code || 'N/A'})`);
    console.log(`   Statut: ${latestDocument.status}`);
    console.log(`   Uploadé: ${latestDocument.uploadedAt.toLocaleString('fr-FR')}`);
    console.log(`   ID: ${latestDocument.id}`);
    console.log(`   URL: ${latestDocument.url}`);
    
    // 2. Vérifier les liens DocumentLink
    const links = await prisma.documentLink.findMany({
      where: { documentId: latestDocument.id }
    });
    
    console.log(`\n🔗 Liens DocumentLink (${links.length}):`);
    if (links.length === 0) {
      console.log('   ❌ Aucun lien trouvé !');
    } else {
      links.forEach((link, index) => {
        console.log(`   ${index + 1}. ${link.linkedType} → ${link.linkedId}`);
      });
    }
    
    // 3. Vérifier si c'est un bail signé
    if (latestDocument.documentType?.code === 'BAIL_SIGNE') {
      console.log('\n📋 Vérification spécifique BAIL_SIGNE :');
      
      const expectedLinks = ['lease', 'property', 'tenant', 'global'];
      const actualLinkTypes = links.map(l => l.linkedType);
      
      console.log('   Liens attendus:', expectedLinks);
      console.log('   Liens trouvés:', actualLinkTypes);
      
      const missingLinks = expectedLinks.filter(type => !actualLinkTypes.includes(type));
      const extraLinks = actualLinkTypes.filter(type => !expectedLinks.includes(type));
      
      if (missingLinks.length > 0) {
        console.log(`   ❌ Liens manquants: ${missingLinks.join(', ')}`);
      }
      if (extraLinks.length > 0) {
        console.log(`   ⚠️  Liens supplémentaires: ${extraLinks.join(', ')}`);
      }
      if (missingLinks.length === 0 && extraLinks.length === 0) {
        console.log('   ✅ Tous les liens sont corrects !');
      }
    }
    
    // 4. Vérifier les informations du bail si c'est un bail signé
    if (latestDocument.leaseId) {
      const lease = await prisma.lease.findUnique({
        where: { id: latestDocument.leaseId },
        include: { tenant: true, property: true }
      });
      
      if (lease) {
        console.log('\n🏠 Informations du bail :');
        console.log(`   Bail ID: ${lease.id}`);
        console.log(`   Propriété: ${lease.property?.address || 'N/A'} (${lease.propertyId})`);
        console.log(`   Locataire: ${lease.tenant?.firstName || 'N/A'} ${lease.tenant?.lastName || 'N/A'} (${lease.tenantId})`);
        console.log(`   Statut: ${lease.status}`);
      }
    }
    
  } catch (error: any) {
    console.error('❌ Erreur lors de la vérification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
