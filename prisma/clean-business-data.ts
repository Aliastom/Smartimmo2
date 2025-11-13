/**
 * Nettoyage ciblé - Supprime uniquement les données métier
 * CONSERVE : Catégories, Types fiscaux, Régimes, Compatibilités, Versions fiscales, Users, etc.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Nettoyage ciblé des données métier...\n');

  // Ordre important : respecter les foreign keys (enfants avant parents)
  
  console.log('📄 Suppression des documents...');
  const docsDeleted = await prisma.document.deleteMany();
  console.log(`   ✅ ${docsDeleted.count} document(s) supprimé(s)`);

  console.log('💰 Suppression des transactions...');
  const transDeleted = await prisma.transaction.deleteMany();
  console.log(`   ✅ ${transDeleted.count} transaction(s) supprimée(s)`);

  console.log('💳 Suppression des paiements...');
  const paymentsDeleted = await prisma.payment.deleteMany();
  console.log(`   ✅ ${paymentsDeleted.count} paiement(s) supprimé(s)`);

  console.log('📸 Suppression des photos...');
  const photosDeleted = await prisma.photo.deleteMany();
  console.log(`   ✅ ${photosDeleted.count} photo(s) supprimée(s)`);

  console.log('📜 Suppression des baux...');
  const leasesDeleted = await prisma.lease.deleteMany();
  console.log(`   ✅ ${leasesDeleted.count} bail/baux supprimé(s)`);

  console.log('📅 Suppression des échéances récurrentes...');
  const echeancesDeleted = await prisma.echeanceRecurrente.deleteMany();
  console.log(`   ✅ ${echeancesDeleted.count} échéance(s) supprimée(s)`);

  console.log('🏦 Suppression des prêts...');
  const loansDeleted = await prisma.loan.deleteMany();
  console.log(`   ✅ ${loansDeleted.count} prêt(s) supprimé(s)`);

  console.log('📊 Suppression de l\'historique d\'occupation...');
  const occupancyDeleted = await prisma.occupancyHistory.deleteMany();
  console.log(`   ✅ ${occupancyDeleted.count} entrée(s) d\'historique supprimée(s)`);

  console.log('🏠 Suppression des biens...');
  const propertiesDeleted = await prisma.property.deleteMany();
  console.log(`   ✅ ${propertiesDeleted.count} bien(s) supprimé(s)`);

  console.log('👤 Suppression des locataires...');
  const tenantsDeleted = await prisma.tenant.deleteMany();
  console.log(`   ✅ ${tenantsDeleted.count} locataire(s) supprimé(s)`);

  console.log('\n✨ Nettoyage terminé avec succès !');
  console.log('\n🔒 DONNÉES CONSERVÉES :');
  console.log('   ✅ Catégories comptables');
  console.log('   ✅ Types fiscaux (NU, MEUBLE, SCI_IS)');
  console.log('   ✅ Régimes fiscaux (MICRO, REEL, etc.)');
  console.log('   ✅ Compatibilités fiscales');
  console.log('   ✅ Version fiscale 2025.1');
  console.log('   ✅ Types de documents');
  console.log('   ✅ Utilisateurs');
  console.log('   ✅ Signaux et règles');
  console.log('\n📊 Total supprimé :');
  console.log(`   - ${propertiesDeleted.count} bien(s)`);
  console.log(`   - ${tenantsDeleted.count} locataire(s)`);
  console.log(`   - ${leasesDeleted.count} bail/baux`);
  console.log(`   - ${transDeleted.count} transaction(s)`);
  console.log(`   - ${docsDeleted.count} document(s)`);
  console.log(`   - ${echeancesDeleted.count} échéance(s)`);
  console.log(`   - ${loansDeleted.count} prêt(s)`);
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du nettoyage:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

