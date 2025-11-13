import { prisma } from '@/lib/prisma';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Valider qu'une nature est compatible avec une catégorie
 */
export async function validateNatureCategory(
  nature: string,
  categoryId?: string
): Promise<ValidationResult> {
  if (!categoryId) {
    return { valid: true }; // Pas de catégorie = OK
  }

  try {
    // Récupérer les types autorisés pour cette nature
    const rules = await prisma.natureRule.findMany({
      where: {
        natureCode: nature,
      },
      select: {
        allowedType: true,
      },
    });

    if (rules.length === 0) {
      return { valid: true }; // Pas de règles = OK (fallback)
    }

    const allowedTypes = rules.map(rule => rule.allowedType);

    // Récupérer le type de la catégorie
    const category = await prisma.category.findUnique({
      where: {
        id: categoryId,
      },
      select: {
        type: true,
        label: true,
      },
    });

    if (!category) {
      return {
        valid: false,
        error: 'Catégorie introuvable',
      };
    }

    if (!allowedTypes.includes(category.type)) {
      return {
        valid: false,
        error: `Catégorie incompatible avec la nature sélectionnée (attendu : ${allowedTypes.join(', ')})`,
      };
    }

    return { valid: true };
  } catch (error) {
    console.error('Error validating nature category:', error);
    return {
      valid: false,
      error: 'Erreur lors de la validation',
    };
  }
}

