/**
 * NETTOYAGE COMPLET - Supprime TOUTES les données (métier + admin)
 * ⚠️ DESTRUCTIF : Supprime absolument tout sauf la structure des tables
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 NETTOYAGE COMPLET DE TOUTES LES DONNÉES...\n');
  console.log('⚠️  ATTENTION : Cette opération va supprimer TOUTES les données !\n');

  // Ordre important : respecter les foreign keys (enfants avant parents)
  
  // ========================================================================
  // DONNÉES MÉTIER (avec organizationId)
  // ========================================================================
  
  console.log('📄 Suppression des documents...');
  const docsDeleted = await prisma.document.deleteMany({});
  console.log(`   ✅ ${docsDeleted.count} document(s) supprimé(s)`);

  console.log('📤 Suppression des sessions d\'upload...');
  const uploadItemsDeleted = await prisma.uploadStagedItem.deleteMany({});
  const uploadSessionsDeleted = await prisma.uploadSession.deleteMany({});
  console.log(`   ✅ ${uploadSessionsDeleted.count} session(s) et ${uploadItemsDeleted.count} item(s) supprimé(s)`);

  console.log('💰 Suppression des transactions...');
  const transDeleted = await prisma.transaction.deleteMany({});
  console.log(`   ✅ ${transDeleted.count} transaction(s) supprimée(s)`);

  console.log('💳 Suppression des paiements...');
  const paymentsDeleted = await prisma.payment.deleteMany({});
  console.log(`   ✅ ${paymentsDeleted.count} paiement(s) supprimé(s)`);

  console.log('📸 Suppression des photos...');
  const photosDeleted = await prisma.photo.deleteMany({});
  console.log(`   ✅ ${photosDeleted.count} photo(s) supprimée(s)`);

  console.log('📅 Suppression des échéances récurrentes...');
  const echeancesDeleted = await prisma.echeanceRecurrente.deleteMany({});
  console.log(`   ✅ ${echeancesDeleted.count} échéance(s) supprimée(s)`);

  console.log('🔔 Suppression des rappels...');
  const remindersDeleted = await prisma.reminder.deleteMany({});
  console.log(`   ✅ ${remindersDeleted.count} rappel(s) supprimé(s)`);

  console.log('📜 Suppression des baux...');
  const leasesDeleted = await prisma.lease.deleteMany({});
  console.log(`   ✅ ${leasesDeleted.count} bail/baux supprimé(s)`);

  console.log('🏦 Suppression des prêts...');
  const loansDeleted = await prisma.loan.deleteMany({});
  console.log(`   ✅ ${loansDeleted.count} prêt(s) supprimé(s)`);

  console.log('📊 Suppression de l\'historique d\'occupation...');
  const occupancyDeleted = await prisma.occupancyHistory.deleteMany({});
  console.log(`   ✅ ${occupancyDeleted.count} entrée(s) d'historique supprimée(s)`);

  console.log('🏠 Suppression des biens...');
  const propertiesDeleted = await prisma.property.deleteMany({});
  console.log(`   ✅ ${propertiesDeleted.count} bien(s) supprimé(s)`);

  console.log('👤 Suppression des locataires...');
  const tenantsDeleted = await prisma.tenant.deleteMany({});
  console.log(`   ✅ ${tenantsDeleted.count} locataire(s) supprimé(s)`);

  console.log('📊 Suppression des simulations fiscales...');
  const simulationsDeleted = await prisma.fiscalSimulation.deleteMany({});
  console.log(`   ✅ ${simulationsDeleted.count} simulation(s) supprimée(s)`);

  // ========================================================================
  // DONNÉES ADMIN (partagées - pas d'organizationId)
  // ========================================================================
  
  console.log('\n🔧 Suppression des données ADMIN...\n');

  // Relations et liaisons d'abord
  try {
    console.log('🔗 Suppression des relations nature-catégorie...');
    const natureCategoryAllowedDeleted = await prisma.nature_category_allowed.deleteMany({});
    const natureCategoryDefaultDeleted = await prisma.nature_category_default.deleteMany({});
    console.log(`   ✅ ${natureCategoryAllowedDeleted.count} autorisation(s) et ${natureCategoryDefaultDeleted.count} mapping(s) supprimé(s)`);
  } catch (e) {
    console.log('   ⏭️  Relations nature-catégorie n\'existent pas ou déjà vides');
  }

  try {
    const natureDefaultsDeleted = await prisma.natureDefault.deleteMany({});
    console.log(`   ✅ ${natureDefaultsDeleted.count} mapping(s) nature par défaut supprimé(s)`);
  } catch (e) {
    console.log('   ⏭️  NatureDefault n\'existe pas ou déjà vide');
  }

  try {
    const natureRulesDeleted = await prisma.natureRule.deleteMany({});
    console.log(`   ✅ ${natureRulesDeleted.count} règle(s) de nature supprimée(s)`);
  } catch (e) {
    console.log('   ⏭️  NatureRule n\'existe pas ou déjà vide');
  }

  console.log('📁 Suppression des types de documents et leurs relations...');
  try {
    const docExtractionRulesDeleted = await prisma.documentExtractionRule.deleteMany({});
    const docKeywordsDeleted = await prisma.documentKeyword.deleteMany({});
    const docTypeFieldsDeleted = await prisma.documentTypeField.deleteMany({});
    const docFieldsDeleted = await prisma.documentField.deleteMany({});
    const docLinksDeleted = await prisma.documentLink.deleteMany({});
    const docTextIndexesDeleted = await prisma.documentTextIndex.deleteMany({});
    console.log(`   ✅ Relations documents supprimées (${docLinksDeleted.count} liens, ${docFieldsDeleted.count} champs, etc.)`);
  } catch (e) {
    console.log('   ⏭️  Relations documents déjà supprimées');
  }
  
  const docTypesDeleted = await prisma.documentType.deleteMany({});
  console.log(`   ✅ ${docTypesDeleted.count} type(s) de document supprimé(s)`);

  console.log('📋 Suppression des natures de transactions...');
  const naturesDeleted = await prisma.natureEntity.deleteMany({});
  console.log(`   ✅ ${naturesDeleted.count} nature(s) supprimée(s)`);

  console.log('📂 Suppression des catégories comptables...');
  const categoriesDeleted = await prisma.category.deleteMany({});
  console.log(`   ✅ ${categoriesDeleted.count} catégorie(s) supprimée(s)`);

  console.log('🧮 Suppression des configurations fiscales...');
  const fiscalParamsDeleted = await prisma.fiscalParams.deleteMany({});
  const fiscalCompatibilitiesDeleted = await prisma.fiscalCompatibility.deleteMany({});
  const fiscalTypesDeleted = await prisma.fiscalType.deleteMany({});
  const fiscalRegimesDeleted = await prisma.fiscalRegime.deleteMany({});
  const fiscalVersionsDeleted = await prisma.fiscalVersion.deleteMany({});
  const taxConfigsDeleted = await prisma.taxConfig.deleteMany({});
  const taxSourceSnapshotsDeleted = await prisma.taxSourceSnapshot.deleteMany({});
  const taxSourceConfigsDeleted = await prisma.taxSourceConfig.deleteMany({});
  console.log(`   ✅ ${fiscalVersionsDeleted.count} version(s), ${fiscalRegimesDeleted.count} régime(s), ${fiscalTypesDeleted.count} type(s), ${fiscalParamsDeleted.count} paramètre(s), ${fiscalCompatibilitiesDeleted.count} compatibilité(s), ${taxConfigsDeleted.count} config(s), ${taxSourceSnapshotsDeleted.count} snapshot(s), ${taxSourceConfigsDeleted.count} source config(s) supprimé(s)`);

  console.log('🔍 Suppression des signaux OCR...');
  const signalsDeleted = await prisma.signal.deleteMany({});
  const typeSignalsDeleted = await prisma.typeSignal.deleteMany({});
  console.log(`   ✅ ${signalsDeleted.count} signal(s) et ${typeSignalsDeleted.count} type(s) de signal supprimé(s)`);

  console.log('🏢 Suppression des sociétés de gestion...');
  const managementCompaniesDeleted = await prisma.managementCompany.deleteMany({});
  console.log(`   ✅ ${managementCompaniesDeleted.count} société(s) de gestion supprimée(s)`);

  console.log('👔 Suppression des profils propriétaires...');
  const landlordsDeleted = await prisma.landlord.deleteMany({});
  console.log(`   ✅ ${landlordsDeleted.count} profil(s) propriétaire supprimé(s)`);

  console.log('⚙️  Suppression des paramètres système...');
  const appSettingsDeleted = await prisma.appSetting.deleteMany({});
  const appConfigsDeleted = await prisma.appConfig.deleteMany({});
  console.log(`   ✅ ${appSettingsDeleted.count} paramètre(s) et ${appConfigsDeleted.count} configuration(s) supprimé(s)`);

  console.log('💾 Suppression des sauvegardes admin...');
  const backupRecordsDeleted = await prisma.adminBackupRecord.deleteMany({});
  const backupSchedulesDeleted = await prisma.adminBackupSchedule.deleteMany({});
  console.log(`   ✅ ${backupRecordsDeleted.count} enregistrement(s) et ${backupSchedulesDeleted.count} planification(s) supprimé(s)`);

  console.log('🤖 Suppression des sessions IA...');
  try {
    const aiToolLogsDeleted = await prisma.aiToolLog.deleteMany({});
    const aiMessagesDeleted = await prisma.aiMessage.deleteMany({});
    const aiChatSessionsDeleted = await prisma.aiChatSession.deleteMany({});
    console.log(`   ✅ ${aiChatSessionsDeleted.count} session(s), ${aiMessagesDeleted.count} message(s), ${aiToolLogsDeleted.count} log(s) supprimé(s)`);
  } catch (e) {
    console.log('   ⏭️  Sessions IA déjà supprimées ou n\'existent pas');
  }

  console.log('📧 Suppression des logs emails...');
  try {
    const emailLogsDeleted = await prisma.emailLog.deleteMany({});
    console.log(`   ✅ ${emailLogsDeleted.count} log(s) email supprimé(s)`);
  } catch (e) {
    console.log('   ⏭️  Logs emails déjà supprimés ou n\'existent pas');
  }

  console.log('📝 Suppression des versions de baux...');
  try {
    const leaseVersionsDeleted = await prisma.leaseVersion.deleteMany({});
    console.log(`   ✅ ${leaseVersionsDeleted.count} version(s) de bail supprimée(s)`);
  } catch (e) {
    console.log('   ⏭️  Versions de baux déjà supprimées ou n\'existent pas');
  }

  console.log('📎 Suppression des pièces jointes de paiements...');
  try {
    const paymentAttachmentsDeleted = await prisma.paymentAttachment.deleteMany({});
    console.log(`   ✅ ${paymentAttachmentsDeleted.count} pièce(s) jointe(s) supprimée(s)`);
  } catch (e) {
    console.log('   ⏭️  Pièces jointes déjà supprimées ou n\'existent pas');
  }

  // ========================================================================
  // DONNÉES UTILISATEURS ET ORGANISATIONS
  // ========================================================================
  
  console.log('\n👥 Suppression des utilisateurs et organisations...\n');

  console.log('🔐 Suppression des sessions et comptes...');
  const sessionsDeleted = await prisma.session.deleteMany({});
  const accountsDeleted = await prisma.account.deleteMany({});
  console.log(`   ✅ ${sessionsDeleted.count} session(s) et ${accountsDeleted.count} compte(s) supprimé(s)`);

  console.log('👤 Suppression des utilisateurs...');
  const usersDeleted = await prisma.user.deleteMany({});
  console.log(`   ✅ ${usersDeleted.count} utilisateur(s) supprimé(s)`);

  console.log('🏢 Suppression des organisations...');
  const orgsDeleted = await prisma.organization.deleteMany({});
  console.log(`   ✅ ${orgsDeleted.count} organisation(s) supprimée(s)`);

  console.log('📝 Suppression des profils utilisateurs...');
  const profilesDeleted = await prisma.userProfile.deleteMany({});
  console.log(`   ✅ ${profilesDeleted.count} profil(s) supprimé(s)`);

  // ========================================================================
  // TABLES DE LIAISON ET RELATIONS
  // ========================================================================
  
  console.log('\n🔗 Suppression des relations et liaisons...\n');

  // Vérifier et supprimer les tables de liaison si elles existent
  try {
    const natureDefaultsDeleted = await prisma.natureDefault.deleteMany({});
    console.log(`   ✅ ${natureDefaultsDeleted.count} mapping(s) nature par défaut supprimé(s)`);
  } catch (e) {
    console.log('   ⏭️  NatureDefault n\'existe pas ou déjà vide');
  }

  try {
    const natureRulesDeleted = await prisma.natureRule.deleteMany({});
    console.log(`   ✅ ${natureRulesDeleted.count} règle(s) de nature supprimée(s)`);
  } catch (e) {
    console.log('   ⏭️  NatureRule n\'existe pas ou déjà vide');
  }

  try {
    const natureCategoryAllowedDeleted = await prisma.nature_category_allowed.deleteMany({});
    console.log(`   ✅ ${natureCategoryAllowedDeleted.count} autorisation(s) nature-catégorie supprimée(s)`);
  } catch (e) {
    console.log('   ⏭️  nature_category_allowed n\'existe pas ou déjà vide');
  }

  try {
    const natureCategoryDefaultDeleted = await prisma.nature_category_default.deleteMany({});
    console.log(`   ✅ ${natureCategoryDefaultDeleted.count} mapping(s) nature-catégorie par défaut supprimé(s)`);
  } catch (e) {
    console.log('   ⏭️  nature_category_default n\'existe pas ou déjà vide');
  }

  console.log('\n✨ NETTOYAGE COMPLET TERMINÉ AVEC SUCCÈS !\n');
  console.log('📊 RÉSUMÉ DES SUPPRESSIONS :');
  console.log('\n📦 DONNÉES MÉTIER :');
  console.log(`   - ${propertiesDeleted.count} bien(s)`);
  console.log(`   - ${tenantsDeleted.count} locataire(s)`);
  console.log(`   - ${leasesDeleted.count} bail/baux`);
  console.log(`   - ${transDeleted.count} transaction(s)`);
  console.log(`   - ${docsDeleted.count} document(s)`);
  console.log(`   - ${echeancesDeleted.count} échéance(s)`);
  console.log(`   - ${loansDeleted.count} prêt(s)`);
  console.log(`   - ${photosDeleted.count} photo(s)`);
  console.log(`   - ${simulationsDeleted.count} simulation(s) fiscale(s)`);
  console.log(`   - ${uploadSessionsDeleted.count} session(s) d'upload`);
  
  console.log('\n🔧 DONNÉES ADMIN :');
  console.log(`   - ${docTypesDeleted.count} type(s) de document`);
  console.log(`   - ${naturesDeleted.count} nature(s) de transaction`);
  console.log(`   - ${categoriesDeleted.count} catégorie(s) comptable`);
  console.log(`   - ${fiscalVersionsDeleted.count} version(s) fiscale`);
  console.log(`   - ${signalsDeleted.count} signal(s) OCR`);
  console.log(`   - ${managementCompaniesDeleted.count} société(s) de gestion`);
  
  console.log('\n👥 UTILISATEURS :');
  console.log(`   - ${usersDeleted.count} utilisateur(s)`);
  console.log(`   - ${orgsDeleted.count} organisation(s)`);
  console.log(`   - ${sessionsDeleted.count} session(s)`);
  console.log(`   - ${accountsDeleted.count} compte(s)`);
  console.log(`   - ${profilesDeleted.count} profil(s) utilisateur`);
  
  console.log('\n✅ La base de données est maintenant complètement vide.');
  console.log('🚀 Vous pouvez maintenant créer de nouveaux comptes et tester !');
  console.log('💡 Le premier utilisateur créé sera automatiquement ADMIN.\n');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du nettoyage:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

