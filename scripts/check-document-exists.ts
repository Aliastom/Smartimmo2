#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDocument() {
  const documentId = 'cmgxq8qwt0001uz9pehf825x2';
  
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      fileName: true,
      documentType: {
        select: { code: true, label: true }
      }
    }
  });
  
  if (document) {
    console.log('Document trouvé:');
    console.log(`  ID: ${document.id}`);
    console.log(`  Nom: ${document.fileName}`);
    console.log(`  Type: ${document.documentType?.code} - ${document.documentType?.label}`);
  } else {
    console.log('Document non trouvé');
  }
  
  await prisma.$disconnect();
}

checkDocument();
