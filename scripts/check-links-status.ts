#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLinks() {
  const links = await prisma.documentLink.findMany({
    select: {
      id: true,
      documentId: true,
      targetType: true,
      targetId: true,
      role: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  });
  
  console.log('📋 Liens créés:', links.length);
  links.forEach((link, index) => {
    console.log(`  ${index + 1}. Doc: ${link.documentId.slice(0, 8)}... | ${link.targetType} - ${link.targetId} (${link.role})`);
  });
  
  await prisma.$disconnect();
}

checkLinks();
