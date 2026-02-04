'use client';

import { GestionDelegueePageCore } from '@/features/gestion/GestionDelegueePageCore';

/**
 * Page Gestion Déléguée (mode normal)
 * 
 * Cette page utilise le Core Component avec mode="normal"
 * et sert de référence/fallback pour l'ancien menu.
 */

export default function GestionDelegueePage() {
  return <GestionDelegueePageCore mode="normal" />;
}

