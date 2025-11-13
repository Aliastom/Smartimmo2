#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function restoreDocuments() {
  console.log('Restauration des documents supprimés...');
  
  const result = await prisma.document.updateMany({
    where: { deletedAt: { not: null } },
    data: { deletedAt: null }
  });
  
  console.log(`✅ ${result.count} documents restaurés`);
  
  await prisma.$disconnect();
}

restoreDocuments();
