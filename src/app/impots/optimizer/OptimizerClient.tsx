/**
 * OptimizerClient - Client de l'optimiseur fiscal
 * 
 * Comparateur PER vs Travaux avec stratégies d'optimisation
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Sparkles,
  TrendingUp,
  Calculator,
  FileDown,
  AlertCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import {
  FiscalKPICard,
  OptimizationComparisonCard,
  WorksStrategyCard,
} from '@/components/fiscal';
import type { OptimizationResult } from '@/types/fiscal';

export default function OptimizerClient() {
  const [loading, setLoading] = useState(false);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);
  const [simulations, setSimulations] = useState<any[]>([]);
  const [selectedSimulationId, setSelectedSimulationId] = useState<string>('');
  
  // Auto-charger la liste des simulations et la dernière
  useEffect(() => {
    loadSimulationsListAndLast();
  }, []);
  
  /**
   * Charge la liste des simulations ET la dernière
   */
  const loadSimulationsListAndLast = async () => {
    try {
      // 1. Charger la liste d'abord
      const response = await fetch('/api/fiscal/simulations?limit=20');
      if (response.ok) {
        const data = await response.json();
        const loadedSimulations = data.simulations || [];
        setSimulations(loadedSimulations);
        
        // 2. Si on a des simulations, pré-sélectionner la première
        if (loadedSimulations.length > 0) {
          setSelectedSimulationId(loadedSimulations[0].id);
        }
      }
    } catch (error) {
      console.error('Erreur chargement liste simulations:', error);
    }
    
    // 3. Charger l'optimisation de la dernière simulation
    await loadLastSimulation();
  };
  
  /**
   * Charge la liste des simulations sauvegardées
   */
  const loadSimulationsList = async () => {
    try {
      const response = await fetch('/api/fiscal/simulations?limit=20');
      if (response.ok) {
        const data = await response.json();
        setSimulations(data.simulations || []);
      }
    } catch (error) {
      console.error('Erreur chargement liste simulations:', error);
    }
  };
  
  /**
   * Charge une simulation (par ID ou la dernière si ID non fourni)
   */
  const loadLastSimulation = async (simulationId?: string) => {
    setLoading(true);
    
    try {
      // Récupérer la simulation (spécifique ou dernière)
      const url = simulationId 
        ? `/api/fiscal/optimize?simulationId=${simulationId}`
        : '/api/fiscal/optimize';
      
      console.log(`🔄 Chargement optimisation depuis: ${url}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Aucune simulation disponible');
      }
      
      const result: OptimizationResult = await response.json();
      setOptimization(result);
      
      console.log(`✅ Optimisation chargée:`, {
        cashflowBrut: result.simulation.cashflow.cashflowBrut,
        cashflowNet: result.simulation.cashflow.cashflowNet,
        economiePotentielle: result.comparison.combine.economie,
      });
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Gère le changement de simulation dans le sélecteur
   */
  const handleSimulationChange = (simulationId: string) => {
    setSelectedSimulationId(simulationId);
    loadLastSimulation(simulationId);
  };
  
  const formatEuro = (amount: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  
  const formatPercent = (rate: number) => `${(rate * 100).toFixed(1)}%`;
  
  return (
    <div className="space-y-6 p-6">
      {/* ========== HEADER ========== */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-yellow-600" />
          Optimisation fiscale
        </h1>
        <p className="text-gray-600 mt-2">
          Comparez les stratégies PER et travaux pour maximiser vos économies d'impôts
        </p>
      </div>
      
      {/* Bannière version fiscale */}
      {optimization && optimization.taxParams && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">
                Version fiscale : <strong>{optimization.taxParams.version}</strong> (année {optimization.taxParams.year})
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Source : {optimization.taxParams.source} • 
                Dernière MAJ : {new Date(optimization.taxParams.dateMAJ).toLocaleDateString('fr-FR')} • 
                Validé par : {optimization.taxParams.validatedBy}
              </p>
            </div>
            {(optimization.taxParams.version === '2025.1' || optimization.taxParams.version === '2024.1') && (
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                Fallback (BDD vide)
              </Badge>
            )}
            {optimization.taxParams.version.includes('scrape') && (
              <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
                Scraping officiel
              </Badge>
            )}
          </div>
        </div>
      )}
      
      {/* ========== SÉLECTEUR DE SIMULATION ========== */}
      {simulations.length > 0 && (
        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Ligne 1 : Titre + Sélecteur + Bouton */}
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700 mb-2 block flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-blue-600" />
                    Simulation utilisée pour l'optimisation
                  </label>
                  <select
                    value={selectedSimulationId}
                    onChange={(e) => handleSimulationChange(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    disabled={loading}
                  >
                    {simulations.map((sim) => (
                      <option key={sim.id} value={sim.id}>
                        {sim.name} • {new Date(sim.createdAt).toLocaleDateString('fr-FR', { 
                          day: '2-digit', 
                          month: '2-digit', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  onClick={() => (window.location.href = '/impots/simulation')}
                  variant="outline"
                  className="h-10"
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Nouvelle simulation
                </Button>
              </div>
              
              {/* Ligne 2 : Encart jaune avec résumé */}
              {optimization && optimization.simulation && (
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
                          {optimization.simulation.inputs.year + 1} (revenus {optimization.simulation.inputs.year})
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-yellow-700 mb-1">Salaire net imposable</p>
                        <p className="text-sm font-bold text-yellow-900">
                          {formatEuro(optimization.simulation.inputs.foyer.salaire)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-yellow-700 mb-1">Parts fiscales</p>
                        <p className="text-sm font-bold text-yellow-900">
                          {optimization.simulation.inputs.foyer.parts} part{optimization.simulation.inputs.foyer.parts > 1 ? 's' : ''}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-yellow-700 mb-1">Situation</p>
                        <p className="text-sm font-bold text-yellow-900">
                          {optimization.simulation.inputs.foyer.isCouple ? 'En couple' : 'Célibataire'}
                        </p>
                      </div>
                    </div>
                    
                    <Separator className="bg-yellow-200" />
                    
                    {/* Ligne 2 : Breakdown immobilier */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-yellow-700 mb-1">Biens immobiliers</p>
                        <p className="text-sm font-bold text-yellow-900">
                          {optimization.simulation.biens.length} bien{optimization.simulation.biens.length > 1 ? 's' : ''}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-yellow-700 mb-1">Loyers annuels</p>
                        <p className="text-sm font-bold text-yellow-900">
                          {(() => {
                            const total = (optimization.simulation.biens || []).reduce((sum: number, b: any) => {
                              const val = Number(b.recettesBrutes);
                              if (isNaN(val)) {
                                console.warn(`⚠️ recettesBrutes invalide pour bien:`, b);
                                return sum;
                              }
                              return sum + val;
                            }, 0);
                            return formatEuro(total);
                          })()}
                        </p>
                        {optimization.simulation.biens.some((b: any) => b.breakdown) && (
                          <p className="text-xs text-yellow-600 mt-0.5">
                            Réalisé + Projeté ({optimization.simulation.biens[0]?.breakdown?.projection?.moisRestants || 0} mois restants)
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-yellow-700 mb-1">Charges + Intérêts</p>
                        <p className="text-sm font-bold text-yellow-900">
                          {(() => {
                            const total = (optimization.simulation.biens || []).reduce((sum: number, b: any) => {
                              const val = Number(b.chargesDeductibles);
                              if (isNaN(val)) {
                                console.warn(`⚠️ chargesDeductibles invalide pour bien:`, b);
                                return sum;
                              }
                              return sum + val;
                            }, 0);
                            return formatEuro(total);
                          })()}
                        </p>
                        {optimization.simulation.biens.some((b: any) => b.breakdown) && (
                          <p className="text-xs text-yellow-600 mt-0.5">
                            dont {(() => {
                              const total = (optimization.simulation.biens || []).reduce((sum: number, b: any) => {
                                const val = Number(b.breakdown?.total?.interetsEmprunt);
                                if (isNaN(val)) return sum;
                                return sum + val;
                              }, 0);
                              return formatEuro(total);
                            })()} d'intérêts
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Ligne 3 : Version fiscale */}
                    <div className="bg-yellow-100 border border-yellow-300 rounded p-2">
                      <p className="text-xs text-yellow-700">
                        Version fiscale : <span className="font-semibold text-yellow-900">{optimization.simulation.taxParams.version}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Si aucune simulation, afficher un message */}
      {simulations.length === 0 && !loading && (
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => (window.location.href = '/impots/simulation')}
          >
            <ArrowRight className="mr-2 h-4 w-4" />
            Créer une nouvelle simulation
          </Button>
        </div>
      )}
      
      {/* ========== CONTENU ========== */}
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      )}
      
      {!loading && !optimization && (
        <Card className="p-12">
          <div className="text-center text-gray-500">
            <Sparkles className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">Aucune optimisation disponible</p>
            <p className="text-sm mt-2 mb-6">
              Créez d'abord une simulation fiscale pour voir les optimisations possibles
            </p>
            <Button onClick={() => (window.location.href = '/impots/simulation')}>
              Aller à la simulation
            </Button>
          </div>
        </Card>
      )}
      
      {!loading && optimization && (
        <div className="space-y-6">
          {/* ========== KPIs GLOBAUX ========== */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FiscalKPICard
              title="Cash-flow brut"
              value={optimization.simulation.cashflow.cashflowBrut}
              icon={TrendingUp}
              iconColor="text-green-600"
              badge={{
                text: 'Avant impôts',
                variant: 'default',
              }}
            />
            
            <FiscalKPICard
              title="Cash-flow net"
              value={optimization.simulation.cashflow.cashflowNet}
              icon={TrendingUp}
              iconColor="text-blue-600"
              badge={{
                text: 'Après impôts',
                variant: 'secondary',
              }}
            />
            
            <FiscalKPICard
              title="Économie fiscale potentielle"
              value={optimization.comparison.combine.economie}
              icon={Sparkles}
              iconColor="text-yellow-600"
              badge={{
                text: 'Stratégie combinée',
                variant: 'default',
              }}
            />
          </div>
          
          {/* ========== ALERTE HYPOTHÈSES ========== */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Hypothèses :</strong> Les calculs sont basés sur vos données {optimization.simulation.inputs.year}.
              Les prélèvements sociaux ne sont pas impactés par le déficit foncier en Phase 2.
              Consultez un expert-comptable pour validation.
            </AlertDescription>
          </Alert>
          
          {/* ========== STRATÉGIE TRAVAUX ========== */}
          <WorksStrategyCard strategy={optimization.works} />
          
          {/* ========== COMPARAISON PER vs TRAVAUX ========== */}
          <OptimizationComparisonCard comparison={optimization.comparison} />
          
          {/* ========== SUGGESTIONS SUPPLÉMENTAIRES ========== */}
          {optimization.suggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                  Suggestions supplémentaires
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {optimization.suggestions.map((suggestion, index) => (
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
                                ? 'success'
                                : suggestion.complexite === 'moyenne'
                                ? 'default'
                                : 'secondary'
                            }
                            className="text-xs"
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
              </CardContent>
            </Card>
          )}
          
          {/* ========== ACTIONS ========== */}
          <div className="flex gap-3">
            <Button
              onClick={() => (window.location.href = '/impots/simulation')}
              variant="outline"
            >
              Modifier la simulation
            </Button>
            
            <Button onClick={() => alert('Export PDF en développement')}>
              <FileDown className="mr-2 h-4 w-4" />
              Télécharger le rapport PDF
            </Button>
          </div>
          
          {/* ========== INFOS VERSION ========== */}
          <div className="text-xs text-gray-500 text-center">
            Optimisations calculées le{' '}
            {new Date(optimization.simulation.dateCalcul).toLocaleString('fr-FR')} •
            Barèmes {optimization.simulation.taxParams.version}
          </div>
        </div>
      )}
    </div>
  );
}

