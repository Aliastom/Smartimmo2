#!/usr/bin/env tsx

/**
 * Script pour nettoyer les documents draft orphelins
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupDraftDocuments() {
  console.log('🧹 NETTOYAGE DES DOCUMENTS DRAFT ORPHELINS');
  console.log('==========================================\n');

  try {
    // 1. Compter les documents draft
    const draftCount = await prisma.document.count({
      where: {
        status: 'draft'
      }
    });

    console.log(`📊 Documents draft trouvés: ${draftCount}`);

    if (draftCount === 0) {
      console.log('✅ Aucun document draft à nettoyer');
      return;
    }

    // 2. Lister les documents draft
    const draftDocuments = await prisma.document.findMany({
      where: {
        status: 'draft'
      },
      select: {
        id: true,
        fileName: true,
        createdAt: true,
        uploadSessionId: true
      }
    });

    console.log('\n📋 Documents draft:');
    draftDocuments.forEach((doc, index) => {
      console.log(`${index + 1}. ${doc.fileName} (${doc.id})`);
      console.log(`   Créé: ${doc.createdAt.toISOString()}`);
      console.log(`   Session: ${doc.uploadSessionId || 'Aucune'}`);
    });

    // 3. Supprimer les documents draft
    console.log('\n🗑️  Suppression des documents draft...');
    
    const deleteResult = await prisma.document.deleteMany({
      where: {
        status: 'draft'
      }
    });

    console.log(`✅ ${deleteResult.count} documents draft supprimés`);

    // 4. Nettoyer les sessions d'upload orphelines
    console.log('\n🧹 Nettoyage des sessions d\'upload orphelines...');
    
    const orphanSessions = await prisma.uploadSession.findMany({
      where: {
        documents: {
          none: {}
        }
      }
    });

    if (orphanSessions.length > 0) {
      const sessionDeleteResult = await prisma.uploadSession.deleteMany({
        where: {
          documents: {
            none: {}
          }
        }
      });

      console.log(`✅ ${sessionDeleteResult.count} sessions orphelines supprimées`);
    } else {
      console.log('✅ Aucune session orpheline trouvée');
    }

    console.log('\n🎉 Nettoyage terminé !');

  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDraftDocuments();
