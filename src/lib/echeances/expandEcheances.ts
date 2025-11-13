/**
 * Service d'expansion des échéances récurrentes en occurrences mensuelles
 */

import { EcheanceType, Periodicite, SensEcheance } from '@prisma/client';

export interface EcheanceRecurrenteInput {
  id: string;
  propertyId: string | null;
  leaseId: string | null;
  label: string;
  type: EcheanceType;
  periodicite: Periodicite;
  montant: number | string; // Decimal from Prisma
  recuperable: boolean;
  sens: SensEcheance;
  startAt: Date | string;
  endAt: Date | string | null;
  isActive: boolean;
}

export interface Occurrence {
  date: string; // Format: 'YYYY-MM-DD'
  type: EcheanceType;
  sens: 'DEBIT' | 'CREDIT';
  label: string;
  amount: number;
  propertyId?: string;
  leaseId?: string;
  echeanceId: string;
}

/**
 * Expande les échéances récurrentes en occurrences mensuelles pour une plage donnée
 * 
 * @param echeances Liste des échéances récurrentes
 * @param fromDate Date de début (format 'YYYY-MM')
 * @param toDate Date de fin (format 'YYYY-MM')
 * @returns Tableau d'occurrences trié par date croissante
 */
export function expandEcheances(
  echeances: EcheanceRecurrenteInput[],
  fromDate: string, // 'YYYY-MM'
  toDate: string // 'YYYY-MM'
): Occurrence[] {
  const occurrences: Occurrence[] = [];
  
  // Parser les dates de la plage
  const [fromYear, fromMonth] = fromDate.split('-').map(Number);
  const [toYear, toMonth] = toDate.split('-').map(Number);
  const fromDateObj = new Date(fromYear, fromMonth - 1, 1);
  const toDateObj = new Date(toYear, toMonth, 0, 23, 59, 59); // Dernier jour du mois

  // Filtrer les échéances actives qui peuvent générer des occurrences dans la plage
  const activeEcheances = echeances.filter(
    (e) => e.isActive && 
    new Date(e.startAt) <= toDateObj &&
    (!e.endAt || new Date(e.endAt) >= fromDateObj)
  );

  for (const echeance of activeEcheances) {
    const startDate = new Date(echeance.startAt);
    const endDate = echeance.endAt ? new Date(echeance.endAt) : null;
    const amount = typeof echeance.montant === 'string' ? parseFloat(echeance.montant) : echeance.montant;

    switch (echeance.periodicite) {
      case 'MONTHLY':
        occurrences.push(...expandMonthly(echeance, startDate, endDate, fromDateObj, toDateObj, amount));
        break;
      
      case 'QUARTERLY':
        occurrences.push(...expandQuarterly(echeance, startDate, endDate, fromDateObj, toDateObj, amount));
        break;
      
      case 'YEARLY':
        occurrences.push(...expandYearly(echeance, startDate, endDate, fromDateObj, toDateObj, amount));
        break;
      
      case 'ONCE':
        occurrences.push(...expandOnce(echeance, startDate, endDate, fromDateObj, toDateObj, amount));
        break;
    }
  }

  // Trier par date croissante
  return occurrences.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Expansion mensuelle : chaque mois entre startDate et endDate (ou infini)
 */
function expandMonthly(
  echeance: EcheanceRecurrenteInput,
  startDate: Date,
  endDate: Date | null,
  fromDate: Date,
  toDate: Date,
  amount: number
): Occurrence[] {
  const occurrences: Occurrence[] = [];
  
  // Commencer au premier jour du mois de début OU au mois suivant si startDate est après
  let currentDate = new Date(Math.max(startDate.getTime(), fromDate.getTime()));
  currentDate.setDate(1); // Premier du mois

  // Si startDate a un jour spécifique, on le conserve pour les occurrences
  const dayOfMonth = startDate.getDate();

  while (currentDate <= toDate && (!endDate || currentDate <= endDate)) {
    // Vérifier que currentDate >= startDate (première occurrence)
    if (currentDate >= startDate) {
      // Construire la date avec le jour original
      const occurrenceDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayOfMonth);
      
      // Ne pas dépasser la fin du mois si le jour n'existe pas (ex: 31 février)
      const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      occurrenceDate.setDate(Math.min(dayOfMonth, lastDayOfMonth));
      
      if (occurrenceDate >= fromDate && occurrenceDate <= toDate) {
        occurrences.push({
          date: formatDate(occurrenceDate),
          type: echeance.type,
          sens: echeance.sens,
          label: echeance.label,
          amount,
          propertyId: echeance.propertyId || undefined,
          leaseId: echeance.leaseId || undefined,
          echeanceId: echeance.id,
        });
      }
    }

    // Passer au mois suivant
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  return occurrences;
}

/**
 * Expansion trimestrielle : tous les 3 mois en conservant le mois de départ
 */
function expandQuarterly(
  echeance: EcheanceRecurrenteInput,
  startDate: Date,
  endDate: Date | null,
  fromDate: Date,
  toDate: Date,
  amount: number
): Occurrence[] {
  const occurrences: Occurrence[] = [];
  
  let currentDate = new Date(Math.max(startDate.getTime(), fromDate.getTime()));
  currentDate.setDate(1);
  
  const dayOfMonth = startDate.getDate();
  const startMonth = startDate.getMonth(); // Mois de départ (0-11)

  while (currentDate <= toDate && (!endDate || currentDate <= endDate)) {
    if (currentDate >= startDate) {
      // Vérifier que c'est bien un mois trimestriel (différence en mois = multiple de 3)
      const monthsDiff = (currentDate.getFullYear() - startDate.getFullYear()) * 12 + 
                         (currentDate.getMonth() - startMonth);
      
      if (monthsDiff >= 0 && monthsDiff % 3 === 0) {
        const occurrenceDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayOfMonth);
        const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
        occurrenceDate.setDate(Math.min(dayOfMonth, lastDayOfMonth));
        
        if (occurrenceDate >= fromDate && occurrenceDate <= toDate) {
          occurrences.push({
            date: formatDate(occurrenceDate),
            type: echeance.type,
            sens: echeance.sens,
            label: echeance.label,
            amount,
            propertyId: echeance.propertyId || undefined,
            leaseId: echeance.leaseId || undefined,
            echeanceId: echeance.id,
          });
        }
      }
    }

    // Avancer de 3 mois
    currentDate.setMonth(currentDate.getMonth() + 3);
  }

  return occurrences;
}

