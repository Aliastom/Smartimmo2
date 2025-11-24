/**
 * Service d'import CSV Airbnb
 * 
 * Traite les exports CSV Airbnb et crée les transactions comptables correspondantes.
 * Pour chaque réservation, crée :
 * - 1 transaction MÈRE (loyer brut)
 * - 2 transactions FILLES (frais de service Airbnb + frais de ménage conciergerie)
 */

import { prisma } from '@/lib/prisma';
import { getGestionCodes } from '@/lib/settings/appSettings';
import { parse } from 'csv-parse/sync';

export interface AirbnbReservationRow {
  Type: string;
  'Code de confirmation': string;
  'Date de réservation': string;
  'Date de début': string;
  'Date de fin': string;
  Nuits: string;
  Voyageur: string;
  'Revenus bruts': string;
  'Frais de service': string;
  'Frais de ménage': string;
  'Taxes de séjour': string;
  Montant: string;
  Devise: string;
}

export interface ImportResult {
  success: boolean;
  reservationsProcessed: number;
  transactionsCreated: number;
  transactionsUpdated: number;
  errors: string[];
  period?: {
    from: Date;
    to: Date;
  };
}

export interface PreviewReservation {
  confirmationCode: string;
  guest: string;
  startDate: string;
  endDate: string;
  nights: number;
  grossRevenue: number;
  serviceFee: number;
  cleaningFee: number;
  transactionDate: string;
  transactionLabel: string;
  errors?: string[];
}

export interface PreviewResult {
  reservations: PreviewReservation[];
  errors: string[];
  totalReservations: number;
  totalGrossRevenue: number;
  totalServiceFee: number;
  totalCleaningFee: number;
  period?: {
    from: string;
    to: string;
  };
}

/**
 * Parse un fichier CSV Airbnb et retourne les lignes de réservation
 */
