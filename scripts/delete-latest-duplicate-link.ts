#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteDuplicateLinks() {
  const documentId = 'cmgxqj0e700071nkfy2k106z6';
  
  // Supprimer le lien avec targetId: null (le redondant)
  const redundantLink = await prisma.documentLink.findFirst({
    where: {
      documentId,
      targetType: 'GLOBAL',
      targetId: null
    }
  });
  
  if (redundantLink) {
    console.log('Suppression du lien redondant:', redundantLink.id);
    await prisma.documentLink.delete({
      where: { id: redundantLink.id }
    });
    console.log('✅ Lien supprimé');
  }
  
  // Vérifier qu'il ne reste qu'un lien
  const remainingLinks = await prisma.documentLink.findMany({
    where: { documentId }
  });
  
  console.log('Liens restants pour le document:', remainingLinks.length);
  
  await prisma.$disconnect();
}

deleteDuplicateLinks();