/**
 * Expansion annuelle : même mois/jour chaque année
 */
function expandYearly(
  echeance: EcheanceRecurrenteInput,
  startDate: Date,
  endDate: Date | null,
  fromDate: Date,
  toDate: Date,
  amount: number
): Occurrence[] {
  const occurrences: Occurrence[] = [];
  
  const dayOfMonth = startDate.getDate();
  const month = startDate.getMonth();
  let year = startDate.getFullYear();

  // Commencer à partir de l'année de fromDate si startDate est antérieur
  if (new Date(year, month, dayOfMonth) < fromDate) {
    year = fromDate.getFullYear();
  }

  while (year <= toDate.getFullYear()) {
    const occurrenceDate = new Date(year, month, dayOfMonth);
    
    // Ajuster si le jour n'existe pas (ex: 29 février)
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    if (dayOfMonth > lastDayOfMonth) {
      occurrenceDate.setDate(lastDayOfMonth);
    }
    
    if (occurrenceDate >= fromDate && occurrenceDate <= toDate && 
        occurrenceDate >= startDate && (!endDate || occurrenceDate <= endDate)) {
      occurrences.push({
        date: formatDate(occurrenceDate),
        type: echeance.type,
        sens: echeance.sens,
        label: echeance.label,
        amount,
        propertyId: echeance.propertyId || undefined,
        leaseId: echeance.leaseId || undefined,
        echeanceId: echeance.id,
      });
    }
    
    year++;
  }

  return occurrences;
}

/**
 * Expansion unique : une seule occurrence si dans la fenêtre
 */
function expandOnce(
  echeance: EcheanceRecurrenteInput,
  startDate: Date,
  endDate: Date | null,
  fromDate: Date,
  toDate: Date,
  amount: number
): Occurrence[] {
  // Si endDate est défini et avant startDate, pas d'occurrence
  if (endDate && endDate < startDate) {
    return [];
  }

  // Si startDate est dans la fenêtre, créer l'occurrence
  if (startDate >= fromDate && startDate <= toDate && (!endDate || startDate <= endDate)) {
    return [{
      date: formatDate(startDate),
      type: echeance.type,
      sens: echeance.sens,
      label: echeance.label,
      amount,
      propertyId: echeance.propertyId || undefined,
      leaseId: echeance.leaseId || undefined,
      echeanceId: echeance.id,
    }];
  }

  return [];
}

/**
 * Formate une date en 'YYYY-MM-DD'
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

