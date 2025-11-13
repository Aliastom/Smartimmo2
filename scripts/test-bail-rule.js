/**
 * Script pour tester la règle SIGNED_LEASE avec le fichier bail
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testBailRule() {
  console.log('🧪 Test de la règle SIGNED_LEASE\n');

  try {
    // Récupérer la règle SIGNED_LEASE
    const signedLease = await prisma.documentType.findFirst({
      where: { code: 'SIGNED_LEASE' }
    });

    if (!signedLease) {
      console.log('❌ Type SIGNED_LEASE non trouvé');
      return;
    }

    console.log(`📋 Type: ${signedLease.code} (${signedLease.label})`);
    
    if (!signedLease.suggestionConfig) {
      console.log('❌ Aucune configuration de suggestion');
      return;
    }

    const config = JSON.parse(signedLease.suggestionConfig);
    console.log(`📊 Configuration trouvée:`);
    console.log(`   - Nombre de règles: ${config.rules?.length || 0}`);
    
    if (config.rules && config.rules.length > 0) {
      const rule = config.rules[0];
      console.log(`   - Pattern: "${rule.pattern}"`);
      console.log(`   - Poids: ${rule.weight}`);
      console.log(`   - Contextes: ${rule.apply_in?.join(', ') || 'Aucun'}`);
      console.log(`   - MIME: ${rule.mime_in?.join(', ') || 'Aucun'}`);
      console.log(`   - Mots-clés OCR: ${rule.ocr_keywords?.join(', ') || 'Aucun'}`);
    }

    // Tester le pattern avec le nom de fichier
    const filename = 'Bail-Vide-test 1-2025-10-11.pdf';
    console.log(`\n🔍 Test avec le fichier: "${filename}"`);
    
    if (config.rules && config.rules.length > 0) {
      const rule = config.rules[0];
      const pattern = rule.pattern;
      
      try {
        const regex = new RegExp(pattern, 'i');
        const matches = regex.test(filename.toLowerCase());
        console.log(`   - Pattern: "${pattern}"`);
        console.log(`   - Fichier normalisé: "${filename.toLowerCase()}"`);
        console.log(`   - Match: ${matches ? '✅ OUI' : '❌ NON'}`);
        
        if (matches) {
          console.log(`   - Score théorique: ${rule.weight / 10} (${Math.round(rule.weight / 10 * 100)}%)`);
        } else {
          console.log(`   - ❌ Le pattern ne matche pas le nom de fichier`);
          console.log(`   - 💡 Analyse du pattern:`);
          console.log(`     * Cherche: "(bail|contrat.*location|lease).*(sign[é|e]|signed|paraph[é|e]|initialis[é|e])"`);
          console.log(`     * Fichier contient "bail" mais pas "signé/signed/paraphé/initialisé"`);
          console.log(`     * 💡 Le fichier s'appelle "Bail-Vide" (brouillon) pas "Bail signé"`);
        }
      } catch (error) {
        console.log(`   - ❌ Erreur regex: ${error.message}`);
      }
    }

    // Vérifier aussi LEASE_DRAFT
    console.log(`\n🔍 Vérification du type LEASE_DRAFT pour "Bail-Vide":`);
    const leaseDraft = await prisma.documentType.findFirst({
      where: { code: 'LEASE_DRAFT' }
    });

    if (leaseDraft && leaseDraft.suggestionConfig) {
      const draftConfig = JSON.parse(leaseDraft.suggestionConfig);
      if (draftConfig.rules && draftConfig.rules.length > 0) {
        const draftRule = draftConfig.rules[0];
        console.log(`   - Pattern: "${draftRule.pattern}"`);
        
        try {
          const regex = new RegExp(draftRule.pattern, 'i');
          const matches = regex.test(filename.toLowerCase());
          console.log(`   - Match LEASE_DRAFT: ${matches ? '✅ OUI' : '❌ NON'}`);
          
          if (matches) {
            console.log(`   - 🎯 LEASE_DRAFT serait plus approprié pour ce fichier !`);
          }
        } catch (error) {
          console.log(`   - ❌ Erreur regex: ${error.message}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBailRule().catch(console.error);
