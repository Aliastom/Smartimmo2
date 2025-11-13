/**
 * Page /fiscal - Espace Fiscal unifié
 * 
 * 5 onglets : Simulation, Synthèse, Détails, Projections, Optimisations
 */

import { Metadata } from 'next';
import { FiscalPage } from './FiscalPage';

export const metadata: Metadata = {
  title: 'Espace fiscal | SmartImmo',
  description: 'Simulation, synthèse, détails, projections et optimisations fiscales en un seul endroit',
};

export default function Page() {
  return <FiscalPage />;
}

