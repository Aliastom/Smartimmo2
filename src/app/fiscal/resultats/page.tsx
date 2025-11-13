/**
 * Page /fiscal/resultats - Espace Résultats unifié
 * 
 * Point d'entrée pour la page de résultats avec les 4 onglets
 */

import { Metadata } from 'next';
import { FiscalResultsPage } from './FiscalResultsPage';

export const metadata: Metadata = {
  title: 'Résultats fiscaux | SmartImmo',
  description: 'Visualisez vos résultats fiscaux avec synthèse, détails, projections et optimisations',
};

export default function Page() {
  return <FiscalResultsPage />;
}

