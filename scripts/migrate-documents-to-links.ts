/**
 * Script de migration des documents existants vers le système DocumentLink
 * 
 * Ce script crée des DocumentLink pour tous les documents existants
 * basés sur leurs champs legacy (propertyId, leaseId, tenantId, transactionId)
 * 
 * Usage :
 * npx ts-node scripts/migrate-documents-to-links.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MigrationStats {
  totalDocuments: number;
  documentsWithLinks: number;
  linksCreated: number;
  errors: number;
  skipped: number;
}

async function migrateDocumentsToLinks() {
  console.log('🚀 Démarrage de la migration des documents vers DocumentLink...\n');

  const stats: MigrationStats = {
    totalDocuments: 0,
    documentsWithLinks: 0,
    linksCreated: 0,
    errors: 0,
    skipped: 0,
  };

  try {
    // Récupérer tous les documents non supprimés
    const documents = await prisma.document.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        filenameOriginal: true,
        propertyId: true,
        leaseId: true,
        tenantId: true,
        transactionId: true,
        links: true, // Liens existants
      },
    });

    stats.totalDocuments = documents.length;

    console.log(`📊 Documents trouvés : ${stats.totalDocuments}\n`);

    // Parcourir chaque document
    for (const doc of documents) {
      console.log(`📄 Traitement : ${doc.filenameOriginal} (${doc.id})`);

      // Vérifier s'il a déjà des liens
      if (doc.links && doc.links.length > 0) {
        console.log(`   ⏭️  Déjà migré (${doc.links.length} lien(s) existant(s))`);
        stats.skipped++;
        continue;
      }

      const linksToCreate: Array<{
        entityType: string;
        entityId: string | null;
      }> = [];

      // Créer des liens basés sur les champs legacy
      if (doc.propertyId) {
        linksToCreate.push({
          entityType: 'PROPERTY',
          entityId: doc.propertyId,
        });
      }

      if (doc.leaseId) {
        linksToCreate.push({
          entityType: 'LEASE',
          entityId: doc.leaseId,
        });
      }

      if (doc.tenantId) {
        linksToCreate.push({
          entityType: 'TENANT',
          entityId: doc.tenantId,
        });
      }

      if (doc.transactionId) {
        linksToCreate.push({
          entityType: 'TRANSACTION',
          entityId: doc.transactionId,
        });
      }

      // Si aucun lien spécifique, créer un lien GLOBAL
      if (linksToCreate.length === 0) {
        linksToCreate.push({
          entityType: 'GLOBAL',
          entityId: null,
        });
      }

      // Créer les liens en base de données
      try {
        for (const link of linksToCreate) {
          await prisma.documentLink.create({
            data: {
              documentId: doc.id,
              entityType: link.entityType,
              entityId: link.entityId,
              isPrimary: false, // Par défaut, pas de document principal lors de la migration
            },
          });

          stats.linksCreated++;
          console.log(`   ✅ Lien créé : ${link.entityType}${link.entityId ? `/${link.entityId}` : ''}`);
        }

        stats.documentsWithLinks++;
      } catch (error) {
        console.error(`   ❌ Erreur :`, error);
        stats.errors++;
      }

      console.log('');
    }

    // Afficher les statistiques finales
    console.log('\n' + '='.repeat(60));
    console.log('📊 Statistiques de Migration');
    console.log('='.repeat(60));
    console.log(`Total de documents traités     : ${stats.totalDocuments}`);
    console.log(`Documents déjà migrés (ignorés) : ${stats.skipped}`);
    console.log(`Documents migrés avec succès    : ${stats.documentsWithLinks}`);
    console.log(`Liens créés                     : ${stats.linksCreated}`);
    console.log(`Erreurs                         : ${stats.errors}`);
    console.log('='.repeat(60));

    if (stats.errors > 0) {
      console.log('\n⚠️  Attention : Des erreurs se sont produites pendant la migration.');
      console.log('Veuillez vérifier les logs ci-dessus pour plus de détails.');
    } else {
      console.log('\n✅ Migration terminée avec succès !');
    }

  } catch (error) {
    console.error('\n❌ Erreur fatale lors de la migration :', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Option : Migration en mode dry-run (simulation)
async function dryRunMigration() {
  console.log('🔍 Mode DRY-RUN : Simulation de la migration (aucun changement en base)\n');

  const documents = await prisma.document.findMany({
    where: {
      deletedAt: null,
    },
    select: {
      id: true,
      filenameOriginal: true,
      propertyId: true,
      leaseId: true,
      tenantId: true,
      transactionId: true,
      links: true,
    },
  });

  console.log(`📊 Documents trouvés : ${documents.length}\n`);

  let wouldCreate = 0;
  let alreadyMigrated = 0;

  for (const doc of documents) {
    if (doc.links && doc.links.length > 0) {
      console.log(`⏭️  ${doc.filenameOriginal} : Déjà migré (${doc.links.length} lien(s))`);
      alreadyMigrated++;
      continue;
    }

    const links: string[] = [];
    if (doc.propertyId) links.push(`PROPERTY/${doc.propertyId}`);
    if (doc.leaseId) links.push(`LEASE/${doc.leaseId}`);
    if (doc.tenantId) links.push(`TENANT/${doc.tenantId}`);
    if (doc.transactionId) links.push(`TRANSACTION/${doc.transactionId}`);
    if (links.length === 0) links.push('GLOBAL');

    console.log(`✅ ${doc.filenameOriginal} → Créerait ${links.length} lien(s) : ${links.join(', ')}`);
    wouldCreate += links.length;
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Résumé de la Simulation');
  console.log('='.repeat(60));
  console.log(`Documents à migrer             : ${documents.length - alreadyMigrated}`);
  console.log(`Documents déjà migrés          : ${alreadyMigrated}`);
  console.log(`Liens qui seraient créés       : ${wouldCreate}`);
  console.log('='.repeat(60));
  console.log('\n💡 Pour exécuter la migration réelle, lancez :');
  console.log('   npx ts-node scripts/migrate-documents-to-links.ts --execute\n');

  await prisma.$disconnect();
}

// Fonction principale
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes('--execute');

  if (isDryRun) {
    await dryRunMigration();
  } else {
    console.log('⚠️  ATTENTION : Cette migration va créer des liens en base de données.\n');
    console.log('   Assurez-vous d\'avoir une sauvegarde de votre base de données avant de continuer.\n');

    // Attendre 3 secondes pour laisser le temps de lire
    console.log('   Démarrage dans 3 secondes...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    await migrateDocumentsToLinks();
  }
}

// Exécuter
main().catch((error) => {
  console.error('Erreur inattendue :', error);
  process.exit(1);
});

