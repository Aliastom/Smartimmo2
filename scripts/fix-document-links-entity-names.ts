import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixDocumentLinksEntityNames() {
  console.log('🔧 Correction des noms d\'entités dans les liens de documents...\n');
  
  try {
    // 1. Récupérer tous les liens de documents
    const links = await prisma.documentLink.findMany({
      include: {
        document: true
      }
    });
    
    console.log(`📊 ${links.length} liens trouvés`);
    
    let updatedCount = 0;
    
    for (const link of links) {
      let entityName: string | null = null;
      
      // Déterminer le nom de l'entité selon le type
      switch (link.targetType) {
        case 'PROPERTY':
          if (link.targetId) {
            const property = await prisma.property.findUnique({
              where: { id: link.targetId },
              select: { name: true }
            });
            entityName = property?.name || `Bien ${link.targetId.slice(-8)}`;
          }
          break;
          
        case 'LEASE':
          if (link.targetId) {
            const lease = await prisma.lease.findUnique({
              where: { id: link.targetId },
              select: { 
                rentAmount: true,
                property: {
                  select: { name: true }
                }
              }
            });
            if (lease) {
              entityName = `${lease.property?.name || 'Bien'} - ${lease.rentAmount}€/mois`;
            } else {
              entityName = `Bail ${link.targetId.slice(-8)}`;
            }
          }
          break;
          
        case 'TENANT':
          if (link.targetId) {
            const tenant = await prisma.tenant.findUnique({
              where: { id: link.targetId },
              select: { firstName: true, lastName: true }
            });
            if (tenant) {
              entityName = `${tenant.firstName} ${tenant.lastName}`;
            } else {
              entityName = `Locataire ${link.targetId.slice(-8)}`;
            }
          }
          break;
          
        case 'TRANSACTION':
          if (link.targetId) {
            const transaction = await prisma.transaction.findUnique({
              where: { id: link.targetId },
              select: { label: true, amount: true }
            });
            if (transaction) {
              entityName = `${transaction.label} - ${transaction.amount}€`;
            } else {
              entityName = `Transaction ${link.targetId.slice(-8)}`;
            }
          }
          break;
          
        case 'GLOBAL':
          entityName = 'Global';
          break;
          
        default:
          entityName = link.targetType;
      }
      
      // Mettre à jour le lien avec le nom de l'entité
      if (entityName) {
        await prisma.documentLink.update({
          where: { id: link.id },
          data: { entityName }
        });
        updatedCount++;
        console.log(`   ✅ ${link.targetType}: ${entityName}`);
      }
    }
    
    console.log(`\n✅ ${updatedCount} liens mis à jour avec les noms d'entités`);
    
    // 2. Vérifier les résultats
    console.log('\n📊 Vérification des résultats...');
    
    const linksWithNames = await prisma.documentLink.findMany({
      where: {
        entityName: { not: null }
      },
      include: {
        document: {
          select: { filenameOriginal: true }
        }
      }
    });
    
    console.log(`   - ${linksWithNames.length} liens avec noms d'entités`);
    
    // Grouper par type
    const byType = linksWithNames.reduce((acc, link) => {
      if (!acc[link.targetType]) acc[link.targetType] = 0;
      acc[link.targetType]++;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count} liens`);
    });
    
    console.log('\n🎉 Correction des noms d\'entités terminée !');
    
  } catch (error) {
    console.error('💥 Erreur lors de la correction:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter la correction
fixDocumentLinksEntityNames()
  .then(() => {
    console.log('\n🎉 Correction terminée avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec de la correction:', error);
    process.exit(1);
  });

export { fixDocumentLinksEntityNames };
