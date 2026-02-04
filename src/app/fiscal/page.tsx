/**
 * Page /fiscal - Espace Fiscal unifié
 * 
 * 5 onglets : Simulation, Synthèse, Détails, Projections, Optimisations
 */

import { Metadata } from 'next';
import { FiscalPageCore } from '@/features/fiscal/FiscalPageCore';

export const metadata: Metadata = {
  title: 'Espace fiscal | SmartImmo',
  description: 'Simulation, synthèse, détails, projections et optimisations fiscales en un seul endroit',
};

export default function Page() {
  return <FiscalPageCore mode="normal" />;
}

