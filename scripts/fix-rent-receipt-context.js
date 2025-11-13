/**
 * Script pour corriger les contextes par défaut de RENT_RECEIPT
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixRentReceiptContext() {
  console.log('🔧 Correction des contextes par défaut de RENT_RECEIPT\n');

  try {
    // Récupérer RENT_RECEIPT
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
    console.log(`📊 Configuration actuelle:`);
    console.log(`   - Contextes par défaut: ${config.defaults_by_context ? Object.keys(config.defaults_by_context).join(', ') : 'Aucun'}`);

    // Modifier la configuration pour ajouter 'property' aux contextes par défaut
    const updatedConfig = {
      ...config,
      defaults_by_context: {
        ...config.defaults_by_context,
        property: 'RENT_RECEIPT', // Ajouter le contexte property
      }
    };

    console.log(`📝 Nouvelle configuration:`);
    console.log(`   - Contextes par défaut: ${Object.keys(updatedConfig.defaults_by_context).join(', ')}`);

    // Mettre à jour dans la base de données
    await prisma.documentType.update({
      where: { id: rentReceipt.id },
      data: {
        suggestionConfig: JSON.stringify(updatedConfig)
      }
    });

    console.log('✅ RENT_RECEIPT mis à jour avec le contexte property');

    // Vérifier SIGNED_LEASE aussi
    const signedLease = await prisma.documentType.findFirst({
      where: { code: 'SIGNED_LEASE' }
    });

    if (signedLease && signedLease.suggestionConfig) {
      const leaseConfig = JSON.parse(signedLease.suggestionConfig);
      console.log(`\n📋 SIGNED_LEASE contextes: ${Object.keys(leaseConfig.defaults_by_context || {}).join(', ')}`);
      
      // Ajuster SIGNED_LEASE pour être moins prioritaire dans le contexte property
      // en retirant 'property' des contextes par défaut
      if (leaseConfig.defaults_by_context && leaseConfig.defaults_by_context.property) {
        const updatedLeaseConfig = {
          ...leaseConfig,
          defaults_by_context: {
            lease: leaseConfig.defaults_by_context.lease,
            global: leaseConfig.defaults_by_context.global || 'MISC'
            // Retirer 'property' pour éviter la priorité
          }
        };

        await prisma.documentType.update({
          where: { id: signedLease.id },
          data: {
            suggestionConfig: JSON.stringify(updatedLeaseConfig)
          }
        });

        console.log('✅ SIGNED_LEASE ajusté (retrait du contexte property)');
      }
    }

    console.log('\n🎉 Corrections appliquées !');
    console.log('✅ RENT_RECEIPT: Ajout du contexte property');
    console.log('✅ SIGNED_LEASE: Retrait du contexte property (si présent)');
    console.log('\nMaintenant, dans le contexte property:');
    console.log('- RENT_RECEIPT aura un score de base (quittances)');
    console.log('- SIGNED_LEASE n\'aura pas de score de base automatique');

  } catch (error) {
    console.error('❌ Erreur lors de la correction:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixRentReceiptContext().catch(console.error);
