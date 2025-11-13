/**
 * Convertit une dataURL (base64) en format compatible avec react-pdf Image
 * @param dataUrl - URL de données au format "data:image/png;base64,..."
 * @returns Format accepté par react-pdf ou undefined si pas de dataUrl
 */
export const dataUrlToPdfSrc = (dataUrl?: string): any => {
  if (!dataUrl) return undefined;
  
  // react-pdf accepte directement les dataURLs et les URLs publiques
  return dataUrl;
};

/**
 * Formate une date en français pour le PDF
 * @param dateStr - Date au format ISO string
 * @returns Date formatée "1 janvier 2024"
 */
export const formatDateFR = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch (error) {
    return dateStr;
  }
};

