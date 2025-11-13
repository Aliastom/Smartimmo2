/**
 * Script pour déboguer les règles de RENT_RECEIPT
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function debugRentReceiptRules() {
  console.log('🔍 Debug des règles RENT_RECEIPT\n');

  try {
    const rentReceipt = await prisma.documentType.findFirst({
      where: { code: 'RENT_RECEIPT' }
    });

    if (!rentReceipt || !rentReceipt.suggestionConfig) {
      console.log('❌ RENT_RECEIPT ou suggestionConfig non trouvé');
      return;
    }

    const config = JSON.parse(rentReceipt.suggestionConfig);
    
    console.log('📋 Configuration de RENT_RECEIPT:\n');
    console.log('Règles:', JSON.stringify(config.rules, null, 2));
    console.log('\ndefaults_by_context:', JSON.stringify(config.defaults_by_context, null, 2));

    // Tester manuellement avec le filename
    const filename = 'quittance_octobre_2025_Jasmin (8).pdf';
    const normalizedFilename = filename.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    console.log('\n🧪 Test manuel:');
    console.log(`Filename: "${filename}"`);
    console.log(`Normalized: "${normalizedFilename}"`);
    
    for (const rule of config.rules) {
      console.log(`\n📏 Règle (poids: ${rule.weight}):`);
      console.log(`   Pattern: ${rule.pattern}`);
      console.log(`   Contextes: [${(rule.contexts || rule.apply_in || []).join(', ')}]`);
      
      try {
        const regex = new RegExp(rule.pattern, 'i');
        const matches = regex.test(normalizedFilename);
        console.log(`   Match: ${matches ? '✅ OUI' : '❌ NON'}`);
        
        if (!matches) {
          // Tester des patterns alternatifs
          console.log(`   Essayons d'autres patterns:`);
          console.log(`   - "quittance" seul: ${/quittance/i.test(normalizedFilename) ? '✅' : '❌'}`);
          console.log(`   - "loyer" seul: ${/loyer/i.test(normalizedFilename) ? '✅' : '❌'}`);
        }
      } catch (e) {
        console.log(`   ⚠️ Erreur regex: ${e.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugRentReceiptRules().catch(console.error);
