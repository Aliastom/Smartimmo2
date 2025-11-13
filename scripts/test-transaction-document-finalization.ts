#!/usr/bin/env tsx

/**
 * Script pour tester la finalisation des documents dans les transactions
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testTransactionDocumentFinalization() {
  console.log('🧪 TEST DE FINALISATION DES DOCUMENTS DANS LES TRANSACTIONS');
  console.log('========================================================\n');

  try {
    // 1. Vérifier les documents en mode draft
    const draftDocuments = await prisma.document.findMany({
      where: { status: 'draft' },
      select: {
        id: true,
        fileName: true,
        status: true,
        uploadSessionId: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📄 Documents en mode draft: ${draftDocuments.length}`);
    draftDocuments.forEach((doc, index) => {
      console.log(`  ${index + 1}. ${doc.fileName} (${doc.id})`);
      console.log(`     Status: ${doc.status}`);
      console.log(`     Session: ${doc.uploadSessionId ? 'OUI' : 'NON'}`);
      console.log(`     Créé: ${doc.createdAt.toISOString()}`);
      console.log('');
    });

    // 2. Vérifier les transactions récentes
    const recentTransactions = await prisma.transaction.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        label: true,
        amount: true,
        createdAt: true,
        documents: {
          select: {
            id: true,
            fileName: true,
            status: true
          }
        }
      }
    });

    console.log(`💰 Transactions récentes: ${recentTransactions.length}`);
    recentTransactions.forEach((tx, index) => {
      console.log(`  ${index + 1}. ${tx.label} (${tx.id})`);
      console.log(`     Montant: ${tx.amount}€`);
      console.log(`     Créé: ${tx.createdAt.toISOString()}`);
      console.log(`     Documents liés: ${tx.documents.length}`);
      tx.documents.forEach((doc, docIndex) => {
        console.log(`       ${docIndex + 1}. ${doc.fileName} (${doc.status})`);
      });
      console.log('');
    });

    // 3. Vérifier les DocumentLinks pour les transactions
    const transactionLinks = await prisma.documentLink.findMany({
      where: { targetType: 'TRANSACTION' },
      select: {
        id: true,
        targetId: true,
        documentId: true,
        role: true,
        entityName: true,
        document: {
          select: {
            fileName: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    console.log(`🔗 Liens DocumentLink pour transactions: ${transactionLinks.length}`);
    transactionLinks.forEach((link, index) => {
      console.log(`  ${index + 1}. Transaction ${link.targetId}`);
      console.log(`     Document: ${link.document.fileName} (${link.document.status})`);
      console.log(`     Rôle: ${link.role}`);
      console.log(`     Entité: ${link.entityName}`);
      console.log('');
    });

    // 4. Vérifier les UploadSessions
    const uploadSessions = await prisma.uploadSession.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        documents: {
          select: {
            id: true,
            fileName: true,
            status: true
          }
        }
      }
    });

    console.log(`📦 Sessions d'upload récentes: ${uploadSessions.length}`);
    uploadSessions.forEach((session, index) => {
      console.log(`  ${index + 1}. Session ${session.id}`);
      console.log(`     Créé: ${session.createdAt.toISOString()}`);
      console.log(`     Expire: ${session.expiresAt?.toISOString() || 'N/A'}`);
      console.log(`     Documents: ${session.documents.length}`);
      session.documents.forEach((doc, docIndex) => {
        console.log(`       ${docIndex + 1}. ${doc.fileName} (${doc.status})`);
      });
      console.log('');
    });

    // 5. Analyser les problèmes potentiels
    console.log('🔍 ANALYSE DES PROBLÈMES POTENTIELS:');
    console.log('=====================================');

    // Documents draft avec session mais pas de transaction
    const orphanedDrafts = await prisma.document.findMany({
      where: {
        status: 'draft',
        uploadSessionId: { not: null },
        links: { none: {} }
      },
      select: {
        id: true,
        fileName: true,
        uploadSessionId: true,
        createdAt: true
      }
    });

    console.log(`📄 Documents draft orphelins (avec session, sans lien): ${orphanedDrafts.length}`);
    orphanedDrafts.forEach((doc, index) => {
      console.log(`  ${index + 1}. ${doc.fileName} (${doc.id})`);
      console.log(`     Session: ${doc.uploadSessionId}`);
      console.log(`     Créé: ${doc.createdAt.toISOString()}`);
    });

    // Transactions sans documents
    const transactionsWithoutDocs = await prisma.transaction.findMany({
      where: {
        documents: { none: {} }
      },
      select: {
        id: true,
        label: true,
        amount: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    console.log(`\n💰 Transactions sans documents: ${transactionsWithoutDocs.length}`);
    transactionsWithoutDocs.forEach((tx, index) => {
      console.log(`  ${index + 1}. ${tx.label} (${tx.id}) - ${tx.amount}€`);
      console.log(`     Créé: ${tx.createdAt.toISOString()}`);
    });

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTransactionDocumentFinalization();
