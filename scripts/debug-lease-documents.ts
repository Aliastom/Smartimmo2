#!/usr/bin/env npx tsx

/**
 * Debug des documents de bail - Vérification des liens
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugLeaseDocuments() {
  console.log('🔍 Debug des documents de bail...\n');

  try {
    // 1. Récupérer tous les baux
    console.log('📋 Récupération des baux...');
    const leases = await prisma.lease.findMany({
      include: {
        property: true,
        tenant: true
      }
    });

    console.log(`   ✅ ${leases.length} bail(s) trouvé(s)`);
    leases.forEach(lease => {
      console.log(`     - ${lease.id}: ${lease.property.name} (${lease.tenant.firstName} ${lease.tenant.lastName}) - Statut: ${lease.status}`);
    });

    // 2. Pour chaque bail, vérifier les documents liés
    for (const lease of leases) {
      console.log(`\n🔍 Analyse du bail ${lease.id} (${lease.property.name})...`);
      
      // Vérifier les DocumentLink
      const documentLinks = await prisma.documentLink.findMany({
        where: {
          targetType: 'LEASE',
          targetId: lease.id
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
        console.log('   ❌ Aucun document lié à ce bail');
        continue;
      }

      // Analyser chaque document
      for (const link of documentLinks) {
        const doc = link.document;
        console.log(`     - Document: ${doc.filenameOriginal || doc.fileName}`);
        console.log(`       Type: ${doc.documentType?.code || 'AUCUN'} (${doc.documentType?.label || 'Non défini'})`);
        console.log(`       URL: ${doc.url}`);
        console.log(`       Statut: ${doc.status}`);
        console.log(`       Role: ${link.role}`);
        console.log(`       Créé: ${doc.createdAt.toISOString()}`);
      }

      // Vérifier spécifiquement les documents BAIL_SIGNE
      const bailSigneLinks = documentLinks.filter(link => 
        link.document.documentType?.code === 'BAIL_SIGNE'
      );
      
      console.log(`   🏠 Documents BAIL_SIGNE: ${bailSigneLinks.length}`);
      if (bailSigneLinks.length === 0) {
        console.log('   ❌ Aucun document BAIL_SIGNE trouvé');
      } else {
        bailSigneLinks.forEach(link => {
          console.log(`     ✅ ${link.document.filenameOriginal || link.document.fileName}`);
        });
      }
    }

    // 3. Vérifier tous les documents BAIL_SIGNE en base
    console.log('\n🔍 Vérification de tous les documents BAIL_SIGNE...');
    const allBailSigneDocs = await prisma.document.findMany({
      where: {
        documentType: {
          code: 'BAIL_SIGNE'
        }
      },
      include: {
        documentType: true,
        links: true
      }
    });

    console.log(`   📄 ${allBailSigneDocs.length} document(s) BAIL_SIGNE trouvé(s)`);
    
    for (const doc of allBailSigneDocs) {
      console.log(`     - ${doc.filenameOriginal || doc.fileName}`);
      console.log(`       URL: ${doc.url}`);
      console.log(`       Statut: ${doc.status}`);
      console.log(`       Liens: ${doc.links.length}`);
      
      doc.links.forEach(link => {
        console.log(`         - ${link.targetType}:${link.targetId} (${link.role})`);
      });
    }

    // 4. Vérifier les types de documents
    console.log('\n🔍 Vérification des types de documents...');
    const documentTypes = await prisma.documentType.findMany({
      where: {
        code: {
          in: ['BAIL_SIGNE', 'ETAT_LIEUX_ENTRANT', 'ETAT_LIEUX_SORTANT', 'ASSURANCE_LOCATAIRE', 'DEPOT_GARANTIE']
        }
      }
    });

    console.log(`   📋 ${documentTypes.length} type(s) de document trouvé(s)`);
    documentTypes.forEach(type => {
      console.log(`     - ${type.code}: ${type.label}`);
    });

    // 5. Test du service LeaseDocumentsService
    console.log('\n🧪 Test du service LeaseDocumentsService...');
    try {
      const { LeaseDocumentsService } = await import('../src/lib/services/leaseDocumentsService');
      
      for (const lease of leases) {
        console.log(`\n   Test pour le bail ${lease.id}...`);
        const summary = await LeaseDocumentsService.getLeaseDocuments(lease.id);
        
        console.log(`     - Bail signé: ${summary.bailSigne ? '✅ Présent' : '❌ Manquant'}`);
        console.log(`     - État des lieux entrant: ${summary.etatLieuxEntrant ? '✅ Présent' : '❌ Manquant'}`);
        console.log(`     - État des lieux sortant: ${summary.etatLieuxSortant ? '✅ Présent' : '❌ Manquant'}`);
        console.log(`     - Assurance locataire: ${summary.assuranceLocataire ? '✅ Présent' : '❌ Manquant'}`);
        console.log(`     - Dépôt de garantie: ${summary.depotGarantie ? '✅ Présent' : '❌ Manquant'}`);
        console.log(`     - Autres documents: ${summary.otherDocuments.length}`);
      }
    } catch (error) {
      console.log(`   ❌ Erreur service: ${error.message}`);
    }

  } catch (error) {
    console.error('💥 Erreur lors du debug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le debug
debugLeaseDocuments()
  .then(() => {
    console.log('\n🎯 Debug terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec du debug:', error);
    process.exit(1);
  });
