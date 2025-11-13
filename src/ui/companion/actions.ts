/**
 * Actions / Capabilities du compagnon IA
 * Fonctions pour interagir avec l'application (navigation, modales, filtres)
 */

import { useRouter } from 'next/navigation';

/**
 * Navigation vers une route
 */
export function goTo(path: string): void {
  // En client component, on peut utiliser window.location
  if (typeof window !== 'undefined') {
    window.location.href = path;
  }
}

/**
 * Ouvrir une modale (stub pour MVP)
 * Dans une version future, ceci déclencherait l'ouverture d'une modale spécifique
 */
export function openModal(modalName: string): void {
  console.log('[Companion] Ouverture de la modale:', modalName);
  // TODO: Implémenter avec un state manager global ou event bus
  // Pour MVP, on log seulement
}

/**
 * Filtrer une table (stub pour MVP)
 * Dans une version future, ceci mettrait à jour les query params
 */
export function filterTable(params: Record<string, any>): void {
  console.log('[Companion] Filtrage de la table:', params);
  // TODO: Implémenter avec query params ou state manager
  // Pour MVP, on log seulement
}

/**
 * Exporter des données (stub pour MVP)
 */
export function exportData(format: 'csv' | 'pdf'): void {
  console.log('[Companion] Export des données:', format);
  // TODO: Implémenter l'export
}

/**
 * Ouvrir l'aide contextuelle
 */
export function openHelp(topic?: string): void {
  if (topic) {
    console.log('[Companion] Ouverture de l\'aide:', topic);
  }
  // Ouvrir la documentation
  window.open('https://smartimmo.fr/docs', '_blank');
}

