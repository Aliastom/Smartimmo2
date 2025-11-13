/**
 * Script pour diagnostiquer pourquoi les règles ne s'affichent pas dans l'interface
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function debugRulesDisplay() {
  console.log('🔍 Diagnostic du problème d\'affichage des règles\n');

  try {
    // Vérifier RENT_RECEIPT spécifiquement
    const rentReceipt = await prisma.documentType.findFirst({
      where: { code: 'RENT_RECEIPT' }
    });

    if (!rentReceipt) {
      console.log('❌ Type RENT_RECEIPT non trouvé');
      return;
    }

    console.log(`📋 Type: ${rentReceipt.code} (${rentReceipt.label})`);
    console.log(`🆔 ID: ${rentReceipt.id}`);
    console.log(`🏷️ Système: ${rentReceipt.isSystem}`);
    console.log(`✅ Actif: ${rentReceipt.isActive}`);
    console.log('');

    // Vérifier le champ suggestionConfig brut
    console.log('🔍 Champ suggestionConfig brut:');
    console.log(`Type: ${typeof rentReceipt.suggestionConfig}`);
    console.log(`Valeur: ${rentReceipt.suggestionConfig}`);
    console.log(`Est null: ${rentReceipt.suggestionConfig === null}`);
    console.log(`Est undefined: ${rentReceipt.suggestionConfig === undefined}`);
    console.log(`Est string vide: ${rentReceipt.suggestionConfig === ''}`);
    console.log('');

    // Tenter de parser le JSON
    if (rentReceipt.suggestionConfig) {
      try {
        const parsed = JSON.parse(rentReceipt.suggestionConfig);
        console.log('✅ Parsing JSON réussi:');
        console.log(`Type parsé: ${typeof parsed}`);
        console.log(`Contient des règles: ${parsed.rules ? 'Oui' : 'Non'}`);
        console.log(`Nombre de règles: ${parsed.rules ? parsed.rules.length : 0}`);
        
        if (parsed.rules && parsed.rules.length > 0) {
          console.log('📋 Règles trouvées:');
          parsed.rules.forEach((rule, index) => {
            console.log(`   Règle ${index + 1}:`);
            console.log(`     Pattern: "${rule.pattern}"`);
            console.log(`     Poids: ${rule.weight}`);
            console.log(`     Contextes: ${rule.apply_in ? rule.apply_in.join(', ') : 'Aucun'}`);
          });
        }
      } catch (parseError) {
        console.log('❌ Erreur de parsing JSON:');
        console.log(`   Erreur: ${parseError.message}`);
        console.log(`   Contenu: "${rentReceipt.suggestionConfig}"`);
      }
    } else {
      console.log('⚠️ suggestionConfig est null/undefined/vide');
    }

    console.log('');

    // Vérifier les autres champs JSON
    console.log('🔍 Autres champs JSON:');
    console.log(`defaultContexts: ${rentReceipt.defaultContexts}`);
    console.log(`lockInFlows: ${rentReceipt.lockInFlows}`);
    console.log(`metadataSchema: ${rentReceipt.metadataSchema}`);

    // Tester le parsing de tous les champs
    try {
      const parsedType = {
        ...rentReceipt,
        defaultContexts: rentReceipt.defaultContexts ? JSON.parse(rentReceipt.defaultContexts) : [],
        suggestionConfig: rentReceipt.suggestionConfig ? JSON.parse(rentReceipt.suggestionConfig) : null,
        lockInFlows: rentReceipt.lockInFlows ? JSON.parse(rentReceipt.lockInFlows) : [],
        metadataSchema: rentReceipt.metadataSchema ? JSON.parse(rentReceipt.metadataSchema) : null,
      };

      console.log('\n✅ Parsing complet réussi:');
      console.log(`defaultContexts: [${parsedType.defaultContexts.join(', ')}]`);
      console.log(`suggestionConfig.rules: ${parsedType.suggestionConfig?.rules?.length || 0} règle(s)`);
      console.log(`lockInFlows: [${parsedType.lockInFlows.join(', ')}]`);
      console.log(`metadataSchema: ${parsedType.metadataSchema ? 'Défini' : 'Non défini'}`);

    } catch (error) {
      console.log('❌ Erreur lors du parsing complet:');
      console.log(`   Erreur: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Erreur lors du diagnostic:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugRulesDisplay().catch(console.error);
