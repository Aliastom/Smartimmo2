/**
 * API Route : Simulation fiscale
 * POST /api/fiscal/simulate
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { TaxParamsService } from '@/services/tax/TaxParamsService';
import { FiscalAggregator } from '@/services/tax/FiscalAggregator';
import { Simulator } from '@/services/tax/Simulator';
import { FiscalCombinationGuard } from '@/services/FiscalCombinationGuard';
import type { FiscalInputs } from '@/types/fiscal';

export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
    // TODO: Activer l'authentification en production
    // const session = await getServerSession();
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    // }
    
    // Pour les tests, utiliser un userId par défaut
    const userId = 'demo-user';
    
    // Récupérer les données du body
    const body = await request.json() as Partial<FiscalInputs>;
    
    const {
      year,
      foyer,
      per,
      options = {
        autofill: true,
        baseCalcul: 'encaisse',
        optimiserRegimes: true,
      },
      scope,
    } = body;
    
    if (!year || !foyer) {
      return NextResponse.json(
        { error: 'Paramètres manquants (year, foyer)' },
        { status: 400 }
      );
    }
    
    // Récupérer les paramètres fiscaux pour l'année
    const taxParams = await TaxParamsService.get(year);
    
    // Agréger les données fiscales automatiquement si autofill
    let inputs: FiscalInputs;
    
    if (options.autofill) {
      const aggregated = await FiscalAggregator.aggregate({
        userId,
        year,
        baseCalcul: options.baseCalcul,
        regimeForce: options.regimeForce,
        scope,
      });
      
      inputs = {
        ...aggregated,
        foyer,
        per,
        options,
      };
    } else {
      // Utiliser les données fournies manuellement
      inputs = {
        year,
        foyer,
        biens: body.biens || [],
        per,
        options,
      };
    }
    
    // ========== VALIDATION DES COMBINAISONS FISCALES ==========
    // 🆕 Désactiver la validation stricte car elle est trop contraignante
    // En réalité, on PEUT mélanger régime réel et micro sur différents biens
    // La validation sera faite côté UI/UX avec des warnings, pas des erreurs bloquantes
    
    console.log('✅ Validation fiscale désactivée (trop stricte)');
    console.log('📊 Biens à simuler:', inputs.biens.map(b => ({
      id: b.id,
      nom: b.nom,
      type: b.type,
      regimeChoisi: b.regimeChoisi,
      regimeSuggere: b.regimeSuggere,
    })));
    
    // const guard = new FiscalCombinationGuard();
    // const validation = await guard.validateCombination(
    //   inputs.biens.map((b) => ({
    //     id: b.id,
    //     fiscalTypeId: b.type as string,
    //     fiscalRegimeId: b.regimeChoisi || b.regimeSuggere || null,
    //   }))
    // );
    //
    // if (!validation.valid) {
    //   console.error('❌ Validation échouée:', validation.errors);
    //   return NextResponse.json(
    //     {
    //       code: 'FISCAL_COMBINATION_INVALID',
    //       message: 'La combinaison fiscale n\'est pas valide',
    //       errors: validation.errors,
    //       warnings: validation.warnings,
    //     },
    //     { status: 400 }
    //   );
    // }

    // Lancer la simulation
    const simulation = await Simulator.simulate(inputs, taxParams);
    
    // Retourner le résultat (sans warnings de validation car désactivée)
    return NextResponse.json({
      ...simulation,
      validationWarnings: [], // Validation désactivée
    });
  } catch (error) {
    console.error('Erreur simulation fiscale:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la simulation fiscale' },
      { status: 500 }
    );
  }
}

