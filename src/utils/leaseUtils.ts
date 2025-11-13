/**
 * Utilitaires pour les baux
 */

/**
 * Retourne la durée par défaut d'un bail selon son type
 * @param furnishedType - Type de bail (meublé, vide, etc.)
 * @returns Durée en années
 */
export function getLeaseDefaultDuration(furnishedType: string | null): number {
  // Meublé = 1 an, Vide = 3 ans (durée légale minimale)
  if (furnishedType === 'meuble' || furnishedType === 'MEUBLE') {
    return 1;
  }
  // Par défaut (vide, garage, etc.) = 3 ans
  return 3;
}

/**
 * Calcule la date de fin d'un bail si elle n'est pas définie
 * @param startDate - Date de début du bail
 * @param endDate - Date de fin fournie (peut être null)
 * @param furnishedType - Type de bail
 * @returns Date de fin calculée ou fournie
 */
export function calculateLeaseEndDate(
  startDate: string | Date,
  endDate: string | Date | null | undefined,
  furnishedType: string | null
): Date | null {
  // Si endDate existe déjà, la retourner
  if (endDate) {
    return typeof endDate === 'string' ? new Date(endDate) : endDate;
  }

  // Sinon, calculer selon le type de bail
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const duration = getLeaseDefaultDuration(furnishedType);
  
  const calculatedEnd = new Date(start);
  calculatedEnd.setFullYear(calculatedEnd.getFullYear() + duration);
  
  return calculatedEnd;
}

/**
 * Formate la période d'un bail pour l'affichage
 * @param startDate - Date de début
 * @param endDate - Date de fin (peut être null)
 * @param furnishedType - Type de bail
 * @returns Texte formaté "Du XX/XX/XXXX au XX/XX/XXXX" ou "Du XX/XX/XXXX (+ X an(s))"
 */
export function formatLeasePeriod(
  startDate: string | Date,
  endDate: string | Date | null | undefined,
  furnishedType: string | null
): { startText: string; endText: string; calculated: boolean } {
  const formatDate = (date: string | Date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const startText = `Du ${formatDate(startDate)}`;
  
  // Si endDate existe, l'utiliser
  if (endDate) {
    return {
      startText,
      endText: `Au ${formatDate(endDate)}`,
      calculated: false
    };
  }

  // Sinon, calculer et indiquer que c'est calculé
  const calculatedEnd = calculateLeaseEndDate(startDate, null, furnishedType);
  const duration = getLeaseDefaultDuration(furnishedType);
  
  return {
    startText,
    endText: calculatedEnd ? `Au ${formatDate(calculatedEnd)} (+ ${duration} an${duration > 1 ? 's' : ''})` : 'Non définie',
    calculated: true
  };
}

