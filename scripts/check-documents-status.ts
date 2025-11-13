#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDocuments() {
  const totalDocs = await prisma.document.count();
  const activeDocs = await prisma.document.count({ where: { status: 'active' } });
  const draftDocs = await prisma.document.count({ where: { status: 'draft' } });
  
  console.log('📊 État des documents:');
  console.log('  Total:', totalDocs);
  console.log('  Actifs:', activeDocs);
  console.log('  Brouillons:', draftDocs);
  
  const links = await prisma.documentLink.count();
  console.log('  Liens:', links);
  
  // Vérifier les documents récents
  const recentDocs = await prisma.document.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      fileName: true,
      status: true,
      createdAt: true
    }
  });
  
  console.log('\n📋 Documents récents:');
  recentDocs.forEach((doc, index) => {
    console.log(`  ${index + 1}. ${doc.fileName} (${doc.status}) - ${doc.createdAt.toISOString()}`);
  });
  
  await prisma.$disconnect();
}

checkDocuments();
