#!/usr/bin/env tsx

/**
 * Script pour nettoyer les liens DocumentLink dupliqués
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupDuplicateLinks() {
  console.log('🧹 NETTOYAGE DES LIENS DOCUMENTLINK DUPLIQUÉS');
  console.log('============================================\n');

  try {
    // 1. Trouver les liens dupliqués
    const duplicateLinks = await prisma.documentLink.groupBy({
      by: ['documentId', 'targetType', 'targetId', 'role'],
      having: {
        documentId: {
          _count: {
            gt: 1
          }
        }
      },
      _count: {
        documentId: true
      }
    });

    console.log(`🔗 Liens dupliqués trouvés: ${duplicateLinks.length}`);

    if (duplicateLinks.length === 0) {
      console.log('✅ Aucun lien dupliqué trouvé.');
      return;
    }

    // 2. Afficher les doublons
    for (const duplicate of duplicateLinks) {
      console.log(`\n📄 Document ${duplicate.documentId}:`);
      console.log(`   Type: ${duplicate.targetType}`);
      console.log(`   Target: ${duplicate.targetId}`);
      console.log(`   Rôle: ${duplicate.role}`);
      console.log(`   Nombre: ${duplicate._count.documentId}`);

      // Récupérer tous les liens pour ce document
      const links = await prisma.documentLink.findMany({
        where: {
          documentId: duplicate.documentId,
          targetType: duplicate.targetType,
          targetId: duplicate.targetId,
          role: duplicate.role
        },
        orderBy: { createdAt: 'asc' }
      });

      console.log(`   Liens trouvés: ${links.length}`);
      links.forEach((link, index) => {
        console.log(`     ${index + 1}. ID: ${link.id} (créé: ${link.createdAt.toISOString()})`);
      });

      // Garder le premier lien, supprimer les autres
      if (links.length > 1) {
        const linksToDelete = links.slice(1); // Garder le premier, supprimer les autres
        console.log(`   🗑️  Suppression de ${linksToDelete.length} liens dupliqués...`);
        
        for (const linkToDelete of linksToDelete) {
          await prisma.documentLink.delete({
            where: { id: linkToDelete.id }
          });
          console.log(`     ✓ Supprimé: ${linkToDelete.id}`);
        }
      }
    }

    // 3. Vérifier le résultat
    const remainingDuplicates = await prisma.documentLink.groupBy({
      by: ['documentId', 'targetType', 'targetId', 'role'],
      having: {
        documentId: {
          _count: {
            gt: 1
          }
        }
      },
      _count: {
        documentId: true
      }
    });

    console.log('\n📊 RÉSULTAT DU NETTOYAGE:');
    console.log('========================');
    console.log(`🔗 Liens dupliqués restants: ${remainingDuplicates.length}`);

    if (remainingDuplicates.length === 0) {
      console.log('✅ Nettoyage terminé ! Aucun lien dupliqué restant.');
    } else {
      console.log('⚠️  Il reste des liens dupliqués. Vérifiez manuellement.');
    }

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDuplicateLinks();