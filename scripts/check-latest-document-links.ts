#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLatestDocument() {
  const documentId = 'cmgxqj0e700071nkfy2k106z6';
  
  const links = await prisma.documentLink.findMany({
    where: { documentId },
    select: {
      id: true,
      targetType: true,
      targetId: true,
      role: true,
      entityName: true,
      createdAt: true
    },
    orderBy: { createdAt: 'asc' }
  });
  
  console.log('Liens pour le document:', links.length);
  links.forEach((link, index) => {
    console.log(`  ${index + 1}. ID: ${link.id}`);
    console.log(`     Type: ${link.targetType}`);
    console.log(`     Target: ${link.targetId}`);
    console.log(`     Rôle: ${link.role}`);
    console.log(`     Entité: ${link.entityName}`);
    console.log(`     Créé: ${link.createdAt.toISOString()}`);
    console.log('');
  });
  
  await prisma.$disconnect();
}

checkLatestDocument();