/**
 * Script de seed pour le système de documents
 * Crée les types de documents, champs, règles d'extraction et mots-clés
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const documentTypesData = [
  {
    code: 'BAIL_SIGNE',
    label: 'Bail signé',
    description: 'Contrat de location signé',
    icon: '📝',
    order: 1,
    fields: [
      { name: 'start_period', dataType: 'date', isRequired: true, label: 'Date de début' },
      { name: 'end_period', dataType: 'date', isRequired: false, label: 'Date de fin' },
      { name: 'rent_amount', dataType: 'money', isRequired: true, label: 'Montant du loyer' },
      { name: 'charges_amount', dataType: 'money', isRequired: false, label: 'Charges' },
      { name: 'address', dataType: 'address', isRequired: true, label: 'Adresse du bien' },
      { name: 'tenant_name', dataType: 'string', isRequired: true, label: 'Nom du locataire' },
    ],
    rules: [
      { fieldName: 'start_period', pattern: 'à\\s+compter\\s+du\\s+([\\d]{1,2}[\\/-][\\d]{1,2}[\\/-][\\d]{4})', postProcess: 'fr_date', priority: 100 },
      { fieldName: 'rent_amount', pattern: 'loyer\\s+mensuel[^\\d]+([\\d\\s,]+)\\s*€', postProcess: 'money_eur', priority: 100 },
      { fieldName: 'charges_amount', pattern: 'charges[^\\d]+([\\d\\s,]+)\\s*€', postProcess: 'money_eur', priority: 90 },
    ],
    keywords: [
      { keyword: 'bail', weight: 10, context: 'title' },
      { keyword: 'contrat de location', weight: 9, context: null },
      { keyword: 'bailleur', weight: 7, context: null },
      { keyword: 'locataire', weight: 7, context: null },
      { keyword: 'loyer', weight: 6, context: null },
      { keyword: 'dépôt de garantie', weight: 5, context: null },
    ],
  },
  {
    code: 'QUITTANCE',
    label: 'Quittance de loyer',
    description: 'Reçu de paiement de loyer',
    icon: '🧾',
    order: 2,
    fields: [
      { name: 'period_month', dataType: 'int', isRequired: true, label: 'Mois' },
      { name: 'period_year', dataType: 'int', isRequired: true, label: 'Année' },
      { name: 'amount_paid', dataType: 'money', isRequired: true, label: 'Montant payé' },
      { name: 'tenant_name', dataType: 'string', isRequired: true, label: 'Nom du locataire' },
      { name: 'lease_ref', dataType: 'string', isRequired: false, label: 'Référence bail' },
    ],
    rules: [
      { fieldName: 'period_month', pattern: 'mois\\s+de\\s+(\\w+)\\s+([\\d]{4})', postProcess: null, priority: 100 },
      { fieldName: 'amount_paid', pattern: 'somme\\s+de[^\\d]+([\\d\\s,]+)\\s*€', postProcess: 'money_eur', priority: 100 },
    ],
    keywords: [
      { keyword: 'quittance', weight: 10, context: 'title' },
      { keyword: 'reçu', weight: 8, context: null },
      { keyword: 'loyer', weight: 7, context: null },
      { keyword: 'payé', weight: 5, context: null },
      { keyword: 'acquitté', weight: 5, context: null },
    ],
  },
  {
    code: 'ATTESTATION_ASSURANCE',
    label: 'Attestation d\'assurance',
    description: 'Assurance habitation du locataire',
    icon: '🛡️',
    order: 3,
    isSensitive: false,
    fields: [
      { name: 'expiry_date', dataType: 'date', isRequired: true, label: 'Date d\'expiration' },
      { name: 'insurer_name', dataType: 'string', isRequired: true, label: 'Assureur' },
      { name: 'policy_number', dataType: 'string', isRequired: false, label: 'Numéro de police' },
      { name: 'tenant_name', dataType: 'string', isRequired: true, label: 'Nom de l\'assuré' },
    ],
    rules: [
      { fieldName: 'expiry_date', pattern: 'valable\\s+jusqu\'au\\s+([\\d]{1,2}[\\/-][\\d]{1,2}[\\/-][\\d]{4})', postProcess: 'fr_date', priority: 100 },
      { fieldName: 'policy_number', pattern: 'police\\s+n[°o]\\s*([\\dA-Z]+)', postProcess: null, priority: 90 },
    ],
    keywords: [
      { keyword: 'attestation', weight: 9, context: 'title' },
      { keyword: 'assurance', weight: 10, context: null },
      { keyword: 'garantie', weight: 6, context: null },
      { keyword: 'responsabilité civile', weight: 7, context: null },
      { keyword: 'multirisque habitation', weight: 8, context: null },
    ],
  },
  {
    code: 'TAXE_FONCIERE',
    label: 'Taxe foncière',
    description: 'Avis d\'imposition foncière',
    icon: '🏛️',
    order: 4,
    fields: [
      { name: 'year', dataType: 'int', isRequired: true, label: 'Année' },
      { name: 'amount_total', dataType: 'money', isRequired: true, label: 'Montant total' },
      { name: 'property_address', dataType: 'address', isRequired: true, label: 'Adresse du bien' },
    ],
    rules: [
      { fieldName: 'year', pattern: 'année\\s+([\\d]{4})', postProcess: null, priority: 100 },
      { fieldName: 'amount_total', pattern: 'montant\\s+total[^\\d]+([\\d\\s,]+)\\s*€', postProcess: 'money_eur', priority: 100 },
    ],
    keywords: [
      { keyword: 'taxe foncière', weight: 10, context: 'title' },
      { keyword: 'impôts', weight: 7, context: null },
      { keyword: 'propriétés bâties', weight: 6, context: null },
      { keyword: 'avis d\'imposition', weight: 8, context: null },
    ],
  },
  {
    code: 'DPE',
    label: 'Diagnostic de Performance Énergétique (DPE)',
    description: 'Diagnostic énergétique du bien',
    icon: '⚡',
    order: 5,
    fields: [
      { name: 'grade', dataType: 'string', isRequired: true, label: 'Classe énergétique (A-G)' },
      { name: 'valid_until', dataType: 'date', isRequired: true, label: 'Valable jusqu\'au' },
      { name: 'consumption', dataType: 'int', isRequired: false, label: 'Consommation (kWh/m²/an)' },
    ],
    rules: [
      { fieldName: 'grade', pattern: 'classe\\s+énergétique\\s*[:\\s]*([A-G])', postProcess: null, priority: 100 },
      { fieldName: 'valid_until', pattern: 'valable\\s+jusqu\'au\\s+([\\d]{1,2}[\\/-][\\d]{1,2}[\\/-][\\d]{4})', postProcess: 'fr_date', priority: 100 },
    ],
    keywords: [
      { keyword: 'dpe', weight: 10, context: 'title' },
      { keyword: 'diagnostic de performance énergétique', weight: 10, context: 'title' },
      { keyword: 'classe énergétique', weight: 8, context: null },
      { keyword: 'consommation', weight: 6, context: null },
      { keyword: 'ges', weight: 5, context: null },
    ],
  },
  {
    code: 'EDL',
    label: 'État des lieux',
    description: 'État des lieux d\'entrée ou de sortie',
    icon: '📋',
    order: 6,
    fields: [
      { name: 'edl_type', dataType: 'string', isRequired: true, label: 'Type (entrée/sortie)' },
      { name: 'edl_date', dataType: 'date', isRequired: true, label: 'Date' },
      { name: 'address', dataType: 'address', isRequired: true, label: 'Adresse' },
    ],
    rules: [
      { fieldName: 'edl_date', pattern: 'fait\\s+le\\s+([\\d]{1,2}[\\/-][\\d]{1,2}[\\/-][\\d]{4})', postProcess: 'fr_date', priority: 100 },
    ],
    keywords: [
      { keyword: 'état des lieux', weight: 10, context: 'title' },
      { keyword: 'etat des lieux', weight: 10, context: 'title' },
      { keyword: 'edl', weight: 9, context: null },
      { keyword: 'entrée', weight: 6, context: null },
      { keyword: 'sortie', weight: 6, context: null },
    ],
  },
  {
    code: 'FACTURE',
    label: 'Facture',
    description: 'Facture de travaux, fournitures, etc.',
    icon: '💶',
    order: 7,
    fields: [
      { name: 'invoice_date', dataType: 'date', isRequired: true, label: 'Date' },
      { name: 'invoice_number', dataType: 'string', isRequired: false, label: 'Numéro' },
      { name: 'amount_ht', dataType: 'money', isRequired: false, label: 'Montant HT' },
      { name: 'amount_ttc', dataType: 'money', isRequired: true, label: 'Montant TTC' },
      { name: 'vendor_name', dataType: 'string', isRequired: true, label: 'Fournisseur' },
    ],
    rules: [
      { fieldName: 'invoice_date', pattern: 'date\\s*[:\\s]*([\\d]{1,2}[\\/-][\\d]{1,2}[\\/-][\\d]{4})', postProcess: 'fr_date', priority: 100 },
      { fieldName: 'amount_ttc', pattern: 'total\\s+ttc[^\\d]+([\\d\\s,]+)\\s*€', postProcess: 'money_eur', priority: 100 },
    ],
    keywords: [
      { keyword: 'facture', weight: 10, context: 'title' },
      { keyword: 'invoice', weight: 9, context: null },
      { keyword: 'montant', weight: 5, context: null },
      { keyword: 'ttc', weight: 6, context: null },
      { keyword: 'ht', weight: 5, context: null },
    ],
  },
  {
    code: 'RIB',
    label: 'RIB (Relevé d\'Identité Bancaire)',
    description: 'Coordonnées bancaires',
    icon: '🏦',
    order: 8,
    isSensitive: true,
    fields: [
      { name: 'iban', dataType: 'iban', isRequired: true, label: 'IBAN' },
      { name: 'bic', dataType: 'string', isRequired: false, label: 'BIC' },
      { name: 'account_holder', dataType: 'string', isRequired: true, label: 'Titulaire' },
    ],
    rules: [
      { fieldName: 'iban', pattern: '(FR\\d{2}[\\s]?\\d{4}[\\s]?\\d{4}[\\s]?\\d{4}[\\s]?\\d{4}[\\s]?\\d{4}[\\s]?\\d{2,3})', postProcess: 'iban', priority: 100 },
    ],
    keywords: [
      { keyword: 'rib', weight: 10, context: 'title' },
      { keyword: 'relevé d\'identité bancaire', weight: 10, context: 'title' },
      { keyword: 'iban', weight: 9, context: null },
      { keyword: 'bic', weight: 7, context: null },
      { keyword: 'coordonnées bancaires', weight: 8, context: null },
    ],
  },
  {
    code: 'PIECE_IDENTITE',
    label: 'Pièce d\'identité',
    description: 'Carte d\'identité, passeport, permis',
    icon: '🪪',
    order: 9,
    isSensitive: true,
    fields: [
      { name: 'id_type', dataType: 'string', isRequired: true, label: 'Type (CNI/Passeport/Permis)' },
      { name: 'id_number', dataType: 'string', isRequired: false, label: 'Numéro' },
      { name: 'expiry_date', dataType: 'date', isRequired: false, label: 'Date d\'expiration' },
    ],
    rules: [],
    keywords: [
      { keyword: 'carte d\'identité', weight: 10, context: null },
      { keyword: 'carte nationale d\'identité', weight: 10, context: null },
      { keyword: 'passeport', weight: 10, context: null },
      { keyword: 'permis de conduire', weight: 9, context: null },
      { keyword: 'identité', weight: 7, context: null },
    ],
  },
  {
    code: 'RELEVE_BANCAIRE',
    label: 'Relevé bancaire',
    description: 'Relevé de compte bancaire',
    icon: '📊',
    order: 10,
    isSensitive: true,
    fields: [
      { name: 'period_start', dataType: 'date', isRequired: false, label: 'Période début' },
      { name: 'period_end', dataType: 'date', isRequired: false, label: 'Période fin' },
    ],
    rules: [],
    keywords: [
      { keyword: 'relevé de compte', weight: 10, context: null },
      { keyword: 'relevé bancaire', weight: 10, context: null },
      { keyword: 'opérations', weight: 6, context: null },
      { keyword: 'solde', weight: 7, context: null },
    ],
  },
  {
    code: 'AVIS_IMPOSITION',
    label: 'Avis d\'imposition',
    description: 'Avis d\'imposition sur le revenu',
    icon: '📄',
    order: 11,
    fields: [
      { name: 'year', dataType: 'int', isRequired: true, label: 'Année' },
      { name: 'tax_amount', dataType: 'money', isRequired: false, label: 'Montant' },
    ],
    rules: [],
    keywords: [
      { keyword: 'avis d\'imposition', weight: 10, context: 'title' },
      { keyword: 'impôt sur le revenu', weight: 9, context: null },
      { keyword: 'revenu fiscal de référence', weight: 8, context: null },
      { keyword: 'impôts', weight: 6, context: null },
    ],
  },
  {
    code: 'AUTRE',
    label: 'Autre document',
    description: 'Document non classé',
    icon: '📎',
    order: 99,
    fields: [],
    rules: [],
    keywords: [],
  },
];

async function seed() {
  console.log('🌱 Début du seed du système de documents...\n');

  for (const typeData of documentTypesData) {
    console.log(`📁 Création du type: ${typeData.label}`);

    // Créer ou mettre à jour le type de document
    const docType = await prisma.documentType.upsert({
      where: { code: typeData.code },
      update: {
        label: typeData.label,
        description: typeData.description,
        icon: typeData.icon,
        order: typeData.order,
        isSensitive: typeData.isSensitive || false,
        isActive: true,
      },
      create: {
        code: typeData.code,
        label: typeData.label,
        description: typeData.description,
        icon: typeData.icon,
        order: typeData.order,
        isSensitive: typeData.isSensitive || false,
        isActive: true,
        isSystem: true,
      },
    });

    // Supprimer les champs, règles et mots-clés existants
    await prisma.documentKeyword.deleteMany({ where: { documentTypeId: docType.id } });
    await prisma.documentExtractionRule.deleteMany({ where: { documentTypeId: docType.id } });
    await prisma.documentTypeField.deleteMany({ where: { documentTypeId: docType.id } });

    // Créer les champs
    for (const field of typeData.fields) {
      await prisma.documentTypeField.create({
        data: {
          documentTypeId: docType.id,
          name: field.name,
          dataType: field.dataType,
          isRequired: field.isRequired,
          label: field.label,
        },
      });
    }

    // Créer les règles d'extraction
    for (const rule of typeData.rules) {
      await prisma.documentExtractionRule.create({
        data: {
          documentTypeId: docType.id,
          fieldName: rule.fieldName,
          pattern: rule.pattern,
          postProcess: rule.postProcess,
          priority: rule.priority,
        },
      });
    }

    // Créer les mots-clés
    for (const keyword of typeData.keywords) {
      await prisma.documentKeyword.create({
        data: {
          documentTypeId: docType.id,
          keyword: keyword.keyword,
          weight: keyword.weight,
          context: keyword.context,
        },
      });
    }

    console.log(`  ✓ ${typeData.fields.length} champs, ${typeData.rules.length} règles, ${typeData.keywords.length} mots-clés\n`);
  }

  console.log('✅ Seed terminé avec succès!');
  console.log(`📊 ${documentTypesData.length} types de documents créés\n`);
}

seed()
  .catch((error) => {
    console.error('❌ Erreur lors du seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

