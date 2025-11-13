#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLinks() {
  const links = await prisma.documentLink.findMany({
    where: { documentId: 'cmgxpi1at0001dg39b0bymwxh' },
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
  
  console.log('Tous les liens pour le document:');
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

checkLinks();
