#!/usr/bin/env npx tsx

/**
 * Script pour vérifier s'il y a des doublons de liens GLOBAL dans la base
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDuplicateLinks() {
  console.log('🔍 Vérification des doublons de liens GLOBAL...\n');

  try {
    // Vérifier les liens GLOBAL dupliqués
    const duplicateGlobalLinks = await prisma.documentLink.groupBy({
      by: ['documentId', 'targetType'],
      where: {
        targetType: 'GLOBAL'
      },
      _count: {
        documentId: true
      },
      having: {
        documentId: {
          _count: {
            gt: 1
          }
        }
      }
    });

    if (duplicateGlobalLinks.length > 0) {
      console.log('❌ Doublons de liens GLOBAL trouvés:');
      for (const duplicate of duplicateGlobalLinks) {
        console.log(`   Document ${duplicate.documentId}: ${duplicate._count.documentId} liens GLOBAL`);
      }
    } else {
      console.log('✅ Aucun doublon de liens GLOBAL trouvé');
    }

    // Vérifier le document spécifique mentionné dans les logs
    const documentId = 'cmgvcsp4q0007n8ioizzbvd7v';
    console.log(`\n🔍 Vérification du document ${documentId}:`);
    
    const documentLinks = await prisma.documentLink.findMany({
      where: {
        documentId: documentId
      },
      include: {
        document: {
          select: {
            id: true,
            filenameOriginal: true,
            createdAt: true
          }
        }
      }
    });

    console.log(`   Document: ${documentLinks[0]?.document?.filenameOriginal || 'Non trouvé'}`);
    console.log(`   Créé le: ${documentLinks[0]?.document?.createdAt || 'Non trouvé'}`);
    console.log(`   Liens trouvés: ${documentLinks.length}`);
    
    for (const link of documentLinks) {
      console.log(`     - ${link.targetType}: ${link.targetId || 'null'} (${link.role})`);
    }

    // Vérifier s'il y a des documents dupliqués
    const duplicateDocuments = await prisma.document.groupBy({
      by: ['filenameOriginal', 'checksum'],
      _count: {
        id: true
      },
      having: {
        id: {
          _count: {
            gt: 1
          }
        }
      }
    });

    if (duplicateDocuments.length > 0) {
      console.log('\n❌ Documents dupliqués trouvés:');
      for (const duplicate of duplicateDocuments) {
        console.log(`   ${duplicate.filenameOriginal}: ${duplicate._count.id} copies`);
      }
    } else {
      console.log('\n✅ Aucun document dupliqué trouvé');
    }

  } catch (error) {
    console.error('Erreur lors de la vérification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicateLinks();
