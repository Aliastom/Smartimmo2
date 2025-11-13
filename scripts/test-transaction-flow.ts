import { prisma } from '@/lib/prisma';

/**
 * Script pour tester le flow complet des transactions avec documents
 */
async function main() {
  console.log('🧪 Test du flow complet des transactions...\n');
  
  try {
    // 1. Vérifier qu'il y a des biens et des baux
    const properties = await prisma.property.findMany({
      take: 1,
      include: { leases: { take: 1 } }
    });
    
    if (properties.length === 0) {
      console.log('❌ Aucun bien trouvé. Créez d\'abord un bien et un bail.');
      return;
    }
    
    const property = properties[0];
    console.log(`🏠 Bien trouvé: ${property.address} (${property.id})`);
    
    if (property.leases.length === 0) {
      console.log('❌ Aucun bail trouvé pour ce bien. Créez d\'abord un bail.');
      return;
    }
    
    const lease = property.leases[0];
    console.log(`📋 Bail trouvé: ${lease.id} (${lease.status})`);
    
    // 2. Vérifier les documents existants
    const existingDocuments = await prisma.document.findMany({
      where: { status: 'active' },
      include: {
        documentType: { select: { code: true, label: true } },
        links: true
      },
      take: 5
    });
    
    console.log(`\n📄 ${existingDocuments.length} documents actifs trouvés:`);
    existingDocuments.forEach((doc, index) => {
      console.log(`   ${index + 1}. ${doc.filenameOriginal}`);
      console.log(`      Type: ${doc.documentType?.label || 'Non classé'}`);
      console.log(`      Liens: ${doc.links.length} (${doc.links.map(l => l.linkedType).join(', ')})`);
    });
    
    // 3. Vérifier les transactions existantes
    const transactions = await prisma.transaction.findMany({
      include: {
        property: { select: { address: true } },
        lease: { select: { id: true, status: true } },
        documents: {
          include: {
            documentType: { select: { code: true, label: true } }
          }
        }
      },
      take: 5,
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`\n💰 ${transactions.length} transactions trouvées:`);
    transactions.forEach((tx, index) => {
      console.log(`   ${index + 1}. Transaction ${tx.id}`);
      console.log(`      Montant: ${tx.amount}€`);
      console.log(`      Nature: ${tx.nature}`);
      console.log(`      Bien: ${tx.property?.address || 'N/A'}`);
      console.log(`      Bail: ${tx.lease?.id || 'N/A'}`);
      console.log(`      Documents: ${tx.documents.length}`);
    });
    
    // 4. Vérifier les liens DocumentLink
    const allLinks = await prisma.documentLink.findMany({
      include: {
        document: {
          select: {
            filenameOriginal: true,
            documentType: { select: { code: true, label: true } }
          }
        }
      }
    });
    
    console.log(`\n🔗 ${allLinks.length} liens DocumentLink trouvés:`);
    
    const linksByType = allLinks.reduce((acc, link) => {
      acc[link.linkedType] = (acc[link.linkedType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(linksByType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count} liens`);
    });
    
    // 5. Vérifier les documents liés aux transactions
    const transactionLinks = allLinks.filter(l => l.linkedType === 'transaction');
    console.log(`\n📋 ${transactionLinks.length} documents liés à des transactions`);
    
    if (transactionLinks.length > 0) {
      console.log('   Exemples:');
      transactionLinks.slice(0, 3).forEach((link, index) => {
        console.log(`   ${index + 1}. ${link.document.filenameOriginal} → Transaction ${link.linkedId}`);
      });
    }
    
    console.log('\n✅ Test terminé !');
    console.log('\n📝 Pour tester le flow complet:');
    console.log('   1. Créez une nouvelle transaction');
    console.log('   2. Ajoutez des documents');
    console.log('   3. Vérifiez que les liens sont créés correctement');
    
  } catch (error: any) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
