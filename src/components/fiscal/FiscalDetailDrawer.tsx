/**
 * FiscalDetailDrawer - Drawer pour afficher les détails de calcul fiscal
 * 
 * Structure pédagogique : Biens → Consolidation → IR → PS → Résumé
 */

'use client';

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';
import type { SimulationResult, RentalPropertyResult } from '@/types/fiscal';
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown,
  FileText, 
  Calendar, 
  Eye,
  ChevronDown,
  ChevronUp,
  Info,
  Download,
  AlertCircle,
  Home,
  Building,
  HelpCircle,
} from 'lucide-react';

interface FiscalDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  simulation: SimulationResult;
  onOpenProjectionModal?: () => void;
}

export function FiscalDetailDrawer({
  open,
  onClose,
  simulation,
  onOpenProjectionModal,
}: FiscalDetailDrawerProps) {
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
    const newExpanded = new Set(expandedBiens);
    if (newExpanded.has(bienId)) {
      newExpanded.delete(bienId);
    } else {
      newExpanded.add(bienId);
    }
    setExpandedBiens(newExpanded);
  };
  
  // Calculer la consolidation globale
  const consolidation = simulation.consolidation;
  const deficitGlobal = consolidation.deficitFoncier || 0;
  const imputableGlobal = consolidation.deficitImputableRevenuGlobal || 0;
  const reportableGlobal = consolidation.deficitReportable || 0;
  
  // Calculer le gain fiscal
  const gainFiscal = imputableGlobal * simulation.ir.trancheMarginate;
  
  // Calculer la variation du revenu imposable
  const revenuInitial = imputableGlobal > 0 
    ? simulation.ir.revenuImposable + imputableGlobal 
    : simulation.ir.revenuImposable;
  const variationRevenu = imputableGlobal > 0 
    ? -((imputableGlobal / revenuInitial) * 100)
    : 0;
  
  return (
    <TooltipProvider>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-600" />
            Détails du calcul fiscal {simulation.inputs.year}
          </SheetTitle>
          <SheetDescription>
            Calcul complet : biens, consolidation, IR, PS et résumé
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          {/* ========== 1️⃣ REVENUS PAR BIEN ========== */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Home className="h-4 w-4 text-blue-600" />
                Revenus par bien
              </h3>
              <span className="text-xs text-gray-500">
                {simulation.biens.length} bien(s)
              </span>
            </div>
            
            <div className="space-y-3">
              {simulation.biens.map((bien) => {
                const isExpanded = expandedBiens.has(bien.id);
                const isDeficit = bien.resultatFiscal < 0;
                const interetsBien = bien.breakdown?.total?.interetsEmprunt || 0;
                const chargesHorsInterets = bien.chargesDeductibles - interetsBien;
                
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
                              <span className="text-gray-600">Charges hors intérêts :</span>
                              <span className="font-medium text-red-700">{formatEuro(chargesHorsInterets)}</span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Intérêts d'emprunt :</span>
                              <span className="font-medium text-orange-700">{formatEuro(interetsBien)}</span>
                            </div>
                            {bien.amortissements > 0 && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Amortissements :</span>
                                <span className="font-medium text-gray-700">{formatEuro(bien.amortissements)}</span>
                              </div>
                            )}
                          </div>
                          
                          <Separator />
                          
                          <div className="flex justify-between font-semibold">
                            <span className="text-gray-900">Résultat fiscal :</span>
                            <span className={isDeficit ? 'text-red-600' : 'text-green-600'}>
                              {formatEuro(bien.resultatFiscal)}
                            </span>
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
                                  
                                  {bien.deficitImputableRevenuGlobal && bien.deficitImputableRevenuGlobal > 0 && (
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
                                      <span className="font-medium">{formatEuro(bien.deficitImputableRevenuGlobal)}</span>
                                    </div>
                                  )}
                                  
                                  {bien.deficitReportable && bien.deficitReportable > 0 && (
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
                                      <span className="font-medium">{formatEuro(bien.deficitReportable)}</span>
                                    </div>
                                  )}
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
          </section>
          
          <Separator />
          
          {/* ========== 2️⃣ CONSOLIDATION FONCIÈRE GLOBALE ========== */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Building className="h-4 w-4 text-purple-600" />
                Consolidation foncière (global)
              </h3>
            </div>
            
            {/* Bandeau exclusion si micro-foncier */}
            {simulation.biens.some(b => b.regime === 'micro' && b.type === 'NU') && (
              <div 
                className="mb-3 p-3 border border-yellow-300 rounded-xl text-sm"
                style={{ 
                  backgroundColor: '#FEF9E7',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
                }}
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-yellow-800 font-medium">Régime micro-foncier détecté</p>
                    <p className="text-yellow-700 text-xs mt-1">
                      Le déficit foncier n'est pas applicable en micro-foncier. Passez au régime réel pour imputer le déficit sur votre revenu global.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
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
                        {formatEuro(simulation.biens.reduce((sum, b) => sum + b.recettesBrutes, 0))}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">Charges hors intérêts</p>
                      <p className="text-base font-semibold text-orange-700">
                        {formatEuro(simulation.biens.reduce((sum, b) => {
                          const interets = b.breakdown?.total?.interetsEmprunt || 0;
                          return sum + (b.chargesDeductibles - interets);
                        }, 0))}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">Intérêts totaux</p>
                      <p className="text-base font-semibold text-red-700">
                        {formatEuro(simulation.biens.reduce((sum, b) => sum + (b.breakdown?.total?.interetsEmprunt || 0), 0))}
                      </p>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Résultat global */}
                  <div className="flex justify-between font-semibold text-base mt-3">
                    <span className="text-gray-900">Résultat foncier net global (avant imputation) :</span>
                    <span className={consolidation.revenusFonciers > 0 ? 'text-green-600' : 'text-red-600'}>
                      {consolidation.revenusFonciers > 0 
                        ? formatEuro(consolidation.revenusFonciers)
                        : formatEuro(-deficitGlobal)
                      }
                    </span>
                  </div>
                  
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
                        <span className="text-gray-700 flex items-center gap-1">
                          Imputable revenu global :
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 text-blue-500 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Plafonné à {formatEuro(simulation.taxParams.deficitFoncier.plafondImputationRevenuGlobal)} (hors intérêts)</p>
                              <p className="text-xs text-gray-500 mt-1">Formule : cap = max(0, loyers - intérêts)</p>
                              <p className="text-xs text-gray-500">imputable = max(0, charges_HI - cap)</p>
                            </TooltipContent>
                          </Tooltip>
                        </span>
                        <span className="font-bold text-blue-700">{formatEuro(imputableGlobal)}</span>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700 flex items-center gap-1">
                          Intérêts reportables (10 ans) :
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 text-orange-500 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Reportable sur revenus fonciers futurs uniquement</p>
                              <p className="text-xs text-gray-500 mt-1">Durée: 10 ans maximum</p>
                            </TooltipContent>
                          </Tooltip>
                        </span>
                        <span className="font-bold text-orange-700">{formatEuro(reportableGlobal)}</span>
                      </div>
                      
                      <p className="text-xs text-gray-600 italic mt-2">
                        💡 Les intérêts ne peuvent PAS s'imputer sur le revenu global, mais peuvent compenser des bénéfices fonciers futurs.
                      </p>
                      
                      <div className="flex gap-2 mt-2">
                        {reportableGlobal > 0 && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="flex-1 text-xs h-7"
                            onClick={() => {}}
                          >
                            📊 Historique reports (N→N+10)
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="flex-1 text-xs h-7 text-blue-600 hover:text-blue-700"
                          onClick={() => window.open('/aide/deficit-foncier', '_blank')}
                        >
                          <HelpCircle className="h-3 w-3 mr-1" />
                          Guide complet
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Revenus BIC */}
                  {consolidation.revenusBIC > 0 && (
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-gray-600">Revenus BIC nets :</span>
                      <span className="font-medium text-green-700">
                        {formatEuro(consolidation.revenusBIC)}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>
          
          <Separator />
          
          {/* ========== 3️⃣ IMPACT SUR L'IR ========== */}
          <section>
            <div className="mb-3">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                Impact sur l'Impôt sur le Revenu
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Simulation de l'impact sur l'impôt sur le revenu (formulaire 2042)
              </p>
            </div>
            
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
                      <span>Revenu global initial :</span>
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
                    <span className="font-medium">{simulation.inputs.foyer.parts}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Revenu par part :</span>
                    <span className="font-medium">{formatEuro(simulation.ir.revenuParPart)}</span>
                  </div>
                </div>
                
                {/* Gain fiscal */}
                {imputableGlobal > 0 && gainFiscal > 0 && (
                  <div 
                    className="mt-3 p-3 border border-green-400 rounded-xl"
                    style={{ 
                      backgroundColor: '#E8F6EE',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
                    }}
                  >
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-green-800 font-semibold flex items-center gap-1">
                        <TrendingDown className="h-4 w-4" />
                        Gain fiscal (déficit imputé)
                      </span>
                      <span className="font-bold text-green-700 text-base">
                        -{formatEuro(gainFiscal)}
                      </span>
                    </div>
                    <p className="text-xs text-green-700">
                      Économie estimée : {formatEuro(imputableGlobal)} × {formatPercent(simulation.ir.trancheMarginate)} (TMI)
                    </p>
                  </div>
                )}
              </div>
              
              {/* Détail par tranche */}
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Détail par tranche :</p>
                <div className="space-y-1">
                  {simulation.ir.detailsTranches.map((detail, index) => (
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
                    <span className="font-medium">{formatEuro(simulation.ir.impotBrut)}</span>
                  </div>
                  
                  {simulation.ir.decote > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Décote :</span>
                      <span className="font-medium">-{formatEuro(simulation.ir.decote)}</span>
                    </div>
                  )}
                  
                  <Separator />
                  
                  <div className="flex justify-between font-bold text-base">
                    <span className="text-gray-900">Impôt net :</span>
                    <span className="text-purple-600">
                      {formatEuro(simulation.ir.impotNet)}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-xs text-gray-500 mt-2">
                    <div className="flex justify-between">
                      <span>Taux moyen :</span>
                      <span>{formatPercent(simulation.ir.tauxMoyen)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tranche marginale :</span>
                      <span className="font-semibold">{formatPercent(simulation.ir.trancheMarginate)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
          
          <Separator />
          
          {/* ========== 4️⃣ PRÉLÈVEMENTS SOCIAUX ========== */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">Prélèvements sociaux (revenus fonciers positifs uniquement)</h3>
              <span className="text-xs text-gray-500">Taux 17,2%</span>
            </div>
            
            {simulation.ps.baseImposable > 0 ? (
              <Card 
                className="border-orange-200 rounded-xl"
                style={{ 
                  backgroundColor: '#FFF4EC',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
                }}
              >
                <CardContent className="p-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Base imposable PS :</span>
                      <span className="font-medium text-gray-900">
                        {formatEuro(simulation.ps.baseImposable)}
                      </span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-gray-700">Taux PS :</span>
                      <span className="font-medium">{formatPercent(simulation.ps.taux)}</span>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex justify-between font-bold text-base">
                      <span className="text-gray-900">Montant PS :</span>
                      <span className="text-orange-600">
                        {formatEuro(simulation.ps.montant)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div 
                className="p-3 border border-green-300 rounded-xl text-sm"
                style={{ 
                  backgroundColor: '#E8F6EE',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
                }}
              >
                <div className="flex items-center gap-2 text-green-700">
                  <span className="text-lg">✅</span>
                  <span className="font-medium">Non applicable cette année (aucun revenu foncier positif)</span>
                </div>
              </div>
            )}
          </section>
          
          {/* ========== PER (si applicable) ========== */}
          {simulation.per && (
            <>
              <Separator />
              <section>
                <h3 className="text-base font-semibold mb-3">Plan Épargne Retraite (PER)</h3>
                
                <Card 
                  className="border-blue-200 rounded-xl"
                  style={{ 
                    backgroundColor: '#EFF6FF',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
                  }}
                >
                  <CardContent className="p-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-700">Versement :</span>
                        <span className="font-medium">{formatEuro(simulation.per.versement)}</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-700">Déduction utilisée :</span>
                        <span className="font-medium">{formatEuro(simulation.per.deductionUtilisee)}</span>
                      </div>
                      
                      <Separator />
                      
                      <div className="flex justify-between text-green-600 font-semibold">
                        <span>Économie d'IR :</span>
                        <span>{formatEuro(simulation.per.economieIR)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>
            </>
          )}
          
          <Separator />
          
          {/* ========== 5️⃣ RÉSUMÉ FINAL ========== */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">Résumé final</h3>
            </div>
            
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
                      {formatEuro(simulation.resume.totalImpots)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">Résultat net après fiscalité :</span>
                    <span className={`font-bold text-base ${simulation.resume.beneficeNetImmobilier >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatEuro(simulation.resume.beneficeNetImmobilier)}
                    </span>
                  </div>
                  
                  <Separator />
                  
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Taux effectif :</span>
                      <span className="font-medium">{formatPercent(simulation.resume.tauxEffectif)}</span>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex justify-between">
                        <span className="text-purple-600 font-medium">Rendement net :</span>
                        <span className="font-semibold text-purple-700">{formatPercent(simulation.resume.rendementNet)}</span>
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
                            {formatEuro(imputableGlobal)} / {formatEuro(simulation.taxParams.deficitFoncier.plafondImputationRevenuGlobal)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500 transition-all rounded-full"
                              style={{ width: `${Math.min(100, (imputableGlobal / simulation.taxParams.deficitFoncier.plafondImputationRevenuGlobal) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-blue-700 min-w-[40px] text-right">
                            {((imputableGlobal / simulation.taxParams.deficitFoncier.plafondImputationRevenuGlobal) * 100).toFixed(0)} %
                          </span>
                        </div>
                      </div>
                      
                      {/* Barre orange : Intérêts reportés */}
                      {reportableGlobal > 0 && (
                        <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
                          <div className="flex justify-between mb-1">
                            <span className="text-gray-700 font-semibold text-xs">
                              Intérêts reportés N+1 :
                            </span>
                            <span className="font-bold text-orange-700 text-sm">
                              {formatEuro(reportableGlobal)}
                            </span>
                          </div>
                          <p className="text-orange-700 text-[10px]">
                            Reportable sur revenus fonciers futurs (reste 9 ans, max {simulation.inputs.year + 10})
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>
          
          {/* ========== MÉTADONNÉES ========== */}
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p><strong>Barèmes :</strong> {simulation.taxParams.version}</p>
                <p className="mt-1"><strong>Source :</strong> {simulation.taxParams.source}</p>
              </div>
              <div className="text-right">
                <p><strong>Calculé le :</strong> {new Date(simulation.dateCalcul).toLocaleString('fr-FR', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</p>
                <p className="mt-1"><strong>Durée :</strong> {simulation.dureeCalculMS} ms</p>
              </div>
            </div>
          </div>
          
          {/* ========== LIEN VERS DÉTAIL PROJECTION ========== */}
          {onOpenProjectionModal && simulation.biens.some((b: any) => b.breakdown) && (
            <div className="mt-4">
              <Button
                onClick={onOpenProjectionModal}
                variant="outline"
                className="w-full"
              >
                <Calendar className="mr-2 h-4 w-4" />
                Voir le détail des données projetées (Passé + Projection)
                <Eye className="ml-2 h-4 w-4" />
              </Button>
              <p className="text-xs text-gray-500 text-center mt-2">
                Breakdown par bien : recettes, charges, intérêts (historique + projection)
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
    </TooltipProvider>
  );
}
