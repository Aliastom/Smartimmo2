#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteDuplicateLinks() {
  // Supprimer le lien avec targetId: null pour le nouveau document
  const linkId = 'cmgxpp3f40009dg395kr474lb';
  
  console.log('Suppression du lien redondant:', linkId);
  
  await prisma.documentLink.delete({
    where: { id: linkId }
  });
  
  console.log('✅ Lien supprimé');
  
  // Vérifier qu'il ne reste qu'un lien
  const remainingLinks = await prisma.documentLink.findMany({
    where: { documentId: 'cmgxpp3es0007dg3940mf8zzu' }
  });
  
  console.log('Liens restants pour le nouveau document:', remainingLinks.length);
  
  await prisma.$disconnect();
}

deleteDuplicateLinks();
