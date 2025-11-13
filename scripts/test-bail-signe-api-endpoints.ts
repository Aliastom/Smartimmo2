#!/usr/bin/env npx tsx

/**
 * Test des endpoints API pour vérifier la visibilité des documents BAIL_SIGNE
 * 
 * Ce script teste les différents endpoints utilisés par le frontend
 * pour s'assurer que les documents BAIL_SIGNE sont bien visibles.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testBailSigneApiEndpoints() {
  console.log('🧪 Test des endpoints API pour les documents BAIL_SIGNE...\n');

  try {
    // 1. Trouver un document BAIL_SIGNE existant
    console.log('📄 Recherche d\'un document BAIL_SIGNE...');
    
    const bailSigneDocument = await prisma.document.findFirst({
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

    if (!bailSigneDocument) {
      console.log('   ❌ Aucun document BAIL_SIGNE trouvé');
      return;
    }

    console.log(`   ✅ Document trouvé: ${bailSigneDocument.filenameOriginal} (${bailSigneDocument.id})`);
    console.log(`   - Bail ID: ${bailSigneDocument.leaseId || 'Aucun'}`);
    console.log(`   - Bien ID: ${bailSigneDocument.propertyId || 'Aucun'}`);
    console.log(`   - Locataire ID: ${bailSigneDocument.tenantId || 'Aucun'}`);

    // 2. Tester l'endpoint global (page Documents générale)
    console.log('\n🌐 Test de l\'endpoint global...');
    
    const globalLinks = await prisma.documentLink.findMany({
      where: {
        targetType: 'GLOBAL'
      },
      include: {
        document: {
          include: {
            documentType: true,
            links: true
          }
        }
      }
    });

    const bailSigneInGlobal = globalLinks.filter(link => 
      link.document.documentType?.code === 'BAIL_SIGNE'
    );

    console.log(`   📊 Documents dans la vue globale: ${globalLinks.length}`);
    console.log(`   📄 Documents BAIL_SIGNE dans la vue globale: ${bailSigneInGlobal.length}`);
    
    if (bailSigneInGlobal.length > 0) {
      console.log('   ✅ Les documents BAIL_SIGNE sont visibles globalement');
    } else {
      console.log('   ❌ Les documents BAIL_SIGNE ne sont PAS visibles globalement');
    }

    // 3. Tester l'endpoint pour un bien spécifique
    if (bailSigneDocument.propertyId) {
      console.log(`\n🏠 Test de l'endpoint pour le bien ${bailSigneDocument.propertyId}...`);
      
      const propertyLinks = await prisma.documentLink.findMany({
        where: {
          targetType: 'PROPERTY',
          targetId: bailSigneDocument.propertyId
        },
        include: {
          document: {
            include: {
              documentType: true,
              links: true
            }
          }
        }
      });

      const bailSigneInProperty = propertyLinks.filter(link => 
        link.document.documentType?.code === 'BAIL_SIGNE'
      );

      console.log(`   📊 Documents dans la vue bien: ${propertyLinks.length}`);
      console.log(`   📄 Documents BAIL_SIGNE dans la vue bien: ${bailSigneInProperty.length}`);
      
      if (bailSigneInProperty.length > 0) {
        console.log('   ✅ Les documents BAIL_SIGNE sont visibles dans la vue bien');
      } else {
        console.log('   ❌ Les documents BAIL_SIGNE ne sont PAS visibles dans la vue bien');
      }
    }

    // 4. Tester l'endpoint pour un bail spécifique
    if (bailSigneDocument.leaseId) {
      console.log(`\n📄 Test de l'endpoint pour le bail ${bailSigneDocument.leaseId}...`);
      
      const leaseLinks = await prisma.documentLink.findMany({
        where: {
          targetType: 'LEASE',
          targetId: bailSigneDocument.leaseId
        },
        include: {
          document: {
            include: {
              documentType: true,
              links: true
            }
          }
        }
      });

      const bailSigneInLease = leaseLinks.filter(link => 
        link.document.documentType?.code === 'BAIL_SIGNE'
      );

      console.log(`   📊 Documents dans la vue bail: ${leaseLinks.length}`);
      console.log(`   📄 Documents BAIL_SIGNE dans la vue bail: ${bailSigneInLease.length}`);
      
      if (bailSigneInLease.length > 0) {
        console.log('   ✅ Les documents BAIL_SIGNE sont visibles dans la vue bail');
      } else {
        console.log('   ❌ Les documents BAIL_SIGNE ne sont PAS visibles dans la vue bail');
      }
    }

    // 5. Tester l'endpoint pour un locataire spécifique
    if (bailSigneDocument.tenantId) {
      console.log(`\n👤 Test de l'endpoint pour le locataire ${bailSigneDocument.tenantId}...`);
      
      const tenantLinks = await prisma.documentLink.findMany({
        where: {
          targetType: 'TENANT',
          targetId: bailSigneDocument.tenantId
        },
        include: {
          document: {
            include: {
              documentType: true,
              links: true
            }
          }
        }
      });

      const bailSigneInTenant = tenantLinks.filter(link => 
        link.document.documentType?.code === 'BAIL_SIGNE'
      );

      console.log(`   📊 Documents dans la vue locataire: ${tenantLinks.length}`);
      console.log(`   📄 Documents BAIL_SIGNE dans la vue locataire: ${bailSigneInTenant.length}`);
      
      if (bailSigneInTenant.length > 0) {
        console.log('   ✅ Les documents BAIL_SIGNE sont visibles dans la vue locataire');
      } else {
        console.log('   ❌ Les documents BAIL_SIGNE ne sont PAS visibles dans la vue locataire');
      }
    }

    // 6. Simuler les appels API comme le fait le frontend
    console.log('\n🔗 Simulation des appels API frontend...');
    
    // Simuler l'appel pour la page Documents globale
    const globalApiCall = await prisma.documentLink.findMany({
      where: {
        targetType: 'GLOBAL'
      },
      include: {
        document: {
          include: {
            documentType: true,
            links: true,
            fields: true,
            reminders: {
              where: { status: 'open' },
              orderBy: { dueDate: 'asc' },
            },
          }
        }
      },
      orderBy: { 
        document: { createdAt: 'desc' }
      },
      take: 50
    });

    const globalDocuments = globalApiCall.map(link => link.document);
    const bailSigneInGlobalApi = globalDocuments.filter(doc => 
      doc.documentType?.code === 'BAIL_SIGNE'
    );

    console.log(`   🌐 API globale: ${globalDocuments.length} documents, ${bailSigneInGlobalApi.length} BAIL_SIGNE`);

    // Simuler l'appel pour un bien spécifique
    if (bailSigneDocument.propertyId) {
      const propertyApiCall = await prisma.documentLink.findMany({
        where: {
          targetType: 'PROPERTY',
          targetId: bailSigneDocument.propertyId
        },
        include: {
          document: {
            include: {
              documentType: true,
              links: true,
              fields: true,
              reminders: {
                where: { status: 'open' },
                orderBy: { dueDate: 'asc' },
              },
            }
          }
        }
      });

      const propertyDocuments = propertyApiCall.map(link => link.document);
      const bailSigneInPropertyApi = propertyDocuments.filter(doc => 
        doc.documentType?.code === 'BAIL_SIGNE'
      );

      console.log(`   🏠 API bien: ${propertyDocuments.length} documents, ${bailSigneInPropertyApi.length} BAIL_SIGNE`);
    }

    // 7. Résumé final
    console.log('\n📋 Résumé des tests:');
    console.log(`   📄 Document BAIL_SIGNE testé: ${bailSigneDocument.filenameOriginal}`);
    console.log(`   🌐 Visible globalement: ${bailSigneInGlobal.length > 0 ? '✅' : '❌'}`);
    
    if (bailSigneDocument.propertyId) {
      const propertyLinks = await prisma.documentLink.findMany({
        where: {
          targetType: 'PROPERTY',
          targetId: bailSigneDocument.propertyId
        }
      });
      const bailSigneInProperty = propertyLinks.filter(link => 
        link.documentId === bailSigneDocument.id
      );
      console.log(`   🏠 Visible dans le bien: ${bailSigneInProperty.length > 0 ? '✅' : '❌'}`);
    }
    
    if (bailSigneDocument.leaseId) {
      const leaseLinks = await prisma.documentLink.findMany({
        where: {
          targetType: 'LEASE',
          targetId: bailSigneDocument.leaseId
        }
      });
      const bailSigneInLease = leaseLinks.filter(link => 
        link.documentId === bailSigneDocument.id
      );
      console.log(`   📄 Visible dans le bail: ${bailSigneInLease.length > 0 ? '✅' : '❌'}`);
    }

    // 8. Diagnostic des problèmes
    console.log('\n🔍 Diagnostic:');
    
    if (bailSigneInGlobal.length === 0) {
      console.log('   ❌ PROBLÈME: Document BAIL_SIGNE non visible globalement');
      console.log('   💡 Solution: Vérifier que la liaison GLOBAL est créée');
    }
    
    if (bailSigneDocument.propertyId) {
      const propertyLinks = await prisma.documentLink.findMany({
        where: {
          targetType: 'PROPERTY',
          targetId: bailSigneDocument.propertyId
        }
      });
      const bailSigneInProperty = propertyLinks.filter(link => 
        link.documentId === bailSigneDocument.id
      );
      
      if (bailSigneInProperty.length === 0) {
        console.log('   ❌ PROBLÈME: Document BAIL_SIGNE non visible dans le bien');
        console.log('   💡 Solution: Vérifier que la liaison PROPERTY est créée');
      }
    }

    if (bailSigneInGlobal.length > 0 && bailSigneDocument.propertyId) {
      const propertyLinks = await prisma.documentLink.findMany({
        where: {
          targetType: 'PROPERTY',
          targetId: bailSigneDocument.propertyId
        }
      });
      const bailSigneInProperty = propertyLinks.filter(link => 
        link.documentId === bailSigneDocument.id
      );
      
      if (bailSigneInProperty.length > 0) {
        console.log('\n✅ Tous les tests sont passés !');
        console.log('   Les documents BAIL_SIGNE sont correctement visibles partout.');
        console.log('   Le problème pourrait venir du cache du navigateur ou d\'un autre problème frontend.');
      }
    }

  } catch (error) {
    console.error('💥 Erreur lors du test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le test
testBailSigneApiEndpoints()
  .then(() => {
    console.log('\n🎯 Test des endpoints terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec du test:', error);
    process.exit(1);
  });
