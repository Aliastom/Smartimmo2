import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedDocumentTypes() {
  console.log('🌱 Seeding des types de documents...\n');

  try {
    // Types de documents de base
    const documentTypes = [
      {
        code: 'BAIL_SIGNE',
        label: 'Bail Signé',
        description: 'Contrat de bail signé entre propriétaire et locataire',
        icon: '📄',
        isSystem: true,
        isActive: true,
        order: 1,
        autoAssignThreshold: 0.85,
        keywords: [
          { keyword: 'bail', weight: 3.0, context: 'title' },
          { keyword: 'contrat', weight: 2.5, context: 'title' },
          { keyword: 'location', weight: 2.0 },
          { keyword: 'locataire', weight: 2.0 },
          { keyword: 'loyer', weight: 1.5 },
          { keyword: 'charges', weight: 1.5 },
          { keyword: 'garantie', weight: 1.5 },
          { keyword: 'signature', weight: 1.0 },
          { keyword: 'durée', weight: 1.0 },
          { keyword: 'logement', weight: 1.0 },
        ],
        signals: [
          { code: 'HAS_DATE_RANGE', label: 'Contient une période de location', weight: 2.0 },
          { code: 'HAS_AMOUNT', label: 'Contient un montant de loyer', weight: 1.5 },
          { code: 'HAS_ADDRESS', label: 'Contient une adresse', weight: 1.5 },
          { code: 'META_CONTRACT_HEADER', label: 'En-tête de contrat', weight: 1.0 },
        ],
        extractionRules: [
          { fieldName: 'start_date', pattern: 'du\\s+(\\d{1,2}[\\/\\-\\.]\\d{1,2}[\\/\\-\\.]\\d{2,4})', postProcess: 'fr_date', priority: 100 },
          { fieldName: 'end_date', pattern: 'au\\s+(\\d{1,2}[\\/\\-\\.]\\d{1,2}[\\/\\-\\.]\\d{2,4})', postProcess: 'fr_date', priority: 100 },
          { fieldName: 'rent_amount', pattern: 'loyer[\\s\\w]*?(\\d+(?:[\\.,]\\d{2})?)\\s*€', postProcess: 'money_eur', priority: 200 },
          { fieldName: 'charges_amount', pattern: 'charges[\\s\\w]*?(\\d+(?:[\\.,]\\d{2})?)\\s*€', postProcess: 'money_eur', priority: 300 },
          { fieldName: 'deposit_amount', pattern: 'garantie[\\s\\w]*?(\\d+(?:[\\.,]\\d{2})?)\\s*€', postProcess: 'money_eur', priority: 400 },
        ],
      },
      {
        code: 'QUITTANCE',
        label: 'Quittance de Loyer',
        description: 'Quittance de paiement de loyer',
        icon: '🧾',
        isSystem: true,
        isActive: true,
        order: 2,
        autoAssignThreshold: 0.9,
        keywords: [
          { keyword: 'quittance', weight: 4.0, context: 'title' },
          { keyword: 'loyer', weight: 3.0 },
          { keyword: 'paiement', weight: 2.0 },
          { keyword: 'reçu', weight: 2.0 },
          { keyword: 'encaissement', weight: 1.5 },
          { keyword: 'versement', weight: 1.5 },
          { keyword: 'mensuel', weight: 1.0 },
          { keyword: 'règlement', weight: 1.0 },
        ],
        signals: [
          { code: 'HAS_AMOUNT', label: 'Contient un montant', weight: 2.5 },
          { code: 'MONTH_YEAR_PATTERN', label: 'Contient une période (mois/année)', weight: 2.0 },
          { code: 'HAS_RECEIPT_HEADER', label: 'En-tête de quittance', weight: 1.5 },
        ],
        extractionRules: [
          { fieldName: 'period_month', pattern: '(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)', priority: 100 },
          { fieldName: 'period_year', pattern: '\\b(20\\d{2})\\b', priority: 100 },
          { fieldName: 'amount_paid', pattern: '(\\d+(?:[\\.,]\\d{2})?)\\s*€', postProcess: 'money_eur', priority: 200 },
          { fieldName: 'payment_date', pattern: '\\b(\\d{1,2}[\\/\\-\\.]\\d{1,2}[\\/\\-\\.]\\d{2,4})\\b', postProcess: 'fr_date', priority: 300 },
        ],
      },
      {
        code: 'ATTESTATION_ASSURANCE',
        label: 'Attestation d\'Assurance',
        description: 'Attestation d\'assurance habitation',
        icon: '🛡️',
        isSystem: true,
        isActive: true,
        order: 3,
        autoAssignThreshold: 0.8,
        keywords: [
          { keyword: 'attestation', weight: 3.0, context: 'title' },
          { keyword: 'assurance', weight: 3.0 },
          { keyword: 'garantie', weight: 2.0 },
          { keyword: 'police', weight: 2.0 },
          { keyword: 'risques', weight: 1.5 },
          { keyword: 'couverture', weight: 1.5 },
          { keyword: 'prime', weight: 1.0 },
          { keyword: 'assureur', weight: 1.0 },
          { keyword: 'validité', weight: 1.0 },
        ],
        signals: [
          { code: 'HEADER_ASSUREUR', label: 'En-tête d\'assureur', weight: 2.0 },
          { code: 'HAS_EXPIRY_DATE', label: 'Contient une date d\'expiration', weight: 2.0 },
          { code: 'HAS_POLICY_NUMBER', label: 'Contient un numéro de police', weight: 1.5 },
        ],
        extractionRules: [
          { fieldName: 'expiry_date', pattern: 'expire[\\s\\w]*?(\\d{1,2}[\\/\\-\\.]\\d{1,2}[\\/\\-\\.]\\d{2,4})', postProcess: 'fr_date', priority: 100 },
          { fieldName: 'policy_number', pattern: 'police[\\s\\w]*?(\\w+)', priority: 200 },
          { fieldName: 'insurer_name', pattern: '(\\w+\\s+assurance|\\w+\\s+assurances)', priority: 300 },
          { fieldName: 'premium_amount', pattern: 'prime[\\s\\w]*?(\\d+(?:[\\.,]\\d{2})?)\\s*€', postProcess: 'money_eur', priority: 400 },
        ],
      },
      {
        code: 'TAXE_FONCIERE',
        label: 'Taxe Foncière',
        description: 'Avis de taxe foncière',
        icon: '🏛️',
        isSystem: true,
        isActive: true,
        order: 4,
        autoAssignThreshold: 0.85,
        keywords: [
          { keyword: 'taxe', weight: 3.0, context: 'title' },
          { keyword: 'foncière', weight: 3.0 },
          { keyword: 'propriété', weight: 2.0 },
          { keyword: 'impôt', weight: 1.5 },
          { keyword: 'terrain', weight: 1.0 },
          { keyword: 'bâti', weight: 1.0 },
          { keyword: 'revenu', weight: 1.0 },
        ],
        signals: [
          { code: 'HEADER_IMPOTS', label: 'En-tête des impôts', weight: 2.5 },
          { code: 'HAS_AMOUNT', label: 'Contient un montant de taxe', weight: 2.0 },
          { code: 'HAS_YEAR', label: 'Contient une année fiscale', weight: 1.5 },
        ],
        extractionRules: [
          { fieldName: 'tax_year', pattern: '\\b(20\\d{2})\\b', priority: 100 },
          { fieldName: 'total_amount', pattern: 'montant[\\s\\w]*?(\\d+(?:[\\.,]\\d{2})?)\\s*€', postProcess: 'money_eur', priority: 200 },
          { fieldName: 'property_address', pattern: 'adresse[\\s\\w]*?([^\\n]+)', priority: 300 },
        ],
      },
      {
        code: 'DPE',
        label: 'Diagnostic de Performance Énergétique',
        description: 'DPE du logement',
        icon: '⚡',
        isSystem: true,
        isActive: true,
        order: 5,
        autoAssignThreshold: 0.8,
        keywords: [
          { keyword: 'diagnostic', weight: 2.5, context: 'title' },
          { keyword: 'performance', weight: 2.5 },
          { keyword: 'énergétique', weight: 2.5 },
          { keyword: 'dpe', weight: 3.0 },
          { keyword: 'classe', weight: 2.0 },
          { keyword: 'énergie', weight: 1.5 },
          { keyword: 'consommation', weight: 1.5 },
          { keyword: 'émission', weight: 1.5 },
        ],
        signals: [
          { code: 'HAS_ENERGY_CLASS', label: 'Contient une classe énergétique', weight: 2.0 },
          { code: 'HAS_VALIDITY_DATE', label: 'Contient une date de validité', weight: 1.5 },
        ],
        extractionRules: [
          { fieldName: 'energy_class', pattern: 'classe[\\s\\w]*?([ABCDEFG])', priority: 100 },
          { fieldName: 'valid_until', pattern: 'valide[\\s\\w]*?(\\d{1,2}[\\/\\-\\.]\\d{1,2}[\\/\\-\\.]\\d{2,4})', postProcess: 'fr_date', priority: 200 },
          { fieldName: 'consumption', pattern: 'consommation[\\s\\w]*?(\\d+)\\s*kWh', priority: 300 },
        ],
      },
    ];

    for (const typeData of documentTypes) {
      console.log(`📄 Création du type: ${typeData.label} (${typeData.code})`);

      // Supprimer le type existant s'il y en a un
      await prisma.documentType.deleteMany({
        where: { code: typeData.code },
      });

      // Créer le type de document
      const { keywords, signals, extractionRules, ...typeFields } = typeData;
      
      const documentType = await prisma.documentType.create({
        data: typeFields,
      });

      // Créer les mots-clés
      if (keywords.length > 0) {
        await prisma.documentKeyword.createMany({
          data: keywords.map(keyword => ({
            ...keyword,
            documentTypeId: documentType.id,
          })),
        });
        console.log(`   ✅ ${keywords.length} mots-clés créés`);
      }

      // Créer les signaux
      if (signals.length > 0) {
        await prisma.documentSignal.createMany({
          data: signals.map(signal => ({
            ...signal,
            documentTypeId: documentType.id,
          })),
        });
        console.log(`   ✅ ${signals.length} signaux créés`);
      }

      // Créer les règles d'extraction
      if (extractionRules.length > 0) {
        await prisma.documentExtractionRule.createMany({
          data: extractionRules.map(rule => ({
            ...rule,
            documentTypeId: documentType.id,
          })),
        });
        console.log(`   ✅ ${extractionRules.length} règles d'extraction créées`);
      }

      console.log(`   🎯 Seuil auto-assign: ${(typeData.autoAssignThreshold * 100).toFixed(0)}%`);
    }

    console.log('\n🎉 Seed terminé avec succès !');
    console.log(`📊 ${documentTypes.length} types de documents créés avec leur configuration complète.`);

  } catch (error) {
    console.error('❌ Erreur lors du seed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le seed
seedDocumentTypes();
