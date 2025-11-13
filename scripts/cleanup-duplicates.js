import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupDuplicates() {
  console.log('🧹 Nettoyage des doublons...');

  try {
    // Supprimer DEPENSE_ASSURANCES (pluriel) car il n'a pas de règles
    const toDelete = await prisma.natureEntity.findUnique({
      where: { code: 'DEPENSE_ASSURANCES' },
      include: { rules: true, defaults: true }
    });

    if (toDelete) {
      console.log(`🗑️ Suppression de ${toDelete.code} (${toDelete.label})`);
      console.log(`   Règles: ${toDelete.rules.length}, Défaut: ${toDelete.defaults ? 'OUI' : 'NON'}`);
      
      // Supprimer en cascade (les règles et defaults seront supprimés automatiquement)
      await prisma.natureEntity.delete({
        where: { code: 'DEPENSE_ASSURANCES' }
      });
      
      console.log('✅ Supprimé avec succès');
    } else {
      console.log('ℹ️ DEPENSE_ASSURANCES non trouvé');
    }

    // Vérifier le résultat
    const remainingNatures = await prisma.natureEntity.findMany({
      where: { code: { contains: 'ASSURANCE' } },
      include: { rules: true, defaults: true }
    });

    console.log(`\n📊 Natures ASSURANCE restantes (${remainingNatures.length}):`);
    remainingNatures.forEach(nature => {
      console.log(`- ${nature.code}: ${nature.label}`);
      console.log(`  Règles: ${nature.rules.map(r => r.allowedType).join(', ')}`);
      console.log(`  Défaut: ${nature.defaults?.defaultCategory?.label || 'Aucun'}`);
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDuplicates();
