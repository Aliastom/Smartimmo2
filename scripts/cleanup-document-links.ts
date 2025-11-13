import { prisma } from '@/lib/prisma';

/**
 * Script de nettoyage des liens DocumentLink avant migration
 * Compatible SQLite
 */
async function main() {
  console.log('🧹 Nettoyage des données DocumentLink...\n');
  
  try {
    // 1. Supprimer les doublons exacts
    console.log('1️⃣ Suppression des doublons exacts...');
    
    // Récupérer tous les liens
    const allLinks = await prisma.documentLink.findMany({
      select: { 
        id: true,
        documentId: true, 
        targetType: true, 
        targetId: true 
      }
    });
    
    // Identifier les doublons (garder le premier ID, supprimer les autres)
    const seen = new Map<string, string>(); // key -> premier ID
    const duplicateIds: string[] = [];
    
    for (const link of allLinks) {
      const key = `${link.documentId}|${link.targetType}|${link.targetId}`;
      if (seen.has(key)) {
        duplicateIds.push(link.id);
      } else {
        seen.set(key, link.id);
      }
    }
    
    // Supprimer les doublons
    if (duplicateIds.length > 0) {
      const deleteResult = await prisma.documentLink.deleteMany({
        where: { id: { in: duplicateIds } }
      });
      console.log(`   ✅ ${deleteResult.count} doublons supprimés`);
    } else {
      console.log(`   ✅ Aucun doublon trouvé`);
    }
    
    // 2. Supprimer les liens "global" créés par erreur dans le flow transaction
    console.log('\n2️⃣ Suppression des liens "GLOBAL" du flow transaction...');
    
    // On garde seulement les liens GLOBAL qui sont seuls (upload depuis page Documents)
    // On supprime les GLOBAL qui coexistent avec TRANSACTION (créés par erreur)
    const globalLinks = await prisma.documentLink.findMany({
      where: { targetType: 'GLOBAL' },
      select: { documentId: true, id: true }
    });
    
    const globalToDelete: string[] = [];
    for (const globalLink of globalLinks) {
      // Vérifier si ce document a aussi un lien TRANSACTION
      const hasTransactionLink = await prisma.documentLink.findFirst({
        where: {
          documentId: globalLink.documentId,
          targetType: 'TRANSACTION'
        }
      });
      
      if (hasTransactionLink) {
        globalToDelete.push(globalLink.id);
      }
    }
    
    if (globalToDelete.length > 0) {
      const deleteGlobalResult = await prisma.documentLink.deleteMany({
        where: { id: { in: globalToDelete } }
      });
      console.log(`   ✅ ${deleteGlobalResult.count} liens GLOBAL erronés supprimés`);
    } else {
      console.log(`   ✅ Aucun lien GLOBAL erroné trouvé`);
    }
    
    // 3. Afficher un résumé
    console.log('\n📊 Résumé après nettoyage:');
    const finalLinksCount = await prisma.documentLink.count();
    console.log(`   Total des liens restants: ${finalLinksCount}`);
    
    const linksByType = await prisma.documentLink.groupBy({
      by: ['targetType'],
      _count: { targetType: true }
    });
    
    console.log('\n   Répartition par type:');
    for (const group of linksByType) {
      console.log(`   - ${group.targetType}: ${group._count.targetType}`);
    }
    
    console.log('\n✅ Nettoyage terminé avec succès !');
    console.log('⚠️  Vous pouvez maintenant lancer la migration Prisma.');
    
  } catch (error: any) {
    console.error('❌ Erreur lors du nettoyage:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();

