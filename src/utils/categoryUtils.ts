/**
 * Utilitaires pour la gestion des catégories comptables
 */

import { prisma } from '@/lib/prisma';

/**
 * Obtient la catégorie suggérée pour une nature donnée
 */
export async function getSuggestedCategoryId(nature: string, userId?: string): Promise<string | null> {
  try {
    console.log(`[getSuggestedCategoryId] Looking for category for nature: ${nature}`);
    
    // Chercher la catégorie par défaut pour cette nature
    const natureDefault = await prisma.natureDefault.findUnique({
      where: { natureCode: nature },
      select: { defaultCategoryId: true },
    });

    console.log(`[getSuggestedCategoryId] Nature default:`, natureDefault);

    if (natureDefault?.defaultCategoryId) {
      console.log(`[getSuggestedCategoryId] Found default category: ${natureDefault.defaultCategoryId}`);
      return natureDefault.defaultCategoryId;
    }

    // Fallback : chercher la première catégorie compatible
    const rules = await prisma.natureRule.findMany({
      where: { natureCode: nature },
      select: { allowedType: true },
    });

    console.log(`[getSuggestedCategoryId] Rules found:`, rules);

    if (rules.length > 0) {
      const allowedTypes = rules.map(rule => rule.allowedType);
      const category = await prisma.category.findFirst({
        where: {
          type: { in: allowedTypes },
          actif: true,
        },
        select: { id: true },
        orderBy: [
          { system: 'desc' },
          { label: 'asc' },
        ],
      });

      console.log(`[getSuggestedCategoryId] Fallback category:`, category);
      return category?.id || null;
    }

    console.log(`[getSuggestedCategoryId] No category found for nature: ${nature}`);
    return null;
  } catch (error) {
    console.error('Error getting suggested category:', error);
    return null;
  }
}

/**
 * Génère un label automatique pour une transaction de loyer
 */
export function generateRentLabel(month: number, year: number, propertyName: string): string {
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  
  const monthName = monthNames[month - 1] || `Mois ${month}`;
  return `Loyer ${monthName} ${year} – ${propertyName}`;
}

/**
 * Génère une note automatique pour une transaction créée via reçu
 */
export function generateReceiptNote(originalNotes?: string): string {
  const autoNote = '[Auto] Créé via Enregistrer ce paiement (quittance).';
  
  if (originalNotes && originalNotes.trim()) {
    return `${originalNotes}\n\n${autoNote}`;
  }
  
  return autoNote;
}

/**
 * Obtient les catégories compatibles pour une nature donnée
 */
export async function getCompatibleCategories(nature: string): Promise<Array<{id: string, label: string, type: string}>> {
  try {
    console.log(`[getCompatibleCategories] Looking for categories compatible with nature: ${nature}`);
    
    // Récupérer les types autorisés pour cette nature
    const rules = await prisma.natureRule.findMany({
      where: { natureCode: nature },
      select: { allowedType: true },
    });

    console.log(`[getCompatibleCategories] Rules found:`, rules);

    if (rules.length === 0) {
      console.log(`[getCompatibleCategories] No rules found for nature: ${nature}`);
      return [];
    }

    const allowedTypes = rules.map(rule => rule.allowedType);
    
    // Récupérer les catégories compatibles
    const categories = await prisma.category.findMany({
      where: {
        type: { in: allowedTypes },
        actif: true,
      },
      select: { 
        id: true, 
        label: true, 
        type: true 
      },
      orderBy: [
        { system: 'desc' },
        { label: 'asc' },
      ],
    });

    console.log(`[getCompatibleCategories] Compatible categories:`, categories);
    return categories;
  } catch (error) {
    console.error('Error getting compatible categories:', error);
    return [];
  }
}

/**
 * Génère une clé d'idempotence pour éviter les doublons
 */
export function generateIdempotencyKey(leaseId: string, amount: number, paidAt: Date): string {
  const dateStr = paidAt.toISOString().split('T')[0]; // YYYY-MM-DD
  return `receipt_${leaseId}_${amount}_${dateStr}`;
}
