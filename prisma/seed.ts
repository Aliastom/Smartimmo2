import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Start seeding...');

  // Clear existing data
  await prisma.document.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.echeanceRecurrente.deleteMany();
  await prisma.lease.deleteMany();
  await prisma.loan.deleteMany();
  await prisma.property.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.category.deleteMany();
  await prisma.taxConfig.deleteMany();

  // Categories
  const categoryLoyer = await prisma.category.create({
    data: {
      slug: 'loyer',
      label: 'Loyer',
      type: 'REVENU',
      deductible: false,
      capitalizable: false,
      system: true,
      actif: true,
    },
  });

  const categorySubvention = await prisma.category.create({
    data: {
      slug: 'subvention',
      label: 'Subvention',
      type: 'income',
      deductible: false,
      capitalizable: false,
      system: false,
      actif: true,
    },
  });

  const categoryTaxeFonciere = await prisma.category.create({
    data: {
      slug: 'taxe-fonciere',
      label: 'Taxe foncière',
      type: 'expense',
      deductible: true,
      capitalizable: false,
      system: false,
      actif: true,
    },
  });

  const categoryAssurance = await prisma.category.create({
    data: {
      slug: 'assurance',
      label: 'Assurance',
      type: 'expense',
      deductible: true,
      capitalizable: false,
      system: false,
      actif: true,
    },
  });

  const categoryTravaux = await prisma.category.create({
    data: {
      slug: 'travaux',
      label: 'Travaux',
      type: 'expense',
      deductible: true,
      capitalizable: true,
      system: false,
      actif: true,
    },
  });

  const categoryGestion = await prisma.category.create({
    data: {
      slug: 'gestion',
      label: 'Gestion',
      type: 'expense',
      deductible: true,
      capitalizable: false,
      system: false,
      actif: true,
    },
  });

  // Properties
  const house = await prisma.property.create({
    data: {
      name: 'Villa Familiale',
      type: 'house',
      address: '123 rue de la Paix',
      postalCode: '75001',
      city: 'Paris',
      surface: 120,
      rooms: 5,
      acquisitionDate: new Date('2020-03-15'),
      acquisitionPrice: 450000,
      notaryFees: 35000,
      currentValue: 500000,
      status: 'rented',
    },
  });

  const apartment = await prisma.property.create({
    data: {
      name: 'Appartement Centre Ville',
      type: 'apartment',
      address: '45 avenue des Champs-Élysées',
      postalCode: '75008',
      city: 'Paris',
      surface: 65,
      rooms: 3,
      acquisitionDate: new Date('2022-09-01'),
      acquisitionPrice: 380000,
      notaryFees: 28000,
      currentValue: 400000,
      status: 'rented',
    },
  });

  const garage = await prisma.property.create({
    data: {
      name: 'Garage Parking Sécurisé',
      type: 'garage',
      address: '12 rue du Parking',
      postalCode: '69001',
      city: 'Lyon',
      surface: 15,
      rooms: 0,
      acquisitionDate: new Date('2021-06-10'),
      acquisitionPrice: 25000,
      notaryFees: 3000,
      currentValue: 30000,
      status: 'vacant',
    },
  });

  // Tenants
  const tenant1 = await prisma.tenant.create({
    data: {
      firstName: 'Dupont',
      lastName: 'Famille',
      email: 'dupont.famille@example.com',
      birthDate: new Date('1985-01-01'),
    },
  });

  const tenant2 = await prisma.tenant.create({
    data: {
      firstName: 'Pierre',
      lastName: 'Martin',
      email: 'pierre.martin@example.com',
      birthDate: new Date('1990-05-10'),
    },
  });

  // Leases
  const lease1 = await prisma.lease.create({
    data: {
      propertyId: house.id,
      tenantId: tenant1.id,
      type: 'residential',
      startDate: new Date('2023-01-01'),
      rentAmount: 2200,
      chargesRecupMensuelles: 150,
      deposit: 4400,
      paymentDay: 5,
      notes: 'Bail résidentiel',
      status: 'ACTIF',
    },
  });

  const lease2 = await prisma.lease.create({
    data: {
      propertyId: apartment.id,
      tenantId: tenant2.id,
      type: 'residential',
      startDate: new Date('2022-09-15'),
      rentAmount: 1800,
      chargesRecupMensuelles: 100,
      deposit: 3600,
      paymentDay: 15,
      notes: 'Bail meublé',
      status: 'ACTIF',
    },
  });

  // Loans
  const loan1 = await prisma.loan.create({
    data: {
      propertyId: house.id,
      label: 'Prêt Crédit Agricole',
      principal: 320000,
      annualRatePct: 1.35,
      durationMonths: 240,
      defermentMonths: 0,
      insurancePct: 0.15,
      startDate: new Date('2020-03-15'),
      rateType: 'FIXED',
      isActive: true,
    },
  });

  // Échéances récurrentes
  const currentYear = new Date().getFullYear();
  
  // Prêt mensuel (lié au bien house)
  await prisma.echeanceRecurrente.create({
    data: {
      propertyId: house.id,
      label: 'Mensualité prêt immobilier',
      type: 'PRET',
      periodicite: 'MONTHLY',
      montant: 650,
      recuperable: false,
      sens: 'DEBIT',
      startAt: new Date(`${currentYear}-01-01`),
      isActive: true,
    },
  });

  // Copropriété mensuelle (house)
  await prisma.echeanceRecurrente.create({
    data: {
      propertyId: house.id,
      label: 'Charges de copropriété',
      type: 'COPRO',
      periodicite: 'MONTHLY',
      montant: 90,
      recuperable: false,
      sens: 'DEBIT',
      startAt: new Date(`${currentYear}-01-05`),
      isActive: true,
    },
  });

  // Copropriété mensuelle (apartment)
  await prisma.echeanceRecurrente.create({
    data: {
      propertyId: apartment.id,
      label: 'Charges de copropriété',
      type: 'COPRO',
      periodicite: 'MONTHLY',
      montant: 120,
      recuperable: false,
      sens: 'DEBIT',
      startAt: new Date(`${currentYear}-01-05`),
      isActive: true,
    },
  });

  // PNO annuelle (house)
  await prisma.echeanceRecurrente.create({
    data: {
      propertyId: house.id,
      label: 'Assurance PNO',
      type: 'PNO',
      periodicite: 'YEARLY',
      montant: 120,
      recuperable: false,
      sens: 'DEBIT',
      startAt: new Date(`${currentYear}-01-20`),
      isActive: true,
    },
  });

  // CFE annuelle (house)
  await prisma.echeanceRecurrente.create({
    data: {
      propertyId: house.id,
      label: 'Contribution Foncière des Entreprises',
      type: 'CFE',
      periodicite: 'YEARLY',
      montant: 200,
      recuperable: false,
      sens: 'DEBIT',
      startAt: new Date(`${currentYear}-12-15`),
      isActive: true,
    },
  });

  // Transactions (12 months of rents + some expenses)
  const today = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 10);

    // Rents for house
    await prisma.transaction.create({
      data: {
        propertyId: house.id,
        leaseId: lease1.id,
        categoryId: categoryLoyer.id,
        label: `Loyer ${date.toLocaleString('fr-FR', { month: 'short', year: 'numeric' })} - ${house.name}`,
        amount: lease1.rentAmount + (lease1.chargesRecupMensuelles || 0),
        date: date,
        paidAt: date,
        nature: 'LOYER',
      },
    });

    // Rents for apartment
    await prisma.transaction.create({
      data: {
        propertyId: apartment.id,
        leaseId: lease2.id,
        categoryId: categoryLoyer.id,
        label: `Loyer ${date.toLocaleString('fr-FR', { month: 'short', year: 'numeric' })} - ${apartment.name}`,
        amount: lease2.rentAmount + (lease2.chargesRecupMensuelles || 0),
        date: date,
        paidAt: date,
        nature: 'LOYER',
      },
    });

    // Example expenses for house
    if (i % 3 === 0) {
      await prisma.transaction.create({
        data: {
          propertyId: house.id,
          label: 'Entretien jardin',
          amount: 80,
          date: date,
          categoryId: categoryTravaux.id,
        },
      });
    }
  }

  // Annual expenses
  await prisma.transaction.create({
    data: {
      propertyId: house.id,
      label: 'Taxe foncière',
      amount: 1200,
      date: new Date(today.getFullYear(), 9, 15),
      categoryId: categoryTaxeFonciere.id,
    },
  });

  await prisma.transaction.create({
    data: {
      propertyId: apartment.id,
      label: 'Assurance PNO',
      amount: 480,
      date: new Date(today.getFullYear(), 1, 20),
      categoryId: categoryAssurance.id,
    },
  });

  // Additional Tenants
  const tenant3 = await prisma.tenant.create({
    data: {
      firstName: 'Marie',
      lastName: 'Dupont',
      email: 'marie.dupont@email.com',
      phone: '0123456789',
      birthDate: new Date('1985-03-15'),
      nationality: 'Française',
    },
  });

  const tenant4 = await prisma.tenant.create({
    data: {
      firstName: 'Pierre',
      lastName: 'Martin',
      email: 'pierre.martin@email.com',
      phone: '0987654321',
      birthDate: new Date('1990-07-22'),
      nationality: 'Française',
    },
  });

  // Active lease
  const lease = await prisma.lease.create({
    data: {
      propertyId: house.id,
      tenantId: tenant3.id,
      type: 'residential',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      rentAmount: 1200,
      chargesRecupMensuelles: 150,
      deposit: 2400,
      indexationType: 'insee',
      paymentDay: 1,
      status: 'ACTIF',
    },
  });

  // Sample documents
  await prisma.document.create({
    data: {
      bucketKey: 'docs/contrat-location.pdf',
      filenameOriginal: 'contrat-location.pdf',
      fileName: 'contrat-location.pdf',
      mime: 'application/pdf',
      url: '/uploads/contrat-location.pdf',
      size: 245760,
      propertyId: house.id,
      status: 'completed',
      ocrStatus: 'pending',
    },
  });

  await prisma.document.create({
    data: {
      fileName: 'quittance-janvier.pdf',
      mime: 'application/pdf',
      url: '/uploads/quittance-janvier.pdf',
      size: 128000,
      transactionId: null,
    },
  });

  // Tax config placeholder
  await prisma.taxConfig.create({
    data: {
      year: 2025,
      json: JSON.stringify({
        barème_ir: {
          parts: "[À VALIDER]",
          tranches: [
            { min: 0, max: 11394, taux: 0.0 },
            { min: 11395, max: 29008, taux: 0.11 },
            { min: 29009, max: 82964, taux: 0.30 },
            { min: 82965, max: 177403, taux: 0.41 },
            { min: 177404, max: null, taux: 0.45 }
          ]
        },
        decote: {
          celibataire: { seuil: 1964, forfait: 889 },
          couple: { seuil: 3054, forfait: 1486 }
        },
        prelevements_sociaux: 0.172,
        micro_foncier_seuil: 15000,
        placeholders: "[À VALIDER]"
      }),
    },
  });

  console.log('Seeding finished.');
}

main().finally(async () => {
  await prisma.$disconnect()
})
