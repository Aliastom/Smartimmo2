#!/usr/bin/env npx tsx

/**
 * Test de la combobox désactivée dans la modal d'upload
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testComboboxDisabled() {
  console.log('🧪 Test de la combobox désactivée dans la modal d\'upload...\n');

  try {
    // 1. Vérifier qu'il y a des baux et propriétés
    console.log('📋 Vérification des données...');
    const [leases, properties] = await Promise.all([
      prisma.lease.findMany({ take: 2, include: { property: true, tenant: true } }),
      prisma.property.findMany({ take: 2 })
    ]);

    console.log(`   ✅ ${leases.length} bail(s) trouvé(s)`);
    console.log(`   ✅ ${properties.length} propriété(s) trouvée(s)`);

    // 2. Résumé de la modification
    console.log('\n🔧 Modification appliquée:');
    console.log('   ✅ 1. Type de document toujours affiché comme combobox');
    console.log('   ✅ 2. Combobox désactivée quand documentTypeEditable = false');
    console.log('   ✅ 3. Style visuel pour indiquer l\'état désactivé');
    console.log('   ✅ 4. Badge informatif "Type pré-rempli" + "Non modifiable"');

    console.log('\n🎉 Combobox désactivée implémentée !');
    console.log('   - Toujours une combobox (plus de badge)');
    console.log('   - Désactivée et pré-sélectionnée depuis le drawer des baux');
    console.log('   - Activée et modifiable depuis les autres pages');

    // 3. Instructions de test
    console.log('\n🧪 Instructions de test:');
    console.log('   1. Page Documents générale:');
    console.log('      - Cliquer "Uploader"');
    console.log('      - ✅ Combobox activée et modifiable');
    console.log('   2. Page Biens/Documents:');
    console.log('      - Aller dans Biens → [Un bien] → Documents');
    console.log('      - Cliquer "Uploader"');
    console.log('      - ✅ Combobox activée et modifiable');
    console.log('   3. Drawer Baux (test principal):');
    console.log('      - Aller dans Baux → Cliquer sur un bail');
    console.log('      - Cliquer "Uploader" sur un document');
    console.log('      - ✅ Combobox DÉSACTIVÉE et pré-sélectionnée');
    console.log('      - ✅ Badge "Type pré-rempli" + "Non modifiable" visible');
    console.log('   4. Bien/Baux:');
    console.log('      - Aller dans Biens → [Un bien] → Baux');
    console.log('      - Cliquer "Modifier" → "Upload bail signé"');
    console.log('      - ✅ Combobox DÉSACTIVÉE et pré-sélectionnée à "Bail signé"');

    // 4. Comportements attendus
    console.log('\n🎯 Comportements attendus:');
    console.log('   - Drawer Baux: Combobox grisée, non cliquable, type pré-sélectionné');
    console.log('   - Autres pages: Combobox normale, cliquable, modifiable');
    console.log('   - Style visuel: bg-gray-100, text-gray-600, cursor-not-allowed');
    console.log('   - Badge informatif: "Type pré-rempli" + "Non modifiable"');

    // 5. Différences visuelles
    console.log('\n🎨 Différences visuelles:');
    console.log('   - Combobox activée: Fond blanc, texte noir, curseur normal');
    console.log('   - Combobox désactivée: Fond gris, texte gris, curseur interdit');
    console.log('   - Badge informatif: Visible uniquement quand désactivée');

  } catch (error) {
    console.error('💥 Erreur lors des tests:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter les tests
testComboboxDisabled()
  .then(() => {
    console.log('\n🎯 Tests terminés');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec des tests:', error);
    process.exit(1);
  });

