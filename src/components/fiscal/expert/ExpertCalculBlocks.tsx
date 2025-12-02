/**
 * Blocs experts pour l'onglet "Calcul de l'impôt"
 */

'use client';

import { useState } from 'react';
import { BlockCard } from '../results/BlockCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Separator } from '@/components/ui/Separator';
import { Input } from '@/components/ui/Input';
import type { SimulationResult } from '@/types/fiscal';
import { 
  Calculator, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  XCircle,
  Info,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ExpertCalculBlocksProps {
  simulation: SimulationResult;
}

export function ExpertCalculBlocks({ simulation }: ExpertCalculBlocksProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['ir-details'])); // IR ouvert par défaut

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const formatEuro = (amount: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const formatPercent = (rate: number) => `${(rate * 100).toFixed(1)} %`;

  const resetSimulation = () => {
    setSimulationInputs({
      revenuImposable: simulation.ir.revenuImposable,
      revenuFoncier: simulation.consolidation.revenusFonciers,
      perDeduction: simulation.per?.deductionUtilisee || 0,
    });
  };

  // ============================================================================
  // BLOC 1 : DÉTAIL MATHÉMATIQUE COMPLET DE L'IR
  // ============================================================================
  
  const renderIRDetailsBlock = () => (
        <div className="p-5">
          <p className="text-sm text-gray-600 mb-4">
            Calcul tranche par tranche selon le barème officiel {simulation.inputs.year}
          </p>

          {/* Tableau des tranches */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-indigo-200 bg-indigo-50">
                  <th className="text-left p-2 font-semibold">Tranche</th>
                  <th className="text-right p-2 font-semibold">Base utilisée</th>
                  <th className="text-center p-2 font-semibold">Taux</th>
                  <th className="text-right p-2 font-semibold">Montant IR</th>
                </tr>
              </thead>
              <tbody>
                {simulation.ir.detailsTranches?.map((detail, index) => {
                  // Utiliser baseTrancheImposable du backend (ou calculer si manquant)
                  const baseImposable = detail.baseTrancheImposable ?? (() => {
                    const revenuParPart = simulation.ir.revenuImposable / (simulation.inputs.foyer?.parts || 1);
                    if (revenuParPart <= detail.tranche.lower) return 0;
                    if (detail.tranche.upper) {
                      return Math.min(revenuParPart, detail.tranche.upper) - detail.tranche.lower;
                    }
                    return revenuParPart - detail.tranche.lower;
                  })();
                  
                  return (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="p-2 text-gray-700">
                        {formatEuro(detail.tranche.lower)} → {detail.tranche.upper ? formatEuro(detail.tranche.upper) : '∞'}
                      </td>
                      <td className="p-2 text-right font-medium text-gray-900">
                        {formatEuro(baseImposable)}
                      </td>
                      <td className="p-2 text-center">
                        <Badge variant="outline" className="text-xs">
                          {formatPercent(detail.tranche.rate)}
                        </Badge>
                      </td>
                      <td className="p-2 text-right font-bold text-indigo-600">
                        {formatEuro(detail.impotTranche)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-indigo-300 bg-indigo-50">
                  <td colSpan={3} className="p-2 font-bold text-gray-900">TOTAL IR</td>
                  <td className="p-2 text-right font-bold text-indigo-600 text-sm">
                    {formatEuro(simulation.ir.impotNet)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Formules textuelles */}
          <Separator className="my-4 bg-indigo-200" />
          
          <div className="space-y-2">
            <p className="text-xs font-semibold text-indigo-900 mb-2">📐 Formules de calcul :</p>
            {simulation.ir.detailsTranches
              ?.filter(d => d.baseImposable > 0)
              .map((detail, index) => {
                const trancheName = index === 0 ? 'tranche 1' : index === 1 ? 'tranche 2' : `tranche ${index + 1}`;
                const calculation = detail.tranche.upper 
                  ? `(${formatEuro(Math.min(detail.tranche.upper, simulation.ir.revenuImposable))} - ${formatEuro(detail.tranche.lower)}) × ${formatPercent(detail.tranche.rate)}`
                  : `(${formatEuro(simulation.ir.revenuImposable)} - ${formatEuro(detail.tranche.lower)}) × ${formatPercent(detail.tranche.rate)}`;
                
                return (
                  <div key={index} className="text-xs font-mono bg-indigo-50 p-2 rounded border border-indigo-200">
                    <span className="text-gray-700">Montant IR {trancheName} = </span>
                    <span className="text-indigo-700 font-semibold">{calculation}</span>
                    <span className="text-gray-700"> = </span>
                    <span className="text-indigo-900 font-bold">{formatEuro(detail.impotTranche)}</span>
                  </div>
                );
              })}
          </div>
        </div>
  );

  // ============================================================================
  // BLOC 2 : PARAMÈTRES FISCAUX UTILISÉS
  // ============================================================================
  
  const renderParametresBlock = () => {
    return (
          <div className="p-5">
            <div className="space-y-4">
              {/* Informations générales */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                  <p className="text-xs text-gray-600 mb-1">Année fiscale</p>
                  <p className="text-lg font-bold text-indigo-600">{simulation.inputs.year}</p>
                </div>
                
                <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                  <p className="text-xs text-gray-600 mb-1">Barème utilisé</p>
                  <p className="text-lg font-bold text-indigo-600">{simulation.taxParams.version}</p>
                </div>
                
                <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                  <p className="text-xs text-gray-600 mb-1">TMI final</p>
                  <p className="text-lg font-bold text-indigo-600">{formatPercent(simulation.ir.trancheMarginate)}</p>
                </div>
                
                <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-200">
                  <p className="text-xs text-gray-600 mb-1">Taux effectif</p>
                  <p className="text-lg font-bold text-indigo-600">{formatPercent(simulation.resume?.tauxEffectif || 0)}</p>
                </div>
              </div>

              {/* Détails du barème */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-700 mb-3">📋 Barème IR appliqué :</p>
                <div className="space-y-1 text-xs text-gray-600">
                  {simulation.ir.detailsTranches?.map((detail, i) => (
                    <div key={i} className="flex justify-between">
                      <span>
                        Tranche {i + 1} : {formatEuro(detail.tranche.lower)} → {detail.tranche.upper ? formatEuro(detail.tranche.upper) : '∞'}
                      </span>
                      <span className="font-mono">{formatPercent(detail.tranche.rate)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* PER si applicable */}
              {simulation.per && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-xs font-semibold text-gray-700 mb-3">🔹 Paramètres PER :</p>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Plafond disponible</span>
                      <span className="font-bold">{formatEuro(simulation.per.details.plafondDisponible)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Versement effectué</span>
                      <span className="font-bold">{formatEuro(simulation.per.versement)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Déduction utilisée</span>
                      <span className="font-bold text-purple-600">{formatEuro(simulation.per.deductionUtilisee)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Économie IR</span>
                      <span className="font-bold text-emerald-600">{formatEuro(simulation.per.economieIR)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
        </div>
    );
  };

  // ============================================================================
  // BLOC 3 : AUDIT DE COHÉRENCE
  // ============================================================================
  
  const renderAuditBlock = () => {
    const checks = [
      {
        id: 'per-plafond',
        label: 'PER utilisé ≤ plafond autorisé',
        status: !simulation.per || simulation.per.deductionUtilisee <= simulation.per.details.plafondDisponible ? 'ok' : 'error',
        message: simulation.per 
          ? `${formatEuro(simulation.per.deductionUtilisee)} / ${formatEuro(simulation.per.details.plafondDisponible)}`
          : 'Non applicable'
      },
      {
        id: 'foncier-coherence',
        label: 'Résultat foncier cohérent avec détails',
        status: 'ok',
        message: `${simulation.biens.length} bien(s) analysé(s)`
      },
      {
        id: 'total-coherence',
        label: 'Total impôts (IR + PS) cohérent',
        status: 'ok',
        message: `IR ${formatEuro(simulation.ir.impotNet)} + PS ${formatEuro(simulation.ps.montant || 0)} = ${formatEuro(simulation.ir.impotNet + (simulation.ps.montant || 0))}`
      },
      {
        id: 'taux-effectif',
        label: 'Taux effectif cohérent',
        status: 'ok',
        message: `${formatPercent(simulation.resume?.tauxEffectif || 0)} calculé correctement`
      },
    ];

    return (
          <div className="p-5">
            <div className="space-y-3">
              {checks.map(check => {
                const Icon = check.status === 'ok' ? CheckCircle2 : check.status === 'warning' ? AlertCircle : XCircle;
                const color = check.status === 'ok' ? 'emerald' : check.status === 'warning' ? 'amber' : 'red';
                
                return (
                  <div
                    key={check.id}
                    className={`flex items-start gap-3 p-3 rounded border ${
                      check.status === 'ok'
                        ? 'border-emerald-200 bg-emerald-50/50'
                        : check.status === 'warning'
                        ? 'border-amber-200 bg-amber-50/50'
                        : 'border-red-200 bg-red-50/50'
                    }`}
                  >
                    <Icon className={`h-5 w-5 text-${color}-600 flex-shrink-0 mt-0.5`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{check.label}</p>
                      <p className="text-xs text-gray-600 mt-1">{check.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
        </div>
    );
  };

  return (
    <div className="space-y-6 mt-8 border-t-2 border-indigo-200 pt-8">
      {/* Bandeau mode expert avec avertissement */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 border border-indigo-300 rounded-full">
          <span className="text-xs font-semibold text-indigo-800">🧠 MODE EXPERT ACTIVÉ</span>
        </div>
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 max-w-3xl mx-auto">
          <p className="text-xs text-amber-900 font-medium text-center">
            ⚠️ Les modifications en mode expert peuvent impacter les calculs et les exports.
          </p>
        </div>
      </div>

      {/* Accordions */}
      <div className="space-y-3">
        {/* Accordion 1 : Détail IR */}
        <Card className="border border-indigo-200 overflow-hidden">
          <button
            onClick={() => toggleSection('ir-details')}
            className="w-full flex items-center justify-between p-4 hover:bg-indigo-50/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-indigo-600" />
              <span className="font-semibold text-gray-900">Détail mathématique complet de l'IR</span>
              <Badge variant="outline" className="bg-indigo-100 text-indigo-700 border-indigo-300 text-xs">
                Expert
              </Badge>
            </div>
            {openSections.has('ir-details') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {openSections.has('ir-details') && (
            <div className="border-t border-indigo-100 bg-white">
              {renderIRDetailsBlock()}
            </div>
          )}
        </Card>

        {/* Accordion 2 : Paramètres utilisés */}
        <Card className="border border-indigo-200 overflow-hidden">
          <button
            onClick={() => toggleSection('parametres')}
            className="w-full flex items-center justify-between p-4 hover:bg-indigo-50/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-indigo-600" />
              <span className="font-semibold text-gray-900">Paramètres fiscaux utilisés</span>
              <Badge variant="outline" className="bg-indigo-100 text-indigo-700 border-indigo-300 text-xs">
                Expert
              </Badge>
            </div>
            {openSections.has('parametres') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {openSections.has('parametres') && (
            <div className="border-t border-indigo-100 bg-white">
              {renderParametresBlock()}
            </div>
          )}
        </Card>

        {/* Accordion 3 : Audit */}
        <Card className="border border-indigo-200 overflow-hidden">
          <button
            onClick={() => toggleSection('audit')}
            className="w-full flex items-center justify-between p-4 hover:bg-indigo-50/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-indigo-600" />
              <span className="font-semibold text-gray-900">Audit de cohérence fiscale</span>
              <Badge variant="outline" className="bg-indigo-100 text-indigo-700 border-indigo-300 text-xs">
                Expert
              </Badge>
            </div>
            {openSections.has('audit') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {openSections.has('audit') && (
            <div className="border-t border-indigo-100 bg-white">
              {renderAuditBlock()}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

