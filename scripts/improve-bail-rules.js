/**
 * Script pour améliorer les règles de suggestion des baux
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function improveBailRules() {
  console.log('🔧 Amélioration des règles de suggestion pour les baux\n');

  try {
    // Récupérer les types de bail
    const signedLease = await prisma.documentType.findFirst({
      where: { code: 'SIGNED_LEASE' }
    });

    const leaseDraft = await prisma.documentType.findFirst({
      where: { code: 'LEASE_DRAFT' }
    });

    if (!signedLease || !leaseDraft) {
      console.log('❌ Types de bail non trouvés');
      return;
    }

    // Améliorer la règle SIGNED_LEASE pour être plus inclusive
    const improvedSignedLeaseConfig = {
      rules: [
        {
          pattern: '(bail|contrat.*location|lease).*(sign[é|e]|signed|paraph[é|e]|initialis[é|e]|final|finalis[é|e])',
          apply_in: ['lease', 'property', 'global'],
          mime_in: ['application/pdf'],
          ocr_keywords: ['bail signé', 'contrat de location', 'loi 89', 'signature', 'paraphe', 'finalisé'],
          weight: 9.5,
          type_code: 'SIGNED_LEASE',
          lock: false
        }
      ],
      defaults_by_context: {
        lease: 'SIGNED_LEASE',
        property: 'SIGNED_LEASE',
        global: 'MISC'
      }
    };

    // Améliorer la règle LEASE_DRAFT pour être plus inclusive
    const improvedLeaseDraftConfig = {
      rules: [
        {
          pattern: '(bail|contrat).*(brouillon|draft|mod[èe]le|template|projet|vide|blank|vierge)',
          apply_in: ['lease', 'property', 'global'],
          mime_in: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
          ocr_keywords: ['brouillon', 'modèle', 'draft', 'template', 'projet', 'vide', 'vierge'],
          weight: 8.5,
          type_code: 'LEASE_DRAFT',
          lock: false
        }
      ],
      defaults_by_context: {
        lease: 'LEASE_DRAFT',
        property: 'LEASE_DRAFT',
        global: 'MISC'
      }
    };

    // Mettre à jour SIGNED_LEASE
    console.log('📝 Mise à jour de SIGNED_LEASE...');
    await prisma.documentType.update({
      where: { id: signedLease.id },
      data: {
        suggestionConfig: JSON.stringify(improvedSignedLeaseConfig)
      }
    });
    console.log('✅ SIGNED_LEASE mis à jour');

    // Mettre à jour LEASE_DRAFT
    console.log('📝 Mise à jour de LEASE_DRAFT...');
    await prisma.documentType.update({
      where: { id: leaseDraft.id },
      data: {
        suggestionConfig: JSON.stringify(improvedLeaseDraftConfig)
      }
    });
    console.log('✅ LEASE_DRAFT mis à jour');

    // Tester les nouvelles règles
    console.log('\n🧪 Test des nouvelles règles:');
    
    const testFiles = [
      'Bail-Vide-test 1-2025-10-11.pdf',
      'Bail signé 2024.pdf',
      'Contrat location final.pdf',
      'Bail brouillon.pdf',
      'Modèle bail.pdf'
    ];

    for (const filename of testFiles) {
      console.log(`\n📄 Test: "${filename}"`);
      
      // Test SIGNED_LEASE
      const signedPattern = improvedSignedLeaseConfig.rules[0].pattern;
      const signedRegex = new RegExp(signedPattern, 'i');
      const signedMatch = signedRegex.test(filename.toLowerCase());
      console.log(`   SIGNED_LEASE: ${signedMatch ? '✅ MATCH' : '❌ Non'}`);
      
      // Test LEASE_DRAFT
      const draftPattern = improvedLeaseDraftConfig.rules[0].pattern;
      const draftRegex = new RegExp(draftPattern, 'i');
      const draftMatch = draftRegex.test(filename.toLowerCase());
      console.log(`   LEASE_DRAFT: ${draftMatch ? '✅ MATCH' : '❌ Non'}`);
    }

    console.log('\n🎉 Règles améliorées !');
    console.log('✅ SIGNED_LEASE: Inclut maintenant "final", "finalisé"');
    console.log('✅ LEASE_DRAFT: Inclut maintenant "vide", "blank", "vierge"');

  } catch (error) {
    console.error('❌ Erreur lors de l\'amélioration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

improveBailRules().catch(console.error);
