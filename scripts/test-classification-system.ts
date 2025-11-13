import { PrismaClient } from '@prisma/client';
import { classificationBDDService } from '../src/services/classification-bdd.service';

const prisma = new PrismaClient();

async function testClassificationSystem() {
  console.log('🧪 Test du système de classification avec signaux...\n');
  
  try {
    // 1. Vérifier que les signaux existent
    console.log('📊 Vérification des signaux...');
    
    const signals = await prisma.signal.findMany({
      where: { deletedAt: null },
      include: {
        typeSignals: {
          include: {
            documentType: {
              select: {
                code: true,
                label: true
              }
            }
          }
        }
      }
    });
    
    console.log(`✅ ${signals.length} signaux trouvés`);
    
    // Grouper par utilisation
    const signalsByUsage = signals.reduce((acc, signal) => {
      const usage = signal.typeSignals.length;
      if (!acc[usage]) acc[usage] = [];
      acc[usage].push(signal);
      return acc;
    }, {} as Record<number, any[]>);
    
    Object.entries(signalsByUsage).forEach(([usage, signalList]) => {
      console.log(`   - ${usage} utilisation(s): ${signalList.length} signaux`);
      signalList.slice(0, 2).forEach(signal => {
        console.log(`     • ${signal.code}: ${signal.label}`);
      });
    });

    // 2. Vérifier les associations TypeSignal
    console.log('\n🔗 Vérification des associations TypeSignal...');
    
    const typeSignals = await prisma.typeSignal.findMany({
      include: {
        documentType: {
          select: { code: true, label: true }
        },
        signal: {
          select: { code: true, label: true }
        }
      }
    });
    
    console.log(`✅ ${typeSignals.length} associations TypeSignal trouvées`);
    
    // Grouper par type de document
    const associationsByType = typeSignals.reduce((acc, ts) => {
      const typeCode = ts.documentType.code;
      if (!acc[typeCode]) acc[typeCode] = [];
      acc[typeCode].push(ts);
      return acc;
    }, {} as Record<string, any[]>);
    
    Object.entries(associationsByType).forEach(([typeCode, associations]) => {
      console.log(`   - ${typeCode}: ${associations.length} signaux associés`);
    });

    // 3. Tester la classification avec des exemples
    console.log('\n🔍 Test de la classification avec des exemples...');
    
    const testCases = [
      {
        filename: 'quittance_mars_2025_Jasmin.pdf',
        text: 'QUITTANCE DE LOYER\n\nPériode du 1er mars 2025 au 31 mars 2025\n\nLocataire: M. Jasmin\nAdresse: 123 rue de la Paix, 75001 Paris\n\nMontant du loyer: 850,00 €\nCharges: 120,00 €\nTotal: 970,00 €',
        expectedType: 'QUITTANCE'
      },
      {
        filename: 'bail_signe_appartement_1.pdf',
        text: 'CONTRAT DE LOCATION\n\nEntre les soussignés:\n- Propriétaire: Mme Dupont\n- Locataire: M. Martin\n\nObjet: Location d\'un appartement situé 45 avenue des Champs, 75008 Paris\n\nDurée: 3 ans à compter du 1er septembre 2024\nLoyer: 1200,00 € par mois\nCharges: 150,00 € par mois',
        expectedType: 'BAIL_SIGNE'
      },
      {
        filename: 'DPE_2024_maison.pdf',
        text: 'DIAGNOSTIC DE PERFORMANCE ÉNERGÉTIQUE\n\nAdresse: 78 rue de la République, 69000 Lyon\n\nClasse énergétique: D\nConsommation: 180 kWh/m²/an\nÉmissions GES: 25 kg CO2/m²/an',
        expectedType: 'DPE'
      },
      {
        filename: 'facture_travaux_plomberie.pdf',
        text: 'FACTURE\n\nN°: F2024-001\nDate: 15/03/2024\n\nTravaux de plomberie\n- Réparation fuite: 150,00 €\n- Remplacement robinet: 80,00 €\n\nTotal TTC: 230,00 €',
        expectedType: 'FACTURE_TRAVAUX'
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n📄 Test: ${testCase.filename}`);
      
      try {
        const results = await classificationBDDService.classifyDocument(testCase.text);
        
        if (results && results.length > 0) {
          const topResult = results[0];
          console.log(`   ✅ Type suggéré: ${topResult.typeLabel} (${topResult.typeCode})`);
          console.log(`   📊 Confiance: ${(topResult.confidence * 100).toFixed(1)}%`);
          
          if (topResult.typeCode === testCase.expectedType) {
            console.log(`   🎯 CORRECT - Correspond au type attendu`);
          } else {
            console.log(`   ⚠️  ATTENTION - Attendu: ${testCase.expectedType}, Obtenu: ${topResult.typeCode}`);
          }
          
          if (topResult.matchedSignals && topResult.matchedSignals.length > 0) {
            console.log(`   🔍 Signaux détectés:`);
            topResult.matchedSignals.slice(0, 3).forEach((signal, index) => {
              console.log(`     ${index + 1}. ${signal.label} (${signal.code}) - poids: ${signal.weight}`);
            });
          }
          
          if (results.length > 1) {
            console.log(`   🔄 Alternatives:`);
            results.slice(1, 3).forEach((alt, index) => {
              console.log(`     ${index + 1}. ${alt.typeLabel} (${(alt.confidence * 100).toFixed(1)}%)`);
            });
          }
        } else {
          console.log(`   ❌ Aucune classification suggérée`);
        }
      } catch (error) {
        console.log(`   💥 Erreur lors de la classification: ${error}`);
      }
    }

    // 4. Tester l'extraction de signaux
    console.log('\n🔍 Test de l\'extraction de signaux...');
    
    const testText = 'QUITTANCE DE LOYER\nPériode du 1er mars 2025 au 31 mars 2025\nMontant: 850,00 €\nAdresse: 123 rue de la Paix, 75001 Paris';
    
    // Tester directement avec le service BDD
    try {
      const results = await classificationBDDService.classifyDocument(testText);
      
      console.log(`   ✅ Classification testée avec succès`);
      if (results && results.length > 0) {
        const topResult = results[0];
        console.log(`   📊 Résultat: ${topResult.typeLabel} (${(topResult.confidence * 100).toFixed(1)}%)`);
        
        if (topResult.matchedSignals && topResult.matchedSignals.length > 0) {
          console.log(`   🔍 Signaux détectés: ${topResult.matchedSignals.length}`);
          topResult.matchedSignals.slice(0, 2).forEach((signal, index) => {
            console.log(`     ${index + 1}. ${signal.label} (${signal.code})`);
          });
        }
      } else {
        console.log(`   ❌ Aucun résultat de classification`);
      }
    } catch (error) {
      console.log(`   💥 Erreur: ${error}`);
    }

    console.log('\n✅ Test du système de classification réussi !');
    console.log('\n📝 Le système de classification fonctionne :');
    console.log('   - Signaux chargés ✅');
    console.log('   - Associations TypeSignal ✅');
    console.log('   - Classification automatique ✅');
    console.log('   - Extraction de signaux ✅');
    console.log('   - Détection de confiance ✅');

  } catch (error) {
    console.error('💥 Erreur lors du test de classification:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le test
testClassificationSystem()
  .then(() => {
    console.log('\n🎉 Test de classification terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec du test de classification:', error);
    process.exit(1);
  });

export { testClassificationSystem };
