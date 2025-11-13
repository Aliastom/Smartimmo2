#!/usr/bin/env npx tsx

/**
 * Debug de la synchronisation du drawer - Pourquoi les documents ne s'affichent pas
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugDrawerSync() {
  console.log('🔍 Debug de la synchronisation du drawer...\n');

  try {
    // 1. Trouver le bail SIGNÉ
    console.log('📋 Recherche du bail SIGNÉ...');
    const signedLease = await prisma.lease.findFirst({
      where: {
        status: 'SIGNÉ'
      },
      include: {
        property: true,
        tenant: true
      }
    });

    if (!signedLease) {
      console.log('   ❌ Aucun bail SIGNÉ trouvé');
      return;
    }

    console.log(`   ✅ Bail SIGNÉ trouvé: ${signedLease.property.name}`);
    console.log(`   - ID: ${signedLease.id}`);
    console.log(`   - Statut: ${signedLease.status}`);
    console.log(`   - Locataire: ${signedLease.tenant.firstName} ${signedLease.tenant.lastName}`);

    // 2. Vérifier les documents liés à ce bail
    console.log('\n📄 Vérification des documents liés...');
    const documentLinks = await prisma.documentLink.findMany({
      where: {
        targetType: 'LEASE',
        targetId: signedLease.id
      },
      include: {
        document: {
          include: {
            documentType: true
          }
        }
      }
    });

    console.log(`   📄 ${documentLinks.length} lien(s) de document trouvé(s)`);
    
    if (documentLinks.length === 0) {
      console.log('   ❌ Aucun document lié à ce bail !');
      console.log('   🔧 Solution: Vérifier la création des DocumentLink lors de l\'upload');
      return;
    }

    // Analyser chaque document
    for (const link of documentLinks) {
      const doc = link.document;
      console.log(`\n   📄 Document: ${doc.filenameOriginal || doc.fileName}`);
      console.log(`     - Type: ${doc.documentType?.code || 'AUCUN'} (${doc.documentType?.label || 'Non défini'})`);
      console.log(`     - URL: ${doc.url}`);
      console.log(`     - Statut: ${doc.status}`);
      console.log(`     - Role: ${link.role}`);
      console.log(`     - Créé: ${doc.createdAt.toISOString()}`);
    }

    // 3. Vérifier spécifiquement les documents BAIL_SIGNE
    const bailSigneLinks = documentLinks.filter(link => 
      link.document.documentType?.code === 'BAIL_SIGNE'
    );
    
    console.log(`\n   🏠 Documents BAIL_SIGNE: ${bailSigneLinks.length}`);
    if (bailSigneLinks.length === 0) {
      console.log('   ❌ Aucun document BAIL_SIGNE trouvé !');
      console.log('   🔧 Solution: Vérifier que le document a bien le type BAIL_SIGNE');
    } else {
      bailSigneLinks.forEach(link => {
        console.log(`     ✅ ${link.document.filenameOriginal || link.document.fileName}`);
      });
    }

    // 4. Test du service LeaseDocumentsService
    console.log('\n🧪 Test du service LeaseDocumentsService...');
    try {
      const { LeaseDocumentsService } = await import('../src/lib/services/leaseDocumentsService');
      
      const summary = await LeaseDocumentsService.getLeaseDocuments(signedLease.id);
      
      console.log(`   📊 Résumé des documents:`);
      console.log(`     - Bail signé: ${summary.bailSigne ? '✅ Présent' : '❌ Manquant'}`);
      if (summary.bailSigne) {
        console.log(`       - Fichier: ${summary.bailSigne.filenameOriginal}`);
        console.log(`       - URL: ${summary.bailSigne.url}`);
        console.log(`       - Type: ${summary.bailSigne.documentType.code}`);
      }
      
      console.log(`     - État des lieux entrant: ${summary.etatLieuxEntrant ? '✅ Présent' : '❌ Manquant'}`);
      console.log(`     - État des lieux sortant: ${summary.etatLieuxSortant ? '✅ Présent' : '❌ Manquant'}`);
      console.log(`     - Assurance locataire: ${summary.assuranceLocataire ? '✅ Présent' : '❌ Manquant'}`);
      console.log(`     - Dépôt de garantie: ${summary.depotGarantie ? '✅ Présent' : '❌ Manquant'}`);
      console.log(`     - Autres documents: ${summary.otherDocuments.length}`);

      // 5. Vérifier si le problème vient du drawer
      if (summary.bailSigne) {
        console.log('\n   ✅ Le service trouve bien le document BAIL_SIGNE');
        console.log('   🔧 Le problème vient probablement du drawer qui ne se met pas à jour');
        console.log('   💡 Solutions possibles:');
        console.log('     1. Vérifier que le drawer recharge les documents à l\'ouverture');
        console.log('     2. Vérifier que handleUploadSuccess recharge correctement');
        console.log('     3. Vérifier que le state documents est bien mis à jour');
      } else {
        console.log('\n   ❌ Le service ne trouve pas le document BAIL_SIGNE');
        console.log('   🔧 Le problème vient de la récupération des documents');
      }

    } catch (error) {
      console.log(`   ❌ Erreur service: ${error.message}`);
    }

    // 6. Vérifier les types de documents
    console.log('\n🔍 Vérification des types de documents...');
    const documentTypes = await prisma.documentType.findMany({
      where: {
        code: 'BAIL_SIGNE'
      }
    });

    if (documentTypes.length === 0) {
      console.log('   ❌ Type de document BAIL_SIGNE non trouvé !');
      console.log('   🔧 Solution: Créer le type de document BAIL_SIGNE');
    } else {
      console.log(`   ✅ Type BAIL_SIGNE trouvé: ${documentTypes[0].label}`);
    }

    // 7. Vérifier l'URL du document
    if (bailSigneLinks.length > 0) {
      const doc = bailSigneLinks[0].document;
      console.log('\n🌐 Vérification de l\'URL du document...');
      console.log(`   URL: ${doc.url}`);
      
      if (doc.url.startsWith('/api/documents/')) {
        console.log('   ✅ URL API - Document accessible via API');
      } else if (doc.url.startsWith('/uploads/')) {
        console.log('   ✅ URL Upload - Document accessible via uploads');
      } else {
        console.log('   ⚠️ URL inconnue - Vérifier l\'accessibilité');
      }
    }

  } catch (error) {
    console.error('💥 Erreur lors du debug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le debug
debugDrawerSync()
  .then(() => {
    console.log('\n🎯 Debug terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec du debug:', error);
    process.exit(1);
  });
