/**
 * Script pour ajouter 'property' aux contextes apply_in de RENT_RECEIPT
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixRentReceiptApplyIn() {
  console.log('🔧 Ajout de "property" aux contextes apply_in de RENT_RECEIPT\n');

  try {
    const rentReceipt = await prisma.documentType.findFirst({
      where: { code: 'RENT_RECEIPT' }
    });

    if (!rentReceipt || !rentReceipt.suggestionConfig) {
      console.log('❌ RENT_RECEIPT ou suggestionConfig non trouvé');
      return;
    }

    const config = JSON.parse(rentReceipt.suggestionConfig);
    
    console.log('📋 Configuration actuelle:');
    console.log(`   apply_in: [${config.rules[0].apply_in.join(', ')}]`);

    // Ajouter 'property' si pas déjà présent
    for (const rule of config.rules) {
      if (!rule.apply_in.includes('property')) {
        rule.apply_in.push('property');
      }
    }

    console.log('📝 Nouvelle configuration:');
    console.log(`   apply_in: [${config.rules[0].apply_in.join(', ')}]`);

    // Mettre à jour dans la base de données
    await prisma.documentType.update({
      where: { id: rentReceipt.id },
      data: {
        suggestionConfig: JSON.stringify(config)
      }
    });

    console.log('\n✅ RENT_RECEIPT mis à jour !');
    console.log('La règle s\'applique maintenant dans le contexte "property"');

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixRentReceiptApplyIn().catch(console.error);
