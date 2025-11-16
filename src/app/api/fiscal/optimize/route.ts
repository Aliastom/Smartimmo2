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


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const organizationId = user.organizationId;
    const userId = user.id;
    
    // Récupérer l'ID de simulation depuis les query params (optionnel)
    const { searchParams } = new URL(request.url);
    const simulationId = searchParams.get('simulationId');
    
    // Charger la dernière simulation sauvegardée
    const { prisma } = await import('@/lib/prisma');
    
    let simulation: any = null;
    let inputs: FiscalInputs;
    let taxParams: any;
    
    if (simulationId) {
      // Charger la simulation spécifique
      console.log(`🔍 Recherche simulation ID: ${simulationId}`);
      
      simulation = await prisma.fiscalSimulation.findFirst({
        where: { 
          id: simulationId,
          organizationId,
          userId 
        },
      });
      
      if (!simulation) {
        console.log(`❌ Simulation ${simulationId} introuvable`);
        return NextResponse.json(
          { error: 'Simulation introuvable' },
          { status: 404 }
        );
      }
      
      console.log(`✅ Simulation spécifique chargée: ${simulation.name}`);
      inputs = JSON.parse(simulation.inputsJson);
      
      console.log(`📋 Inputs sauvegardés:`, {
        year: inputs.year,
        foyer: inputs.foyer,
        perEnabled: !!inputs.per,
        nombreBiensSauvegardes: inputs.biens?.length || 0,
      });
      
      // ⚠️ NE PAS charger taxParams du JSON (perd les fonctions)
      // Recharger depuis TaxParamsService pour avoir les fonctions intactes
      taxParams = await TaxParamsService.get(inputs.year);
      
      // ✅ DÉCISION : Utiliser les biens SAUVEGARDÉS (snapshot au moment de la simulation)
      // Au lieu de ré-agréger (qui peut donner des résultats différents si données modifiées)
      if (inputs.biens && inputs.biens.length > 0) {
        console.log(`✅ Utilisation des biens SAUVEGARDÉS de la simulation (${inputs.biens.length} bien(s))`);
        inputs.biens.forEach((b: any, i: number) => {
          console.log(`  ${i+1}. ${b.nom}: Loyers ${b.loyers}€, Charges ${b.charges}€, Régime ${b.regimeChoisi || b.regimeSuggere}`);
        });
      } else {
        console.log(`⚠️ Pas de biens sauvegardés → Ré-agrégation depuis BDD`);
        
        // Fallback : Ré-agréger les données immobilières depuis la BDD
        const aggregated = await FiscalAggregator.aggregate({
          userId,
          year: inputs.year,
          baseCalcul: inputs.options?.baseCalcul || 'encaisse',
        });
        
        // Fusionner les données agrégées avec les inputs sauvegardés
        inputs = {
          ...inputs,
          biens: aggregated.biens || [],
          societesIS: aggregated.societesIS || [],
        };
        
        console.log(`📊 Données ré-agrégées: ${(aggregated.biens || []).length} bien(s)`);
      }
      
      console.log(`💰 Inputs finaux pour optimisation:`, {
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
        console.log(`✅ Simulation chargée: ${simulation.id} - ${simulation.name} (créée le ${simulation.createdAt})`);
        inputs = JSON.parse(simulation.inputsJson);
        
        console.log(`📋 Inputs sauvegardés:`, {
          year: inputs.year,
          foyer: inputs.foyer,
          perEnabled: !!inputs.per,
          nombreBiensSauvegardes: inputs.biens?.length || 0,
        });
        
        // ⚠️ NE PAS charger taxParams du JSON (perd les fonctions)
        // Recharger depuis TaxParamsService pour avoir les fonctions intactes
        taxParams = await TaxParamsService.get(inputs.year);
        
        // ✅ DÉCISION : Utiliser les biens SAUVEGARDÉS (snapshot au moment de la simulation)
        // Au lieu de ré-agréger (qui peut donner des résultats différents si données modifiées)
        if (inputs.biens && inputs.biens.length > 0) {
          console.log(`✅ Utilisation des biens SAUVEGARDÉS de la simulation (${inputs.biens.length} bien(s))`);
          inputs.biens.forEach((b: any, i: number) => {
            console.log(`  ${i+1}. ${b.nom}: Loyers ${b.loyers}€, Charges ${b.charges}€, Régime ${b.regimeChoisi || b.regimeSuggere}`);
          });
        } else {
          console.log(`⚠️ Pas de biens sauvegardés → Ré-agrégation depuis BDD`);
          
          // Fallback : Ré-agréger les données immobilières depuis la BDD
          const aggregated = await FiscalAggregator.aggregate({
            userId,
            year: inputs.year,
            baseCalcul: inputs.options?.baseCalcul || 'encaisse',
          });
          
          // Fusionner les données agrégées avec les inputs sauvegardés
          inputs = {
            ...inputs,
            biens: aggregated.biens || [],
            societesIS: aggregated.societesIS || [],
          };
          
          console.log(`📊 Données ré-agrégées: ${(aggregated.biens || []).length} bien(s)`);
        }
        
        console.log(`💰 Inputs finaux pour optimisation:`, {
          year: inputs.year,
          salaire: inputs.foyer.salaire,
          parts: inputs.foyer.parts,
          nombreBiens: inputs.biens.length,
        });
      } else {
        console.log('⚠️ Aucune simulation trouvée → Génération de données par défaut');
        // Pas de simulation sauvegardée : générer une optimisation de base
        const currentYear = new Date().getFullYear();
        taxParams = await TaxParamsService.get(currentYear);
        
        const aggregated = await FiscalAggregator.aggregate({
          userId,
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
    
    // ✅ Debug : Vérifier les valeurs des biens avant renvoi
    console.log(`📊 Biens dans optimisation (avant JSON):`);
    optimization.simulation.biens.forEach((b: any, i: number) => {
      console.log(`  ${i+1}. ${b.nom}:`, {
        recettesBrutes: b.recettesBrutes,
        chargesDeductibles: b.chargesDeductibles,
        type: typeof b.recettesBrutes,
        typeCharges: typeof b.chargesDeductibles,
      });
    });
    
    return NextResponse.json(optimization);
  } catch (error) {
    console.error('Erreur optimisation fiscale:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'optimisation fiscale' },
      { status: 500 }
    );
  }
}

