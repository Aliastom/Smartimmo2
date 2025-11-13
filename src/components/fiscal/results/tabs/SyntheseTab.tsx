/**
 * SyntheseTab - Vue d'ensemble avec KPIs et graphiques
 */

'use client';

import { useMemo } from 'react';
import { BlockCard } from '../BlockCard';
import { KpiCard } from '../KpiCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Separator } from '@/components/ui/Separator';
import { 
  TrendingUp, 
  TrendingDown, 
  Home, 
  Euro, 
  Percent,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  Coins,
  PiggyBank,
  ArrowUpRight,
  Info,
  Calculator,
} from 'lucide-react';
import type { SimulationResult } from '@/types/fiscal';

interface SyntheseTabProps {
  simulation: SimulationResult;
  onGoToDetails: () => void;
  onGoToOptimizations: () => void;
}

export function SyntheseTab({ simulation, onGoToDetails, onGoToOptimizations }: SyntheseTabProps) {
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

  return (
    <div className="space-y-6 p-6">
      {/* Titre et sous-titre */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Synthèse fiscale
        </h2>
        <p className="text-gray-600">
          Vue d'ensemble de votre situation fiscale avec les indicateurs clés
        </p>
      </div>

      {/* Section 1 : KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total impôts (IR + PS)"
          value={formatEuro(totalImpots)}
          subtitle={`IR: ${formatEuro(simulation.ir.impotNet)} • PS: ${formatEuro(simulation.ps.montant || 0)}`}
          icon={<Coins className="h-6 w-6 text-violet-400" />}
          valueColor="text-violet-600"
          className="bg-white/70"
        />

        <KpiCard
          title="Bénéfice net immobilier"
          value={formatEuro(beneficeNet)}
          subtitle="Loyers - Charges - Impôts"
          icon={<PiggyBank className={`h-6 w-6 ${beneficeNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} />}
          valueColor={beneficeNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}
          className="bg-white/70"
        />

        <KpiCard
          title="Taux effectif"
          value={formatPercent(simulation.resume?.tauxEffectif || 0)}
          subtitle={`TMI: ${formatPercent(simulation.ir.trancheMarginate)}`}
          icon={<Percent className="h-6 w-6 text-sky-400" />}
          valueColor="text-sky-600"
          className="bg-white/70"
        />

        <KpiCard
          title="Base imposable (IR)"
          value={formatEuro(simulation.ir.revenuImposable)}
          subtitle={(() => {
            const salaire = simulation.inputs.foyer.salaire;
            const foncier = simulation.consolidation.revenusFonciers;
            const deficitImp = simulation.consolidation.deficitImputableRevenuGlobal || 0;
            const perDeduction = simulation.per?.deductionUtilisee || 0;
            
            const parts = [`${formatEuro(salaire)} sal.`];
            if (foncier !== 0) parts.push(`${foncier >= 0 ? '+' : ''}${formatEuro(foncier)} fonc.`);
            if (deficitImp > 0) parts.push(`-${formatEuro(deficitImp)} déf.imp.`);
            if (perDeduction > 0) parts.push(`-${formatEuro(perDeduction)} PER`);
            
            return parts.join(' ');
          })()}
          icon={<FileText className="h-6 w-6 text-purple-400" />}
          valueColor="text-purple-600"
          className="bg-white/70"
        />
      </div>

      {/* Section 2 : Détail du calcul */}
      <BlockCard
        title="Détail du calcul"
        icon={<TrendingUp className="h-5 w-5" />}
      >
        <div className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="font-medium text-blue-900 mb-3 flex items-center gap-1">
            <Info className="h-4 w-4" />
            Comment est calculé le bénéfice net immobilier
          </p>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Loyers encaissés</span>
              <span className="font-semibold text-emerald-600">{formatEuro(loyersTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>- Charges déductibles</span>
              <span className="font-semibold text-rose-600">-{formatEuro(chargesTotal)}</span>
            </div>
            <div className="flex justify-between text-blue-800">
              <span>- Impôts supplémentaires (IR + PS causés par le foncier)</span>
              <span className="font-semibold">
                {impotsSuppTotal > 0 ? `-${formatEuro(impotsSuppTotal)}` : `${formatEuro(0)} (économie)`}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 ml-6">
              <span>└ dont IR supplémentaire</span>
              <span>
                {irSupplementaire > 0 ? `-${formatEuro(irSupplementaire)}` : `${formatEuro(0)} (économie ${formatEuro(Math.abs(irSupplementaire))})`}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-500 ml-6">
              <span>└ dont PS fonciers</span>
              <span>{formatEuro(simulation.ps.montant || 0)}</span>
            </div>
            
            <Separator className="bg-blue-300 my-2" />
            
            <div className="flex justify-between pt-1 font-semibold text-blue-900">
              <span className="text-base">= Bénéfice net réel</span>
              <span className={`text-xl ${beneficeNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatEuro(beneficeNet)}
              </span>
            </div>
          </div>
        </div>
      </BlockCard>

      {/* Section 3 : Régimes par bien */}
      <BlockCard
        title="Régimes fiscaux par bien"
        icon={<Home className="h-5 w-5" />}
        badge={
          biensNonOptimaux.length > 0 && (
            <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
              {biensNonOptimaux.length} à optimiser
            </Badge>
          )
        }
      >
        <div className="space-y-3">
          {regimesParBien.map((bien, i) => {
            const bienComplet = simulation.biens.find(b => b.nom === bien.nom);
            // ✅ Utiliser le résultat du backend
            const resultat = bienComplet?.resultatFiscal || 0;
            
            return (
              <Card
                key={i}
                className={`border ${bien.isOptimal ? 'border-emerald-200 bg-emerald-50' : 'border-orange-200 bg-orange-50'}`}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {bien.isOptimal ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-orange-600" />
                      )}
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{bien.nom}</p>
                          <span className={`text-sm font-semibold ${resultat >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {resultat >= 0 ? '+' : ''}{formatEuro(resultat)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">
                          Régime : {bien.regimeUtilise === 'micro' ? 'Micro' : 'Réel'}
                          {!bien.isOptimal && ` → Suggéré: ${bien.regimeSuggere === 'micro' ? 'Micro' : 'Réel'}`}
                        </p>
                      </div>
                    </div>

                    {!bien.isOptimal && (
                      <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                        +{Math.round(Math.abs(bien.gainPotentiel))} €/an
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Total des résultats fonciers - Backend */}
          {(() => {
            const totalResultats = simulation.consolidation.revenusFonciers;
            
            return (
              <Card className="border-2 border-purple-300 bg-purple-50">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Calculator className="h-5 w-5 text-purple-600" />
                      <div>
                        <p className="font-semibold text-gray-900">Total revenus fonciers</p>
                        <p className="text-xs text-gray-600">
                          Consolidation de {simulation.biens.length} bien(s)
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold ${totalResultats >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {totalResultats >= 0 ? '+' : ''}{formatEuro(totalResultats)}
                      </p>
                      <p className="text-xs text-gray-500">Résultat fiscal net</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </div>

        {biensNonOptimaux.length > 0 && (
          <div className="mt-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={onGoToOptimizations}>
              Voir les optimisations <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </BlockCard>

      {/* Section 4 : PER (Plan Épargne Retraite) - Version synthétique */}
      {simulation.per && (
        <BlockCard
          title="Plan Épargne Retraite (PER)"
          icon={<PiggyBank className="h-5 w-5" />}
          badge={
            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
              -{formatEuro(simulation.per.economieIR)} d'impôt
            </Badge>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Versement effectué */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <p className="text-xs text-blue-700 mb-2">Versement effectué</p>
              <p className="text-2xl font-bold text-blue-900">{formatEuro(simulation.per.versement)}</p>
              <p className="text-xs text-gray-600 mt-1">Sur {formatEuro(simulation.per.details.plafondDisponible)} disponible</p>
            </div>

            {/* Impact sur le revenu imposable - Détaillé */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-600 mb-3 text-center">Revenu imposable global</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Salaire net imposable</span>
                  <span className="font-semibold">{formatEuro(simulation.inputs.foyer.salaire)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Revenus fonciers</span>
                  <span className={`font-semibold ${simulation.consolidation.revenusFonciers >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {simulation.consolidation.revenusFonciers >= 0 ? '+' : ''}{formatEuro(simulation.consolidation.revenusFonciers)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Déduction PER</span>
                  <span className="font-semibold text-blue-700">-{formatEuro(simulation.per.deductionUtilisee)}</span>
                </div>
                <Separator className="bg-gray-300 my-1" />
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">Total imposable</span>
                  <span className="text-xl font-bold text-green-700">{formatEuro(simulation.ir.revenuImposable)}</span>
                </div>
              </div>
            </div>

            {/* Économie réalisée */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p className="text-xs text-green-700 mb-2">Économie d'impôt (IR)</p>
              <p className="text-3xl font-bold text-green-600">{formatEuro(simulation.per.economieIR)}</p>
              <p className="text-xs text-gray-600 mt-1">{formatPercent(simulation.ir.trancheMarginate)} × {formatEuro(simulation.per.deductionUtilisee)}</p>
            </div>
          </div>
          
          {simulation.per.nouveauReliquat > 0 && (
            <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
              <Info className="h-4 w-4 inline mr-2 text-orange-600" />
              <span className="text-orange-800">
                Reliquat non utilisé : <strong>{formatEuro(simulation.per.nouveauReliquat)}</strong> reportable sur {simulation.taxParams.per?.dureeReportReliquats || 3} ans
              </span>
            </div>
          )}
        </BlockCard>
      )}

      {/* CTA final */}
      <div className="flex justify-center pt-4">
        <Button onClick={onGoToDetails} size="lg" className="gap-2">
          <FileText className="h-5 w-5" />
          Accéder aux détails fiscaux complets
        </Button>
      </div>
    </div>
  );
}

