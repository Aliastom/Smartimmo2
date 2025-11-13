/**
 * FiscalSummaryCompact - Résumé fiscal compact pour l'onglet Simulation
 * 
 * Affichage instantané des résultats dans la colonne droite
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Separator } from '@/components/ui/Separator';
import { Skeleton } from '@/components/ui/Skeleton';
import { 
  TrendingUp, 
  TrendingDown, 
  Euro,
  Percent,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import type { SimulationResult } from '@/types/fiscal';

interface FiscalSummaryCompactProps {
  simulation: SimulationResult | null;
  loading: boolean;
  onGoToSynthese?: () => void;
}

export function FiscalSummaryCompact({ simulation, loading, onGoToSynthese }: FiscalSummaryCompactProps) {
  const formatEuro = (amount: number) => {
    if (isNaN(amount)) return '–';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (rate: number) => {
    if (isNaN(rate)) return '–';
    return `${(rate * 100).toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (!simulation) {
    return (
      <Card className="border-2 border-dashed border-gray-300">
        <CardContent className="p-6 text-center">
          <p className="text-sm text-gray-500">
            Cliquez sur "Calculer" pour voir les résultats
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculer les totaux
  const totalImpots = simulation.ir.impotNet + simulation.ps.total;
  const loyersTotal = simulation.biens?.reduce((sum, b) => sum + (b.recettesBrutes || b.loyers || 0), 0) || 0;
  const chargesTotal = simulation.biens?.reduce((sum, b) => sum + (b.chargesDeductibles || b.charges || 0) + (b.interetsEmprunt || b.interets || 0), 0) || 0;
  const beneficeNet = loyersTotal - chargesTotal - totalImpots;
  const irSupp = simulation.ir.impotNet - (simulation.ir.impotSansFoncier || simulation.ir.impotNet);
  const psTotal = simulation.ps.total;

  // Détecter NaN
  const hasNaN = isNaN(totalImpots) || isNaN(beneficeNet) || isNaN(simulation.ir.tauxEffectif);

  return (
    <div className="space-y-4">
      {/* Alerte données incomplètes */}
      {hasNaN && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="p-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <p className="text-xs text-yellow-800">
              Certaines valeurs ne sont pas encore calculées. Vérifiez vos données.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Impacts fiscaux */}
      <Card className="border-gray-200 shadow-sm rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Euro className="h-5 w-5 text-purple-600" />
            Impacts fiscaux
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-2 bg-violet-50 rounded">
              <p className="text-gray-600 text-xs">Impôt sur le revenu (IR)</p>
              <p className="font-bold text-violet-600">
                {formatEuro(simulation.ir.impotNet)}
              </p>
            </div>
            <div className="p-2 bg-amber-50 rounded">
              <p className="text-gray-600 text-xs">Prélèvements sociaux (PS)</p>
              <p className="font-bold text-amber-600">
                {formatEuro(simulation.ps.total)}
              </p>
            </div>
            <div className="p-2 bg-gray-50 rounded">
              <p className="text-gray-600 text-xs">Taux effectif</p>
              <p className="font-bold text-gray-900">
                {formatPercent(simulation.ir.tauxEffectif)}
              </p>
            </div>
            <div className="p-2 bg-gray-50 rounded">
              <p className="text-gray-600 text-xs">Tranche marginale</p>
              <p className="font-bold text-gray-900">
                {formatPercent(simulation.ir.trancheMarginate)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Résumé */}
      <Card className="border-gray-200 shadow-sm rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Résumé
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Total impôts */}
          <div className="flex justify-between p-3 bg-red-50 rounded-lg">
            <span className="font-medium text-gray-700">Total impôts (IR + PS)</span>
            <span className="text-xl font-bold text-red-600">
              {formatEuro(totalImpots)}
            </span>
          </div>
          
          {/* Bénéfice net */}
          <div className="flex justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex-1">
              <span className="font-medium text-gray-700">Bénéfice net immobilier</span>
              <p className="text-xs text-gray-500 mt-1">
                Loyers - Charges - Impôts supplémentaires (IR + PS)
              </p>
            </div>
            <span className={`text-xl font-bold ${beneficeNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatEuro(beneficeNet)}
            </span>
          </div>
          
          {/* Détail du calcul */}
          <div className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded p-2">
            <p className="font-medium text-blue-900 mb-1">💡 Détail du calcul :</p>
            <div className="space-y-0.5">
              <div className="flex justify-between">
                <span>Loyers encaissés</span>
                <span className="font-medium">{formatEuro(loyersTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>- Charges déductibles</span>
                <span className="font-medium">-{formatEuro(chargesTotal)}</span>
              </div>
              <div className="flex justify-between text-blue-700">
                <span>- Impôts supplémentaires (IR + PS)</span>
                <span className="font-medium">-{formatEuro(totalImpots)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400 ml-4">
                <span>└ dont IR supplémentaire</span>
                <span>-{formatEuro(irSupp)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400 ml-4">
                <span>└ dont PS fonciers</span>
                <span>-{formatEuro(psTotal)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-blue-300 font-semibold text-blue-900">
                <span>= Bénéfice net réel</span>
                <span className={beneficeNet >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatEuro(beneficeNet)}
                </span>
              </div>
            </div>
          </div>
          
          {/* Régimes fiscaux par bien */}
          {simulation.biens && simulation.biens.length > 0 && (
            <div className="text-xs bg-purple-50 border border-purple-200 rounded p-3">
              <p className="font-medium text-purple-900 mb-2">📊 Régimes fiscaux par bien :</p>
              <div className="space-y-2">
                {simulation.biens.map((bien, i) => {
                  const suggere = bien.regimeSuggere || 'micro';
                  const utilise = bien.regimeUtilise || 'micro';
                  const isOptimal = suggere === utilise;
                  const gainPotentiel = bien.details?.economieRegimeReel || 0;
                  
                  return (
                    <div key={i} className="bg-white border border-purple-200 rounded p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-800">{bien.nom}</span>
                        <span className="text-xs text-gray-500">{bien.type}</span>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-gray-700">Actuel :</span>
                          <Badge variant="outline" className="bg-gray-100 text-gray-800">
                            {utilise === 'micro' ? 'Micro' : 'Réel'}
                          </Badge>
                        </div>
                        
                        {!isOptimal && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-orange-700 font-medium">Suggéré :</span>
                            <Badge className="bg-orange-100 text-orange-800 border-orange-300">
                              {suggere === 'micro' ? 'Micro' : 'Réel'}
                            </Badge>
                            {Math.abs(gainPotentiel) > 0 && (
                              <span className="text-orange-600 text-xs font-bold">
                                +{Math.round(Math.abs(gainPotentiel)).toLocaleString('fr-FR')} €/an
                              </span>
                            )}
                          </div>
                        )}
                        
                        {isOptimal && (
                          <div className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                            <span className="text-xs text-green-700 font-medium">Optimal</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-2 pt-2 border-t border-purple-200">
                <p className="text-xs text-purple-700 italic">
                  💡 Actuel → Suggéré (+gain potentiel/an)
                </p>
              </div>
            </div>
          )}

          {/* Bouton vers Synthèse */}
          {onGoToSynthese && (
            <Button 
              onClick={onGoToSynthese} 
              variant="outline" 
              size="sm" 
              className="w-full mt-2"
            >
              Voir le détail complet <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

