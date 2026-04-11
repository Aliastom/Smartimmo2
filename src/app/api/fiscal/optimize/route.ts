/**
 * API Route : Optimisation fiscale
 * GET /api/fiscal/optimize - Récupère la dernière optimisation
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/getCurrentUser';
import { TaxParamsService } from '@/services/tax/TaxParamsService';
import { FiscalAggregator } from '@/services/tax/FiscalAggregator';
import { Optimizer } from '@/services/tax/Optimizer';
import type { FiscalInputs } from '@/types/fiscal';
import { logDebug } from '@/lib/utils/logger';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleOptimize(request);
}

export async function POST(request: NextRequest) {
  return handleOptimize(request);
}

async function handleOptimize(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const userId = user.id;
    
    // Récupérer l'ID de simulation depuis les query params (optionnel)
    const { searchParams } = new URL(request.url);
    const simulationId = searchParams.get('simulationId');
    // ✅ Accepter les données de la simulation récente en paramètre (pour éviter de recharger)
    const useRecentSimulation = searchParams.get('useRecent') === 'true';
    
    // ✅ Si POST avec des inputs, utiliser directement (simulation récente)
    let bodyData: any = null;
    if (request.method === 'POST') {
      try {
        bodyData = await request.json();
        logDebug(`📥 POST reçu avec bodyData:`, {
          hasInputs: !!bodyData?.inputs,
          inputsYear: bodyData?.inputs?.year,
          inputsBiensCount: bodyData?.inputs?.biens?.length,
          useRecent: bodyData?.useRecent,
        });
      } catch (e) {
        logDebug(`❌ Erreur parsing body POST:`, e);
        // Ignorer si pas de body
      }
    }
    
    // Charger la dernière simulation sauvegardée
    const { prisma } = await import('@/lib/prisma');
    
    let simulation: any = null;
    let inputs: FiscalInputs;
    let taxParams: any;
    
    // ✅ Si on a des inputs en POST (simulation récente), les utiliser directement
    if (bodyData?.inputs && bodyData.useRecent) {
      inputs = bodyData.inputs;
      taxParams = await TaxParamsService.get(
        inputs.year + 1,
        inputs._uiMetadata?.baremeCode
      );
      logDebug(`✅ Utilisation des inputs de la simulation récente (${inputs.biens?.length || 0} bien(s)) - PAS de rechargement`);
    } else if (simulationId) {
      // Charger la simulation spécifique
      logDebug(`🔍 Recherche simulation ID: ${simulationId}`);
      
      simulation = await prisma.fiscalSimulation.findFirst({
        where: { 
          id: simulationId,
          organizationId,
          userId 
        },
      });
      
      if (!simulation) {
        logDebug(`❌ Simulation ${simulationId} introuvable`);
        return NextResponse.json(
          { error: 'Simulation introuvable' },
          { status: 404 }
        );
      }
      
      logDebug(`✅ Simulation spécifique chargée: ${simulation.name}`);
      inputs = JSON.parse(simulation.inputsJson);
      
      logDebug(`📋 Inputs sauvegardés:`, {
        year: inputs.year,
        foyer: inputs.foyer,
        perEnabled: !!inputs.per,
        nombreBiensSauvegardes: inputs.biens?.length || 0,
      });
      
      // ⚠️ NE PAS charger taxParams du JSON (perd les fonctions)
      // Recharger depuis TaxParamsService pour avoir les fonctions intactes
      taxParams = await TaxParamsService.get(
        inputs.year + 1,
        inputs._uiMetadata?.baremeCode
      );
      
      // ✅ DÉCISION : Utiliser les biens SAUVEGARDÉS (snapshot au moment de la simulation)
      // Au lieu de ré-agréger (qui peut donner des résultats différents si données modifiées)
      if (inputs.biens && inputs.biens.length > 0) {
        logDebug(`✅ Utilisation des biens SAUVEGARDÉS de la simulation (${inputs.biens.length} bien(s))`);
        inputs.biens.forEach((b: any, i: number) => {
          logDebug(`  ${i+1}. ${b.nom}: Loyers ${b.loyers}€, Charges ${b.charges}€, Régime ${b.regimeChoisi || b.regimeSuggere}`);
        });
      } else {
        logDebug(`⚠️ Pas de biens sauvegardés → Ré-agrégation depuis BDD`);
        
        const aggregated = await FiscalAggregator.aggregate({
          organizationId,
          year: inputs.year,
          baseCalcul: inputs.options?.baseCalcul || 'encaisse',
        });
        
        // Fusionner les données agrégées avec les inputs sauvegardés
        inputs = {
          ...inputs,
          biens: aggregated.biens || [],
          societesIS: aggregated.societesIS || [],
        };
        
        logDebug(`📊 Données ré-agrégées: ${(aggregated.biens || []).length} bien(s)`);
      }
      
      logDebug(`💰 Inputs finaux pour optimisation:`, {
        year: inputs.year,
        salaire: inputs.foyer.salaire,
        parts: inputs.foyer.parts,
        nombreBiens: inputs.biens.length,
      });
    } else {
      // Charger la dernière simulation
      simulation = await prisma.fiscalSimulation.findFirst({
        where: { 
          organizationId,
          userId 
        },
        orderBy: { createdAt: 'desc' },
      });
      
      if (simulation) {
        logDebug(`✅ Simulation chargée: ${simulation.id} - ${simulation.name} (créée le ${simulation.createdAt})`);
        inputs = JSON.parse(simulation.inputsJson);
        
        logDebug(`📋 Inputs sauvegardés:`, {
          year: inputs.year,
          foyer: inputs.foyer,
          perEnabled: !!inputs.per,
          nombreBiensSauvegardes: inputs.biens?.length || 0,
        });
        
        // ⚠️ NE PAS charger taxParams du JSON (perd les fonctions)
        // Recharger depuis TaxParamsService pour avoir les fonctions intactes
        taxParams = await TaxParamsService.get(
          inputs.year + 1,
          inputs._uiMetadata?.baremeCode
        );
        
        // ✅ DÉCISION : Utiliser les biens SAUVEGARDÉS (snapshot au moment de la simulation)
        // Au lieu de ré-agréger (qui peut donner des résultats différents si données modifiées)
        if (inputs.biens && inputs.biens.length > 0) {
          logDebug(`✅ Utilisation des biens SAUVEGARDÉS de la simulation (${inputs.biens.length} bien(s))`);
          inputs.biens.forEach((b: any, i: number) => {
            logDebug(`  ${i+1}. ${b.nom}: Loyers ${b.loyers}€, Charges ${b.charges}€, Régime ${b.regimeChoisi || b.regimeSuggere}`);
          });
        } else {
          logDebug(`⚠️ Pas de biens sauvegardés → Ré-agrégation depuis BDD`);
          
          const aggregated = await FiscalAggregator.aggregate({
            organizationId,
            year: inputs.year,
            baseCalcul: inputs.options?.baseCalcul || 'encaisse',
          });
          
          // Fusionner les données agrégées avec les inputs sauvegardés
          inputs = {
            ...inputs,
            biens: aggregated.biens || [],
            societesIS: aggregated.societesIS || [],
          };
          
          logDebug(`📊 Données ré-agrégées: ${(aggregated.biens || []).length} bien(s)`);
        }
        
        logDebug(`💰 Inputs finaux pour optimisation:`, {
          year: inputs.year,
          salaire: inputs.foyer.salaire,
          parts: inputs.foyer.parts,
          nombreBiens: inputs.biens.length,
        });
      } else {
        // logDebug('⚠️ Aucune simulation trouvée → Génération de données par défaut');
        // Pas de simulation sauvegardée : générer une optimisation de base
        const currentYear = new Date().getFullYear();
        taxParams = await TaxParamsService.get(currentYear + 1);
        
        const aggregated = await FiscalAggregator.aggregate({
          organizationId,
          year: currentYear,
          baseCalcul: 'encaisse',
        });
        
        inputs = {
          ...aggregated,
          foyer: {
            salaire: 50000,  // Valeur par défaut
            autresRevenus: 0,
            parts: 2,
            isCouple: true,
          },
          options: {
            autofill: true,
            baseCalcul: 'encaisse',
            optimiserRegimes: true,
          },
        };
      }
    }
    
    // Optimiser
    const optimization = await Optimizer.optimize(inputs, taxParams);
    
    // ✅ Debug : Vérifier les valeurs des biens avant renvoi (désactivé en production)
    // logDebug(`📊 Biens dans optimisation (avant JSON):`);
    // optimization.simulation.biens.forEach((b: any, i: number) => {
    //   logDebug(`  ${i+1}. ${b.nom}:`, {
    //     recettesBrutes: b.recettesBrutes,
    //     chargesDeductibles: b.chargesDeductibles,
    //     type: typeof b.recettesBrutes,
    //     typeCharges: typeof b.chargesDeductibles,
    //   });
    // });
    
    return NextResponse.json(optimization);
  } catch (error) {
    console.error('Erreur optimisation fiscale:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'optimisation fiscale' },
      { status: 500 }
    );
  }
}

