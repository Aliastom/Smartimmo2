/**
 * Script pour nettoyer les liens GLOBAL en doublon
 * Exécuter avec: node scripts/clean-duplicate-global-links.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanDuplicateGlobalLinks() {
  console.log('🧹 Nettoyage des liens GLOBAL en doublon...');
  
  try {
    // 1. Identifier les documents avec des liens GLOBAL en doublon
    console.log('\n1️⃣ Identification des doublons...');
    
    const duplicateLinks = await prisma.$queryRaw`
      SELECT 
        d.id,
        d.filenameOriginal,
        COUNT(dl.documentId) as nb_liens_global
      FROM Document d
      LEFT JOIN DocumentLink dl ON d.id = dl.documentId 
      WHERE dl.linkedType IN ('GLOBAL', 'global')
      GROUP BY d.id, d.filenameOriginal
      HAVING COUNT(dl.documentId) > 1
    `;
    
    console.log(`📊 Trouvé ${duplicateLinks.length} documents avec des liens GLOBAL en doublon`);
    
    if (duplicateLinks.length === 0) {
      console.log('✅ Aucun doublon trouvé, rien à nettoyer !');
      return;
    }
    
    // 2. Afficher les doublons pour information
    for (const doc of duplicateLinks) {
      const links = await prisma.documentLink.findMany({
        where: {
          documentId: doc.id,
          linkedType: { in: ['GLOBAL', 'global'] }
        }
      });
      
      console.log(`📄 ${doc.filenameOriginal} (${doc.id}):`);
      links.forEach(link => {
        console.log(`   - ${link.linkedType} -> ${link.linkedId}`);
      });
    }
    
    // 3. Supprimer les anciens liens GLOBAL (majuscules)
    console.log('\n2️⃣ Suppression des liens GLOBAL obsolètes...');
    
    const deleteResult = await prisma.documentLink.deleteMany({
      where: {
        linkedType: 'GLOBAL',
        linkedId: 'GLOBAL',
        documentId: {
          in: await prisma.documentLink.findMany({
            where: {
              linkedType: 'global',
              linkedId: 'global'
            },
            select: { documentId: true }
          }).then(links => links.map(l => l.documentId))
        }
      }
    });
    
    console.log(`🗑️ Supprimé ${deleteResult.count} liens GLOBAL obsolètes`);
    
    // 4. Vérifier le résultat
    console.log('\n3️⃣ Vérification finale...');
    
    const remainingDuplicates = await prisma.$queryRaw`
      SELECT 
        d.id,
        d.filenameOriginal,
        COUNT(dl.documentId) as nb_liens_global
      FROM Document d
      LEFT JOIN DocumentLink dl ON d.id = dl.documentId 
      WHERE dl.linkedType IN ('GLOBAL', 'global')
      GROUP BY d.id, d.filenameOriginal
      HAVING COUNT(dl.documentId) > 1
    `;
    
    if (remainingDuplicates.length === 0) {
      console.log('✅ Nettoyage terminé avec succès ! Plus de doublons.');
    } else {
      console.log(`⚠️ Il reste encore ${remainingDuplicates.length} doublons à résoudre manuellement.`);
    }
    
    // 5. Statistiques finales
    const totalGlobalLinks = await prisma.documentLink.count({
      where: {
        linkedType: { in: ['GLOBAL', 'global'] }
      }
    });
    
    const globalLinksDetail = await prisma.$queryRaw`
      SELECT 
        linkedType,
        linkedId,
        COUNT(*) as count
      FROM DocumentLink 
      WHERE linkedType IN ('GLOBAL', 'global')
      GROUP BY linkedType, linkedId
    `;
    
    console.log('\n📈 Statistiques finales:');
    console.log(`   Total liens globaux: ${totalGlobalLinks}`);
    globalLinksDetail.forEach(stat => {
      console.log(`   ${stat.linkedType} -> ${stat.linkedId}: ${stat.count} liens`);
    });
    
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
cleanDuplicateGlobalLinks();
