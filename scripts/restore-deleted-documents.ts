#!/usr/bin/env tsx

/**
 * Script pour restaurer les documents supprimés
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function restoreDeletedDocuments() {
  console.log('🔄 RESTAURATION DES DOCUMENTS SUPPRIMÉS');
  console.log('======================================\n');

  try {
    // 1. Compter les documents supprimés
    const deletedCount = await prisma.document.count({
      where: { deletedAt: { not: null } }
    });

    console.log(`📊 Documents supprimés trouvés: ${deletedCount}`);

    if (deletedCount === 0) {
      console.log('✅ Aucun document supprimé à restaurer');
      return;
    }

    // 2. Lister quelques documents supprimés
    const deletedDocuments = await prisma.document.findMany({
      where: { deletedAt: { not: null } },
      take: 10,
      select: {
        id: true,
        fileName: true,
        status: true,
        deletedAt: true,
        createdAt: true
      },
      orderBy: { deletedAt: 'desc' }
    });

    console.log('\n📋 Exemples de documents supprimés:');
    deletedDocuments.forEach((doc, index) => {
      console.log(`${index + 1}. ${doc.fileName}`);
      console.log(`   Status: ${doc.status}`);
      console.log(`   Supprimé le: ${doc.deletedAt?.toISOString()}`);
      console.log(`   Créé le: ${doc.createdAt.toISOString()}`);
      console.log('');
    });

    // 3. Restaurer les documents supprimés
    console.log('🔄 Restauration des documents...');
    
    const restoreResult = await prisma.document.updateMany({
      where: { deletedAt: { not: null } },
      data: { deletedAt: null }
    });

    console.log(`✅ ${restoreResult.count} documents restaurés`);

    // 4. Vérifier le résultat
    const activeCount = await prisma.document.count({
      where: { deletedAt: null }
    });

    console.log(`📊 Documents actifs après restauration: ${activeCount}`);

    // 5. Analyser les statuts après restauration
    const statusCounts = await prisma.document.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: {
        status: true
      }
    });

    console.log('\n📋 Répartition par statut après restauration:');
    statusCounts.forEach(group => {
      console.log(`  • ${group.status || 'NULL'}: ${group._count.status}`);
    });

    console.log('\n🎉 Restauration terminée !');
    console.log('Les documents devraient maintenant être visibles dans l\'application.');

  } catch (error) {
    console.error('❌ Erreur lors de la restauration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreDeletedDocuments();
