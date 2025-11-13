/**
 * Script Node.js pour configurer les types de documents
 * Alternative à psql pour Windows
 * 
 * Usage: node scripts/configure-document-types.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Configuration des types de documents pour OCR → Transaction...\n');

  try {
    // 1. RELEVÉ DE COMPTE PROPRIÉTAIRE
    console.log('1️⃣ Configuration RELEVE_COMPTE_PROP...');
    await prisma.documentType.updateMany({
      where: { code: 'RELEVE_COMPTE_PROP' },
      data: {
        suggestionsConfig: JSON.stringify({
          regex: {
            periode: "(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|Jan|Fév|Mar|Avr|Mai|Juin|Juil|Août|Sep|Oct|Nov|Déc) ?(20\\d{2})",
            montant: "([0-9]{1,}[\\., ]?[0-9]{0,3}[\\.,][0-9]{2}) ?€?",
            bien: "(Appartement|Maison|Studio|T[0-9]|F[0-9]|Lot) ?([A-Z0-9\\-]+)?",
            reference: "Réf[érence\\.:]* ?([A-Z0-9\\-]{4,})",
            date: "([0-9]{1,2}[/\\-][0-9]{1,2}[/\\-][0-9]{4})"
          },
          libelleTemplate: "Loyer {periode} - {bien}"
        }),
        defaultContexts: JSON.stringify({
          autoCreateAboveConfidence: 0.85,
          natureCategorieMap: {
            "RECETTE_LOYER": "Loyer + Charges",
            "DEPENSE_GESTION": "Commission agence"
          },
          codeSystemMap: {
            "LOYER": "NATURE_LOYER",
            "COMMISSION": "NATURE_COMMISSION"
          }
        }),
        flowLocks: JSON.stringify([
          {
            if: "nature == 'DEPENSE_GESTION'",
            lock: ["categoryId"],
            reason: "Catégorie automatique pour commissions d'agence"
          }
        ]),
        metaSchema: JSON.stringify({
          fields: ["periode", "montant", "bien", "reference", "date"],
          confidenceThreshold: 0.6,
          version: "v1.0",
          requiredFields: ["montant", "periode"]
        })
      }
    });
    console.log('   ✅ RELEVE_COMPTE_PROP configuré\n');

    // 2. QUITTANCE DE LOYER
    console.log('2️⃣ Configuration QUITTANCE_LOYER...');
    await prisma.documentType.updateMany({
      where: { code: 'QUITTANCE_LOYER' },
      data: {
        suggestionsConfig: JSON.stringify({
          regex: {
            periode: "Période[\\s:]*([0-9]{2}/[0-9]{4}|[a-zéû]+ [0-9]{4})",
            montant: "Montant[\\s:]*([0-9]+[\\.,][0-9]{2})",
            bien: "Bien[\\s:]*([^\\n]+)",
            locataire: "Locataire[\\s:]*([^\\n]+)",
            date: "Date[\\s:]*([0-9]{1,2}[/\\-][0-9]{1,2}[/\\-][0-9]{4})"
          },
          libelleTemplate: "Quittance {periode}"
        }),
        defaultContexts: JSON.stringify({
          natureCategorieMap: {
            "RECETTE_LOYER": "Loyer + Charges"
          }
        }),
        metaSchema: JSON.stringify({
          fields: ["periode", "montant", "bien", "locataire"],
          confidenceThreshold: 0.7,
          version: "v1.0"
        })
      }
    });
    console.log('   ✅ QUITTANCE_LOYER configuré\n');

    // 3. FACTURE TRAVAUX
    console.log('3️⃣ Configuration FACTURE_TRAVAUX...');
    await prisma.documentType.updateMany({
      where: { code: 'FACTURE_TRAVAUX' },
      data: {
        suggestionsConfig: JSON.stringify({
          regex: {
            date: "Date[\\s:]*([0-9]{1,2}[/\\-][0-9]{1,2}[/\\-][0-9]{4})",
            montant: "Total TTC[\\s:]*([0-9]+[\\.,][0-9]{2})",
            reference: "Facture n°[\\s:]*([A-Z0-9\\-]+)",
            prestataire: "SIRET[\\s:]*[0-9]+ ?([^\\n]+)",
            bien: "(Appartement|Maison|Studio|Lot) ?([A-Z0-9\\-]+)?"
          },
          libelleTemplate: "Travaux {prestataire} - Facture {reference}"
        }),
        defaultContexts: JSON.stringify({
          natureCategorieMap: {
            "DEPENSE_ENTRETIEN": "Travaux et réparations",
            "DEPENSE_AMELIORATION": "Travaux d'amélioration"
          }
        }),
        metaSchema: JSON.stringify({
          fields: ["date", "montant", "reference", "prestataire", "bien"],
          confidenceThreshold: 0.5,
          version: "v1.0"
        })
      }
    });
    console.log('   ✅ FACTURE_TRAVAUX configuré\n');

    // 4. AVIS DE TAXE FONCIÈRE
    console.log('4️⃣ Configuration AVIS_TAXE_FONCIERE...');
    await prisma.documentType.updateMany({
      where: { code: 'AVIS_TAXE_FONCIERE' },
      data: {
        suggestionsConfig: JSON.stringify({
          regex: {
            annee: "Année[\\s:]*([0-9]{4})",
            montant: "Montant[\\s:]*([0-9]+[\\.,][0-9]{2})",
            bien: "Adresse[\\s:]*([^\\n]+)",
            reference: "Référence[\\s:]*([A-Z0-9\\-]+)",
            date: "Date limite[\\s:]*([0-9]{1,2}[/\\-][0-9]{1,2}[/\\-][0-9]{4})"
          },
          libelleTemplate: "Taxe foncière {annee}"
        }),
        defaultContexts: JSON.stringify({
          natureCategorieMap: {
            "DEPENSE_TAXE": "Taxe foncière"
          }
        }),
        metaSchema: JSON.stringify({
          fields: ["annee", "montant", "bien", "reference"],
          confidenceThreshold: 0.6,
          version: "v1.0"
        })
      }
    });
    console.log('   ✅ AVIS_TAXE_FONCIERE configuré\n');

    // 5. FACTURE ASSURANCE
    console.log('5️⃣ Configuration FACTURE_ASSURANCE...');
    await prisma.documentType.updateMany({
      where: { code: 'FACTURE_ASSURANCE' },
      data: {
        suggestionsConfig: JSON.stringify({
          regex: {
            date: "Date[\\s:]*([0-9]{1,2}[/\\-][0-9]{1,2}[/\\-][0-9]{4})",
            montant: "Prime annuelle[\\s:]*([0-9]+[\\.,][0-9]{2})",
            reference: "Police[\\s:]*([A-Z0-9\\-]+)",
            bien: "(Appartement|Maison|Studio|Lot) ?([A-Z0-9\\-]+)?",
            periode: "Période[\\s:]*([0-9]{2}/[0-9]{4})"
          },
          libelleTemplate: "Assurance {periode}"
        }),
        defaultContexts: JSON.stringify({
          natureCategorieMap: {
            "DEPENSE_ASSURANCE": "Assurance PNO",
            "DEPENSE_ASSURANCE_GLI": "Assurance GLI"
          }
        }),
        metaSchema: JSON.stringify({
          fields: ["date", "montant", "reference", "bien", "periode"],
          confidenceThreshold: 0.6,
          version: "v1.0"
        })
      }
    });
    console.log('   ✅ FACTURE_ASSURANCE configuré\n');

    // 6. FACTURE ÉNERGIE
    console.log('6️⃣ Configuration FACTURE_ENERGIE...');
    await prisma.documentType.updateMany({
      where: { code: 'FACTURE_ENERGIE' },
      data: {
        suggestionsConfig: JSON.stringify({
          regex: {
            date: "Date[\\s:]*([0-9]{1,2}[/\\-][0-9]{1,2}[/\\-][0-9]{4})",
            montant: "Montant à payer[\\s:]*([0-9]+[\\.,][0-9]{2})",
            reference: "Référence[\\s:]*([A-Z0-9\\-]+)",
            bien: "Adresse[\\s:]*([^\\n]+)",
            periode: "Période[\\s:]*([0-9]{2}/[0-9]{4})"
          },
          libelleTemplate: "Énergie {periode}"
        }),
        defaultContexts: JSON.stringify({
          natureCategorieMap: {
            "DEPENSE_ENERGIE": "Électricité et gaz"
          }
        }),
        metaSchema: JSON.stringify({
          fields: ["date", "montant", "reference", "bien", "periode"],
          confidenceThreshold: 0.5,
          version: "v1.0"
        })
      }
    });
    console.log('   ✅ FACTURE_ENERGIE configuré\n');

    // Vérification
    console.log('📊 Vérification de la configuration...\n');
    const configured = await prisma.documentType.findMany({
      where: {
        suggestionsConfig: { not: null },
        isActive: true
      },
      select: {
        code: true,
        label: true,
        metaSchema: true
      },
      orderBy: { order: 'asc' }
    });

    console.log('Types configurés :');
    configured.forEach((type) => {
      const meta = type.metaSchema ? JSON.parse(type.metaSchema) : {};
      console.log(`  ✅ ${type.code.padEnd(25)} | Seuil: ${meta.confidenceThreshold || 'N/A'}`);
    });

    console.log('\n🎉 Configuration terminée avec succès !');
    console.log('\n📝 Prochaines étapes :');
    console.log('  1. Redémarrer l\'application : npm run dev');
    console.log('  2. Uploader un document test sur /documents');
    console.log('  3. Vérifier l\'ouverture automatique de la modale');
    
  } catch (error) {
    console.error('❌ Erreur lors de la configuration :', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

