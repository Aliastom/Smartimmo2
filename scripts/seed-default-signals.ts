import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedDefaultSignals() {
  console.log('🌱 Seeding des signaux par défaut...\n');
  
  try {
    // Signaux par défaut pour la classification
    const defaultSignals = [
      // Signaux généraux
      {
        code: 'HAS_DATE_RANGE',
        label: 'Contient une période de dates',
        regex: '\\b(du|au|depuis|jusqu\'?au?|entre)\\s+\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}',
        flags: 'iu',
        description: 'Détecte la présence d\'une période de dates dans le document'
      },
      {
        code: 'HAS_AMOUNT',
        label: 'Contient un montant',
        regex: '\\b\\d+[\\s,.]?\\d*\\s*€?\\b',
        flags: 'iu',
        description: 'Détecte la présence d\'un montant monétaire'
      },
      {
        code: 'HAS_ADDRESS',
        label: 'Contient une adresse',
        regex: '\\b\\d+\\s+[a-zàâäéèêëïîôöùûüÿç\\s]+(?:rue|avenue|boulevard|place|impasse|allée|chemin|route)\\b',
        flags: 'iu',
        description: 'Détecte la présence d\'une adresse postale'
      },
      {
        code: 'HAS_PHONE',
        label: 'Contient un numéro de téléphone',
        regex: '\\b(?:0[1-9]|\\+33\\s?[1-9])\\s?[0-9]{8}\\b',
        flags: 'iu',
        description: 'Détecte la présence d\'un numéro de téléphone français'
      },
      {
        code: 'HAS_EMAIL',
        label: 'Contient une adresse email',
        regex: '\\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}\\b',
        flags: 'iu',
        description: 'Détecte la présence d\'une adresse email'
      },
      
      // Signaux spécifiques aux baux
      {
        code: 'BAIL_HEADER',
        label: 'En-tête de bail',
        regex: '\\b(?:contrat\\s+de\\s+location|bail\\s+de\\s+location|convention\\s+de\\s+location)\\b',
        flags: 'iu',
        description: 'Détecte un en-tête de contrat de bail'
      },
      {
        code: 'BAIL_PARTIES',
        label: 'Parties du bail',
        regex: '\\b(?:propriétaire|locataire|bailleur|preneur)\\b',
        flags: 'iu',
        description: 'Détecte la mention des parties au bail'
      },
      {
        code: 'BAIL_DURATION',
        label: 'Durée du bail',
        regex: '\\b(?:durée|période)\\s+(?:de\\s+)?(?:location|bail)\\b',
        flags: 'iu',
        description: 'Détecte la mention de la durée du bail'
      },
      {
        code: 'BAIL_RENT',
        label: 'Loyer et charges',
        regex: '\\b(?:loyer|charges|redevance)\\b',
        flags: 'iu',
        description: 'Détecte la mention du loyer et des charges'
      },
      
      // Signaux spécifiques aux quittances
      {
        code: 'QUITTANCE_HEADER',
        label: 'En-tête de quittance',
        regex: '\\b(?:quittance\\s+de\\s+loyer|reçu\\s+de\\s+loyer)\\b',
        flags: 'iu',
        description: 'Détecte un en-tête de quittance de loyer'
      },
      {
        code: 'QUITTANCE_PERIOD',
        label: 'Période de quittance',
        regex: '\\b(?:mois\\s+de|période\\s+du)\\s+\\w+\\s+\\d{4}\\b',
        flags: 'iu',
        description: 'Détecte la période de la quittance'
      },
      {
        code: 'QUITTANCE_AMOUNT',
        label: 'Montant de la quittance',
        regex: '\\b(?:montant|somme)\\s+(?:de\\s+)?(?:loyer|charges)\\b',
        flags: 'iu',
        description: 'Détecte la mention du montant de la quittance'
      },
      
      // Signaux spécifiques aux diagnostics
      {
        code: 'DPE_HEADER',
        label: 'En-tête DPE',
        regex: '\\b(?:diagnostic\\s+de\\s+performance\\s+énergétique|dpe)\\b',
        flags: 'iu',
        description: 'Détecte un en-tête de diagnostic de performance énergétique'
      },
      {
        code: 'DPE_CLASS',
        label: 'Classe énergétique',
        regex: '\\b(?:classe\\s+énergétique|étiquette\\s+énergie)\\s*[A-G]\\b',
        flags: 'iu',
        description: 'Détecte la classe énergétique du DPE'
      },
      {
        code: 'DPE_CONSUMPTION',
        label: 'Consommation énergétique',
        regex: '\\b(?:consommation|kwh|kwh/m²)\\b',
        flags: 'iu',
        description: 'Détecte la mention de consommation énergétique'
      },
      
      // Signaux spécifiques aux factures
      {
        code: 'INVOICE_HEADER',
        label: 'En-tête de facture',
        regex: '\\b(?:facture|devis|note\\s+de\\s+honoraires)\\b',
        flags: 'iu',
        description: 'Détecte un en-tête de facture'
      },
      {
        code: 'INVOICE_NUMBER',
        label: 'Numéro de facture',
        regex: '\\b(?:n°|numéro|ref)\\s*:?\\s*[A-Z0-9-]+\\b',
        flags: 'iu',
        description: 'Détecte un numéro de facture'
      },
      {
        code: 'INVOICE_DATE',
        label: 'Date de facture',
        regex: '\\b(?:date|le)\\s*:?\\s*\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}\\b',
        flags: 'iu',
        description: 'Détecte la date de la facture'
      },
      
      // Signaux spécifiques aux états des lieux
      {
        code: 'EDL_HEADER',
        label: 'En-tête d\'état des lieux',
        regex: '\\b(?:état\\s+des\\s+lieux|inventaire)\\b',
        flags: 'iu',
        description: 'Détecte un en-tête d\'état des lieux'
      },
      {
        code: 'EDL_ENTRY_EXIT',
        label: 'Entrée/Sortie',
        regex: '\\b(?:entrée|sortie|entrée\\s+en\\s+lieu|sortie\\s+de\\s+lieu)\\b',
        flags: 'iu',
        description: 'Détecte la mention d\'entrée ou sortie'
      },
      {
        code: 'EDL_CONDITIONS',
        label: 'État des lieux',
        regex: '\\b(?:bon|moyen|mauvais|excellent)\\s+(?:état|condition)\\b',
        flags: 'iu',
        description: 'Détecte l\'évaluation de l\'état des lieux'
      }
    ];

    // Créer les signaux
    console.log('📝 Création des signaux...');
    const createdSignals = [];
    
    for (const signal of defaultSignals) {
      try {
        const created = await prisma.signal.upsert({
          where: { code: signal.code },
          update: {
            label: signal.label,
            regex: signal.regex,
            flags: signal.flags,
            description: signal.description,
            updatedAt: new Date()
          },
          create: signal
        });
        createdSignals.push(created);
        console.log(`   ✅ ${signal.code}: ${signal.label}`);
      } catch (error) {
        console.log(`   ❌ Erreur pour ${signal.code}: ${error}`);
      }
    }

    console.log(`\n✅ ${createdSignals.length} signaux créés/mis à jour`);

    // Créer des associations TypeSignal pour les types de documents principaux
    console.log('\n🔗 Création des associations TypeSignal...');
    
    const documentTypes = await prisma.documentType.findMany({
      where: { isActive: true }
    });

    const typeSignalAssociations = [
      // BAIL_SIGNE
      {
        documentTypeCode: 'BAIL_SIGNE',
        signalCodes: ['BAIL_HEADER', 'BAIL_PARTIES', 'BAIL_DURATION', 'BAIL_RENT', 'HAS_DATE_RANGE', 'HAS_AMOUNT', 'HAS_ADDRESS']
      },
      // QUITTANCE
      {
        documentTypeCode: 'QUITTANCE',
        signalCodes: ['QUITTANCE_HEADER', 'QUITTANCE_PERIOD', 'QUITTANCE_AMOUNT', 'HAS_AMOUNT', 'HAS_DATE_RANGE']
      },
      // RECU_LOYER
      {
        documentTypeCode: 'RECU_LOYER',
        signalCodes: ['QUITTANCE_HEADER', 'QUITTANCE_PERIOD', 'QUITTANCE_AMOUNT', 'HAS_AMOUNT', 'HAS_DATE_RANGE']
      },
      // DPE
      {
        documentTypeCode: 'DPE',
        signalCodes: ['DPE_HEADER', 'DPE_CLASS', 'DPE_CONSUMPTION', 'HAS_ADDRESS']
      },
      // FACTURE
      {
        documentTypeCode: 'FACTURE',
        signalCodes: ['INVOICE_HEADER', 'INVOICE_NUMBER', 'INVOICE_DATE', 'HAS_AMOUNT', 'HAS_ADDRESS']
      },
      // FACTURE_TRAVAUX
      {
        documentTypeCode: 'FACTURE_TRAVAUX',
        signalCodes: ['INVOICE_HEADER', 'INVOICE_NUMBER', 'INVOICE_DATE', 'HAS_AMOUNT', 'HAS_ADDRESS']
      },
      // EDL_ENTREE
      {
        documentTypeCode: 'EDL_ENTREE',
        signalCodes: ['EDL_HEADER', 'EDL_ENTRY_EXIT', 'EDL_CONDITIONS', 'HAS_ADDRESS', 'HAS_DATE_RANGE']
      },
      // EDL_SORTIE
      {
        documentTypeCode: 'EDL_SORTIE',
        signalCodes: ['EDL_HEADER', 'EDL_ENTRY_EXIT', 'EDL_CONDITIONS', 'HAS_ADDRESS', 'HAS_DATE_RANGE']
      }
    ];

    let associationsCreated = 0;
    
    for (const association of typeSignalAssociations) {
      const documentType = documentTypes.find(dt => dt.code === association.documentTypeCode);
      
      if (documentType) {
        for (const signalCode of association.signalCodes) {
          const signal = createdSignals.find(s => s.code === signalCode);
          
          if (signal) {
            try {
              await prisma.typeSignal.upsert({
                where: {
                  documentTypeId_signalId: {
                    documentTypeId: documentType.id,
                    signalId: signal.id
                  }
                },
                update: {
                  weight: 1.0,
                  enabled: true,
                  updatedAt: new Date()
                },
                create: {
                  documentTypeId: documentType.id,
                  signalId: signal.id,
                  weight: 1.0,
                  enabled: true
                }
              });
              associationsCreated++;
            } catch (error) {
              console.log(`   ⚠️  Erreur association ${documentType.code} + ${signalCode}: ${error}`);
            }
          }
        }
        console.log(`   ✅ ${association.documentTypeCode}: ${association.signalCodes.length} signaux associés`);
      }
    }

    console.log(`\n✅ ${associationsCreated} associations TypeSignal créées`);

    // Invalider le cache de configuration
    await prisma.appConfig.upsert({
      where: { key: 'document_config_version' },
      update: { 
        value: JSON.stringify({ version: Date.now() }),
        updatedAt: new Date(),
      },
      create: { 
        key: 'document_config_version',
        value: JSON.stringify({ version: Date.now() }),
        description: 'Version de la configuration des documents pour invalidation du cache',
      },
    });

    console.log('\n🎉 Seeding des signaux terminé avec succès !');
    console.log('\n📝 Résumé :');
    console.log(`   - ${createdSignals.length} signaux créés/mis à jour`);
    console.log(`   - ${associationsCreated} associations TypeSignal créées`);
    console.log(`   - Cache de configuration invalidé`);

  } catch (error) {
    console.error('💥 Erreur lors du seeding des signaux:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le seeding
seedDefaultSignals()
  .then(() => {
    console.log('\n🎉 Seeding des signaux terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Échec du seeding des signaux:', error);
    process.exit(1);
  });

export { seedDefaultSignals };
