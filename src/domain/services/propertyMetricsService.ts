import { prisma } from '@/lib/prisma';

export interface PropertyMetrics {
  statut: string;
  valeurMarche: number;
  crd: number; // Capital restant dû
  fraisSortie: number;
  equity: number;
  rendementBrut: number;
  capRate: number;
  tauxOccupation: number;
}

export interface PortfolioSummary {
  patrimoineBrut: number;
  dettes: number;
  patrimoineNet: number;
  ltv: number;
  cashflowAnnuel: number;
  repartitions: {
    parVille: Record<string, { nombre: number; valeur: number }>;
    parType: Record<string, { nombre: number; valeur: number }>;
    parOccupation: Record<string, { nombre: number; valeur: number }>;
  };
  biens: Array<{
    id: string;
    name: string;
    valeurMarche: number;
    crd: number;
    equity: number;
    rendementBrut: number;
    capRate: number;
    tauxOccupation: number;
  }>;
}

/**
 * Calcule le statut d'un bien en fonction de son mode et de ses baux
 */
export async function computePropertyStatus(propertyId: string): Promise<string> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      statusMode: true,
      statusManual: true,
      occupation: true,
      Lease: {
        where: {
          status: { in: ['ACTIF', 'SIGNÉ'] }
        },
        select: { id: true }
      }
    }
  });

  if (!property) throw new Error(`Property ${propertyId} not found`);

  // Mode MANUAL → retourner statusManual
  if (property.statusMode === 'MANUAL' && property.statusManual) {
    return property.statusManual;
  }

  // Mode AUTO → calculer en fonction de l'occupation et des baux
  if (['PRINCIPALE', 'SECONDAIRE', 'USAGE_PRO'].includes(property.occupation)) {
    return 'occupied_owner';
  }

  if (property.occupation === 'LOCATIF') {
    return property.Lease.length > 0 ? 'rented' : 'vacant';
  }

  return 'vacant';
}

/**
 * Calcule les métriques complètes d'un bien
 */
export async function computePropertyMetrics(
  propertyId: string,
  defaultExitFeesRate: number = 0.07
): Promise<PropertyMetrics> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      Loan: {
        where: { status: 'active' },
        select: { remainingCapital: true, monthlyPayment: true, interestRate: true }
      },
      Lease: {
        where: { status: { in: ['ACTIF', 'SIGNÉ'] } },
        select: { rentAmount: true, chargesRecupMensuelles: true, chargesNonRecupMensuelles: true, startDate: true, endDate: true }
      },
      Payment: {
        where: {
          nature: { in: ['LOYER', 'CHARGES'] },
          date: {
            gte: new Date(new Date().getFullYear(), 0, 1), // Début d'année
            lte: new Date()
          }
        },
        select: { amount: true, nature: true }
      }
    }
  });

  if (!property) throw new Error(`Property ${propertyId} not found`);

  const statut = await computePropertyStatus(propertyId);
  const valeurMarche = property.currentValue;
  const crd = property.Loan.reduce((sum, loan) => sum + loan.remainingCapital, 0);
  const exitFeesRate = property.exitFeesRate ?? defaultExitFeesRate;
  const fraisSortie = valeurMarche * exitFeesRate;
  const equity = valeurMarche - crd - fraisSortie;

  // Rendement brut annuel = (loyers HC annuels) / valeur marché
  const loyersAnnuels = property.Lease.reduce((sum, lease) => {
    return sum + (lease.rentAmount * 12);
  }, 0);
  const rendementBrut = valeurMarche > 0 ? (loyersAnnuels / valeurMarche) * 100 : 0;

  // Cap rate (approx) = NOI / valeur marché
  // NOI simplifié = loyers encaissés - charges non récup (on approxime)
  const loyersEncaisses = property.payments
    .filter(p => p.nature === 'LOYER')
    .reduce((sum, p) => sum + p.amount, 0);
  const chargesPayees = property.payments
    .filter(p => p.nature === 'CHARGES')
    .reduce((sum, p) => sum + p.amount, 0);
  const noi = loyersEncaisses - chargesPayees;
  const capRate = valeurMarche > 0 ? (noi / valeurMarche) * 100 : 0;

  // Taux d'occupation (approx) = % de mois avec encaissements / 12
  const currentYear = new Date().getFullYear();
  const monthsWithRent = new Set(
    property.payments
      .filter(p => p.nature === 'LOYER')
      .map(p => new Date(p.date).getMonth())
  ).size;
  const tauxOccupation = (monthsWithRent / 12) * 100;

  return {
    statut,
    valeurMarche,
    crd,
    fraisSortie,
    equity,
    rendementBrut,
    capRate,
    tauxOccupation
  };
}

