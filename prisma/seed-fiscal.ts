/**
 * Seed pour initialiser les données fiscales de base
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Initialisation des données fiscales...');

  // ==================== TYPES FISCAUX ====================
  
  const types = [
    {
      id: 'NU',
      label: 'Location nue (non meublée)',
      category: 'FONCIER',
      description: 'Location vide classique soumise aux revenus fonciers',
      isActive: true,
    },
    {
      id: 'MEUBLE',
      label: 'Location meublée (LMNP/LMP)',
      category: 'BIC',
      description: 'Location meublée soumise aux Bénéfices Industriels et Commerciaux',
      isActive: true,
    },
    {
      id: 'SCI_IS',
      label: 'SCI à l\'Impôt sur les Sociétés',
      category: 'IS',
      description: 'Société soumise à l\'IS avec comptabilité commerciale',
      isActive: true,
    },
  ];

  for (const type of types) {
    await prisma.fiscalType.upsert({
      where: { id: type.id },
      update: type,
      create: type,
    });
    console.log(`✅ Type fiscal créé: ${type.label}`);
  }

  // ==================== RÉGIMES FISCAUX ====================

  const regimes = [
    {
      id: 'MICRO',
      label: 'Micro-foncier',
      appliesToIds: JSON.stringify(['NU']),
      calcProfile: 'micro_foncier',
      description: 'Abattement forfaitaire de 30% sur les revenus fonciers (plafonné à 15 000€)',
      isActive: true,
    },
    {
      id: 'REEL',
      label: 'Régime réel (foncier)',
      appliesToIds: JSON.stringify(['NU']),
      engagementYears: 3,
      calcProfile: 'reel_foncier',
      description: 'Déduction des charges réelles. Engagement 3 ans.',
      isActive: true,
    },
    {
      id: 'MICRO_BIC',
      label: 'Micro-BIC',
      appliesToIds: JSON.stringify(['MEUBLE']),
      calcProfile: 'micro_bic',
      description: 'Abattement forfaitaire de 50% (ou 71% pour meublés tourisme classés)',
      isActive: true,
    },
    {
      id: 'REEL_SIMPLIFIE',
      label: 'Régime réel simplifié (BIC)',
      appliesToIds: JSON.stringify(['MEUBLE']),
      engagementYears: 2,
      calcProfile: 'reel_bic',
      description: 'Déduction des charges réelles + amortissements. Engagement 2 ans.',
      isActive: true,
    },
    {
      id: 'IS_NORMAL',
      label: 'IS au taux normal',
      appliesToIds: JSON.stringify(['SCI_IS']),
      calcProfile: 'is_normal',
      description: 'Imposition au taux normal de l\'IS (15% puis 25%)',
      isActive: true,
    },
  ];

  for (const regime of regimes) {
    await prisma.fiscalRegime.upsert({
      where: { id: regime.id },
      update: regime,
      create: regime,
    });
    console.log(`✅ Régime fiscal créé: ${regime.label}`);
  }

  // ==================== COMPATIBILITÉS ====================

  const compatibilities = [
    {
      scope: 'category',
      left: 'FONCIER',
      right: 'BIC',
      rule: 'CAN_MIX',
      note: 'Un investisseur peut avoir simultanément du foncier NU et du meublé (BIC)',
    },
    {
      scope: 'category',
      left: 'FONCIER',
      right: 'IS',
      rule: 'MUTUALLY_EXCLUSIVE',
      note: 'Une SCI à l\'IS ne peut pas générer de revenus fonciers IR',
    },
    {
      scope: 'category',
      left: 'BIC',
      right: 'IS',
      rule: 'MUTUALLY_EXCLUSIVE',
      note: 'Une SCI à l\'IS ne peut pas générer de revenus BIC',
    },
  ];

  for (const compat of compatibilities) {
    // Vérifier si existe déjà
    const existing = await prisma.fiscalCompatibility.findFirst({
      where: {
        scope: compat.scope,
        left: compat.left,
        right: compat.right,
      },
    });

    if (!existing) {
      await prisma.fiscalCompatibility.create({
        data: compat,
      });
      console.log(`✅ Compatibilité créée: ${compat.left} <-> ${compat.right} (${compat.rule})`);
    }
  }

  // ==================== VERSION FISCALE INITIALE ====================

  // Vérifier s'il existe déjà une version pour 2025
  const existingVersion = await prisma.fiscalVersion.findFirst({
    where: { year: 2025 },
  });

  if (!existingVersion) {
    const fiscalParams = {
      version: '2025.1',
      year: 2025,
      irBrackets: [
        { lower: 0, upper: 11294, rate: 0 },
        { lower: 11294, upper: 28797, rate: 0.11 },
        { lower: 28797, upper: 82341, rate: 0.30 },
        { lower: 82341, upper: 177106, rate: 0.41 },
        { lower: 177106, upper: null, rate: 0.45 },
      ],
      irDecote: {
        threshold: 1929,
      },
      psRate: 0.172,
      micro: {
        foncierAbattement: 0.30,
        foncierPlafond: 15000,
        bicAbattement: 0.50,
        bicPlafond: 77700,
        meubleTourismeAbattement: 0.71,
        meubleTourismePlafond: 188700,
      },
      deficitFoncier: {
        plafondImputationRevenuGlobal: 10700,
        dureeReport: 10,
      },
      per: {
        tauxPlafond: 0.10,
        plancherLegal: 4399,
        dureeReportReliquats: 3,
      },
      lmp: {
        recettesMin: 23000,
        tauxRecettesProMin: 0.50,
        inscriptionRCSObligatoire: true,
      },
      sciIS: {
        tauxReduit: 0.15,
        plafondTauxReduit: 42500,
        tauxNormal: 0.25,
      },
      source: 'DGFiP 2025 (valeurs officielles)',
    };

    const version = await prisma.fiscalVersion.create({
      data: {
        code: '2025.1',
        year: 2025,
        source: 'DGFiP 2025',
        status: 'published',
        validatedBy: 'system',
        notes: 'Version initiale 2025 - Barèmes officiels',
        params: {
          create: {
            jsonData: JSON.stringify(fiscalParams),
          },
        },
      },
    });

    console.log(`✅ Version fiscale 2025.1 créée et publiée`);
  } else {
    console.log(`ℹ️  Version fiscale 2025 déjà existante`);
  }

  console.log('\n✨ Initialisation terminée !');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

