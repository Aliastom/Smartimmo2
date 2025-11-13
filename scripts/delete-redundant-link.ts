#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteRedundantLink() {
  const linkId = 'cmgxpi1b80003dg3910jhne17'; // Le lien avec targetId: null
  
  console.log('Suppression du lien redondant:', linkId);
  
  await prisma.documentLink.delete({
    where: { id: linkId }
  });
  
  console.log('✅ Lien supprimé');
  
  // Vérifier qu'il ne reste qu'un lien
  const remainingLinks = await prisma.documentLink.findMany({
    where: { documentId: 'cmgxpi1at0001dg39b0bymwxh' }
  });
  
  console.log('Liens restants:', remainingLinks.length);
  
  await prisma.$disconnect();
}

deleteRedundantLink();
