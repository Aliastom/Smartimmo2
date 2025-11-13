#!/usr/bin/env tsx

/**
 * Script pour supprimer DÉFINITIVEMENT tous les documents de la base de données
 * ATTENTION: Cette action est irréversible !
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

async function deleteAllDocuments() {
  console.log('⚠️  SUPPRESSION DÉFINITIVE DE TOUS LES DOCUMENTS');
  console.log('===============================================');
  console.log('🚨 ATTENTION: Cette action est IRRÉVERSIBLE !');
  console.log('');

  try {
    // 1. Compter tous les documents
    const totalDocuments = await prisma.document.count();
    const activeDocuments = await prisma.document.count({
      where: { deletedAt: null }
    });
    const deletedDocuments = await prisma.document.count({
      where: { deletedAt: { not: null } }
    });

    console.log(`📊 État actuel:`);
    console.log(`   • Total des documents: ${totalDocuments}`);
    console.log(`   • Documents actifs: ${activeDocuments}`);
    console.log(`   • Documents supprimés: ${deletedDocuments}`);
    console.log('');

    if (totalDocuments === 0) {
      console.log('✅ Aucun document à supprimer.');
      return;
    }

    // 2. Lister quelques documents pour confirmation
    const sampleDocuments = await prisma.document.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        status: true,
        deletedAt: true,
        createdAt: true
      }
    });

    console.log('📋 Exemples de documents à supprimer:');
    sampleDocuments.forEach((doc, index) => {
      console.log(`  ${index + 1}. ${doc.fileName}`);
      console.log(`     ID: ${doc.id}`);
      console.log(`     Status: ${doc.status}`);
      console.log(`     Supprimé: ${doc.deletedAt ? 'OUI' : 'NON'}`);
      console.log(`     Créé: ${doc.createdAt.toISOString()}`);
      console.log('');
    });

    // 3. Demander confirmation (simulation - en production, vous devriez ajouter une vraie confirmation)
    console.log('⚠️  CONFIRMATION REQUISE');
    console.log('========================');
    console.log('Pour confirmer la suppression, modifiez le script et mettez CONFIRM_DELETE = true');
    console.log('');

    const CONFIRM_DELETE = true; // ⚠️ Confirmation de suppression

    if (!CONFIRM_DELETE) {
      console.log('❌ Suppression annulée. Pour confirmer, modifiez CONFIRM_DELETE = true dans le script.');
      return;
    }

    console.log('🚀 Début de la suppression...');
    console.log('');

    // 4. Supprimer les fichiers physiques
    console.log('🗑️  Suppression des fichiers physiques...');
    const documentsWithFiles = await prisma.document.findMany({
      select: {
        id: true,
        fileName: true,
        url: true,
        bucketKey: true
      }
    });

    let filesDeleted = 0;
    for (const doc of documentsWithFiles) {
      try {
        // Essayer différents chemins possibles
        const possiblePaths = [
          path.join(process.cwd(), 'storage', 'tmp', doc.fileName),
          path.join(process.cwd(), 'storage', 'documents', doc.fileName),
          path.join(process.cwd(), 'public', doc.url?.replace('/', '') || ''),
          path.join(process.cwd(), doc.bucketKey || ''),
        ];

        for (const filePath of possiblePaths) {
          try {
            await fs.unlink(filePath);
            console.log(`  ✓ Fichier supprimé: ${filePath}`);
            filesDeleted++;
            break; // Fichier trouvé et supprimé, passer au suivant
          } catch (error) {
            // Fichier non trouvé à ce chemin, essayer le suivant
          }
        }
      } catch (error) {
        console.log(`  ⚠️  Impossible de supprimer le fichier pour ${doc.fileName}`);
      }
    }

    console.log(`✅ ${filesDeleted} fichiers physiques supprimés`);
    console.log('');

    // 5. Supprimer les DocumentLinks
    console.log('🔗 Suppression des liens DocumentLink...');
    const linksDeleted = await prisma.documentLink.deleteMany({});
    console.log(`✅ ${linksDeleted.count} liens DocumentLink supprimés`);
    console.log('');

    // 6. Supprimer les DocumentFields
    console.log('📝 Suppression des champs DocumentField...');
    const fieldsDeleted = await prisma.documentField.deleteMany({});
    console.log(`✅ ${fieldsDeleted.count} champs DocumentField supprimés`);
    console.log('');

    // 7. Supprimer les DocumentTextIndex
    console.log('🔍 Suppression des index de texte...');
    const textIndexDeleted = await prisma.documentTextIndex.deleteMany({});
    console.log(`✅ ${textIndexDeleted.count} index de texte supprimés`);
    console.log('');

    // 8. Supprimer tous les documents
    console.log('📄 Suppression de tous les documents...');
    const documentsDeleted = await prisma.document.deleteMany({});
    console.log(`✅ ${documentsDeleted.count} documents supprimés`);
    console.log('');

    // 9. Supprimer les sessions d'upload
    console.log('📦 Suppression des sessions d\'upload...');
    const sessionsDeleted = await prisma.uploadSession.deleteMany({});
    console.log(`✅ ${sessionsDeleted.count} sessions d'upload supprimées`);
    console.log('');

    // 10. Vérifier le résultat
    const remainingDocuments = await prisma.document.count();
    const remainingLinks = await prisma.documentLink.count();
    const remainingSessions = await prisma.uploadSession.count();

    console.log('🎉 SUPPRESSION TERMINÉE !');
    console.log('========================');
    console.log(`📄 Documents restants: ${remainingDocuments}`);
    console.log(`🔗 Liens restants: ${remainingLinks}`);
    console.log(`📦 Sessions restantes: ${remainingSessions}`);
    console.log('');

    if (remainingDocuments === 0 && remainingLinks === 0 && remainingSessions === 0) {
      console.log('✅ Base de données complètement nettoyée !');
    } else {
      console.log('⚠️  Il reste des éléments. Vérifiez manuellement.');
    }

  } catch (error) {
    console.error('❌ Erreur lors de la suppression:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllDocuments();
