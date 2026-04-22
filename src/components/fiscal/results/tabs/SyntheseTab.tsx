/**
 * SyntheseTab - Vue d'ensemble avec KPIs et graphiques
 */

'use client';

import { useMemo, useState } from 'react';
import { BlockCard } from '../BlockCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Separator } from '@/components/ui/Separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';
import { 
  TrendingDown, 
  Home, 
  Euro, 
  CheckCircle2,
  AlertCircle,
  Info,
  Calculator,
  PiggyBank,
  Building,
  X,
} from 'lucide-react';
import type { SimulationResult, RentalPropertyResult, TypeBien } from '@/types/fiscal';
import {
  aggregateBicPedagogyFromBiens,
  computeLmnpReelPedagogyDisplay,
  isMicroBicRegime,
} from '@/lib/fiscal/immoTaxDisplayAlloc';

/** Location nue → revenus fonciers (2044). */
function isRevenuFoncierNuType(type: TypeBien): boolean {
  return type === 'NU';
}

/** Meublé / LMNP / LMP → BIC (2042 C PRO). */
function isRevenuBicImmobilierType(type: TypeBien): boolean {
  return type === 'MEUBLE' || type === 'LMNP' || type === 'LMP';
}

function aggregateImmoBreakdown(biens: RentalPropertyResult[]) {
  const recettesParCategorie: Record<string, { label: string; amount: number }> = {};
  const chargesParCategorie: Record<string, { label: string; amount: number }> = {};

  biens.forEach((bien) => {
    if (bien.breakdown?.byCategory) {
      Object.entries(bien.breakdown.byCategory.recettes).forEach(([code, data]) => {
        if (!recettesParCategorie[code]) {
          recettesParCategorie[code] = { label: data.label, amount: 0 };
        }
        recettesParCategorie[code].amount += data.amount;
      });
      Object.entries(bien.breakdown.byCategory.charges).forEach(([code, data]) => {
        if (!chargesParCategorie[code]) {
          chargesParCategorie[code] = { label: data.label, amount: 0 };
        }
        chargesParCategorie[code].amount += data.amount;
      });
    }
  });

  const recettesSorted = Object.entries(recettesParCategorie).sort((a, b) => b[1].amount - a[1].amount);
  const chargesSorted = Object.entries(chargesParCategorie).sort((a, b) => b[1].amount - a[1].amount);
  const totalRecettes = biens.reduce((sum, b) => sum + (b.recettesBrutes || 0), 0);
  const totalCharges = biens.reduce((sum, b) => sum + (b.chargesDeductibles || 0), 0);

  return { recettesSorted, chargesSorted, totalRecettes, totalCharges };
}

interface SyntheseTabProps {
  simulation: SimulationResult;
  onGoToDetails: () => void;
  onGoToOptimizations: () => void;
}

