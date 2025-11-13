#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupAll() {
  await prisma.documentLink.deleteMany({});
  await prisma.document.deleteMany({});
  console.log('🧹 Nettoyage complet effectué');
  await prisma.$disconnect();
}

cleanupAll();
