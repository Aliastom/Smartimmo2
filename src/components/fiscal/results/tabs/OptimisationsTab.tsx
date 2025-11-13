/**
 * OptimisationsTab - Stratégies d'optimisation fiscale
 * 
 * Réutilise la logique de OptimizerClient
 */

'use client';

import { useState, useEffect } from 'react';
import { BlockCard } from '../BlockCard';
import { KpiCard } from '../KpiCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Separator } from '@/components/ui/Separator';
import { Skeleton } from '@/components/ui/Skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Sparkles, 
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Wrench,
  PiggyBank,
  CheckCircle2,
  Target,
  ArrowRight,
} from 'lucide-react';
import type { OptimizationResult } from '@/types/fiscal';

interface OptimisationsTabProps {
  simulationId?: string;
  onGoToNewSimulation?: () => void;
}

export function OptimisationsTab({ simulationId, onGoToNewSimulation }: OptimisationsTabProps) {
  const [loading, setLoading] = useState(false);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formatEuro = (amount: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  // Charger l'optimisation
  useEffect(() => {
    loadOptimization();
  }, [simulationId]);

  const loadOptimization = async () => {
    setLoading(true);
    setError(null);

    try {
      const url = simulationId 
        ? `/api/fiscal/optimize?simulationId=${simulationId}`
        : '/api/fiscal/optimize';

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Aucune optimisation disponible');
      }

      const data = await response.json();
      setOptimization(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (error || !optimization) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || 'Aucune optimisation disponible'}
          </AlertDescription>
        </Alert>
        {onGoToNewSimulation && (
          <div className="mt-4 flex justify-center">
            <Button onClick={onGoToNewSimulation}>
              Créer une nouvelle simulation
            </Button>
          </div>
        )}
      </div>
    );
  }

  const { simulation, suggestions, works, comparison } = optimization;

  const formatPercent = (ratio: number) => `${(ratio * 100).toFixed(0)}%`;
  
  const maxRatio = comparison ? Math.max(
    comparison.per.ratio,
    comparison.travaux.ratio,
    comparison.combine.ratio
  ) : 1;

  // Calculer les totaux pour la simulation (depuis simulation.biens, pas inputs.biens)
  const totalRecettes = Number((simulation.biens || []).reduce((sum: number, b: any) => {
    const val = Number(b.recettesBrutes);
    if (isNaN(val)) {
      console.warn(`⚠️ recettesBrutes invalide pour bien:`, b);
      return sum;
    }
    return sum + val;
  }, 0));

  const totalCharges = Number((simulation.biens || []).reduce((sum: number, b: any) => {
    const val = Number(b.chargesDeductibles);
    if (isNaN(val)) {
      console.warn(`⚠️ chargesDeductibles invalide pour bien:`, b);
      return sum;
    }
    return sum + val;
  }, 0));

  const totalInterets = Number((simulation.biens || []).reduce((sum: number, b: any) => {
    const val = Number(b.breakdown?.total?.interetsEmprunt);
    if (isNaN(val)) return sum;
    return sum + val;
  }, 0));

  // Utiliser les valeurs du cashflow depuis simulation.cashflow s'il existe
  const cashflowBrut = simulation.cashflow?.cashflowBrut ?? (totalRecettes - totalCharges - totalInterets);
  const totalImpots = (simulation.ir?.impotNet || 0) + (simulation.ps?.montant || 0);
  const cashflowNet = simulation.cashflow?.cashflowNet ?? (cashflowBrut - totalImpots);
  const economiePotentielle = comparison?.combine?.economie || suggestions.reduce((sum, s) => sum + (s.economieEstimee || 0), 0);

  return (
    <div className="space-y-6 p-6">
      {/* Titre et sous-titre */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Optimisations fiscales
        </h2>
        <p className="text-gray-600">
          Découvrez les stratégies pour réduire vos impôts : PER, travaux, changements de régime
        </p>
      </div>

      {/* Résumé de la simulation utilisée */}
      <BlockCard
        title="Simulation utilisée pour l'optimisation"
        icon={<Sparkles className="h-5 w-5" />}
        actions={
          onGoToNewSimulation && (
            <Button variant="outline" size="sm" onClick={onGoToNewSimulation}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Nouvelle simulation
            </Button>
          )
        }
      >
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-yellow-900 mb-3 flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Résumé de la simulation
          </h3>
          <div className="space-y-4">
            {/* Ligne 1 : Infos principales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-yellow-700 mb-1">Année de déclaration</p>
                <p className="text-sm font-bold text-yellow-900">
                  {simulation.inputs.year + 1} (revenus {simulation.inputs.year})
                </p>
              </div>
              <div>
                <p className="text-xs text-yellow-700 mb-1">Salaire net imposable</p>
                <p className="text-sm font-bold text-yellow-900">
                  {formatEuro(simulation.inputs.foyer?.salaire || simulation.inputs.salaire)}
                </p>
              </div>
              <div>
                <p className="text-xs text-yellow-700 mb-1">Parts fiscales</p>
                <p className="text-sm font-bold text-yellow-900">
                  {simulation.inputs.foyer?.parts || simulation.inputs.parts} part{(simulation.inputs.foyer?.parts || simulation.inputs.parts) > 1 ? 's' : ''}
                </p>
              </div>
              <div>
                <p className="text-xs text-yellow-700 mb-1">Situation</p>
                <p className="text-sm font-bold text-yellow-900">
                  {simulation.inputs.foyer?.isCouple || simulation.inputs.isCouple ? 'En couple' : 'Célibataire'}
                </p>
              </div>
            </div>
            
            <Separator className="bg-yellow-200" />
            
            {/* Ligne 2 : Breakdown immobilier */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-yellow-700 mb-1">Biens immobiliers</p>
                <p className="text-sm font-bold text-yellow-900">
                  {simulation.biens?.length || 0} bien{(simulation.biens?.length || 0) > 1 ? 's' : ''}
                </p>
              </div>
              <div>
                <p className="text-xs text-yellow-700 mb-1">Loyers annuels</p>
                <p className="text-sm font-bold text-yellow-900">
                  {formatEuro(totalRecettes)}
                </p>
                {simulation.biens?.some((b: any) => b.breakdown) && (
                  <p className="text-xs text-yellow-600 mt-0.5">
                    Réalisé + Projeté ({simulation.biens[0]?.breakdown?.projection?.moisRestants || 0} mois restants)
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-yellow-700 mb-1">Charges + Intérêts</p>
                <p className="text-sm font-bold text-yellow-900">
                  {formatEuro(totalCharges + totalInterets)}
                </p>
                {totalInterets > 0 && (
                  <p className="text-xs text-yellow-600 mt-0.5">
                    dont {formatEuro(totalInterets)} d'intérêts
                  </p>
                )}
              </div>
            </div>
            
            {/* Ligne 3 : Version fiscale */}
            <div className="bg-yellow-100 border border-yellow-300 rounded p-2">
              <p className="text-xs text-yellow-700">
                Version fiscale : <span className="font-semibold text-yellow-900">{simulation.taxParams.version}</span>
              </p>
            </div>
          </div>
        </div>
      </BlockCard>

      {/* KPIs d'optimisation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          title="Cash-flow brut"
          value={formatEuro(cashflowBrut)}
          subtitle="Avant impôts"
          icon={<TrendingUp className="h-6 w-6" />}
          valueColor={cashflowBrut >= 0 ? 'text-emerald-600' : 'text-rose-600'}
        />

        <KpiCard
          title="Cash-flow net"
          value={formatEuro(cashflowNet)}
          subtitle="Après impôts"
          icon={<TrendingDown className="h-6 w-6" />}
          valueColor={cashflowNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}
        />

        <KpiCard
          title="Économie fiscale potentielle"
          value={formatEuro(economiePotentielle)}
          subtitle="Stratégie combinée"
          icon={<Sparkles className="h-6 w-6" />}
          valueColor="text-purple-600"
        />
      </div>

      {/* Hypothèses */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Les calculs sont basés sur vos données {simulation.inputs.year}. Les prélèvements sociaux ne sont pas impactés par le déficit foncier en Phase 2. Consultez un expert-comptable pour validation.
        </AlertDescription>
      </Alert>

      {/* ========== STRATÉGIE TRAVAUX (Phase 1 & 2) ========== */}
      {works && (
        <BlockCard
          title="Stratégie d'optimisation par les travaux"
          icon={<Wrench className="h-5 w-5 text-orange-600" />}
        >
          <div className="space-y-6">
            {/* Phase 1 */}
            <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border-2 border-green-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-green-900 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Phase 1
                </h4>
                <Badge variant="default" className="bg-green-600">
                  Prioritaire
                </Badge>
              </div>
              
              <p className="text-sm text-green-800 mb-4 font-medium">
                {works.phase1.objectif}
              </p>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-green-700">Montant de travaux :</span>
                  <span className="font-bold text-green-900">
                    {formatEuro(works.phase1.montantCible)}
                  </span>
                </div>
                
                <div className="bg-white/60 p-3 rounded space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Économie IR :</span>
                    <span className="font-semibold text-green-600">
                      {formatEuro(works.phase1.economieIR)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Économie PS :</span>
                    <span className="font-semibold text-green-600">
                      {formatEuro(works.phase1.economiePS)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1 mt-1">
                    <span className="text-gray-900">Total économisé :</span>
                    <span className="text-green-600">
                      {formatEuro(works.phase1.economieTotal)}
                    </span>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-green-700">Ratio € économisé / € investi :</span>
                    <span className="font-bold text-green-900">
                      {formatPercent(works.phase1.ratioEconomieSurInvest)}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(works.phase1.ratioEconomieSurInvest * 100, 100)}
                    className="h-3"
                  />
                  <p className="text-xs text-green-700 mt-1">
                    Pour chaque 100€ investis, vous économisez{' '}
                    {formatEuro(works.phase1.ratioEconomieSurInvest * 100)} d'impôts
                  </p>
                </div>
              </div>
            </div>
            
            {/* Phase 2 */}
            <div className="p-4 bg-gradient-to-br from-blue-50 to-sky-50 rounded-lg border-2 border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Phase 2
                </h4>
                <Badge variant="secondary">
                  Optionnelle
                </Badge>
              </div>
              
              <p className="text-sm text-blue-800 mb-4 font-medium">
                {works.phase2.objectif}
              </p>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-blue-700">Montant de travaux :</span>
                  <span className="font-bold text-blue-900">
                    {formatEuro(works.phase2.montantCible)}
                  </span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-blue-700">Déficit créé :</span>
                  <span className="font-bold text-blue-900">
                    {formatEuro(works.phase2.deficitCree)}
                  </span>
                </div>
                
                <div className="bg-white/60 p-3 rounded space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Économie IR :</span>
                    <span className="font-semibold text-green-600">
                      {formatEuro(works.phase2.economieIR)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1 mt-1">
                    <span className="text-gray-900">Total économisé :</span>
                    <span className="text-green-600">
                      {formatEuro(works.phase2.economieTotal)}
                    </span>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-blue-700">Ratio € économisé / € investi :</span>
                    <span className="font-bold text-blue-900">
                      {formatPercent(works.phase2.ratioEconomieSurInvest)}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(works.phase2.ratioEconomieSurInvest * 100, 100)}
                    className="h-3"
                  />
                </div>
                
                <Alert variant="default" className="bg-orange-50 border-orange-200">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-xs text-orange-800">
                    {works.phase2.avertissement}
                  </AlertDescription>
                </Alert>
              </div>
            </div>
            
            {/* Recommandation globale */}
            <div className="p-4 bg-purple-50 rounded-lg border-2 border-purple-200">
              <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Recommandation
              </h4>
              <p className="text-sm text-purple-800 mb-3">{works.recommandation}</p>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white/60 p-2 rounded">
                  <p className="text-gray-600 text-xs">Total investissement</p>
                  <p className="font-bold text-gray-900">
                    {formatEuro(works.totalInvestissement)}
                  </p>
                </div>
                <div className="bg-white/60 p-2 rounded">
                  <p className="text-gray-600 text-xs">Total économie</p>
                  <p className="font-bold text-green-600">
                    {formatEuro(works.totalEconomie)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </BlockCard>
      )}

      {/* ========== COMPARAISON DES STRATÉGIES ========== */}
      {comparison && (
        <BlockCard
          title="Comparaison des stratégies"
          icon={<Sparkles className="h-5 w-5 text-yellow-600" />}
        >
          <div className="space-y-6">
            {/* Stratégie PER */}
            <div className={`p-4 rounded-lg border-2 transition-all ${
              comparison.strategyRecommendation === 'per'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 bg-gray-50'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <PiggyBank className="h-5 w-5 text-blue-600" />
                  <h4 className="font-semibold">Plan Épargne Retraite</h4>
                </div>
                {comparison.strategyRecommendation === 'per' && (
                  <Badge variant="default" className="bg-green-600">
                    Recommandé
                  </Badge>
                )}
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Investissement :</span>
                  <span className="font-medium">{formatEuro(comparison.per.investissement)}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Économie fiscale :</span>
                  <span className="font-semibold text-green-600">
                    {formatEuro(comparison.per.economie)}
                  </span>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Ratio € économisé / € investi :</span>
                    <span className="font-bold">{formatPercent(comparison.per.ratio)}</span>
                  </div>
                  <Progress
                    value={(comparison.per.ratio / maxRatio) * 100}
                    className="h-2"
                  />
                </div>
                
                <p className="text-xs text-gray-500 italic mt-2">
                  {comparison.per.disponibilite}
                </p>
              </div>
            </div>
            
            {/* Stratégie Travaux */}
            <div className={`p-4 rounded-lg border-2 transition-all ${
              comparison.strategyRecommendation === 'travaux'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 bg-gray-50'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-orange-600" />
                  <h4 className="font-semibold">Travaux déductibles</h4>
                </div>
                {comparison.strategyRecommendation === 'travaux' && (
                  <Badge variant="default" className="bg-green-600">
                    Recommandé
                  </Badge>
                )}
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Investissement :</span>
                  <span className="font-medium">{formatEuro(comparison.travaux.investissement)}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Économie fiscale :</span>
                  <span className="font-semibold text-green-600">
                    {formatEuro(comparison.travaux.economie)}
                  </span>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Ratio € économisé / € investi :</span>
                    <span className="font-bold">{formatPercent(comparison.travaux.ratio)}</span>
                  </div>
                  <Progress
                    value={(comparison.travaux.ratio / maxRatio) * 100}
                    className="h-2"
                  />
                </div>
                
                <p className="text-xs text-gray-500 italic mt-2">
                  {comparison.travaux.disponibilite}
                </p>
              </div>
            </div>
            
            {/* Stratégie combinée */}
            <div className={`p-4 rounded-lg border-2 transition-all ${
              comparison.strategyRecommendation === 'combine'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 bg-gray-50'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                  <h4 className="font-semibold">Stratégie combinée</h4>
                </div>
                {comparison.strategyRecommendation === 'combine' && (
                  <Badge variant="default" className="bg-green-600">
                    Recommandé
                  </Badge>
                )}
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Investissement total :</span>
                  <span className="font-medium">{formatEuro(comparison.combine.investissement)}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Économie fiscale totale :</span>
                  <span className="font-semibold text-green-600">
                    {formatEuro(comparison.combine.economie)}
                  </span>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Ratio global :</span>
                    <span className="font-bold">{formatPercent(comparison.combine.ratio)}</span>
                  </div>
                  <Progress
                    value={(comparison.combine.ratio / maxRatio) * 100}
                    className="h-2"
                  />
                </div>
              </div>
            </div>
            
            {/* Recommandation */}
            <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
              <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Recommandation
              </h4>
              <p className="text-sm text-blue-800">{comparison.reasoning}</p>
            </div>
          </div>
        </BlockCard>
      )}

      {/* ========== SUGGESTIONS SUPPLÉMENTAIRES ========== */}
      {suggestions.length > 0 && (
        <BlockCard
          title="Suggestions supplémentaires"
          icon={<TrendingUp className="h-5 w-5 text-purple-600" />}
        >
          <div className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <div
                key={index}
                className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900">{suggestion.titre}</h4>
                      <Badge
                        variant={
                          suggestion.complexite === 'facile'
                            ? 'default'
                            : suggestion.complexite === 'moyenne'
                            ? 'outline'
                            : 'secondary'
                        }
                        className={`text-xs ${
                          suggestion.complexite === 'facile'
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                            : suggestion.complexite === 'moyenne'
                            ? 'bg-orange-100 text-orange-700 border-orange-300'
                            : 'bg-gray-100 text-gray-700 border-gray-300'
                        }`}
                      >
                        {suggestion.complexite}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{suggestion.description}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-xs text-gray-500">Économie estimée</p>
                    <p className="font-bold text-green-600">
                      {formatEuro(Math.round(suggestion.economieEstimee))}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </BlockCard>
      )}

      {/* Message si aucune suggestion */}
      {suggestions.length === 0 && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            Votre simulation est déjà optimale ! Aucune suggestion d'amélioration n'a été trouvée.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