/**
 * Calcule le résumé du portefeuille complet
 */
export async function computePortfolioSummary(
  defaultExitFeesRate: number = 0.07
): Promise<PortfolioSummary> {
  const properties = await prisma.property.findMany({
    include: {
      Loan: {
        where: { status: 'active' },
        select: { remainingCapital: true, monthlyPayment: true }
      },
      Lease: {
        where: { status: { in: ['ACTIF', 'SIGNÉ'] } },
        select: { rentAmount: true, chargesRecupMensuelles: true, chargesNonRecupMensuelles: true }
      },
      Payment: {
        where: {
          date: {
            gte: new Date(new Date().getFullYear(), 0, 1),
            lte: new Date()
          }
        },
        select: { amount: true, nature: true }
      }
    }
  });

  let patrimoineBrut = 0;
  let dettesTotales = 0;
  let fraisSortieTotaux = 0;
  let cashflowAnnuel = 0;

  const repartitions = {
    parVille: {} as Record<string, { nombre: number; valeur: number }>,
    parType: {} as Record<string, { nombre: number; valeur: number }>,
    parOccupation: {} as Record<string, { nombre: number; valeur: number }>
  };

  const biens: PortfolioSummary['biens'] = [];

  for (const property of properties) {
    const valeurMarche = property.currentValue;
    const crd = property.Loan.reduce((sum, loan) => sum + loan.remainingCapital, 0);
    const exitFeesRate = property.exitFeesRate ?? defaultExitFeesRate;
    const fraisSortie = valeurMarche * exitFeesRate;
    const equity = valeurMarche - crd - fraisSortie;

    patrimoineBrut += valeurMarche;
    dettesTotales += crd;
    fraisSortieTotaux += fraisSortie;

    // Cashflow = loyers encaissés - mensualités
    const loyersEncaisses = property.payments
      .filter(p => p.nature === 'LOYER')
      .reduce((sum, p) => sum + p.amount, 0);
    const mensualites = property.Loan.reduce((sum, loan) => sum + (loan.monthlyPayment * 12), 0);
    cashflowAnnuel += loyersEncaisses - mensualites;

    // Rendement brut
    const loyersAnnuels = property.Lease.reduce((sum, lease) => sum + (lease.rentAmount * 12), 0);
    const rendementBrut = valeurMarche > 0 ? (loyersAnnuels / valeurMarche) * 100 : 0;

    // Cap rate (simplifié)
    const chargesPayees = property.payments
      .filter(p => p.nature === 'CHARGES')
      .reduce((sum, p) => sum + p.amount, 0);
    const noi = loyersEncaisses - chargesPayees;
    const capRate = valeurMarche > 0 ? (noi / valeurMarche) * 100 : 0;

    // Taux d'occupation
    const monthsWithRent = new Set(
      property.payments
        .filter(p => p.nature === 'LOYER')
        .map(p => new Date(p.date).getMonth())
    ).size;
    const tauxOccupation = (monthsWithRent / 12) * 100;

    biens.push({
      id: property.id,
      name: property.name,
      valeurMarche,
      crd,
      equity,
      rendementBrut,
      capRate,
      tauxOccupation
    });

    // Répartitions
    if (!repartitions.parVille[property.city]) {
      repartitions.parVille[property.city] = { nombre: 0, valeur: 0 };
    }
    repartitions.parVille[property.city].nombre++;
    repartitions.parVille[property.city].valeur += valeurMarche;

    if (!repartitions.parType[property.type]) {
      repartitions.parType[property.type] = { nombre: 0, valeur: 0 };
    }
    repartitions.parType[property.type].nombre++;
    repartitions.parType[property.type].valeur += valeurMarche;

    if (!repartitions.parOccupation[property.occupation]) {
      repartitions.parOccupation[property.occupation] = { nombre: 0, valeur: 0 };
    }
    repartitions.parOccupation[property.occupation].nombre++;
    repartitions.parOccupation[property.occupation].valeur += valeurMarche;
  }

  const patrimoineNet = patrimoineBrut - dettesTotales - fraisSortieTotaux;
  const ltv = patrimoineBrut > 0 ? (dettesTotales / patrimoineBrut) * 100 : 0;

  return {
    patrimoineBrut,
    dettes: dettesTotales,
    patrimoineNet,
    ltv,
    cashflowAnnuel,
    repartitions,
    biens
  };
}

