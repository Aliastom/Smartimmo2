/**
 * Seed de données de test pour les vues analytiques de l'Agent IA
 * Génère des données cohérentes pour tester les vues analytiques
 */

import { PrismaClient } from '@prisma/client';
import { addMonths, subMonths, startOfMonth } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seed des données analytiques pour l\'Agent IA...\n');

  // Nettoyage préalable (optionnel - à commenter si vous voulez garder les données existantes)
  // await prisma.transaction.deleteMany({ where: { source: 'AI_SEED' } });

  // 1. Récupérer un bien et un bail existant (ou en créer)
  let property = await prisma.property.findFirst({
    where: { isArchived: false },
  });

  if (!property) {
    console.log('⚠️  Aucun bien trouvé, création d\'un bien de test...');
    property = await prisma.property.create({
      data: {
        name: 'Appartement Test IA',
        type: 'appartement',
        address: '123 Rue de la Paix',
        postalCode: '75001',
        city: 'Paris',
        surface: 50,
        rooms: 2,
        acquisitionDate: subMonths(new Date(), 24),
        acquisitionPrice: 250000,
        notaryFees: 15000,
        currentValue: 270000,
        status: 'LOUE',
      },
    });
  }

  console.log(`✓ Bien utilisé: ${property.name} (${property.id})`);

  // 2. Récupérer un locataire ou en créer
  let tenant = await prisma.tenant.findFirst({
    where: { status: 'ACTIVE' },
  });

  if (!tenant) {
    console.log('⚠️  Aucun locataire trouvé, création d\'un locataire de test...');
    tenant = await prisma.tenant.create({
      data: {
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean.dupont.test@example.com',
        phone: '+33612345678',
        status: 'ACTIVE',
      },
    });
  }

  console.log(`✓ Locataire utilisé: ${tenant.firstName} ${tenant.lastName} (${tenant.id})`);

  // 3. Récupérer un bail actif ou en créer
  let lease = await prisma.lease.findFirst({
    where: {
      propertyId: property.id,
      status: { in: ['ACTIF', 'EN_COURS', 'SIGNE'] },
    },
  });

  if (!lease) {
    console.log('⚠️  Aucun bail actif trouvé, création d\'un bail de test...');
    lease = await prisma.lease.create({
      data: {
        propertyId: property.id,
        tenantId: tenant.id,
        type: 'vide',
        startDate: subMonths(startOfMonth(new Date()), 12), // Il y a 12 mois
        rentAmount: 800,
        deposit: 800,
        paymentDay: 5,
        status: 'ACTIF',
        indexationType: 'IRL',
      },
    });
  }

  console.log(`✓ Bail utilisé: ${lease.id} (${lease.rentAmount}€/mois)`);

  // 4. Générer des transactions pour les 6 derniers mois
  console.log('\n💰 Génération des transactions...');

  const transactionsToCreate = [];
  const now = new Date();

  for (let i = 0; i < 6; i++) {
    const monthDate = subMonths(startOfMonth(now), i);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth() + 1;

    // Loyer encaissé (crédit)
    transactionsToCreate.push({
      propertyId: property.id,
      leaseId: lease.id,
      label: `Loyer ${monthDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}`,
      amount: lease.rentAmount,
      date: new Date(year, month - 1, 5), // 5ème jour du mois
      paidAt: new Date(year, month - 1, 5), // Payé le même jour
      nature: 'LOYER',
      source: 'AI_SEED',
      year,
      month,
    });

    // Charges diverses (débit) - toutes les 2 mois
    if (i % 2 === 0) {
      transactionsToCreate.push({
        propertyId: property.id,
        label: `Charges copropriété ${monthDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}`,
        amount: -150,
        date: new Date(year, month - 1, 15),
        paidAt: new Date(year, month - 1, 15),
        nature: 'CHARGE_COPRO',
        source: 'AI_SEED',
        year,
        month,
      });
    }

    // Taxe foncière (une fois)
    if (i === 3) {
      transactionsToCreate.push({
        propertyId: property.id,
        label: `Taxe foncière ${year}`,
        amount: -800,
        date: new Date(year, 9, 15), // Octobre
        paidAt: new Date(year, 9, 15),
        nature: 'IMPOT',
        source: 'AI_SEED',
        year,
        month: 10,
      });
    }
  }

  // Loyer du mois en cours NON PAYÉ (pour vw_rent_due)
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  transactionsToCreate.push({
    propertyId: property.id,
    leaseId: lease.id,
    label: `Loyer ${now.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })} (EN ATTENTE)`,
    amount: lease.rentAmount,
    date: new Date(currentYear, currentMonth - 1, 5),
    paidAt: null, // NON PAYÉ
    nature: 'LOYER',
    source: 'AI_SEED',
    year: currentYear,
    month: currentMonth,
  });

  await prisma.transaction.createMany({
    data: transactionsToCreate,
    skipDuplicates: true,
  });

  console.log(`✓ ${transactionsToCreate.length} transactions créées`);

  // 5. Créer un prêt pour tester vw_loan_status
  console.log('\n🏦 Génération des prêts...');

  const existingLoan = await prisma.loan.findFirst({
    where: { propertyId: property.id },
  });

  if (!existingLoan) {
    await prisma.loan.create({
      data: {
        propertyId: property.id,
        label: 'Prêt immobilier principal',
        principal: 200000,
        annualRatePct: 1.5,
        durationMonths: 240, // 20 ans
        defermentMonths: 0,
        insurancePct: 0.36,
        startDate: subMonths(new Date(), 24), // Commencé il y a 2 ans
        endDate: addMonths(new Date(), 216), // Fin dans 18 ans
        rateType: 'FIXED',
        isActive: true,
      },
    });
    console.log('✓ 1 prêt créé');
  } else {
    console.log('✓ Prêt existant trouvé, ignoré');
  }

  // 6. Créer des types de documents requis pour vw_docs_status
  console.log('\n📄 Génération des types de documents...');

  const docTypes = [
    { code: 'releve_proprio', label: 'Relevé propriétaire', isRequired: true, scope: 'global' },
    { code: 'releve_banque', label: 'Relevé bancaire', isRequired: true, scope: 'global' },
  ];

  for (const dt of docTypes) {
    await prisma.documentType.upsert({
      where: { code: dt.code },
      create: dt,
      update: {},
    });
  }

  console.log(`✓ ${docTypes.length} types de documents créés/vérifiés`);

  // 7. Créer quelques documents pour tester vw_docs_status
  console.log('\n📎 Génération de documents de test...');

  const releveProprioType = await prisma.documentType.findUnique({
    where: { code: 'releve_proprio' },
  });

  if (releveProprioType) {
    // Document pour le mois dernier (présent)
    const lastMonth = subMonths(now, 1);
    await prisma.document.upsert({
      where: {
        fileSha256: 'ai_seed_releve_proprio_last_month',
      },
      create: {
        bucketKey: 'test/releve_proprio_last_month.pdf',
        filenameOriginal: 'releve_proprio_last_month.pdf',
        fileName: 'releve_proprio_last_month.pdf',
        mime: 'application/pdf',
        size: 1024,
        url: '/uploads/test/releve_proprio_last_month.pdf',
        fileSha256: 'ai_seed_releve_proprio_last_month',
        documentTypeId: releveProprioType.id,
        uploadedAt: lastMonth,
        ocrStatus: 'completed',
        status: 'finalized',
      },
      update: {},
    });

    console.log('✓ Documents de test créés');
  }

  console.log('\n✅ Seed terminé avec succès !\n');
  console.log('📊 Vous pouvez maintenant tester les vues analytiques :');
  console.log('   - vw_cashflow_month');
  console.log('   - vw_rent_due');
  console.log('   - vw_loan_status');
  console.log('   - vw_indexations_upcoming');
  console.log('   - vw_docs_status');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