export function parseAirbnbCSV(csvContent: string): AirbnbReservationRow[] {
  try {
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true, // Gérer les BOM UTF-8
    }) as AirbnbReservationRow[];

    // Filtrer uniquement les lignes de type "Réservation"
    return records.filter((row) => {
      const type = row.Type?.trim();
      return type === 'Réservation' || type === 'Reservation';
    });
  } catch (error) {
    throw new Error(`Erreur lors du parsing du CSV: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }
}

/**
 * Convertit une date au format français (DD/MM/YYYY), américain (MM/DD/YYYY) ou ISO en Date
 * 
 * Airbnb utilise le format américain MM/DD/YYYY dans ses exports CSV.
 * Exemple: "11/14/2025" = 14 novembre 2025 (MM/DD/YYYY)
 */
function parseDate(dateStr: string): Date {
  if (!dateStr) {
    throw new Error('Date vide');
  }

  // Nettoyer la chaîne (supprimer les espaces)
  const cleaned = dateStr.trim();

  // Essayer le format ISO d'abord (YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss)
  if (cleaned.includes('T') || cleaned.match(/^\d{4}-\d{2}-\d{2}/)) {
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Essayer le format avec slash (peut être DD/MM/YYYY ou MM/DD/YYYY)
  const slashParts = cleaned.split('/');
  if (slashParts.length === 3) {
    const part1 = parseInt(slashParts[0], 10);
    const part2 = parseInt(slashParts[1], 10);
    const year = parseInt(slashParts[2], 10);
    
    if (isNaN(part1) || isNaN(part2) || isNaN(year)) {
      throw new Error(`Date invalide: ${dateStr}`);
    }
    
    // Détection automatique du format pour Airbnb CSV :
    // Les exports Airbnb utilisent toujours MM/DD/YYYY (format américain)
    // Exemple: "11/14/2025" = mois 11, jour 14, année 2025 = 14 novembre 2025
    let parsedDate: Date;
    
    if (part1 > 12) {
      // Si part1 > 12, c'est forcément le jour → format français DD/MM/YYYY
      parsedDate = new Date(year, part2 - 1, part1);
    } else if (part2 > 12) {
      // Si part2 > 12, c'est forcément le jour → format américain MM/DD/YYYY
      parsedDate = new Date(year, part1 - 1, part2);
    } else {
      // Ambiguïté (ex: 05/06/2025) : on suppose format américain MM/DD/YYYY pour Airbnb
      // Essayer d'abord format américain (MM/DD/YYYY)
      parsedDate = new Date(year, part1 - 1, part2);
      
      // Vérifier la validité : si l'année ne correspond pas, essayer l'autre format
      if (parsedDate.getFullYear() !== year || parsedDate.getMonth() !== part1 - 1 || parsedDate.getDate() !== part2) {
        // Essayer format français
        const altDate = new Date(year, part2 - 1, part1);
        if (altDate.getFullYear() === year && altDate.getMonth() === part2 - 1 && altDate.getDate() === part1) {
          parsedDate = altDate;
        }
      }
    }
    
    // Vérifier que la date est valide
    if (isNaN(parsedDate.getTime())) {
      throw new Error(`Date invalide après parsing: ${dateStr}`);
    }
    
    // Vérification finale : s'assurer que l'année est correcte
    const finalYear = parsedDate.getFullYear();
    const finalMonth = parsedDate.getMonth() + 1;
    const finalDay = parsedDate.getDate();
    
    // Si l'année ne correspond pas, il y a eu une erreur de parsing
    if (finalYear !== year) {
      // Essayer le format alternatif
      const altDate = new Date(year, part2 - 1, part1);
      if (!isNaN(altDate.getTime()) && altDate.getFullYear() === year) {
        return altDate;
      }
      throw new Error(`Année incohérente après parsing de: ${dateStr} (année attendue: ${year}, obtenue: ${finalYear})`);
    }
    
    return parsedDate;
  }

  // Essayer le format YYYY-MM-DD avec tirets
  const dashParts = cleaned.split('-');
  if (dashParts.length === 3 && dashParts[0].length === 4) {
    const year = parseInt(dashParts[0], 10);
    const month = parseInt(dashParts[1], 10) - 1;
    const day = parseInt(dashParts[2], 10);
    
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      throw new Error(`Date invalide: ${dateStr}`);
    }
    
    const date = new Date(year, month, day);
    if (isNaN(date.getTime())) {
      throw new Error(`Date invalide après parsing: ${dateStr}`);
    }
    return date;
  }

  throw new Error(`Format de date non reconnu: ${dateStr}`);
}

/**
 * Convertit un montant string en nombre (gère les virgules et espaces)
 */
function parseAmount(amountStr: string): number {
  if (!amountStr) return 0;
  
  // Remplacer les virgules par des points et supprimer les espaces
  const cleaned = amountStr.replace(/,/g, '.').replace(/\s/g, '');
  const parsed = parseFloat(cleaned);
  
  if (isNaN(parsed)) {
    return 0;
  }
  
  return parsed;
}

/**
 * Génère le label d'une transaction Airbnb
 */
function generateTransactionLabel(
  type: 'PARENT' | 'FEE' | 'CLEANING',
  confirmationCode: string,
  date: Date
): string {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const monthYear = `${month.toString().padStart(2, '0')}/${year}`;

  switch (type) {
    case 'PARENT':
      return `Loyer Airbnb – ${confirmationCode} – ${monthYear}`;
    case 'FEE':
      return `Commission Airbnb – ${confirmationCode} – ${monthYear}`;
    case 'CLEANING':
      return `Frais ménage conciergerie – ${confirmationCode} – ${monthYear}`;
  }
}

/**
 * Génère accounting_month au format YYYY-MM à partir d'une date
 */
function generateAccountingMonth(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Génère les notes d'une transaction Airbnb
 */
function generateTransactionNotes(
  type: 'PARENT' | 'FEE' | 'CLEANING',
  reservation: AirbnbReservationRow,
  grossRevenue: number,
  cleaningFee: number
): string {
  const confirmationCode = reservation['Code de confirmation'] || 'N/A';
  const guest = reservation.Voyageur || 'N/A';
  const nights = reservation.Nuits || '0';
  const startDate = reservation['Date de début'] || 'N/A';
  const endDate = reservation['Date de fin'] || 'N/A';

  const baseInfo = `Réservation ${confirmationCode} – ${guest} – ${nights} nuit(s). Séjour du ${startDate} au ${endDate}.`;

  switch (type) {
    case 'PARENT':
      return `${baseInfo} Revenus bruts ${grossRevenue.toFixed(2)} €, dont ménage ${cleaningFee.toFixed(2)} €.`;
    case 'FEE':
      return `Frais de service Airbnb (hôte). ${baseInfo}`;
    case 'CLEANING':
      return `Frais de ménage facturés au voyageur puis reversés à la conciergerie. ${baseInfo}`;
  }
}

/**
 * Prévisualise les réservations Airbnb depuis un CSV sans créer de transactions
 */
export function previewAirbnbReservations(csvContent: string): PreviewResult {
  const errors: string[] = [];
  const reservations: PreviewReservation[] = [];
  let minDate: Date | null = null;
  let maxDate: Date | null = null;
  let totalGrossRevenue = 0;
  let totalServiceFee = 0;
  let totalCleaningFee = 0;

  try {
    // 1. Parser le CSV
    const csvReservations = parseAirbnbCSV(csvContent);
    
    if (csvReservations.length === 0) {
      return {
        reservations: [],
        errors: ['Aucune réservation trouvée dans le CSV. Vérifiez que le fichier contient des lignes avec Type = "Réservation".'],
        totalReservations: 0,
        totalGrossRevenue: 0,
        totalServiceFee: 0,
        totalCleaningFee: 0,
      };
    }

    // 2. Traiter chaque réservation
    for (const reservation of csvReservations) {
      try {
        const confirmationCode = reservation['Code de confirmation']?.trim();
        if (!confirmationCode) {
          errors.push(`Réservation ignorée: Code de confirmation manquant`);
          continue;
        }

        // Parser les montants
        const grossRevenue = parseAmount(reservation['Revenus bruts'] || '0');
        const serviceFee = parseAmount(reservation['Frais de service'] || '0');
        const cleaningFee = parseAmount(reservation['Frais de ménage'] || '0');

        // Ignorer les réservations avec revenus bruts à 0
        if (grossRevenue === 0) {
          errors.push(`Réservation ${confirmationCode} ignorée: Revenus bruts à 0`);
          continue;
        }

        // Parser la date
        let transactionDate: Date;
        try {
          transactionDate = parseDate(reservation['Date de fin'] || reservation['Date de début'] || '');
        } catch (error) {
          errors.push(`Réservation ${confirmationCode}: Erreur de parsing de date - ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
          continue;
        }

        // Formater la date pour l'affichage
        const formatDate = (date: Date): string => {
          const day = date.getDate().toString().padStart(2, '0');
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const year = date.getFullYear();
          return `${day}/${month}/${year}`;
        };

        // Mettre à jour les dates min/max pour la période
        if (!minDate || transactionDate < minDate) {
          minDate = transactionDate;
        }
        if (!maxDate || transactionDate > maxDate) {
          maxDate = transactionDate;
        }

        // Générer le label de transaction
        const transactionLabel = generateTransactionLabel('PARENT', confirmationCode, transactionDate);

        // Ajouter la réservation à la prévisualisation
        reservations.push({
          confirmationCode,
          guest: reservation.Voyageur || 'N/A',
          startDate: reservation['Date de début'] || 'N/A',
          endDate: reservation['Date de fin'] || 'N/A',
          nights: parseInt(reservation.Nuits || '0', 10),
          grossRevenue,
          serviceFee,
          cleaningFee,
          transactionDate: formatDate(transactionDate),
          transactionLabel,
        });

        totalGrossRevenue += grossRevenue;
        totalServiceFee += serviceFee;
        totalCleaningFee += cleaningFee;
      } catch (error) {
        const confirmationCode = reservation['Code de confirmation'] || 'N/A';
        errors.push(`Erreur lors du traitement de la réservation ${confirmationCode}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      }
    }

    return {
      reservations,
      errors,
      totalReservations: reservations.length,
      totalGrossRevenue,
      totalServiceFee,
      totalCleaningFee,
      period: minDate && maxDate ? {
        from: minDate.toISOString(),
        to: maxDate.toISOString(),
      } : undefined,
    };
  } catch (error) {
    return {
      reservations: [],
      errors: [error instanceof Error ? error.message : 'Erreur inconnue lors de la prévisualisation'],
      totalReservations: 0,
      totalGrossRevenue: 0,
      totalServiceFee: 0,
      totalCleaningFee: 0,
    };
  }
}

/**
 * Importe les réservations Airbnb depuis un CSV et crée les transactions
 */
export async function importAirbnbReservations(
  propertyId: string,
  organizationId: string,
  csvContent: string
): Promise<ImportResult> {
  const errors: string[] = [];
  let reservationsProcessed = 0;
  let transactionsCreated = 0;
  let transactionsUpdated = 0;
  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  try {
    // 1. Parser le CSV
    const reservations = parseAirbnbCSV(csvContent);
    
    if (reservations.length === 0) {
      return {
        success: false,
        reservationsProcessed: 0,
        transactionsCreated: 0,
        transactionsUpdated: 0,
        errors: ['Aucune réservation trouvée dans le CSV. Vérifiez que le fichier contient des lignes avec Type = "Réservation".'],
      };
    }

    // 2. Récupérer les paramètres système (natures/catégories)
    const codes = await getGestionCodes();

    // 3. Vérifier que les codes existent en base
    const rentCategory = await prisma.category.findUnique({
      where: { slug: codes.rentCategory },
    });
    if (!rentCategory) {
      return {
        success: false,
        reservationsProcessed: 0,
        transactionsCreated: 0,
        transactionsUpdated: 0,
        errors: [`Catégorie loyer "${codes.rentCategory}" introuvable en base. Vérifiez les paramètres de gestion déléguée.`],
      };
    }

    const mgmtCategory = await prisma.category.findUnique({
      where: { slug: codes.mgmtCategory },
    });
    if (!mgmtCategory) {
      return {
        success: false,
        reservationsProcessed: 0,
        transactionsCreated: 0,
        transactionsUpdated: 0,
        errors: [`Catégorie frais de gestion "${codes.mgmtCategory}" introuvable en base. Vérifiez les paramètres de gestion déléguée.`],
      };
    }

    // 4. Vérifier que le bien existe et est en mode Airbnb
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      return {
        success: false,
        reservationsProcessed: 0,
        transactionsCreated: 0,
        transactionsUpdated: 0,
        errors: [`Bien avec l'ID "${propertyId}" introuvable.`],
      };
    }

    if (property.organizationId !== organizationId) {
      return {
        success: false,
        reservationsProcessed: 0,
        transactionsCreated: 0,
        transactionsUpdated: 0,
        errors: [`Le bien n'appartient pas à l'organisation "${organizationId}".`],
      };
    }

    // 5. Traiter chaque réservation
    for (const reservation of reservations) {
      try {
        const confirmationCode = reservation['Code de confirmation']?.trim();
        if (!confirmationCode) {
          errors.push(`Réservation ignorée: Code de confirmation manquant`);
          continue;
        }

        // Parser les montants
        const grossRevenue = parseAmount(reservation['Revenus bruts'] || '0');
        const serviceFee = parseAmount(reservation['Frais de service'] || '0');
        const cleaningFee = parseAmount(reservation['Frais de ménage'] || '0');

        // Ignorer les réservations avec revenus bruts à 0
        if (grossRevenue === 0) {
          errors.push(`Réservation ${confirmationCode} ignorée: Revenus bruts à 0`);
          continue;
        }

        // Parser la date (utiliser Date de fin de préférence, sinon Date de début)
        let transactionDate: Date;
        try {
          transactionDate = parseDate(reservation['Date de fin'] || reservation['Date de début'] || '');
        } catch (error) {
          errors.push(`Réservation ${confirmationCode}: Erreur de parsing de date - ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
          continue;
        }

        // Mettre à jour les dates min/max pour la période
        if (!minDate || transactionDate < minDate) {
          minDate = transactionDate;
        }
        if (!maxDate || transactionDate > maxDate) {
          maxDate = transactionDate;
        }

        // Créer/mettre à jour les 3 transactions dans une transaction Prisma
        await prisma.$transaction(async (tx) => {
          // Transaction MÈRE : LOYER (Recette)
          const parentLabel = generateTransactionLabel('PARENT', confirmationCode, transactionDate);
          const parentNotes = generateTransactionNotes('PARENT', reservation, grossRevenue, cleaningFee);

          // Chercher une transaction existante avec la même clé unique
          const existingParent = await tx.transaction.findFirst({
            where: {
              propertyId,
              source: 'AIRBNB',
              externalId: confirmationCode,
              externalType: 'RESERVATION_PARENT',
            },
          });

          const accountingMonth = generateAccountingMonth(transactionDate);
          
          const parentTransaction = existingParent
            ? await tx.transaction.update({
                where: { id: existingParent.id },
                data: {
                  amount: grossRevenue,
                  date: transactionDate,
                  label: parentLabel,
                  notes: parentNotes,
                  month: transactionDate.getMonth() + 1,
                  year: transactionDate.getFullYear(),
                  accounting_month: accountingMonth,
                  rapprochementStatus: 'rapprochee',
                  dateRapprochement: new Date(),
                },
              })
            : await tx.transaction.create({
                data: {
                  organizationId,
                  propertyId,
                  source: 'AIRBNB',
                  externalId: confirmationCode,
                  externalType: 'RESERVATION_PARENT',
                  label: parentLabel,
                  amount: grossRevenue,
                  date: transactionDate,
                  nature: codes.rentNature,
                  categoryId: rentCategory.id,
                  notes: parentNotes,
                  month: transactionDate.getMonth() + 1,
                  year: transactionDate.getFullYear(),
                  accounting_month: accountingMonth,
                  rapprochementStatus: 'rapprochee',
                  dateRapprochement: new Date(),
                },
              });

          if (!existingParent) {
            transactionsCreated++;
          } else {
            transactionsUpdated++;
          }

          // Transaction FILLE 1 : Commission Airbnb (Frais de service)
          if (serviceFee > 0) {
            const feeLabel = generateTransactionLabel('FEE', confirmationCode, transactionDate);
            const feeNotes = generateTransactionNotes('FEE', reservation, grossRevenue, cleaningFee);

            const existingFee = await tx.transaction.findFirst({
              where: {
                propertyId,
                source: 'AIRBNB',
                externalId: confirmationCode,
                externalType: 'RESERVATION_FEE',
              },
            });

            const feeTransaction = existingFee
              ? await tx.transaction.update({
                  where: { id: existingFee.id },
                  data: {
                    amount: -serviceFee, // Négatif car c'est une dépense
                    date: transactionDate,
                    label: feeLabel,
                    notes: feeNotes,
                    month: transactionDate.getMonth() + 1,
                    year: transactionDate.getFullYear(),
                    accounting_month: accountingMonth,
                    rapprochementStatus: 'rapprochee',
                    dateRapprochement: new Date(),
                  },
                })
              : await tx.transaction.create({
                  data: {
                    organizationId,
                    propertyId,
                    source: 'AIRBNB',
                    externalId: confirmationCode,
                    externalType: 'RESERVATION_FEE',
                    parentTransactionId: parentTransaction.id,
                    label: feeLabel,
                    amount: -serviceFee, // Négatif car c'est une dépense
                    date: transactionDate,
                    nature: codes.mgmtNature,
                    categoryId: mgmtCategory.id,
                    notes: feeNotes,
                    month: transactionDate.getMonth() + 1,
                    year: transactionDate.getFullYear(),
                    accounting_month: accountingMonth,
                    rapprochementStatus: 'rapprochee',
                    dateRapprochement: new Date(),
                  },
                });

            if (!existingFee) {
              transactionsCreated++;
            } else {
              transactionsUpdated++;
            }
          }

          // Transaction FILLE 2 : Frais de ménage conciergerie
          if (cleaningFee > 0) {
            const cleaningLabel = generateTransactionLabel('CLEANING', confirmationCode, transactionDate);
            const cleaningNotes = generateTransactionNotes('CLEANING', reservation, grossRevenue, cleaningFee);

            const existingCleaning = await tx.transaction.findFirst({
              where: {
                propertyId,
                source: 'AIRBNB',
                externalId: confirmationCode,
                externalType: 'RESERVATION_CLEANING',
              },
            });

            const cleaningTransaction = existingCleaning
              ? await tx.transaction.update({
                  where: { id: existingCleaning.id },
                  data: {
                    amount: -cleaningFee, // Négatif car c'est une dépense
                    date: transactionDate,
                    label: cleaningLabel,
                    notes: cleaningNotes,
                    month: transactionDate.getMonth() + 1,
                    year: transactionDate.getFullYear(),
                    accounting_month: accountingMonth,
                    rapprochementStatus: 'rapprochee',
                    dateRapprochement: new Date(),
                  },
                })
              : await tx.transaction.create({
                  data: {
                    organizationId,
                    propertyId,
                    source: 'AIRBNB',
                    externalId: confirmationCode,
                    externalType: 'RESERVATION_CLEANING',
                    parentTransactionId: parentTransaction.id,
                    label: cleaningLabel,
                    amount: -cleaningFee, // Négatif car c'est une dépense
                    date: transactionDate,
                    nature: codes.mgmtNature,
                    categoryId: mgmtCategory.id,
                    notes: cleaningNotes,
                    month: transactionDate.getMonth() + 1,
                    year: transactionDate.getFullYear(),
                    accounting_month: accountingMonth,
                    rapprochementStatus: 'rapprochee',
                    dateRapprochement: new Date(),
                  },
                });

            if (!existingCleaning) {
              transactionsCreated++;
            } else {
              transactionsUpdated++;
            }
          }
        });

        reservationsProcessed++;
      } catch (error) {
        const confirmationCode = reservation['Code de confirmation'] || 'N/A';
        errors.push(`Erreur lors du traitement de la réservation ${confirmationCode}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      }
    }

    return {
      success: errors.length === 0,
      reservationsProcessed,
      transactionsCreated,
      transactionsUpdated,
      errors,
      period: minDate && maxDate ? { from: minDate, to: maxDate } : undefined,
    };
  } catch (error) {
    return {
      success: false,
      reservationsProcessed,
      transactionsCreated,
      transactionsUpdated,
      errors: [error instanceof Error ? error.message : 'Erreur inconnue lors de l\'import'],
    };
  }
}