function SyntheseTab({ simulation, onGoToDetails, onGoToOptimizations }: SyntheseTabProps) {
  const [showBiensModal, setShowBiensModal] = useState(false);
  
  const formatEuro = (amount: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const formatPercent = (rate: number) => `${(rate * 100).toFixed(1)} %`;

  // ✅ Utiliser UNIQUEMENT les données du backend (pas de recalcul)
  const totalImpots = simulation.resume?.totalImpots || 0;
  const beneficeNet = simulation.resume?.beneficeNetImmobilier || 0;
  const impotsSuppTotal = simulation.resume?.impotsSuppTotal || 0;
  const irSupplementaire = simulation.resume?.irSupplementaire || 0;
  const loyersTotal = simulation.biens?.reduce((sum, b) => sum + (b.recettesBrutes || 0), 0) || 0;
  const chargesTotal = simulation.biens?.reduce((sum, b) => sum + (b.chargesDeductibles || 0), 0) || 0;
  const montant4BA = simulation.consolidation.revenusFonciers4BA ?? simulation.consolidation.revenusFonciers;
  
  // 🆕 Calculer l'impôt restant à payer (après déduction des montants déjà payés)
  const prelevementSourceDejaPaye = simulation.inputs?.options?.prelevementSourceDejaPaye || 0;
  const acomptesDejaPayes = simulation.inputs?.options?.acomptesDejaPayes || 0;
  const totalDejaPaye = prelevementSourceDejaPaye + acomptesDejaPayes;
  const impotRestantAPayer = Math.max(0, totalImpots - totalDejaPaye);

  // Calculer la variation de l'IR
  const imputableGlobal = simulation.consolidation?.deficitImputableRevenuGlobal || 0;
  const revenuInitial = imputableGlobal > 0 
    ? simulation.ir.revenuImposable + imputableGlobal 
    : simulation.ir.revenuImposable;
  const variationIR = imputableGlobal > 0 ? -((imputableGlobal / revenuInitial) * 100) : 0;

  // Analyser les régimes par bien
  const regimesParBien = useMemo(() => {
    return simulation.biens.map((bien) => {
      const regimeUtilise = bien.regimeUtilise || 'micro';
      const regimeSuggere = bien.regimeSuggere || regimeUtilise;
      const gainPotentiel = bien.details?.economieRegimeReel || 0;
      const isOptimal = regimeUtilise === regimeSuggere || Math.abs(gainPotentiel) < 20;

      return {
        nom: bien.nom,
        regimeUtilise,
        regimeSuggere,
        gainPotentiel,
        isOptimal,
      };
    });
  }, [simulation.biens]);

  const biensNonOptimaux = regimesParBien.filter((b) => !b.isOptimal);

  const biensNu = useMemo(
    () => simulation.biens.filter((b) => isRevenuFoncierNuType(b.type)),
    [simulation.biens],
  );
  const biensBic = useMemo(
    () => simulation.biens.filter((b) => isRevenuBicImmobilierType(b.type)),
    [simulation.biens],
  );
  const nuBreakdown = useMemo(() => aggregateImmoBreakdown(biensNu), [biensNu]);
  const bicPedagogy = useMemo(() => aggregateBicPedagogyFromBiens(biensBic), [biensBic]);
  const biensBicMicro = useMemo(
    () => biensBic.filter((b) => isMicroBicRegime(b)),
    [biensBic],
  );
  const biensBicReel = useMemo(
    () => biensBic.filter((b) => !isMicroBicRegime(b)),
    [biensBic],
  );
  const bicMicroBreakdown = useMemo(() => aggregateImmoBreakdown(biensBicMicro), [biensBicMicro]);
  const bicReelBreakdown = useMemo(() => aggregateImmoBreakdown(biensBicReel), [biensBicReel]);
  const lmnpReelUx = useMemo(() => computeLmnpReelPedagogyDisplay(biensBicReel), [biensBicReel]);
  const biensSciIs = useMemo(
    () => simulation.biens.filter((b) => b.type === 'SCI_IS'),
    [simulation.biens],
  );

  const renderBienRow = (bien: RentalPropertyResult) => {
    const isDeficit = bien.resultatFiscal < 0;
    const hasDeficit = bien.deficit && bien.deficit > 0;

    return (
      <tr
        key={bien.id}
        className={`border-b border-gray-100 ${isDeficit ? 'bg-red-50/30' : 'bg-green-50/30'} hover:bg-gray-50 transition-colors`}
      >
        <td className="p-3">
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-gray-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-900">{bien.nom}</p>
              <p className="text-xs text-gray-500">{bien.type}</p>
            </div>
          </div>
        </td>
        <td className="p-3 text-center">
          <Badge variant="outline" className="bg-white text-xs">
            {bien.regime === 'micro' ? 'Micro' : 'Réel'}
          </Badge>
        </td>
        <td className="p-3 text-right">
          <span className="font-semibold text-emerald-600">+{formatEuro(bien.recettesBrutes)}</span>
        </td>
        <td className="p-3 text-right">
          <span className="font-semibold text-orange-600">-{formatEuro(bien.chargesDeductibles)}</span>
        </td>
        <td className="p-3 text-right">
          <span className={`font-bold ${isDeficit ? 'text-red-600' : 'text-emerald-600'}`}>
            {isDeficit ? '' : '+'}
            {formatEuro(bien.resultatFiscal)}
          </span>
        </td>
        <td className="p-3 text-center">
          {hasDeficit ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center gap-1">
                  <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 text-xs">
                    {formatEuro(bien.deficit)}
                  </Badge>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    {bien.deficitImputableRevenuGlobal && bien.deficitImputableRevenuGlobal > 0 && (
                      <span className="text-blue-600">Imp: {formatEuro(bien.deficitImputableRevenuGlobal)}</span>
                    )}
                    {bien.deficitReportable && bien.deficitReportable > 0 && (
                      <span className="text-orange-600">Rep: {formatEuro(bien.deficitReportable)}</span>
                    )}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1 text-xs">
                  <p className="font-semibold">Détail du déficit :</p>
                  <p>• Imputable revenu global : {formatEuro(bien.deficitImputableRevenuGlobal || 0)}</p>
                  <p>• Reportable (10 ans) : {formatEuro(bien.deficitReportable || 0)}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-gray-400 text-xs">-</span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6 p-6">
      {/* Titre et sous-titre */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-purple-600 mb-2 flex items-center justify-center gap-2">
          🟣 Total imposable
        </h2>
        <p className="text-gray-600">
          Comprendre simplement comment votre impôt est calculé
        </p>
      </div>

      {/* ENCART 1 : SALAIRE NET IMPOSABLE */}
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 flex flex-col items-center" style={{ width: '32px' }}>
          <div className="w-3 h-3 rounded-full bg-purple-600 mt-8"></div>
          <div className="w-0.5 flex-1 bg-purple-300 mt-2"></div>
        </div>
        <div className="ml-10">
          <BlockCard
            title="1. Salaire net imposable"
            icon={<Euro className="h-5 w-5 text-purple-600" />}
          >
            <Card className="border-2 border-purple-300 bg-white shadow-md">
              <CardContent className="p-5">
                {(() => {
                  // Calculer l'abattement de 10% (forfaitaire) utilisé
                  const salaireNetImposable = simulation.inputs.foyer.salaire;
                  const params = simulation.taxParams.salaryDeduction || { taux: 0.10, min: 472, max: 13522 };
                  
                  // Estimer le salaire brut (inverse de l'abattement)
                  // Si abattement 10% : net = brut - (brut × 0.10) = brut × 0.90
                  // Donc brut = net / 0.90
                  const salaireBrutEstime = salaireNetImposable / (1 - params.taux);
                  const abattementEstime = salaireBrutEstime - salaireNetImposable;
                  
                  // Vérifier si l'abattement est dans les bornes
                  const abattementReel = Math.min(Math.max(abattementEstime, params.min), params.max);
                  const salaireBrutReel = salaireNetImposable + abattementReel;
                  
                  return (
                    <div className="space-y-3">
                      {/* Calcul du salaire net imposable */}
                      <div className="text-sm">
                        <p className="font-medium text-gray-700 mb-2">💼 Revenus professionnels</p>
                        <div className="space-y-1.5 ml-3">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Salaire brut annuel</span>
                            <span className="font-medium text-gray-700">
                              {formatEuro(salaireBrutReel)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-500 flex items-center gap-1">
                              – Abattement forfaitaire 10%
                              <span className="text-[10px] italic">(min {formatEuro(params.min)}, max {formatEuro(params.max)})</span>
                            </span>
                            <span className="text-gray-600">-{formatEuro(abattementReel)}</span>
                          </div>
                        </div>
                      </div>

                      <Separator className="bg-purple-200 my-2" />

                      {/* Salaire net imposable - VIOLET */}
                      <div className="bg-purple-100 border-2 border-purple-300 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600 mb-1">Base de mes impôts hors immobilier</p>
                            <p className="font-semibold text-gray-900">Salaire net imposable</p>
                          </div>
                          <span className="text-2xl font-bold text-purple-600">
                            {formatEuro(salaireNetImposable)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </BlockCard>
        </div>
      </div>

      {/* ENCART 2 : IMMOBILIER (IMPACT FISCAL) */}
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 flex flex-col items-center" style={{ width: '32px' }}>
          <div className="w-3 h-3 rounded-full bg-purple-600 mt-8"></div>
          <div className="w-0.5 flex-1 bg-purple-300 mt-2"></div>
        </div>
        <div className="ml-10">
          <BlockCard
            title="2. Immobilier (impact fiscal)"
            icon={<Home className="h-5 w-5 text-purple-600" />}
          >
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBiensModal(true)}
                  className="text-sm font-medium text-purple-600 hover:text-purple-700 hover:underline cursor-pointer transition-colors flex items-center gap-1"
                >
                  <Building className="h-3 w-3" />
                  Détail par bien ({simulation.biens.length})
                </button>
              </div>

              {/* Location nue — 2044 */}
              <Card className="border-2 border-purple-200 bg-white shadow-md">
                <CardContent className="p-5">
                  <div className="mb-3">
                    <h4 className="font-semibold text-gray-900">Revenus fonciers (location nue)</h4>
                    <p className="text-xs text-gray-500">Déclaration 2044 · hors meublé / BIC</p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-700">Revenus</span>
                        <span className="font-semibold text-gray-700">+ {formatEuro(nuBreakdown.totalRecettes)}</span>
                      </div>
                      {nuBreakdown.recettesSorted.length > 0 && (
                        <div className="ml-4 mt-1 space-y-0.5">
                          {nuBreakdown.recettesSorted.map(([code, data]) => (
                            <div key={code} className="flex justify-between text-xs text-gray-500">
                              <span>• {data.label}</span>
                              <span className="text-gray-600">+{formatEuro(data.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-gray-700">Charges</span>
                        <span className="font-semibold text-gray-700">– {formatEuro(nuBreakdown.totalCharges)}</span>
                      </div>
                      {nuBreakdown.chargesSorted.length > 0 && (
                        <div className="ml-4 mt-1 space-y-0.5">
                          {nuBreakdown.chargesSorted.map(([code, data]) => (
                            <div key={code} className="flex justify-between text-xs text-gray-500">
                              <span>• {data.label}</span>
                              <span className="text-gray-600">-{formatEuro(data.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <Separator className="bg-purple-200 my-2" />
                    <div className="bg-purple-100 border-2 border-purple-300 rounded-lg p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Pris en compte pour l&apos;IR (consolidation)</p>
                          <p className="font-semibold text-gray-900">Résultat</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-2xl font-bold text-purple-600 block">
                            {simulation.consolidation.revenusFonciers >= 0 ? '+' : ''}
                            {formatEuro(simulation.consolidation.revenusFonciers)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Meublé / BIC — 2042 C PRO */}
              <Card className="border-2 border-purple-200 bg-white shadow-md">
                <CardContent className="p-5">
                  <TooltipProvider>
                    <div className="mb-3">
                      <h4 className="font-semibold text-gray-900">Revenus meublés (LMNP / LMP – BIC)</h4>
                      <p className="text-xs text-gray-500">Déclaration 2042 C PRO · distinct du foncier</p>
                    </div>

                    <div className="space-y-4">
                      {biensBicMicro.length > 0 && (
                        <div className="rounded-lg border border-purple-100 bg-purple-50/40 px-3 py-2.5 space-y-2">
                          <p className="text-xs font-semibold text-purple-900 uppercase tracking-wide">Micro-BIC</p>
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-medium text-gray-700">Recettes brutes</span>
                            <span className="font-semibold text-gray-800">
                              + {formatEuro(bicPedagogy.recettesMicroBic)}
                            </span>
                          </div>
                          {bicMicroBreakdown.recettesSorted.length > 0 && (
                            <div className="ml-3 space-y-0.5">
                              {bicMicroBreakdown.recettesSorted.map(([code, data]) => (
                                <div key={code} className="flex justify-between text-xs text-gray-500">
                                  <span>• {data.label}</span>
                                  <span className="text-gray-600">+{formatEuro(data.amount)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-medium text-gray-700">Abattement forfaitaire micro-BIC</span>
                            <span className="font-semibold text-gray-800">
                              – {formatEuro(bicPedagogy.abattementMicro)}
                            </span>
                          </div>
                        </div>
                      )}

                      {lmnpReelUx && (
                        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/30 px-3 py-3">
                          <p className="text-xs font-semibold text-slate-800 uppercase tracking-wide">
                            Régime réel (LMNP / LMP)
                          </p>

                          <div>
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-gray-700">Recettes brutes</span>
                              <span className="font-semibold text-gray-800">
                                + {formatEuro(lmnpReelUx.recettesBrutes)}
                              </span>
                            </div>
                            {bicReelBreakdown.recettesSorted.length > 0 && (
                              <div className="ml-3 mt-1 space-y-0.5">
                                {bicReelBreakdown.recettesSorted.map(([code, data]) => (
                                  <div key={code} className="flex justify-between text-xs text-gray-500">
                                    <span>• {data.label}</span>
                                    <span className="text-gray-600">+{formatEuro(data.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="font-medium text-gray-700">Charges déductibles (réel)</span>
                            <span className="font-semibold text-gray-800">
                              – {formatEuro(lmnpReelUx.chargesDeductibles)}
                            </span>
                          </div>

                          <div className="flex justify-between items-center gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-medium text-gray-700">Amortissements comptabilisés</span>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    className="text-gray-400 hover:text-purple-600 shrink-0 rounded-full p-0.5"
                                    aria-label="Aide amortissement"
                                  >
                                    <Info className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs text-xs">
                                  Amortissement : charge comptable sans sortie de trésorerie, qui permet de lisser
                                  l&apos;imposition dans le temps.
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <span className="font-semibold text-gray-800 shrink-0">
                              – {formatEuro(lmnpReelUx.amortissementsComptabilises)}
                            </span>
                          </div>

                          <Separator className="bg-purple-200/80" />

                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <span className="font-medium text-gray-800">Résultat avant amortissements</span>
                                <p className="text-[10px] text-gray-500 mt-0.5">Recettes − charges</p>
                              </div>
                              <span
                                className={`font-semibold shrink-0 ${lmnpReelUx.resultatAvantAmortissements >= 0 ? 'text-gray-900' : 'text-red-600'}`}
                              >
                                {lmnpReelUx.resultatAvantAmortissements >= 0 ? '+' : ''}
                                {formatEuro(lmnpReelUx.resultatAvantAmortissements)}
                              </span>
                            </div>

                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <span className="font-medium text-gray-800">Amortissements déductibles cette année</span>
                                <p className="text-[10px] text-gray-500 mt-0.5">
                                  min(amortissements, résultat avant amort. si positif)
                                </p>
                              </div>
                              <span className="font-semibold text-gray-900 shrink-0">
                                – {formatEuro(lmnpReelUx.amortissementsDeductiblesCetteAnnee)}
                              </span>
                            </div>

                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <span className="font-medium text-gray-800">Amortissements non déduits (reportables)</span>
                                <p className="text-[10px] text-gray-500 mt-0.5">Amortissements − amort. déductibles</p>
                              </div>
                              <span className="font-semibold text-indigo-800 shrink-0">
                                {formatEuro(lmnpReelUx.amortissementsNonDeduitsReportables)}
                              </span>
                            </div>
                          </div>

                          <Separator className="bg-purple-200/80" />

                          {lmnpReelUx.hasDeficitAvantAmort && (
                            <div className="rounded-md border border-red-200 bg-red-50/70 px-3 py-2 text-[11px] text-red-950">
                              <p className="font-semibold text-red-900 mb-0.5">Déficit BIC (hors amortissements)</p>
                              <div className="flex justify-between gap-2">
                                <span>Montant (charges &gt; recettes, avant amortissements)</span>
                                <span className="font-bold shrink-0">
                                  {formatEuro(lmnpReelUx.deficitBicHorsAmortissements)}
                                </span>
                              </div>
                              <p className="text-[10px] text-red-900/85 mt-1">
                                Ne pas confondre avec « amortissements non déduits (reportables) » : autre nature, autre
                                logique de report.
                              </p>
                              <p className="text-[11px] text-red-950 mt-2 pt-2 border-t border-red-200/80">
                                Le déficit BIC (hors amortissements) est reportable sur les futurs bénéfices BIC.
                              </p>
                            </div>
                          )}

                          {!lmnpReelUx.hasDeficitAvantAmort && lmnpReelUx.hasAmortissementsNonDeduits && (
                            <div className="rounded-md border border-indigo-200 bg-indigo-50/60 px-3 py-2 text-[11px] text-indigo-950">
                              <p className="font-semibold text-indigo-900 mb-0.5">Amortissements non déduits (reportables)</p>
                              <p>
                                Les amortissements dépassent le résultat avant amortissements : ce n&apos;est pas un
                                déficit BIC ; la part non déduite constitue un stock reportable pour réduire des
                                bénéfices futurs.
                              </p>
                            </div>
                          )}

                          <div className="flex justify-between items-start gap-2 text-sm pt-1">
                            <div>
                              <span className="font-semibold text-gray-900">Résultat fiscal BIC (affichage agrégé)</span>
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                max(0, résultat après amortissements) sur le périmètre réel agrégé
                              </p>
                            </div>
                            <span className="font-bold text-purple-800 shrink-0">
                              {lmnpReelUx.resultatFiscalBicMax0Ux > 0 ? '+' : ''}
                              {formatEuro(lmnpReelUx.resultatFiscalBicMax0Ux)}
                            </span>
                          </div>

                          {lmnpReelUx.amortissementsComptabilises > 0.5 && (
                            <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-2.5 py-2 text-[10px] text-amber-950 leading-snug">
                              <span className="font-medium text-amber-900">Plus-value à la revente ·</span> depuis 2025,
                              les amortissements déduits peuvent être réintégrés dans le calcul de la plus-value à la
                              revente (information générale, hors calcul moteur).
                            </div>
                          )}

                          {lmnpReelUx.amortissementsComptabilises > 0.5 && !lmnpReelUx.hasDeficitAvantAmort && (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-[11px] text-emerald-950 leading-snug">
                              <p className="font-semibold text-emerald-900 mb-1">LMNP au réel · amortissements</p>
                              <p>
                                En LMNP au réel, les amortissements réduisent le résultat fiscal sans créer de déficit.
                                La part non utilisée est reportable et pourra réduire les bénéfices futurs.
                              </p>
                            </div>
                          )}

                        </div>
                      )}

                      <div className="flex justify-between items-center text-sm border-t border-dashed border-purple-200 pt-2">
                        <span className="text-gray-600">Σ résultat fiscal BIC (tous biens, avant plancher foyer)</span>
                        <span
                          className={`font-semibold ${bicPedagogy.sumResultatFiscal >= 0 ? 'text-gray-800' : 'text-red-600'}`}
                        >
                          {bicPedagogy.sumResultatFiscal >= 0 ? '+' : ''}
                          {formatEuro(bicPedagogy.sumResultatFiscal)}
                        </span>
                      </div>

                      <Separator className="bg-purple-200 my-1" />

                      <div className="bg-purple-100 border-2 border-purple-300 rounded-lg p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm text-gray-600 mb-1">Résultat BIC retenu pour l&apos;IR (moteur)</p>
                            <p className="font-semibold text-gray-900">Consolidation foyer</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-2xl font-bold text-purple-600 block">
                              {simulation.consolidation.revenusBIC >= 0 ? '+' : ''}
                              {formatEuro(simulation.consolidation.revenusBIC)}
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-600 mt-2">
                          Le montant officiel peut différer du tableau agrégé « réel » si vous avez aussi du micro-BIC ou
                          plusieurs biens au réel (le moteur consolide bien par bien puis au foyer).
                        </p>
                      </div>

                      {(Math.abs(simulation.consolidation.revenusBIC - bicPedagogy.sumResultatFiscal) > 0.5 ||
                        (bicPedagogy.recettes > 0 && Math.abs(simulation.consolidation.revenusBIC) < 0.5)) && (
                        <p className="text-[11px] text-gray-600 leading-snug">
                          Le micro-BIC applique un abattement forfaitaire sur les recettes. Au réel, la chaîne recettes →
                          charges → amortissements explique un résultat à <strong>0 €</strong> sans « perte » comptable des
                          loyers : une partie des amortissements peut être non déduite et reportée, ou un déficit hors
                          amortissements peut exister si les charges dépassent les recettes.
                        </p>
                      )}
                    </div>
                  </TooltipProvider>
                </CardContent>
              </Card>
            </div>
          </BlockCard>
        </div>
      </div>

      {/* ENCART 3 : PER */}
      {simulation.per && (
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 flex flex-col items-center" style={{ width: '32px' }}>
            <div className="w-3 h-3 rounded-full bg-purple-600 mt-8"></div>
            <div className="w-0.5 flex-1 bg-purple-300 mt-2"></div>
          </div>
          <div className="ml-10">
            <BlockCard
              title="3. Plan Épargne Retraite (PER)"
              icon={<TrendingDown className="h-5 w-5 text-purple-600" />}
            >
              <Card className="border-2 border-purple-300 bg-white shadow-md">
                <CardContent className="p-5">
                  <div className="space-y-3">
                    {/* Montant versé */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Montant versé</span>
                      <span className="font-semibold text-gray-700">{formatEuro(simulation.per.versement)}</span>
                    </div>
                    
                    {/* Plafond disponible */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Plafond disponible</span>
                      <span className="font-semibold text-gray-700">{formatEuro(simulation.per.details.plafondDisponible)}</span>
                    </div>
                    
                    <Separator className="bg-purple-200 my-2" />
                    
                    {/* Déduction appliquée - VIOLET */}
                    <div className="bg-purple-100 border-2 border-purple-300 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600 mb-1">Ce que le PER retire de l'impôt</p>
                          <p className="font-semibold text-gray-900">Déduction PER</p>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-purple-600 block">
                            – {formatEuro(simulation.per.deductionUtilisee)}
                          </span>
                          <p className="text-[10px] text-gray-500 italic mt-1">
                            Déduction légale du revenu imposable
                          </p>
                        </div>
                      </div>
                      <p className="text-[10px] text-purple-700 mt-2 text-center">
                        💡 L'économie d'impôt dépend de votre TMI
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </BlockCard>
          </div>
        </div>
      )}

      {/* ENCART 4 : CONSTRUCTION DU REVENU IMPOSABLE */}
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 flex flex-col items-center" style={{ width: '32px' }}>
          <div className="w-4 h-4 rounded-full bg-emerald-500 mt-8 flex items-center justify-center">
            <span className="text-white text-xs">✓</span>
          </div>
        </div>
        <div className="ml-10">
          <BlockCard
            title="4. Construction du revenu imposable"
            icon={<Calculator className="h-5 w-5 text-purple-600" />}
          >
            <Card className="border-2 border-purple-300 bg-white shadow-md">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Salaire */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">Salaire net imposable</span>
                    <span className="text-lg font-bold text-purple-600">+ {formatEuro(simulation.inputs.foyer.salaire)}</span>
                  </div>
                  
                  {/* Résultat foncier (NU / 2044) */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">+ Résultat foncier (location nue)</span>
                    <span className="text-lg font-bold text-purple-600">
                      + {formatEuro(simulation.consolidation.revenusFonciers)}
                    </span>
                  </div>

                  {/* Résultat BIC (LMNP / LMP) */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">+ Résultat LMNP / LMP (BIC)</span>
                    <span className="text-lg font-bold text-purple-600">
                      + {formatEuro(simulation.consolidation.revenusBIC)}
                    </span>
                  </div>

                  {imputableGlobal > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">– Déficit foncier imputable au revenu global</span>
                      <span className="text-lg font-bold text-orange-600">
                        – {formatEuro(imputableGlobal)}
                      </span>
                    </div>
                  )}
                  
                  <Separator className="bg-gray-400" />
                  
                  {/* Revenu brut imposable (avant PER) */}
                  <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <span className="font-semibold text-gray-900">= Revenu brut imposable</span>
                    <span className="text-xl font-bold text-gray-900">
                      {formatEuro(
                        simulation.inputs.foyer.salaire +
                          simulation.consolidation.revenusFonciers +
                          simulation.consolidation.revenusBIC -
                          imputableGlobal,
                      )}
                    </span>
                  </div>
                  
                  {/* Déduction PER */}
                  {simulation.per && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700">– Déduction PER</span>
                      <span className="text-lg font-bold text-purple-600">– {formatEuro(simulation.per.deductionUtilisee)}</span>
                    </div>
                  )}
                  
                  <Separator className="bg-purple-400" />
                  
                  {/* Total imposable final */}
                  <div className="bg-gradient-to-r from-purple-100 to-purple-50 border-2 border-purple-400 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl animate-pulse">🎯</span>
                        <span className="font-bold text-gray-900">TOTAL IMPOSABLE FINAL</span>
                      </div>
                      <span className="text-2xl font-bold text-purple-600">
                        {formatEuro(simulation.ir.revenuImposable)}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-gray-600 italic">
                        Cette base servira à calculer l'impôt sur le revenu
                      </p>
                      <p className="text-xs text-purple-700 font-medium">
                        C'est ce montant qui détermine votre tranche et votre impôt.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </BlockCard>
        </div>
      </div>

      {/* Modal : Revenus par bien */}
      {showBiensModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowBiensModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-purple-50">
              <div className="flex items-center gap-3">
                <Home className="h-6 w-6 text-purple-600" />
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Revenus par bien (justificatif)</h3>
                  <p className="text-sm text-gray-600">{simulation.biens.length} bien(s)</p>
                </div>
              </div>
              <button
                onClick={() => setShowBiensModal(false)}
                className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <TooltipProvider>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left p-3 font-semibold text-gray-700">Bien</th>
                        <th className="text-center p-3 font-semibold text-gray-700">Régime</th>
                        <th className="text-right p-3 font-semibold text-gray-700">Loyers</th>
                        <th className="text-right p-3 font-semibold text-gray-700">Charges</th>
                        <th className="text-right p-3 font-semibold text-gray-700">Résultat fiscal</th>
                        <th className="text-center p-3 font-semibold text-gray-700">Déficit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {biensNu.length > 0 && (
                        <>
                          <tr className="bg-slate-100 border-y border-slate-200">
                            <td colSpan={6} className="p-2 pl-3 text-xs font-semibold uppercase tracking-wide text-slate-700">
                              Revenus fonciers — location nue (2044)
                            </td>
                          </tr>
                          {biensNu.map((bien) => renderBienRow(bien))}
                          <tr className="border-b border-slate-200 bg-slate-50 font-medium text-sm">
                            <td className="p-2 pl-3" colSpan={2}>
                              Sous-total · impact IR foncier
                            </td>
                            <td className="p-2 text-right text-emerald-700">
                              +{formatEuro(biensNu.reduce((s, b) => s + (b.recettesBrutes || 0), 0))}
                            </td>
                            <td className="p-2 text-right text-orange-700">
                              -{formatEuro(biensNu.reduce((s, b) => s + (b.chargesDeductibles || 0), 0))}
                            </td>
                            <td className="p-2 text-right">
                              <span
                                className={`font-bold ${simulation.consolidation.revenusFonciers >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                              >
                                {simulation.consolidation.revenusFonciers >= 0 ? '+' : ''}
                                {formatEuro(simulation.consolidation.revenusFonciers)}
                              </span>
                            </td>
                            <td className="p-2" />
                          </tr>
                        </>
                      )}

                      {biensBic.length > 0 && (
                        <>
                          <tr className="bg-slate-100 border-y border-slate-200">
                            <td colSpan={6} className="p-2 pl-3 text-xs font-semibold uppercase tracking-wide text-slate-700">
                              Revenus meublés — LMNP / LMP (BIC · 2042 C PRO)
                            </td>
                          </tr>
                          {biensBic.map((bien) => renderBienRow(bien))}
                          <tr className="border-b border-slate-200 bg-slate-50 font-medium text-sm">
                            <td className="p-2 pl-3" colSpan={2}>
                              Sous-total · impact IR BIC
                            </td>
                            <td className="p-2 text-right text-emerald-700">
                              +{formatEuro(biensBic.reduce((s, b) => s + (b.recettesBrutes || 0), 0))}
                            </td>
                            <td className="p-2 text-right text-orange-700">
                              -{formatEuro(biensBic.reduce((s, b) => s + (b.chargesDeductibles || 0), 0))}
                            </td>
                            <td className="p-2 text-right">
                              <span
                                className={`font-bold ${simulation.consolidation.revenusBIC >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                              >
                                {simulation.consolidation.revenusBIC >= 0 ? '+' : ''}
                                {formatEuro(simulation.consolidation.revenusBIC)}
                              </span>
                            </td>
                            <td className="p-2" />
                          </tr>
                        </>
                      )}

                      {biensSciIs.length > 0 && (
                        <>
                          <tr className="bg-amber-50 border-y border-amber-200">
                            <td colSpan={6} className="p-2 pl-3 text-xs font-semibold uppercase tracking-wide text-amber-900">
                              SCI à l&apos;IS (hors base IR du foyer)
                            </td>
                          </tr>
                          {biensSciIs.map((bien) => renderBienRow(bien))}
                        </>
                      )}
                    </tbody>

                    <tfoot>
                      <tr className="border-t-2 border-gray-300 bg-purple-50 font-semibold">
                        <td className="p-3" colSpan={2}>
                          <div className="flex items-center gap-2">
                            <Calculator className="h-4 w-4 text-purple-600" />
                            <span className="text-gray-900">Totaux encaissements / charges (tous biens)</span>
                          </div>
                        </td>
                        <td className="p-3 text-right text-emerald-700">
                          +{formatEuro(simulation.biens.reduce((sum, b) => sum + (b.recettesBrutes || 0), 0))}
                        </td>
                        <td className="p-3 text-right text-orange-700">
                          -{formatEuro(simulation.biens.reduce((sum, b) => sum + (b.chargesDeductibles || 0), 0))}
                        </td>
                        <td className="p-3 text-right">
                          <span className="text-xs font-normal text-gray-600 block text-right mb-0.5">
                            Impact IR (foncier + BIC)
                          </span>
                          <span
                            className={`font-bold text-base ${simulation.consolidation.revenusFonciers + simulation.consolidation.revenusBIC >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                          >
                            {simulation.consolidation.revenusFonciers + simulation.consolidation.revenusBIC >= 0 ? '+' : ''}
                            {formatEuro(
                              simulation.consolidation.revenusFonciers + simulation.consolidation.revenusBIC,
                            )}
                          </span>
                        </td>
                        <td className="p-3" />
                      </tr>
                      <tr className="border-t border-emerald-300 bg-emerald-50 font-semibold">
                        <td className="p-3" colSpan={4}>
                          <span className="text-gray-900">TOTAL (résultat fiscal foncier / 4BA)</span>
                        </td>
                        <td className="p-3 text-right">
                          <span className={`font-bold text-base ${montant4BA >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                            {montant4BA >= 0 ? '+' : ''}
                            {formatEuro(montant4BA)}
                          </span>
                        </td>
                        <td className="p-3" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </TooltipProvider>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
              <Button variant="outline" onClick={() => setShowBiensModal(false)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { SyntheseTab };
export default SyntheseTab;

