/**
 * Script pour tester la règle RENT_RECEIPT avec le fichier spécifique
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function testRentReceiptRule() {
  console.log('🧪 Test de la règle RENT_RECEIPT\n');

  try {
    // Récupérer la règle RENT_RECEIPT
    const rentReceipt = await prisma.documentType.findFirst({
      where: { code: 'RENT_RECEIPT' }
    });

    if (!rentReceipt) {
      console.log('❌ Type RENT_RECEIPT non trouvé');
      return;
    }

    console.log(`📋 Type: ${rentReceipt.code} (${rentReceipt.label})`);
    
    if (!rentReceipt.suggestionConfig) {
      console.log('❌ Aucune configuration de suggestion');
      return;
    }

    const config = JSON.parse(rentReceipt.suggestionConfig);
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
    const filename = 'quittance_octobre_2025_Jasmin (5).pdf';
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
          console.log(`   - 💡 Suggestion: Vérifier si le pattern est correct`);
        }
      } catch (error) {
        console.log(`   - ❌ Erreur regex: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRentReceiptRule().catch(console.error);
