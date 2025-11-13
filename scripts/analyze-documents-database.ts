#!/usr/bin/env tsx

/**
 * Script pour analyser les documents dans la base de données
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyzeDocuments() {
  console.log('🔍 ANALYSE DES DOCUMENTS DANS LA BASE');
  console.log('====================================\n');

  try {
    // 1. Compter tous les documents
    const totalDocuments = await prisma.document.count();
    console.log(`📊 Total des documents: ${totalDocuments}`);

    // 2. Analyser par statut
    const statusCounts = await prisma.document.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    });

    console.log('\n📋 Répartition par statut:');
    statusCounts.forEach(group => {
      console.log(`  • ${group.status || 'NULL'}: ${group._count.status}`);
    });

    // 3. Analyser par ownerId
    const ownerCounts = await prisma.document.groupBy({
      by: ['ownerId'],
      _count: {
        ownerId: true
      }
    });

    console.log('\n👤 Répartition par ownerId:');
    ownerCounts.forEach(group => {
      console.log(`  • ${group.ownerId || 'NULL'}: ${group._count.ownerId}`);
    });

    // 4. Analyser par deletedAt
    const deletedCount = await prisma.document.count({
      where: { deletedAt: { not: null } }
    });
    const activeCount = await prisma.document.count({
      where: { deletedAt: null }
    });

    console.log('\n🗑️  Répartition par suppression:');
    console.log(`  • Supprimés (deletedAt != null): ${deletedCount}`);
    console.log(`  • Actifs (deletedAt = null): ${activeCount}`);

    // 5. Analyser par uploadSessionId
    const withSessionCount = await prisma.document.count({
      where: { uploadSessionId: { not: null } }
    });
    const withoutSessionCount = await prisma.document.count({
      where: { uploadSessionId: null }
    });

    console.log('\n📦 Répartition par session d\'upload:');
    console.log(`  • Avec session (uploadSessionId != null): ${withSessionCount}`);
    console.log(`  • Sans session (uploadSessionId = null): ${withoutSessionCount}`);

    // 6. Analyser les documents récents
    const recentDocuments = await prisma.document.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        status: true,
        ownerId: true,
        deletedAt: true,
        uploadSessionId: true,
        createdAt: true
      }
    });

    console.log('\n📄 5 documents les plus récents:');
    recentDocuments.forEach((doc, index) => {
      console.log(`  ${index + 1}. ${doc.fileName}`);
      console.log(`     ID: ${doc.id}`);
      console.log(`     Status: ${doc.status || 'NULL'}`);
      console.log(`     Owner: ${doc.ownerId || 'NULL'}`);
      console.log(`     Deleted: ${doc.deletedAt ? 'OUI' : 'NON'}`);
      console.log(`     Session: ${doc.uploadSessionId ? 'OUI' : 'NON'}`);
      console.log(`     Créé: ${doc.createdAt.toISOString()}`);
      console.log('');
    });

    // 7. Analyser les DocumentLinks
    const totalLinks = await prisma.documentLink.count();
    console.log(`🔗 Total des liens DocumentLink: ${totalLinks}`);

    const linkCounts = await prisma.documentLink.groupBy({
      by: ['targetType'],
      _count: {
        targetType: true
      }
    });

    console.log('\n🔗 Répartition des liens par type:');
    linkCounts.forEach(group => {
      console.log(`  • ${group.targetType}: ${group._count.targetType}`);
    });

  } catch (error) {
    console.error('❌ Erreur lors de l\'analyse:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeDocuments();
