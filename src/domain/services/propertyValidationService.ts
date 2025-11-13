import { prisma } from '@/lib/prisma';

export interface PropertyValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  adjustments?: {
    statusMode?: string;
    status?: string;
  };
}

/**
 * Valide la cohérence entre occupation et statut d'un bien
 */
export async function validatePropertyOccupationStatus(
  propertyId: string | null, // null pour création
  occupation: string,
  statusMode: string,
  statusManual: string | null,
  checkActiveLeases: boolean = true
): Promise<PropertyValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const adjustments: PropertyValidationResult['adjustments'] = {};

  // Vérifier l'unicité de la résidence principale
  if (occupation === 'PRINCIPALE') {
    const existingPrincipal = await prisma.property.findFirst({
      where: {
        occupation: 'PRINCIPALE',
        ...(propertyId ? { id: { not: propertyId } } : {})
      },
      select: { id: true, name: true }
    });

    if (existingPrincipal) {
      errors.push(`Un bien est déjà déclaré comme résidence principale (${existingPrincipal.name}). Vous ne pouvez avoir qu'une seule résidence principale.`);
    }
  }

  // Si le bien est déjà créé, vérifier les baux actifs
  if (checkActiveLeases && propertyId) {
    const activeLeases = await prisma.lease.findMany({
      where: {
        propertyId,
        status: { in: ['ACTIF', 'SIGNÉ'] }
      },
      select: { id: true }
    });

    const hasActiveLeases = activeLeases.length > 0;

    // Règles de cohérence
    if (['PRINCIPALE', 'SECONDAIRE', 'USAGE_PRO'].includes(occupation)) {
      if (hasActiveLeases) {
        errors.push(`Impossible de définir l'occupation comme "${occupation}" car le bien a des baux actifs. Résiliez d'abord les baux ou choisissez "LOCATIF".`);
      }
      // Forcer le mode MANUAL et statut OCCUPE_PROPRIETAIRE
      if (statusMode === 'AUTO') {
        adjustments.statusMode = 'MANUAL';
        adjustments.status = 'occupied_owner';
        warnings.push('Le mode de statut a été automatiquement basculé en MANUAL avec statut "Occupé par le propriétaire".');
      }
    }

    if (occupation === 'VACANT') {
      if (hasActiveLeases) {
        errors.push('Impossible de marquer le bien comme VACANT car il a des baux actifs. Résiliez d\'abord les baux.');
      }
    }

    if (occupation === 'LOCATIF') {
      // En mode AUTO, le statut sera calculé automatiquement
      if (statusMode === 'AUTO') {
        const newStatus = hasActiveLeases ? 'rented' : 'vacant';
        if (newStatus !== statusManual) {
          adjustments.status = newStatus;
          warnings.push(`Le statut sera automatiquement défini comme "${newStatus === 'rented' ? 'Loué' : 'Vacant'}" en fonction des baux actifs.`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    adjustments: Object.keys(adjustments).length > 0 ? adjustments : undefined
  };
}

