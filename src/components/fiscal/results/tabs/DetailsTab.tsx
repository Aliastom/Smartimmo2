/**
 * DetailsTab - Détails fiscaux complets (réutilise FiscalDetailDrawer)
 * 
 * Adapté depuis FiscalDetailDrawer pour affichage inline (sans Sheet)
 */

'use client';

import { useState } from 'react';
import { BlockCard } from '../BlockCard';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';
import { Progress } from '@/components/ui/progress';
import type { SimulationResult, RentalPropertyResult } from '@/types/fiscal';
import { 
  Home, 
  Building,
  ChevronDown,
  ChevronUp,
  Info,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  FileText,
  Download,
  Calculator,
  PiggyBank,
} from 'lucide-react';

interface DetailsTabProps {
  simulation: SimulationResult;
  onOpenProjectionModal?: () => void;
  onExportPDF?: () => void;
}

export function DetailsTab({ simulation, onOpenProjectionModal, onExportPDF }: DetailsTabProps) {
  const [expandedBiens, setExpandedBiens] = useState<Set<string>>(new Set());
  
  const formatEuro = (amount: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  
  const formatPercent = (rate: number) => `${(rate * 100).toFixed(2)} %`;
  
  const toggleBien = (bienId: string) => {
    setExpandedBiens((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(bienId)) {
        newSet.delete(bienId);
      } else {
        newSet.add(bienId);
      }
      return newSet;
    });
  };
  
  // ✅ Utiliser UNIQUEMENT les données du backend (pas de recalcul)
  const consolidation = simulation.consolidation;
  const deficitGlobal = consolidation.deficitFoncier || 0;
  const imputableGlobal = consolidation.deficitImputableRevenuGlobal || 0;
  const reportableGlobal = consolidation.deficitReportable || 0;
  
  const gainFiscal = imputableGlobal * simulation.ir.trancheMarginate;
  
  const revenuInitial = imputableGlobal > 0 
    ? simulation.ir.revenuImposable + imputableGlobal 
    : simulation.ir.revenuImposable;
  
  const variationRevenu = imputableGlobal > 0 
    ? -((imputableGlobal / revenuInitial) * 100)
    : 0;
  
  return (
    <TooltipProvider>
      <div className="space-y-6 p-6">
        {/* Titre et sous-titre */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Détails fiscaux complets
          </h2>
          <p className="text-gray-600">
            Calcul détaillé par bien, consolidation, impact sur l'IR et les prélèvements sociaux
          </p>
        </div>

        {/* Section 1 : Revenus par bien */}
        <BlockCard
          title="Revenus par bien"
          icon={<Home className="h-5 w-5" />}
          badge={<Badge variant="outline">{simulation.biens.length} bien(s)</Badge>}
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (expandedBiens.size === simulation.biens.length) {
                  setExpandedBiens(new Set());
                } else {
                  setExpandedBiens(new Set(simulation.biens.map((b) => b.id)));
                }
              }}
              className="text-xs"
            >
              {expandedBiens.size === simulation.biens.length ? 'Tout replier' : 'Tout afficher'}
            </Button>
          }
        >
          <div className="space-y-3">
            {simulation.biens.map((bien: RentalPropertyResult) => {
              const isExpanded = expandedBiens.has(bien.id);
              const isDeficit = bien.resultatFiscal < 0;

              return (
                <Card
                  key={bien.id}
                  className={`border-l-4 rounded-xl ${isDeficit ? 'border-l-red-500' : 'border-l-green-500'}`}
                  style={{ 
                    backgroundColor: isDeficit ? '#FFEBEB' : '#E8F6EE',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
                  }}
                >
                  <CardContent className="p-4">
                    {/* Header bien */}
                    <div 
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => toggleBien(bien.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Building className="h-4 w-4 text-gray-500" />
                        <div>
                          <h4 className="font-semibold text-gray-900">{bien.nom}</h4>
                          <p className="text-xs text-gray-500">
                            Régime {bien.regime === 'micro' ? 'Micro' : 'Réel'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          className={`${isDeficit ? 'bg-red-100 text-red-700 border-red-300' : 'bg-green-100 text-green-700 border-green-300'}`}
                        >
                          {formatEuro(bien.resultatFiscal)}
                          {isDeficit && ' (déficit)'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{bien.type}</Badge>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>
                    
                    {/* Détails (repliable) */}
                    {isExpanded && (
                      <div className="mt-4 space-y-3 pt-3 border-t border-gray-200">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Loyers encaissés :</span>
                            <span className="font-medium text-green-700">{formatEuro(bien.recettesBrutes)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Charges déductibles :</span>
                            <span className="font-medium text-red-700">{formatEuro(bien.chargesDeductibles)}</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Résultat fiscal :</span>
                            <span className={`font-medium ${isDeficit ? 'text-red-700' : 'text-green-700'}`}>{formatEuro(bien.resultatFiscal)}</span>
                          </div>
                          {bien.amortissements > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Amortissements :</span>
                              <span className="font-medium text-gray-700">{formatEuro(bien.amortissements)}</span>
                            </div>
                          )}
                        </div>
                        
                        
                        {/* Détail du déficit */}
                        {bien.deficit && bien.deficit > 0 && (
                          <div 
                            className="mt-3 p-3 border border-red-300 rounded-xl space-y-2 text-xs"
                            style={{ 
                              backgroundColor: '#FFEBEB',
                              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
                            }}
                          >
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 space-y-1.5">
                                <div className="flex justify-between font-semibold text-red-900">
                                  <span>Déficit total :</span>
                                  <span>{formatEuro(bien.deficit)}</span>
                                </div>
                                
                                {/* Toujours afficher Imputable revenu global (même si 0) */}
                                <div className="flex justify-between text-red-700">
                                  <span className="flex items-center gap-1">
                                    Imputable revenu global :
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Info className="h-3 w-3 inline cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Plafonné à 10 700 €/an (hors intérêts)</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </span>
                                  <span className="font-medium">{formatEuro(bien.deficitImputableRevenuGlobal || 0)}</span>
                                </div>
                                
                                {/* Toujours afficher Reportable (même si 0) */}
                                <div className="flex justify-between text-red-700">
                                  <span className="flex items-center gap-1">
                                    Reportable (10 ans) :
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Info className="h-3 w-3 inline cursor-help" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Reportable sur revenus fonciers futurs (10 ans max)</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </span>
                                  <span className="font-medium">{formatEuro(bien.deficitReportable || 0)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </BlockCard>

        {/* Section 2 : Consolidation foncière globale */}
        <BlockCard
          title="Consolidation foncière (global)"
          icon={<Building className="h-5 w-5" />}
        >
          <Card 
            className="border-purple-200 rounded-xl"
            style={{ 
              backgroundColor: '#F6F8FF',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
            }}
          >
            <CardContent className="p-4">
              <div className="space-y-2 text-sm">
                {/* Totaux */}
                <div className="grid grid-cols-3 gap-4 text-xs text-gray-600 mb-3">
                  <div>
                    <p className="font-medium">Loyers totaux</p>
                    <p className="text-base font-semibold text-green-700">
                      {formatEuro(simulation.biens?.reduce((sum, b) => sum + (b.recettesBrutes || 0), 0) || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Charges déductibles</p>
                    <p className="text-base font-semibold text-orange-700">
                      {formatEuro(simulation.biens?.reduce((sum, b) => sum + (b.chargesDeductibles || 0), 0) || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium">Résultat net</p>
                    {(() => {
                      const loyers = simulation.biens?.reduce((sum, b) => sum + (b.recettesBrutes || 0), 0) || 0;
                      const charges = simulation.biens?.reduce((sum, b) => sum + (b.chargesDeductibles || 0), 0) || 0;
                      const resultat = loyers - charges;
                      
                      return (
                        <p className={`text-base font-semibold ${resultat >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {formatEuro(resultat)}
                        </p>
                      );
                    })()}
                  </div>
                </div>
                
                <Separator />
                
                {/* Résultat global - Recalculé */}
                {(() => {
                  const loyers = simulation.biens?.reduce((sum, b) => sum + (b.recettesBrutes || 0), 0) || 0;
                  const charges = simulation.biens?.reduce((sum, b) => sum + (b.chargesDeductibles || 0), 0) || 0;
                  const resultatGlobal = loyers - charges;
                  
                  return (
                    <div className="flex justify-between font-semibold text-base mt-3">
                      <span className="text-gray-900">Résultat foncier net global (avant imputation) :</span>
                      <span className={resultatGlobal > 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatEuro(resultatGlobal)}
                      </span>
                    </div>
                  );
                })()}
                
                {/* Si déficit : détails imputation/report */}
                {deficitGlobal > 0 && (
                  <div 
                    className="mt-3 p-3 border border-purple-300 rounded-xl space-y-2"
                    style={{ 
                      backgroundColor: 'white',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
                    }}
                  >
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-700 flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center gap-1 cursor-help">
                              Imputable revenu global :
                              <Info className="h-3 w-3" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Plafonné à 10 700 €/an (hors intérêts)</p>
                          </TooltipContent>
                        </Tooltip>
                      </span>
                      <span className="font-bold text-blue-700">{formatEuro(imputableGlobal)}</span>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-orange-700 flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center gap-1 cursor-help">
                              Intérêts reportables (10 ans) :
                              <Info className="h-3 w-3" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Reportable sur revenus fonciers futurs (10 ans max)</p>
                          </TooltipContent>
                        </Tooltip>
                      </span>
                      <span className="font-bold text-orange-700">{formatEuro(reportableGlobal)}</span>
                    </div>
                    
                    <div 
                      className="p-2 border border-yellow-300 rounded-lg flex items-start gap-2"
                      style={{ backgroundColor: '#FEF9E7' }}
                    >
                      <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-yellow-800">
                        Les intérêts ne peuvent PAS s'imputer sur le revenu global, mais peuvent compenser des bénéfices fonciers futurs.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Lien Guide complet */}
          <div className="flex justify-center mt-3">
            <Button variant="link" size="sm" className="text-sky-600">
              <FileText className="h-4 w-4 mr-2" />
              Guide complet
            </Button>
          </div>
        </BlockCard>

        {/* Section 3 : Impact sur l'IR */}
        <BlockCard
          title="Impact sur l'Impôt sur le Revenu"
          icon={<TrendingUp className="h-5 w-5" />}
        >
          <p className="text-xs text-gray-500 mb-3">
            Simulation de l'impact sur l'impôt sur le revenu (formulaire 2042)
          </p>
          
          <div className="space-y-3">
            {/* Revenu imposable */}
            <div 
              className="p-3 border border-purple-200 rounded-xl"
              style={{ 
                backgroundColor: '#F3EFFF',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
              }}
            >
              {/* Détail revenu imposable */}
              {imputableGlobal > 0 && (
                <div className="space-y-1 text-xs text-gray-600 mb-3">
                  <div className="flex justify-between">
                    <span>
                      Revenu global initial
                      {simulation.per && simulation.per.deductionUtilisee > 0 && (
                        <span className="text-blue-600"> (dont -{formatEuro(simulation.per.deductionUtilisee)} PER)</span>
                      )}
                      :
                    </span>
                    <span className="font-medium">
                      {formatEuro(simulation.ir.revenuImposable + imputableGlobal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-blue-700">
                    <span>Imputation foncière :</span>
                    <span className="font-medium">-{formatEuro(imputableGlobal)}</span>
                  </div>
                  <Separator className="my-1" />
                </div>
              )}
              
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-700 font-semibold flex items-center gap-2">
                  {imputableGlobal > 0 ? 'Base imposable corrigée :' : 'Revenu imposable total :'}
                  {variationRevenu < 0 && (
                    <Badge className="bg-green-100 text-green-700 border-green-300 text-[10px] px-1.5 py-0">
                      <TrendingDown className="h-3 w-3 inline mr-0.5" />
                      {variationRevenu.toFixed(1)} %
                    </Badge>
                  )}
                </span>
                <span className="font-semibold text-purple-900">
                  {formatEuro(simulation.ir.revenuImposable)}
                </span>
              </div>
                <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Nombre de parts :</span>
                  <span className="font-medium">{simulation.inputs.foyer?.parts || simulation.inputs.parts}</span>
                </div>
                <div className="flex justify-between">
                  <span>Revenu par part :</span>
                  <span className="font-medium">{formatEuro(simulation.ir.revenuParPart || (simulation.ir.revenuImposable / (simulation.inputs.foyer?.parts || simulation.inputs.parts)))}</span>
                </div>
              </div>
              
              {/* IR supplémentaire */}
              {(() => {
                const irSupp = simulation.resume?.irSupplementaire || 0;
                const psSupp = simulation.ps.montant || 0;
                const impotsSuppTotal = Math.max(0, irSupp + psSupp);  // Si négatif → 0
                
                return (
                  <div 
                    className={`mt-3 p-3 border rounded-xl ${impotsSuppTotal > 0 ? 'border-red-400 bg-red-50' : 'border-green-400 bg-green-50'}`}
                    style={{ 
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
                    }}
                  >
                    <div className="flex justify-between text-sm mb-2">
                      <span className={`font-semibold flex items-center gap-1 ${impotsSuppTotal > 0 ? 'text-red-800' : 'text-green-800'}`}>
                        {impotsSuppTotal > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        Impôts supplémentaires (IR + PS causés par le foncier)
                      </span>
                      <span className={`font-bold text-base ${impotsSuppTotal > 0 ? 'text-red-700' : 'text-green-700'}`}>
                        {impotsSuppTotal > 0 ? `+${formatEuro(impotsSuppTotal)}` : `${formatEuro(0)}`}
                      </span>
                    </div>
                    
                    <div className="space-y-1 text-xs ml-4">
                      <div className="flex justify-between text-gray-600">
                        <span>└ dont IR supplémentaire</span>
                        <span>
                          {irSupp > 0 ? `+${formatEuro(irSupp)}` : `${formatEuro(0)} (économie ${formatEuro(Math.abs(irSupp))})`}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>└ dont PS fonciers</span>
                        <span>{formatEuro(psSupp)}</span>
                      </div>
                    </div>
                    
                    {irSupp < 0 && (
                      <p className="text-xs text-green-700 mt-2 italic">
                        💡 Le déficit foncier réduit votre IR de {formatEuro(Math.abs(irSupp))} ({formatEuro(imputableGlobal)} × {formatPercent(simulation.ir.trancheMarginate)} TMI)
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
            
            {/* Détail par tranche */}
            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">Détail par tranche :</p>
              <div className="space-y-1">
                {simulation.ir.detailsTranches?.map((detail, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center text-xs p-2 bg-gray-50 rounded"
                  >
                    <span className="text-gray-600">
                      {formatEuro(detail.tranche.lower)} - {detail.tranche.upper ? formatEuro(detail.tranche.upper) : '∞'}
                      {' '}({formatPercent(detail.tranche.rate)})
                    </span>
                    <span className="font-medium text-gray-900">
                      {formatEuro(detail.impotTranche)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Impôt final */}
            <div 
              className="p-3 border border-gray-300 rounded-xl"
              style={{ 
                backgroundColor: 'white',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
              }}
            >
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Impôt brut :</span>
                  <span className="font-medium">{formatEuro(simulation.ir.impotBrut || simulation.ir.impotNet)}</span>
                </div>
                
                <Separator />
                
                <div className="flex justify-between font-semibold">
                  <span className="text-gray-900">Impôt net :</span>
                  <span className="text-lg text-purple-700">{formatEuro(simulation.ir.impotNet)}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-xs text-gray-600 mt-2">
                  <div className="flex justify-between">
                    <span>Taux moyen :</span>
                    <span className="font-medium">{formatPercent(simulation.ir.tauxEffectif)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tranche marginale :</span>
                    <span className="font-medium">{formatPercent(simulation.ir.trancheMarginate)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </BlockCard>

        {/* Section 4 : Prélèvements sociaux */}
        <BlockCard
          title="Prélèvements sociaux (PS)"
          icon={<TrendingUp className="h-5 w-5" />}
        >
          {(simulation.ps.montant || 0) > 0 ? (
            <Card className="bg-cyan-50 border-cyan-200">
              <CardContent className="p-4">
                <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Base imposable</span>
                  <span className="font-semibold">{formatEuro(simulation.ps.baseImposable || 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Taux PS</span>
                  <span className="font-semibold">{formatPercent(simulation.ps.taux || 0)}</span>
                </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-900">Montant PS</span>
                    <span className="text-xl font-bold text-cyan-600">
                      {formatEuro(simulation.ps.montant || 0)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-200 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">✓</span>
              </div>
              <div>
                <p className="font-semibold text-emerald-800">Non applicable cette année</p>
                <p className="text-xs text-emerald-700">
                  Aucun revenu foncier positif soumis aux prélèvements sociaux
                </p>
              </div>
            </div>
          )}
        </BlockCard>

        {/* Section 5 : Plan Épargne Retraite (PER) */}
        {simulation.per && (
          <BlockCard
            title="Plan Épargne Retraite (PER)"
            icon={<PiggyBank className="h-5 w-5" />}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Calcul du plafond */}
              <div className="p-4 border border-blue-200 rounded-xl" style={{ backgroundColor: '#F6F8FF', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)' }}>
                <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  Calcul du plafond PER
                </h4>
                
                <div className="space-y-3 text-sm">
                  {/* Règles officielles */}
                  <div className="bg-blue-100 border border-blue-300 rounded-lg p-3">
                    <p className="font-semibold text-blue-900 mb-2 text-xs">📋 Règles officielles (Barème {simulation.inputs.year})</p>
                    <div className="space-y-1 text-xs text-blue-800">
                      <p>• Taux plafond : <strong>{formatPercent(simulation.taxParams.per?.tauxPlafond || 0.10)}</strong> des revenus professionnels</p>
                      <p>• Plancher légal : <strong>{formatEuro(simulation.taxParams.per?.plancherLegal || 4399)}</strong></p>
                      <p>• Durée report reliquats : <strong>{simulation.taxParams.per?.dureeReportReliquats || 3} ans</strong></p>
                    </div>
                  </div>

                  {/* Calcul détaillé */}
                  <div>
                    <p className="font-semibold text-blue-900 mb-2 text-xs">🧮 Calcul du plafond annuel</p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-start">
                        <span className="text-gray-700">Revenus professionnels {simulation.inputs.year}</span>
                        <span className="font-semibold">{formatEuro(simulation.inputs.foyer.salaire)}</span>
                      </div>
                      <div className="flex justify-between items-start text-xs text-gray-600">
                        <span className="ml-4">× Taux plafond ({formatPercent(simulation.taxParams.per?.tauxPlafond || 0.10)})</span>
                        <span className="font-medium">{formatEuro(simulation.inputs.foyer.salaire * (simulation.taxParams.per?.tauxPlafond || 0.10))}</span>
                      </div>
                      <div className="flex justify-between items-start text-xs text-gray-600">
                        <span className="ml-4">Maximum(ci-dessus, plancher {formatEuro(simulation.taxParams.per?.plancherLegal || 4399)})</span>
                        <span className="font-medium">{formatEuro(Math.max(simulation.inputs.foyer.salaire * (simulation.taxParams.per?.tauxPlafond || 0.10), simulation.taxParams.per?.plancherLegal || 4399))}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Reliquats */}
                  {Object.entries(simulation.per.details.reliquatsParAnnee).some(([_, amount]) => amount > 0) && (
                    <div>
                      <p className="font-semibold text-blue-900 mb-2 text-xs">📅 Reliquats utilisables</p>
                      {Object.entries(simulation.per.details.reliquatsParAnnee).map(([year, amount]) => (
                        amount > 0 && (
                          <div key={year} className="flex justify-between text-xs text-gray-600">
                            <span className="ml-4">• Reliquat {year}</span>
                            <span className="font-medium">{formatEuro(amount)}</span>
                          </div>
                        )
                      ))}
                    </div>
                  )}

                  <Separator className="bg-blue-400 my-2" />
                  
                  {/* Plafond total */}
                  <div className="flex justify-between pt-1">
                    <span className="font-semibold text-blue-900">Plafond total disponible</span>
                    <span className="font-bold text-blue-900 text-lg">{formatEuro(simulation.per.details.plafondDisponible)}</span>
                  </div>

                  {/* Versement et déduction */}
                  <div className="bg-white rounded-lg p-2 border border-blue-200">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600">Versement effectué</span>
                      <span className="font-semibold">{formatEuro(simulation.per.versement)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Déduction utilisée</span>
                      <span className="font-semibold text-green-700">{formatEuro(simulation.per.deductionUtilisee)}</span>
                    </div>
                  </div>

                  {/* Nouveau reliquat */}
                  {simulation.per.nouveauReliquat > 0 && (
                    <div className="bg-orange-100 border border-orange-300 rounded-lg p-3">
                      <p className="text-xs text-orange-800">
                        <strong>⚠️ Nouveau reliquat 2026 :</strong> {formatEuro(simulation.per.nouveauReliquat)}
                      </p>
                      <p className="text-xs text-orange-700 mt-1">
                        Reportable sur {simulation.taxParams.per?.dureeReportReliquats || 3} ans (jusqu'en {2025 + (simulation.taxParams.per?.dureeReportReliquats || 3)})
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Impact fiscal détaillé */}
              <div className="p-4 border border-green-200 rounded-xl" style={{ backgroundColor: '#F0FDF4', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)' }}>
                <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" />
                  Impact sur votre fiscalité
                </h4>
                <div className="space-y-3">
                  {/* Impact sur le revenu imposable */}
                  <div className="bg-white rounded-lg p-3 border border-green-200">
                    <p className="text-xs text-gray-600 mb-2">1️⃣ Réduction du revenu imposable</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700">Avant PER</span>
                        <span className="font-semibold text-gray-500 line-through">{formatEuro(simulation.ir.revenuImposable + simulation.per.deductionUtilisee)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700">Déduction PER</span>
                        <span className="font-semibold text-blue-700">-{formatEuro(simulation.per.deductionUtilisee)}</span>
                      </div>
                      <Separator className="bg-gray-300 my-1" />
                      <div className="flex justify-between">
                        <span className="text-gray-700 font-semibold">Après PER</span>
                        <span className="font-bold text-green-700 text-base">{formatEuro(simulation.ir.revenuImposable)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Impact sur l'impôt */}
                  <div className="bg-white rounded-lg p-3 border border-green-200">
                    <p className="text-xs text-gray-600 mb-2">2️⃣ Réduction de l'impôt sur le revenu</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm items-center">
                        <span className="text-gray-700">IR sans PER</span>
                        <span className="font-semibold text-gray-500 line-through">{formatEuro(simulation.ir.impotNet + simulation.per.economieIR)}</span>
                      </div>
                      <div className="flex justify-between text-sm items-center">
                        <span className="text-gray-700">Économie PER</span>
                        <span className="font-semibold text-green-700">-{formatEuro(simulation.per.economieIR)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 ml-4">
                        <span>({formatEuro(simulation.per.deductionUtilisee)} × {formatPercent(simulation.ir.trancheMarginate)} TMI)</span>
                      </div>
                      <Separator className="bg-gray-300 my-1" />
                      <div className="flex justify-between">
                        <span className="text-gray-700 font-semibold">IR avec PER</span>
                        <span className="font-bold text-green-700 text-base">{formatEuro(simulation.ir.impotNet)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Économie totale */}
                  <div className="bg-green-600 text-white rounded-lg p-4">
                    <p className="text-xs opacity-90 mb-1">💰 Économie d'impôt réalisée</p>
                    <p className="text-3xl font-bold">{formatEuro(simulation.per.economieIR)}</p>
                    <p className="text-xs opacity-80 mt-2">
                      Vous payez {formatEuro(simulation.ir.impotNet)} au lieu de {formatEuro(simulation.ir.impotNet + simulation.per.economieIR)}
                    </p>
                  </div>

                  {/* Note sur les PS */}
                  <div className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded p-2">
                    <Info className="h-3 w-3 inline mr-1" />
                    Le PER ne réduit pas les prélèvements sociaux (PS)
                  </div>
                </div>
              </div>
            </div>
          </BlockCard>
        )}

        {/* Section 6 : Résumé final */}
        <BlockCard
          title="Résumé final"
          icon={<Calculator className="h-5 w-5" />}
        >
          <Card 
            className="border-slate-300 rounded-xl"
            style={{ 
              background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
            }}
          >
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Total impôts (IR + PS) :</span>
                  <span className="font-bold text-red-600 text-base">
                    {formatEuro(simulation.ir.impotNet + (simulation.ps.montant || 0))}
                  </span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Résultat net après fiscalité :</span>
                  <span className={`font-bold text-base ${
                    (simulation.resume?.beneficeNetImmobilier || 0) >= 0 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    {formatEuro(simulation.resume?.beneficeNetImmobilier || 0)}
                  </span>
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Taux effectif :</span>
                    <span className="font-medium">{formatPercent(simulation.resume?.tauxEffectif || 0)}</span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex justify-between">
                      <span className="text-purple-600 font-medium">Rendement net :</span>
                      <span className="font-semibold text-purple-700">
                        {formatPercent(simulation.resume?.rendementNet || 0)}
                      </span>
                    </div>
                    <p className="text-gray-500 text-[10px] italic mt-0.5">
                      Après IR et PS, hors valorisation patrimoniale
                    </p>
                  </div>
                </div>
                
                {/* Imputation/Report */}
                {deficitGlobal > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-2.5">
                    {/* Barre bleue : Imputation */}
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                      <div className="flex justify-between mb-2">
                        <span className="text-gray-700 font-semibold text-xs">
                          Imputation opérée {simulation.inputs.year} :
                        </span>
                        <span className="font-bold text-blue-700 text-sm">
                          {formatEuro(imputableGlobal)} / {formatEuro(simulation.taxParams?.deficitFoncier?.plafondImputationRevenuGlobal || 10700)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 transition-all rounded-full"
                            style={{ width: `${Math.min(100, (imputableGlobal / (simulation.taxParams?.deficitFoncier?.plafondImputationRevenuGlobal || 10700)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-blue-700 min-w-[40px] text-right">
                          {((imputableGlobal / (simulation.taxParams?.deficitFoncier?.plafondImputationRevenuGlobal || 10700)) * 100).toFixed(0)} %
                        </span>
                      </div>
                    </div>
                    
                    {/* Barre orange : Report */}
                    {reportableGlobal > 0 && (
                      <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
                        <div className="flex justify-between mb-2">
                          <span className="text-gray-700 font-semibold text-xs">
                            Report opéré (10 ans max) :
                          </span>
                          <span className="font-bold text-orange-700 text-sm">
                            {formatEuro(reportableGlobal)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-orange-500 transition-all rounded-full"
                              style={{ width: '100%' }}
                            />
                          </div>
                          <span className="text-xs font-bold text-orange-700 min-w-[40px] text-right">
                            100 %
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </BlockCard>
      </div>
    </TooltipProvider>
  );
}

