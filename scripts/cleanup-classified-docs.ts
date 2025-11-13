#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupClassifiedDocs() {
  const classifiedDocs = await prisma.document.findMany({
    where: { status: 'classified' }
  });
  
  console.log('🧹 Nettoyage des documents avec statut classified:', classifiedDocs.length);
  
  for (const doc of classifiedDocs) {
    console.log('Suppression:', doc.fileName);
    await prisma.document.delete({ where: { id: doc.id } });
  }
  
  console.log('✅ Nettoyage terminé');
  await prisma.$disconnect();
}

cleanupClassifiedDocs();
