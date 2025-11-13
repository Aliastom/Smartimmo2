#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkQuittanceLinks() {
  const documentId = 'cmgxq8qwt0001uz9pehf825x2';
  
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
  
  console.log('Liens pour la quittance:', links.length);
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

checkQuittanceLinks();
