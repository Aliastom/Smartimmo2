/**
 * API Route : Export CSV de la simulation fiscale
 * POST /api/fiscal/export-csv
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { SimulationResult } from '@/types/fiscal';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // TODO: Activer l'authentification en production
    // const session = await getServerSession();
    // if (!session?.user) {
    //   return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    // }
    
    const body = await request.json();
    const simulation: SimulationResult = body.simulation;
    
    // Générer le CSV
    const csv = generateCSV(simulation);
    
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="simulation-fiscale-${simulation.inputs.year}.csv"`,
      },
    });
  } catch (error) {
    console.error('Erreur export CSV:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'export CSV' },
      { status: 500 }
    );
  }
}

/**
 * Génère un fichier CSV de la simulation
 */
function generateCSV(simulation: SimulationResult): string {
  const lines: string[] = [];
  
  // Header
  lines.push(`Simulation fiscale ${simulation.inputs.year}`);
  lines.push('');
  
  // Foyer
  lines.push('FOYER FISCAL');
  lines.push('Salaire,Parts,Couple');
  lines.push(
    `${simulation.inputs.foyer.salaire},${simulation.inputs.foyer.parts},${simulation.inputs.foyer.isCouple ? 'Oui' : 'Non'}`
  );
  lines.push('');
  
  // Biens
  lines.push('BIENS IMMOBILIERS');
  lines.push('ID,Nom,Type,Régime,Recettes,Charges,Amortissements,Résultat fiscal');
  
  for (const bien of simulation.biens) {
    lines.push(
      `${bien.id},${bien.nom},${bien.type},${bien.regime},${bien.recettesBrutes},${bien.chargesDeductibles},${bien.amortissements},${bien.resultatFiscal}`
    );
  }
  
  lines.push('');
  
  // Consolidation
  lines.push('CONSOLIDATION');
  lines.push('Revenus fonciers,Revenus BIC,Déficit foncier,Déficit BIC');
  lines.push(
    `${simulation.consolidation.revenusFonciers},${simulation.consolidation.revenusBIC},${simulation.consolidation.deficitFoncier},${simulation.consolidation.deficitBIC}`
  );
  lines.push('');
  
  // Impôts
  lines.push('IMPÔTS');
  lines.push('IR brut,Décote,IR net,PS,Total impôts');
  lines.push(
    `${simulation.ir.impotBrut},${simulation.ir.decote},${simulation.ir.impotNet},${simulation.ps.montant},${simulation.resume.totalImpots}`
  );
  lines.push('');
  
  // Résumé
  lines.push('RÉSUMÉ');
  lines.push('Total impôts,Bénéfice net,Taux effectif,TMI');
  lines.push(
    `${simulation.resume.totalImpots},${simulation.resume.beneficeNetImmobilier},${simulation.resume.tauxEffectif},${simulation.ir.trancheMarginate}`
  );
  lines.push('');
  
  // Métadonnées
  lines.push('MÉTADONNÉES');
  lines.push('Version barèmes,Source,Date calcul');
  lines.push(
    `${simulation.taxParams.version},${simulation.taxParams.source},${new Date(simulation.dateCalcul).toISOString()}`
  );
  
  return lines.join('\n');
}

