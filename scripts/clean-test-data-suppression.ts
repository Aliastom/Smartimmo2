/**
 * Script de nettoyage des données de test pour le système de suppression simple
 * 
 * ⚠️ ATTENTION : Ce script supprime UNIQUEMENT les données créées par le script de test
 * Il ne touche PAS aux données admin ou utilisateur existantes
 * 
 * Usage: npx tsx scripts/clean-test-data-suppression.ts
 */

import { PrismaClient } from '@prisma/client';
import { unlink } from 'fs/promises';
import { join } from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Démarrage du nettoyage des données de test...\n');
  console.log('⚠️  ATTENTION : Suppression UNIQUEMENT des données de test');
  console.log('📋 IDs à supprimer : test-p1-suppression, test-tenant-suppression, test-l1-suppression, test-t1-suppression, test-d1-suppression, test-d2-suppression, test-d3-suppression\n');

  try {
    // 1. Supprimer les liaisons de test (au cas où)
    console.log('🔗 Suppression des liaisons de test...');
    const deletedLinks = await prisma.documentLink.deleteMany({
      where: {
        documentId: {
          in: ['test-d1-suppression', 'test-d2-suppression', 'test-d3-suppression']
        }
      }
    });
    console.log(`✅ ${deletedLinks.count} liaison(s) supprimée(s)`);

    // 2. Supprimer les documents de test
    console.log('\n📄 Suppression des documents de test...');
    const deletedDocs = await prisma.document.deleteMany({
      where: {
        id: {
          in: ['test-d1-suppression', 'test-d2-suppression', 'test-d3-suppression']
        }
      }
    });
    console.log(`✅ ${deletedDocs.count} document(s) supprimé(s) de la base`);

    // 3. Supprimer les fichiers physiques de test
    console.log('\n📁 Suppression des fichiers physiques de test...');
    const storageDir = join(process.cwd(), 'storage', 'documents');
    const testFiles = [
      'test-d1-suppression.pdf',
      'test-d2-suppression.pdf',
      'test-d3-suppression.pdf'
    ];

    for (const file of testFiles) {
      try {
        await unlink(join(storageDir, file));
        console.log(`  ✅ ${file} supprimé`);
      } catch (error) {
        console.log(`  ⚠️  ${file} (déjà supprimé ou introuvable)`);
      }
    }

    // 4. Supprimer la transaction de test
    console.log('\n💳 Suppression de la transaction de test...');
    const deletedTransaction = await prisma.transaction.deleteMany({
      where: { id: 'test-t1-suppression' }
    });
    console.log(`✅ ${deletedTransaction.count} transaction(s) supprimée(s)`);

    // 5. Supprimer le bail de test
    console.log('\n📄 Suppression du bail de test...');
    const deletedLease = await prisma.lease.deleteMany({
      where: { id: 'test-l1-suppression' }
    });
    console.log(`✅ ${deletedLease.count} bail(s) supprimé(s)`);

    // 6. Supprimer le locataire de test
    console.log('\n👤 Suppression du locataire de test...');
    const deletedTenant = await prisma.tenant.deleteMany({
      where: { id: 'test-tenant-suppression' }
    });
    console.log(`✅ ${deletedTenant.count} locataire(s) supprimé(s)`);

    // 7. Supprimer le bien de test
    console.log('\n📦 Suppression du bien de test...');
    const deletedProperty = await prisma.property.deleteMany({
      where: { id: 'test-p1-suppression' }
    });
    console.log(`✅ ${deletedProperty.count} bien(s) supprimé(s)`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ NETTOYAGE TERMINÉ AVEC SUCCÈS !');
    console.log('='.repeat(60));
    console.log('\n📊 Résumé des suppressions :');
    console.log('─'.repeat(60));
    console.log(`• Liaisons supprimées : ${deletedLinks.count}`);
    console.log(`• Documents supprimés : ${deletedDocs.count}`);
    console.log(`• Transactions supprimées : ${deletedTransaction.count}`);
    console.log(`• Baux supprimés : ${deletedLease.count}`);
    console.log(`• Locataires supprimés : ${deletedTenant.count}`);
    console.log(`• Biens supprimés : ${deletedProperty.count}`);
    console.log('─'.repeat(60));
    console.log('\n✅ Toutes les données de test ont été supprimées');
    console.log('✅ Les données admin et utilisateur sont préservées');
    console.log('\n💡 Tu peux maintenant créer tes propres données de test !\n');

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });