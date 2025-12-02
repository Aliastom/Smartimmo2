/**
 * Blocs experts pour l'onglet "Déclaration fiscale"
 * Version accordions avec couleurs indigo
 */

'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useExpertModeStore } from '@/store/expertModeStore';
import type { SimulationResult } from '@/types/fiscal';
import { 
  CheckCircle2, 
  AlertCircle,
  RotateCcw,
  Copy,
  Trash2,
  Play,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ExpertDeclarationBlocksProps {
  simulation: SimulationResult;
}

export function ExpertDeclarationBlocks({ simulation }: ExpertDeclarationBlocksProps) {
  const { overrides, setOverride, resetOverrides, scenarios, addScenario, removeScenario } = useExpertModeStore();
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['form-checks']));
  const [newScenarioName, setNewScenarioName] = useState('');
  const [showNewScenario, setShowNewScenario] = useState(false);

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const formatEuro = (amount: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  const hasOverrides = Object.keys(overrides).length > 0;

  // Contrôles 2042/2044
  const checks2042 = [
    { case: '1AJ', label: 'Salaire renseigné', valid: simulation.inputs.foyer.salaire > 0, value: simulation.inputs.foyer.salaire },
    { case: '4BA', label: 'Revenus fonciers', valid: true, value: simulation.consolidation.revenusFonciers },
  ];
  if (simulation.per) checks2042.push({ case: '6NS', label: 'PER déclaré', valid: simulation.per.deductionUtilisee > 0, value: simulation.per.deductionUtilisee });

  const checks2044 = [
    { case: '211', label: 'Loyers', valid: simulation.biens.reduce((sum, b) => sum + b.recettesBrutes, 0) > 0, value: simulation.biens.reduce((sum, b) => sum + b.recettesBrutes, 0) },
    { case: '229', label: 'Charges', valid: true, value: simulation.biens.reduce((sum, b) => sum + b.chargesDeductibles, 0) },
    { case: '420', label: 'Résultat cohérent', valid: true, value: simulation.consolidation.revenusFonciers },
  ];

  const allValid2042 = checks2042.every(c => c.valid);
  const allValid2044 = checks2044.every(c => c.valid);

  return (
    <div className="space-y-6 mt-8 border-t-2 border-indigo-200 pt-8">
      {/* Bandeau */}
      <div className="space-y-3">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 border border-indigo-300 rounded-full">
            <span className="text-xs font-semibold text-indigo-800">🧠 MODE EXPERT ACTIVÉ - DÉCLARATION</span>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
          <p className="text-xs text-amber-900 font-medium text-center">
            ⚠️ Les modifications en mode expert peuvent impacter les calculs et les exports.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {/* ACCORDION 1 : Contrôle formulaires */}
        <Card className="border border-indigo-200 overflow-hidden">
          <button onClick={() => toggleSection('form-checks')} className="w-full flex items-center justify-between p-4 hover:bg-indigo-50/50 transition-colors">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-indigo-600" />
              <span className="font-semibold text-gray-900">Contrôle des formulaires</span>
              <Badge variant="outline" className="bg-indigo-100 text-indigo-700 border-indigo-300 text-xs">Expert</Badge>
            </div>
            {openSections.has('form-checks') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {openSections.has('form-checks') && (
            <div className="border-t border-indigo-100 bg-white p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900">Formulaire 2042</h4>
                    <Badge variant="outline" className={allValid2042 ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-amber-100 text-amber-700 border-amber-300'}>
                      {allValid2042 ? '✅ OK' : '⚠️ À vérifier'}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {checks2042.map((check, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {check.valid ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <AlertCircle className="h-3 w-3 text-amber-600" />}
                          <span className="text-gray-700">{check.case} : {check.label}</span>
                        </div>
                        <span className="font-mono text-gray-600">{formatEuro(check.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-900">Formulaire 2044</h4>
                    <Badge variant="outline" className={allValid2044 ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-amber-100 text-amber-700 border-amber-300'}>
                      {allValid2044 ? '✅ OK' : '⚠️ À vérifier'}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {checks2044.map((check, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {check.valid ? <CheckCircle2 className="h-3 w-3 text-emerald-600" /> : <AlertCircle className="h-3 w-3 text-amber-600" />}
                          <span className="text-gray-700">{check.case} : {check.label}</span>
                        </div>
                        <span className="font-mono text-gray-600">{formatEuro(check.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* ACCORDION 2 : Overrides */}
        <Card className="border border-indigo-200 overflow-hidden">
          <button onClick={() => toggleSection('overrides')} className="w-full flex items-center justify-between p-4 hover:bg-indigo-50/50 transition-colors">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-indigo-600" />
              <span className="font-semibold text-gray-900">Overrides manuels (what-if avancé)</span>
              <Badge variant="outline" className="bg-indigo-100 text-indigo-700 border-indigo-300 text-xs">Expert</Badge>
            </div>
            {openSections.has('overrides') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {openSections.has('overrides') && (
            <div className="border-t border-indigo-100 bg-white p-5">
              {hasOverrides && (
                <div className="bg-amber-50 border border-amber-300 rounded p-3 mb-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-amber-900 font-medium">
                      ⚠️ Scénario simulé. Les montants peuvent différer de votre situation réelle.
                    </p>
                    <Button variant="outline" size="sm" onClick={resetOverrides} className="text-xs">
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Reset
                    </Button>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {[
                  { key: 'revenuImposable' as const, label: 'Case 1AJ - Salaire', value: simulation.inputs.foyer.salaire },
                  { key: 'revenuFoncier' as const, label: 'Case 4BA - Foncier', value: simulation.consolidation.revenusFonciers },
                  ...(simulation.per ? [{ key: 'perDeduction' as const, label: 'Case 6NS - PER', value: simulation.per.deductionUtilisee }] : []),
                ].map(({ key, label, value }) => (
                  <div key={key}>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">{label}</label>
                    <div className="relative">
                      <Input type="number" value={overrides[key] ?? value} onChange={(e) => setOverride(key, parseFloat(e.target.value) || 0)} className="text-sm pr-8" />
                      {overrides[key] !== undefined && (
                        <button onClick={() => setOverride(key, undefined)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          <RotateCcw className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Valeur réelle : {formatEuro(value)}</p>
                  </div>
                ))}
              </div>

              {/* IMPACT EN TEMPS RÉEL */}
              {hasOverrides && (() => {
                const salaireOverride = overrides.revenuImposable ?? simulation.inputs.foyer.salaire;
                const foncierOverride = overrides.revenuFoncier ?? simulation.consolidation.revenusFonciers;
                const perOverride = overrides.perDeduction ?? (simulation.per?.deductionUtilisee || 0);
                
                const revenuImposableNew = salaireOverride + foncierOverride - perOverride;
                const revenuImposableOld = simulation.ir.revenuImposable;
                const deltaRevenu = revenuImposableNew - revenuImposableOld;
                
                const irOld = simulation.ir.impotNet;
                const irImpactEstime = deltaRevenu * simulation.ir.trancheMarginate;
                const irNew = Math.max(0, irOld + irImpactEstime);
                
                const psOld = simulation.ps.montant || 0;
                const psNew = psOld; // PS non impacté par PER
                
                const totalOld = irOld + psOld;
                const totalNew = irNew + psNew;
                
                return (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-indigo-300 rounded-lg p-5">
                    <h4 className="font-bold text-indigo-900 mb-4 flex items-center gap-2">
                      <span className="text-lg">⚡</span>
                      IMPACT EN TEMPS RÉEL
                    </h4>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b-2 border-indigo-200">
                            <th className="text-left p-2 font-semibold text-gray-700">Indicateur</th>
                            <th className="text-right p-2 font-semibold text-gray-700">Baseline</th>
                            <th className="text-right p-2 font-semibold text-indigo-700">Avec override</th>
                            <th className="text-right p-2 font-semibold text-gray-700">Δ</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-indigo-100">
                            <td className="p-2 text-gray-700">Revenu imposable</td>
                            <td className="p-2 text-right font-mono text-gray-900">{formatEuro(revenuImposableOld)}</td>
                            <td className="p-2 text-right font-mono font-bold text-indigo-600">{formatEuro(revenuImposableNew)}</td>
                            <td className={`p-2 text-right font-bold ${deltaRevenu < 0 ? 'text-emerald-600' : 'text-orange-600'}`}>
                              {deltaRevenu >= 0 ? '+' : ''}{formatEuro(deltaRevenu)}
                            </td>
                          </tr>
                          <tr className="border-b border-indigo-100">
                            <td className="p-2 text-gray-700">IR (estimé TMI {((simulation.ir.trancheMarginate || 0) * 100).toFixed(0)}%)</td>
                            <td className="p-2 text-right font-mono text-gray-900">{formatEuro(irOld)}</td>
                            <td className="p-2 text-right font-mono font-bold text-indigo-600">{formatEuro(irNew)}</td>
                            <td className={`p-2 text-right font-bold ${irNew < irOld ? 'text-emerald-600' : 'text-orange-600'}`}>
                              {irNew - irOld >= 0 ? '+' : ''}{formatEuro(irNew - irOld)}
                            </td>
                          </tr>
                          <tr className="border-b border-indigo-100">
                            <td className="p-2 text-gray-700">PS (non impacté)</td>
                            <td className="p-2 text-right font-mono text-gray-900">{formatEuro(psOld)}</td>
                            <td className="p-2 text-right font-mono text-gray-400">{formatEuro(psNew)}</td>
                            <td className="p-2 text-right text-gray-400">0€</td>
                          </tr>
                          <tr className="bg-indigo-50 border-t-2 border-indigo-300">
                            <td className="p-2 font-bold text-gray-900">Total impôts</td>
                            <td className="p-2 text-right font-mono font-bold text-gray-900">{formatEuro(totalOld)}</td>
                            <td className="p-2 text-right font-mono font-bold text-indigo-700 text-lg">{formatEuro(totalNew)}</td>
                            <td className={`p-2 text-right font-bold text-lg ${totalNew < totalOld ? 'text-emerald-600' : 'text-orange-600'}`}>
                              {totalNew - totalOld >= 0 ? '+' : ''}{formatEuro(totalNew - totalOld)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-indigo-200 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const scenarioName = `Scénario ${String.fromCharCode(66 + scenarios.length)}`; // B, C, D...
                          addScenario(scenarioName, { ...overrides });
                        }}
                        className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Ajouter au comparateur
                      </Button>
                    </div>
                    
                    <p className="text-xs text-indigo-700 mt-3 italic">
                      💡 Calcul estimé basé sur votre TMI actuel. Le calcul réel peut varier si vous changez de tranche.
                    </p>
                  </div>
                );
              })()}
            </div>
          )}
        </Card>

        {/* ACCORDION 3 : Scénarios */}
        <Card className="border border-indigo-200 overflow-hidden">
          <button onClick={() => toggleSection('scenarios')} className="w-full flex items-center justify-between p-4 hover:bg-indigo-50/50 transition-colors">
            <div className="flex items-center gap-2">
              <Copy className="h-4 w-4 text-indigo-600" />
              <span className="font-semibold text-gray-900">Comparateur de scénarios</span>
              <Badge variant="outline" className="bg-indigo-100 text-indigo-700 border-indigo-300 text-xs">Expert</Badge>
              {scenarios.length > 0 && (
                <Badge variant="outline" className="bg-gray-100 text-gray-700 text-xs">{scenarios.length}</Badge>
              )}
            </div>
            {openSections.has('scenarios') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {openSections.has('scenarios') && (
            <div className="border-t border-indigo-100 bg-white p-5 space-y-4">
              <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">Scénario A : Situation actuelle</h4>
                    <p className="text-xs text-gray-600 mt-1">Basé sur les données SmartImmo</p>
                  </div>
                  <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">Référence</Badge>
                </div>
                
                {/* Variables d'entrée */}
                <div className="bg-white/70 rounded p-3 mb-3 border border-purple-200">
                  <p className="text-xs font-semibold text-gray-700 mb-2">📥 Variables d'entrée :</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Salaire (1AJ)</span>
                      <span className="font-mono text-gray-900">{formatEuro(simulation.inputs.foyer.salaire)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Foncier (4BA)</span>
                      <span className="font-mono text-gray-900">{formatEuro(simulation.consolidation.revenusFonciers)}</span>
                    </div>
                    {simulation.per && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">PER (6NS)</span>
                        <span className="font-mono text-gray-900">{formatEuro(simulation.per.deductionUtilisee)}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Résultats */}
                <div className="grid grid-cols-4 gap-3 text-xs">
                  {[
                    { label: 'IR', value: simulation.ir.impotNet, color: 'orange' },
                    { label: 'PS', value: simulation.ps.montant || 0, color: 'orange' },
                    { label: 'Total', value: simulation.ir.impotNet + (simulation.ps.montant || 0), color: 'orange' },
                    { label: 'Rendement', value: `${((simulation.resume?.rendementNet || 0) * 100).toFixed(1)}%`, color: 'emerald', isPercent: true },
                  ].map((item, i) => (
                    <div key={i}>
                      <p className="text-gray-600 mb-1">{item.label}</p>
                      <p className={`font-bold text-${item.color}-600`}>{item.isPercent ? item.value : formatEuro(item.value as number)}</p>
                    </div>
                  ))}
                </div>
              </div>
              {scenarios.map((scenario, index) => {
                // Calculer les impacts du scénario
                const salaireScenario = scenario.overrides.revenuImposable ?? simulation.inputs.foyer.salaire;
                const foncierScenario = scenario.overrides.revenuFoncier ?? simulation.consolidation.revenusFonciers;
                const perScenario = scenario.overrides.perDeduction ?? (simulation.per?.deductionUtilisee || 0);
                
                const revenuImposableScenario = salaireScenario + foncierScenario - perScenario;
                const deltaRevenu = revenuImposableScenario - simulation.ir.revenuImposable;
                const irImpact = deltaRevenu * simulation.ir.trancheMarginate;
                const irScenario = Math.max(0, simulation.ir.impotNet + irImpact);
                const psScenario = simulation.ps.montant || 0; // PS non impacté
                const totalScenario = irScenario + psScenario;
                
                // Calcul rendement (simplifié)
                const loyersBruts = simulation.biens?.reduce((sum, b) => sum + (b.recettesBrutes || 0), 0) || 0;
                const chargesTotal = simulation.biens?.reduce((sum, b) => sum + (b.chargesDeductibles || 0), 0) || 0;
                const beneficeNetScenario = loyersBruts - chargesTotal - (totalScenario - (simulation.resume?.impotsSuppTotal || 0));
                const rendementScenario = loyersBruts > 0 ? (beneficeNetScenario / loyersBruts) * 100 : 0;
                
                return (
                  <div key={scenario.id} className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">{scenario.name}</h4>
                        <p className="text-xs text-gray-600 mt-1">
                          {Object.keys(scenario.overrides).length} variable(s) modifiée(s)
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs text-indigo-600"
                          onClick={() => {
                            Object.entries(scenario.overrides).forEach(([key, value]) => {
                              if (value !== undefined) {
                                setOverride(key as any, value);
                              }
                            });
                          }}
                        >
                          <Play className="h-3 w-3 mr-1" />Appliquer
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => removeScenario(scenario.id)} 
                          className="text-xs text-red-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Variables modifiées */}
                    {Object.keys(scenario.overrides).length > 0 && (
                      <div className="bg-white/70 rounded p-3 mb-3 border border-blue-300">
                        <p className="text-xs font-semibold text-gray-700 mb-2">🔄 Variables modifiées :</p>
                        <div className="space-y-1 text-xs">
                          {scenario.overrides.revenuImposable !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Salaire (1AJ)</span>
                              <span className="font-mono text-blue-700 font-bold">
                                {formatEuro(scenario.overrides.revenuImposable)}
                                <span className="text-gray-500 ml-2">({formatEuro(scenario.overrides.revenuImposable - simulation.inputs.foyer.salaire)})</span>
                              </span>
                            </div>
                          )}
                          {scenario.overrides.revenuFoncier !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Foncier (4BA)</span>
                              <span className="font-mono text-blue-700 font-bold">
                                {formatEuro(scenario.overrides.revenuFoncier)}
                                <span className="text-gray-500 ml-2">({formatEuro(scenario.overrides.revenuFoncier - simulation.consolidation.revenusFonciers)})</span>
                              </span>
                            </div>
                          )}
                          {scenario.overrides.perDeduction !== undefined && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">PER (6NS)</span>
                              <span className="font-mono text-blue-700 font-bold">
                                {formatEuro(scenario.overrides.perDeduction)}
                                <span className="text-gray-500 ml-2">({formatEuro(scenario.overrides.perDeduction - (simulation.per?.deductionUtilisee || 0))})</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Résultats */}
                    <div className="grid grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="text-gray-600 mb-1">IR</p>
                        <p className="font-bold text-orange-600">{formatEuro(irScenario)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 mb-1">PS</p>
                        <p className="font-bold text-orange-600">{formatEuro(psScenario)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 mb-1">Total</p>
                        <p className="font-bold text-orange-600">{formatEuro(totalScenario)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 mb-1">Rendement</p>
                        <p className="font-bold text-emerald-600">{rendementScenario.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
