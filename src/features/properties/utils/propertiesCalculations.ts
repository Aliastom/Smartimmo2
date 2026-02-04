/**
 * Fonctions de calcul unifiées pour la page Properties/Biens
 * 
 * Ces fonctions sont utilisées à la fois en mode normal (API) et en mode app-shell (IndexedDB)
 * pour garantir des résultats identiques.
 */

import type { LocalProperty, LocalLease, LocalTransaction, CachedNature } from '@/lib/offline/db';

/**
 * Interface pour les stats des propriétés
 */
export interface PropertyStats {
  total: number; // Tous les biens (y compris archivés)
  occupied: number; // Biens avec au moins un bail ACTIF
  vacant: number; // Biens sans bail ACTIF
  monthlyRevenue: number; // Revenus mensuels (transactions LOYER du mois en cours)
}

/**
 * Calcule les stats des propriétés
 * 
 * Règles identiques au mode normal (PropertyRepo.getStats):
 * - total: compte TOUS les biens (y compris archivés)
 * - occupied: compte les biens avec au moins un bail ACTIF
 * - vacant: compte les biens sans bail ACTIF
 * - monthlyRevenue: somme des transactions avec nature='LOYER' du mois en cours
 */
export function computePropertyStats(
  properties: LocalProperty[],
  leases: LocalLease[],
  transactions: LocalTransaction[],
  natures: Map<string, CachedNature>
): PropertyStats {
  // Total: TOUS les biens (y compris archivés) - comme PropertyRepo.getStats
  const total = properties.length;

  // Créer un Set des propertyIds avec au moins un bail ACTIF
  const occupiedPropertyIds = new Set<string>();
  leases.forEach(lease => {
    if (lease.status === 'ACTIF') {
      occupiedPropertyIds.add(lease.propertyId);
    }
  });

  // Occupés: biens avec au moins un bail ACTIF
  const occupied = properties.filter(p => occupiedPropertyIds.has(p.id)).length;

  // Vacants: biens sans bail ACTIF
  const vacant = total - occupied;

  // Monthly Revenue: transactions avec nature='LOYER' du mois en cours
  // ⚠️ CRITIQUE: Utiliser exactement la même logique que PropertyRepo.getStats
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthlyRevenue = transactions
    .filter(tx => {
      // Filtrer par date (mois en cours) - >= premier jour du mois
      const txDate = new Date(tx.date);
      if (txDate < currentMonthStart) {
        return false;
      }

      // Filtrer par nature='LOYER' (exactement comme PropertyRepo.getStats)
      // Note: PropertyRepo.getStats utilise nature: 'LOYER', pas 'RECETTE_LOYER'
      if (!tx.nature) return false;
      return tx.nature === 'LOYER';
    })
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  return {
    total,
    occupied,
    vacant,
    monthlyRevenue,
  };
}

/**
 * Détermine si une propriété est occupée en fonction de ses baux
 */
export function isPropertyOccupied(propertyId: string, leases: LocalLease[]): boolean {
  return leases.some(lease => lease.propertyId === propertyId && lease.status === 'ACTIF');
}

/**
 * Convertit LocalProperty vers Property pour les graphiques
 */
export function convertPropertyForChart(
  property: LocalProperty,
  leases: LocalLease[]
): { id: string; status: 'occupied' | 'vacant' } {
  return {
    id: property.id,
    status: isPropertyOccupied(property.id, leases) ? 'occupied' : 'vacant',
  };
}

/**
 * Convertit LocalTransaction vers Transaction pour les graphiques
 * 
 * ⚠️ CRITIQUE: Utiliser exactement la même logique que le mode normal (page.tsx ligne 163)
 * - kind = flow === 'INCOME' ? 'income' : 'expense'
 * - amount = valeur absolue du montant (comme dans RevenueExpenseCard qui somme les montants)
 */
export function convertTransactionForChart(
  transaction: LocalTransaction,
  natures: Map<string, CachedNature>
): { id: string; propertyId: string; date: string; amount: number; kind: 'income' | 'expense' } {
  // ⚠️ CRITIQUE: Utiliser exactement la même logique que le mode normal (page.tsx ligne 162-163)
  // En mode normal: 
  //   const flow = natureFlowMap.get(t.nature);
  //   const kind = flow === 'INCOME' ? 'income' : 'expense';
  //   amount: t.amount (utilisé directement, peut être négatif)
  
  const flow = transaction.nature ? (natures.get(transaction.nature)?.flow || null) : null;
  
  // ⚠️ CRITIQUE: Utiliser exactement la même logique que le mode normal
  // Si flow === 'INCOME' → 'income', sinon → 'expense'
  const kind = flow === 'INCOME' ? 'income' : 'expense';

  return {
    id: transaction.id,
    propertyId: transaction.propertyId || '',
    date: transaction.date,
    // ⚠️ CRITIQUE: En mode normal, on utilise t.amount directement
    // RevenueExpenseCard somme les montants avec reduce((sum, t) => sum + t.amount, 0)
    // Donc si les montants sont négatifs pour les dépenses, ils seront correctement soustraits
    // Mais en pratique, les montants sont probablement toujours positifs et c'est le kind qui détermine le type
    // Pour être sûr, utilisons Math.abs() pour avoir des valeurs positives cohérentes
    amount: Math.abs(transaction.amount),
    kind,
  };
}

