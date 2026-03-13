/**
 * DetailsTab - Étape 3 : Calcul de l'impôt (ORANGE)
 * 
 * Détail du calcul de l'IR, PS et total impôt
 */

'use client';

import { useState } from 'react';
import { BlockCard } from '../BlockCard';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';
import { useExpertModeStore } from '@/store/expertModeStore';
import { ExpertCalculBlocks } from '../../expert/ExpertCalculBlocks';
import type { SimulationResult, RentalPropertyResult } from '@/types/fiscal';
import { PilotagePASBlock } from '@/components/fiscal/PilotagePASBlock';
import { 
  Home, 
  Building,
  Info,
  Calculator,
  TrendingUp,
  DollarSign,
  Percent,
  CheckCircle2,
  AlertCircle,
  Coins,
} from 'lucide-react';

interface DetailsTabProps {
  simulation: SimulationResult;
  onOpenProjectionModal?: () => void;
  onExportPDF?: () => void;
}

export function DetailsTab({ simulation, onOpenProjectionModal, onExportPDF }: DetailsTabProps) {
  const { isExpertMode } = useExpertModeStore();
  const [showTranchesDetail, setShowTranchesDetail] = useState(false);
  const [showPSDetail, setShowPSDetail] = useState(false);
  
  const formatEuro = (amount: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  
  const formatPercent = (rate: number) => `${(rate * 100).toFixed(1)} %`;
  
  // Données
  const baseImposable = simulation.ir.revenuImposable;
  const irTotal = simulation.ir.impotNet;
  const psTotal = simulation.ps.montant || 0;
  const totalImpots = irTotal + psTotal;
  
  const prelevementSourceDejaPaye = simulation.inputs?.options?.prelevementSourceDejaPaye || 0;
  const acomptesDejaPayes = simulation.inputs?.options?.acomptesDejaPayes || 0;
  const totalDejaPaye = prelevementSourceDejaPaye + acomptesDejaPayes;
  const resteAPayer = Math.max(0, totalImpots - totalDejaPaye);
  
  return (
    <TooltipProvider>
      <div className="space-y-6 p-6">
        {/* Titre et sous-titre */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-orange-600 mb-2 flex items-center justify-center gap-2">
            🟠 Calcul de l'impôt
          </h2>
          <p className="text-gray-600">
            Comprendre précisément combien l'État vous prélève
          </p>
        </div>

        {/* BLOC 1 : POINT DE DÉPART OFFICIEL */}
        <BlockCard
          title="Point de départ : Base imposable"
          icon={<Calculator className="h-5 w-5 text-purple-600" />}
          badge={
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-300">
              Issu de la synthèse
            </Badge>
          }
        >
          <Card className="border-2 border-purple-300 bg-purple-50 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Montant utilisé pour le calcul de l'impôt</p>
                  <p className="font-semibold text-gray-900">Base imposable totale</p>
                  <p className="text-xs text-gray-500 mt-1 italic">Salaire + Immobilier – PER</p>
                </div>
                <span className="text-2xl font-bold text-purple-600">
                  {formatEuro(baseImposable)}
                </span>
              </div>
            </CardContent>
          </Card>
        </BlockCard>

        {/* BLOC 2 : CALCUL DE L'IMPÔT SUR LE REVENU (IR) */}
        <BlockCard
          title="Calcul de l'Impôt sur le Revenu (IR)"
          icon={<DollarSign className="h-5 w-5 text-orange-600" />}
        >
          <Card className="border-2 border-orange-300 bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="space-y-4">
                {/* Résumé des tranches */}
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    Votre revenu est découpé en tranches, chacune avec son taux :
                  </p>
                  
                  {/* Barres de progression par tranche */}
                  <div className="space-y-2">
                    {simulation.ir.detailsTranches?.map((detail, index) => {
                      // Calculer le pourcentage de remplissage de la tranche
                      const largeurTranche = detail.tranche.upper 
                        ? detail.tranche.upper - detail.tranche.lower 
                        : detail.baseTrancheImposable || 1; // Pour la dernière tranche sans limite haute
                      const pourcentage = (detail.baseTrancheImposable / largeurTranche) * 100;
                      const isInTranche = detail.baseTrancheImposable > 0;
                      
                      return (
                        <div key={index} className={`p-2 rounded ${isInTranche ? 'bg-orange-50' : 'bg-gray-50'}`}>
                          <div className="flex justify-between items-center text-xs mb-1">
                            <span className="font-medium text-gray-700">
                              {formatEuro(detail.tranche.lower)} → {detail.tranche.upper ? formatEuro(detail.tranche.upper) : '∞'}
                              <span className="ml-2 text-orange-600 font-bold">({formatPercent(detail.tranche.rate)})</span>
                            </span>
                            <span className="font-bold text-orange-600">
                              {isInTranche ? (
                                <>
                                  {formatEuro(detail.baseTrancheImposable)} × {formatPercent(detail.tranche.rate)} = {formatEuro(detail.impotTranche)}
                                </>
                              ) : (
                                formatEuro(detail.impotTranche)
                              )}
                            </span>
                          </div>
                          {isInTranche && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-orange-500 rounded-full transition-all"
                                  style={{ width: `${Math.min(100, pourcentage)}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-gray-500 min-w-[60px] text-right">
                                {formatEuro(detail.baseTrancheImposable)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Separator className="bg-orange-300" />

                {/* Total IR */}
                <div className="bg-orange-100 border-2 border-orange-400 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">Total Impôt sur le Revenu</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Taux marginal (TMI) : {formatPercent(simulation.ir.trancheMarginate)}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5">
                        Taux moyen d&apos;imposition : {formatPercent(simulation.resume?.tauxEffectif ?? simulation.ir.tauxMoyen)}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-1.5 italic">
                        Le TMI correspond à la tranche la plus élevée atteinte. Le taux moyen correspond au poids global de l&apos;impôt sur votre revenu imposable.
                      </p>
                      <p className="text-xs text-gray-500 mt-1 italic">
                        Montant calculé selon le barème officiel {simulation.inputs.year}
                      </p>
                    </div>
                    <span className="text-2xl font-bold text-orange-600">
                      {formatEuro(irTotal)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </BlockCard>

        {/* BLOC 3 : CALCUL DES PRÉLÈVEMENTS SOCIAUX (PS) */}
        <BlockCard
          title="Calcul des Prélèvements Sociaux (PS)"
          icon={<Percent className="h-5 w-5 text-orange-600" />}
        >
          {psTotal > 0 ? (
            <Card className="border-2 border-orange-300 bg-white shadow-sm">
              <CardContent className="p-5">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Base PS immobilière</span>
                    <span className="font-semibold text-gray-700">
                      {formatEuro(simulation.ps.baseImposable || 0)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Taux PS</span>
                    <span className="font-semibold text-gray-700">
                      {formatPercent(simulation.ps.taux || 0.172)}
                    </span>
                  </div>
                  
                  <Separator className="bg-orange-300" />
                  
                  {/* Total PS */}
                  <div className="bg-orange-100 border-2 border-orange-400 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">Total prélèvements sociaux sur revenus immobiliers</p>
                        <p className="text-xs text-gray-500 mt-1.5">
                          Les prélèvements sociaux s&apos;appliquent ici aux revenus immobiliers. Ils ne sont pas réduits par le PER.
                        </p>
                      </div>
                      <span className="text-2xl font-bold text-orange-600">
                        {formatEuro(psTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              <div>
                <p className="font-semibold text-emerald-800">Non applicable cette année</p>
                <p className="text-xs text-emerald-700">
                  Aucun revenu foncier positif soumis aux prélèvements sociaux
                </p>
              </div>
            </div>
          )}
        </BlockCard>

        {/* BLOC 4 : IMPÔT TOTAL */}
        <BlockCard
          title="Total des impôts"
          icon={<Coins className="h-5 w-5 text-orange-600" />}
        >
          <Card className="border-2 border-orange-300 bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Impôt sur le Revenu (IR)</span>
                  <span className="font-semibold text-gray-700">{formatEuro(irTotal)}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">+ Prélèvements sociaux sur revenus immobiliers</span>
                  <span className="font-semibold text-gray-700">{formatEuro(psTotal)}</span>
                </div>
                
                <Separator className="bg-orange-300" />
                
                <div className="bg-orange-100 border-2 border-orange-400 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900">TOTAL IMPÔTS</p>
                      {(() => {
                        const irSupplementaire = simulation.resume?.irSupplementaire || 0;
                        const irSalaire = irTotal - irSupplementaire;
                        const impotsSalaire = irSalaire; // PS = 0 sur salaire
                        const impotsImpactFoncier = irSupplementaire + psTotal; // IR supp + PS fonciers
                        const hasFoncier = simulation.consolidation.revenusFonciers !== 0;
                        
                        return hasFoncier ? (
                          <>
                            <p className="text-xs text-gray-600 mt-1">
                              Impôts de base (salaire seul) : {formatEuro(impotsSalaire)}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              Impact revenus fonciers : <span className={impotsImpactFoncier >= 0 ? 'text-orange-600' : 'text-emerald-600'}>{impotsImpactFoncier >= 0 ? '+' : ''}{formatEuro(impotsImpactFoncier)}</span>
                            </p>
                          </>
                        ) : null;
                      })()}
                    </div>
                    <span className="text-2xl font-bold text-orange-600">{formatEuro(totalImpots)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </BlockCard>

        {/* BLOC 5 : IMPÔTS DÉJÀ PAYÉS */}
        {totalDejaPaye > 0 && (
          <BlockCard
            title="Impôts déjà payés"
            icon={<CheckCircle2 className="h-5 w-5 text-orange-600" />}
          >
            <Card className="border-2 border-orange-300 bg-white shadow-sm">
              <CardContent className="p-5">
                <div className="space-y-3">
                  {prelevementSourceDejaPaye > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Prélèvement à la source</span>
                      <span className="font-semibold text-gray-700">– {formatEuro(prelevementSourceDejaPaye)}</span>
                    </div>
                  )}
                  
                  {acomptesDejaPayes > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Acomptes déjà versés</span>
                      <span className="font-semibold text-gray-700">– {formatEuro(acomptesDejaPayes)}</span>
                    </div>
                  )}
                  
                  <Separator className="bg-orange-300" />
                  
                  <div className="bg-orange-100 border-2 border-orange-400 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900">Total déjà payé</span>
                      <span className="text-2xl font-bold text-orange-600">
                        – {formatEuro(totalDejaPaye)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </BlockCard>
        )}

        {/* BLOC 6 : RESTE À PAYER */}
        <BlockCard
          title="Reste à payer"
          icon={<DollarSign className="h-5 w-5 text-orange-600" />}
        >
          <Card className={`border-2 shadow-sm ${resteAPayer > 0 ? 'border-orange-300' : 'border-emerald-300'} bg-white`}>
            <CardContent className="p-6">
              <div className="space-y-3">
                {totalDejaPaye > 0 && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Total impôts calculés</span>
                      <span className="font-semibold text-gray-700">{formatEuro(totalImpots)}</span>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">– Déjà payé</span>
                      <span className="font-semibold text-gray-700">– {formatEuro(totalDejaPaye)}</span>
                    </div>
                    
                    <Separator className={resteAPayer > 0 ? "bg-orange-300" : "bg-emerald-300"} />
                  </>
                )}
                
                <div className={`rounded-lg p-4 ${resteAPayer > 0 ? 'bg-orange-100 border-2 border-orange-400' : 'bg-emerald-100 border-2 border-emerald-400'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl animate-pulse">🎯</span>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">
                          {resteAPayer > 0 ? 'Montant restant à régler' : 'Vous êtes à jour !'}
                        </p>
                        <span className="font-bold text-gray-900">RESTE À PAYER</span>
                      </div>
                    </div>
                    <span className={`text-2xl font-bold ${resteAPayer > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
                      {formatEuro(resteAPayer)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 italic">
                    Ce montant correspond à l'avis d'imposition final estimé
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </BlockCard>

        {/* BLOC : PILOTAGE PAS & ACOMPTES */}
        <BlockCard
          title="Pilotage PAS & acomptes"
          icon={<Percent className="h-5 w-5 text-indigo-600" />}
        >
          <PilotagePASBlock
            mode="summary"
            simulation={simulation}
          />
        </BlockCard>

        {/* BLOC 7 : RENDEMENT NET (INFO) */}
        <BlockCard
          title="💡 Performance locative nette"
          icon={<Info className="h-5 w-5 text-amber-600" />}
        >
          <Card className="border-2 border-amber-300 bg-amber-50 shadow-sm">
            <CardContent className="px-5 pt-3 pb-5">
              <div className="space-y-4">
                {/* Résultat principal */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-amber-800 font-medium mb-1">
                      Pourcentage des loyers réellement conservés
                    </p>
                    <p className="text-xs text-amber-700">
                      Après déduction de toutes les charges et impôts
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-amber-600">
                      {formatPercent(simulation.resume?.rendementNet || 0)}
                    </p>
                    <p className="text-xs text-amber-700">net après charges et fiscalité</p>
                  </div>
                </div>

                <Separator className="bg-amber-300" />

                {/* Détail du calcul */}
                <div className="bg-white/70 rounded-lg p-4 border border-amber-200">
                  <p className="text-xs font-semibold text-amber-900 mb-3 flex items-center gap-1">
                    <Calculator className="h-3 w-3" />
                    Détail du calcul
                  </p>
                  
                  {(() => {
                    const loyersBruts = simulation.biens?.reduce((sum, b) => sum + (b.recettesBrutes || 0), 0) || 0;
                    const chargesTotal = simulation.biens?.reduce((sum, b) => sum + (b.chargesDeductibles || 0), 0) || 0;
                    const impotsSuppTotal = simulation.resume?.impotsSuppTotal || 0;
                    const beneficeNet = simulation.resume?.beneficeNetImmobilier || 0;
                    const resultatFoncier = loyersBruts - chargesTotal;
                    const tauxMargeLocative = loyersBruts > 0 ? resultatFoncier / loyersBruts : 0;
                    const tauxFiscaliteImmobiliere = resultatFoncier > 0 ? Math.max(0, impotsSuppTotal) / resultatFoncier : 0;
                    
                    return (
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Loyers bruts annuels</span>
                          <span className="font-bold text-gray-800">{formatEuro(loyersBruts)}</span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">– Charges déductibles</span>
                          <span className="font-medium text-gray-600">-{formatEuro(chargesTotal)}</span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">– IR + PS dus à l'immobilier</span>
                          <span className="font-medium text-gray-600">-{formatEuro(Math.max(0, impotsSuppTotal))}</span>
                        </div>
                        
                        <Separator className="bg-amber-200 my-1" />
                        
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-800">= Résultat net après impôt</span>
                          <span className="font-bold text-gray-900">{formatEuro(beneficeNet)}</span>
                        </div>
                        
                        <div className="bg-amber-100 rounded p-2 mt-2">
                          <p className="text-[10px] text-amber-900 font-mono">
                            <span className="font-semibold">Formule :</span> ({formatEuro(beneficeNet)} / {formatEuro(loyersBruts)}) × 100 = {formatPercent(simulation.resume?.rendementNet || 0)}
                          </p>
                        </div>
                        
                        <div className="mt-2 pt-2 border-t border-amber-200/70 space-y-1 text-[10px] text-amber-800/90">
                          <p>Taux de marge locative = Résultat foncier / Loyers → <strong>{formatPercent(tauxMargeLocative)}</strong></p>
                          <p>Taux de fiscalité immobilière = IR + PS / Résultat foncier → <strong>~{formatPercent(tauxFiscaliteImmobiliere)}</strong></p>
                        </div>
                        
                        <p className="text-[10px] text-amber-700 italic mt-2">
                          💡 Sur 100 € de loyers encaissés, vous conservez {((simulation.resume?.rendementNet || 0) * 100).toFixed(1).replace('.', ',')} € après charges et fiscalité.
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>
        </BlockCard>

      </div>

      {/* MODE EXPERT : Blocs supplémentaires */}
      {isExpertMode && <ExpertCalculBlocks simulation={simulation} />}
    </TooltipProvider>
  );
}
