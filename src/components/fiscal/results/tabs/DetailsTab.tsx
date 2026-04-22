/**
 * DetailsTab - Étape 3 : Calcul de l'impôt (ORANGE)
 * 
 * Détail du calcul de l'IR, PS et total impôt
 */

'use client';

import { useState, useMemo } from 'react';
import { computeIRResult } from '@/services/tax/computeIRResult';
import { irNetAffichageEuro } from '@/services/tax/irNetAffichageEuro';
import { useFiscalStore } from '@/store/fiscalStore';
import {
  abattementForfaitaireRevenus,
  computeRevenuProFoyerIR,
  computeCotisationsPensionsEffectives,
} from '@/services/tax/computeRevenuProFoyerIR';
import { BlockCard } from '../BlockCard';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';
import { useExpertModeStore } from '@/store/expertModeStore';
import { ExpertCalculBlocks } from '../../expert/ExpertCalculBlocks';
import type { SimulationResult, RentalPropertyResult } from '@/types/fiscal';
import { allocateProRataTwoWeights } from '@/lib/fiscal/immoTaxDisplayAlloc';
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
  const draftFoyer = useFiscalStore((s) => s.simulationDraft.foyer);
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

  const formatPartsFr = (p: number) =>
    Number.isInteger(p) ? String(p) : p.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });

  const partsFoyer = simulation.inputs?.foyer?.parts ?? 1;

  const gainImpotParts = useMemo(() => {
    if (partsFoyer <= 1 || !simulation.taxParams) return null;
    const r = simulation.ir.revenuImposable;
    if (r <= 0) return null;
    const irUnePart = computeIRResult(r, 1, simulation.taxParams, simulation.inputs?.foyer?.isCouple ?? false);
    const gain = Math.round(irUnePart.impotNet - simulation.ir.impotNet);
    return gain > 0 ? gain : null;
  }, [simulation, partsFoyer]);

  /** Relevé chiffré pour valider IR / décote : jamais en prod ; en local, activer NEXT_PUBLIC_FISCAL_IR_DEBUG=true */
  const debugIrDevPanel = useMemo(() => {
    if (
      process.env.NODE_ENV !== 'development' ||
      process.env.NEXT_PUBLIC_FISCAL_IR_DEBUG !== 'true'
    ) {
      return null;
    }
    const meta = simulation.inputs._uiMetadata;
    const tp = simulation.taxParams?.salaryDeduction;
    const foyer = simulation.inputs.foyer;
    const taxParams = simulation.taxParams;
    const rows: { k: string; v: string }[] = [];

    if (taxParams) {
      rows.push({
        k: 'Version fiscale chargée (code / année barème)',
        v: `${taxParams.version} / ${taxParams.year}`,
      });
      const b = taxParams.irBrackets || [];
      rows.push({
        k: 'Barème IR effectif (tranches)',
        v: b
          .map(
            (t) =>
              `${t.lower}–${t.upper == null ? '∞' : t.upper} : ${(t.rate * 100).toFixed(1).replace(/\.0$/, '')} %`
          )
          .join(' | '),
      });
      const d = taxParams.irDecote;
      rows.push({
        k: 'Décote effective (seuils / plafonds / taux)',
        v: d
          ? `célib ${d.seuilCelibataire} € | couple ${d.seuilCouple} € | plaf. célib ${d.plafondCelibataire} € | plaf. couple ${d.plafondCouple} € | taux ${d.taux}`
          : '—',
      });
    }

    const pensionsBrutes = Math.max(0, Number(foyer.pensionsBrutes) || 0);
    let baseFoyerAvantQuotient: number;

    if (pensionsBrutes > 0 && taxParams) {
      const dedP = abattementForfaitaireRevenus(pensionsBrutes, taxParams);
      const netApresAbattementPensions = pensionsBrutes - dedP;
      const cotisP = computeCotisationsPensionsEffectives(
        foyer,
        taxParams,
        netApresAbattementPensions
      );
      const netImposablePensions = Math.max(0, netApresAbattementPensions - cotisP);
      const activiteNet =
        Math.max(0, Number(foyer.salaire) || 0) + Math.max(0, Number(foyer.autresRevenus) || 0);

      rows.push({ k: 'Pensions brutes (saisie)', v: formatEuro(pensionsBrutes) });
      rows.push({
        k: 'Abattement 10 % sur pensions (borné min/max barème)',
        v: `−${formatEuro(dedP)}`,
      });
      rows.push({
        k: 'Base pensions après abattement 10 %',
        v: formatEuro(netApresAbattementPensions),
      });
      rows.push({
        k: 'Déductions sociales déductibles sur pensions (ex. CSG déductible)',
        v: cotisP > 0 ? `−${formatEuro(cotisP)}` : formatEuro(0),
      });
      rows.push({
        k: 'Net imposable pensions',
        v: formatEuro(netImposablePensions),
      });
      rows.push({
        k: 'Revenus d’activité nets imposables (salaire + autres, hors pensions)',
        v: formatEuro(activiteNet),
      });
      baseFoyerAvantQuotient = computeRevenuProFoyerIR(foyer, taxParams);
      rows.push({
        k: 'Base foyer avant quotient / barème (moteur)',
        v: formatEuro(baseFoyerAvantQuotient),
      });
    } else {
      let baseApresAbattement: number;
      if (
        meta?.salaryMode === 'brut' &&
        meta.salaireBrutOriginal != null &&
        (meta.deductionMode ?? 'forfaitaire') === 'forfaitaire' &&
        tp
      ) {
        const brut = meta.salaireBrutOriginal;
        const ded = Math.min(
          Math.max(brut * (tp.taux ?? 0.1), tp.min ?? 472),
          tp.max ?? 13522
        );
        baseApresAbattement = brut - ded;
        rows.push({
          k: 'Brut saisi (revenus d’activité — ne pas confondre avec pensions brutes)',
          v: formatEuro(brut),
        });
        rows.push({
          k: 'Abattement forfaitaire 10 % (borné min/max barème)',
          v: `−${formatEuro(ded)}`,
        });
        rows.push({
          k: 'Base après abattement 10 %',
          v: formatEuro(baseApresAbattement),
        });
      } else {
        baseApresAbattement = foyer.salaire + foyer.autresRevenus;
        rows.push({
          k: 'Base après abattement (salaire + autres, déjà nets côté saisie)',
          v: formatEuro(baseApresAbattement),
        });
      }

      const con = simulation.consolidation;
      const casFoyerSeul =
        (simulation.biens?.length ?? 0) === 0 &&
        Math.abs(con?.revenusFonciers ?? 0) < 0.005 &&
        Math.abs(con?.revenusBIC ?? 0) < 0.005 &&
        Math.abs((con as { deficitImputableRevenuGlobal?: number })?.deficitImputableRevenuGlobal ?? 0) <
          0.005 &&
        (simulation.inputs.per?.versementPrevu ?? 0) <= 0;

      let cotisDed: number;
      if (casFoyerSeul) {
        const revenuMoteur = simulation.ir.revenuImposable;
        cotisDed = Math.max(0, Math.round(baseApresAbattement - revenuMoteur));
        baseFoyerAvantQuotient = revenuMoteur;
      } else {
        const cotisSaisie =
          foyer.cotisationsSocialesDeductibles ??
          draftFoyer?.cotisationsSocialesDeductibles;
        cotisDed = Math.max(0, Number(cotisSaisie) || 0);
        baseFoyerAvantQuotient = Math.max(0, baseApresAbattement - cotisDed);
      }

      rows.push({
        k: 'Cotisations sociales déductibles (voie historique, hors pensions brutes)',
        v: cotisDed > 0 ? `−${formatEuro(cotisDed)}` : formatEuro(0),
      });
      rows.push({
        k: casFoyerSeul
          ? 'Base finale avant quotient (= revenu imposable moteur, foyer seul)'
          : 'Base finale avant quotient (pro + autres nets saisie − cotisations)',
        v: formatEuro(baseFoyerAvantQuotient),
      });
    }

    rows.push({
      k: 'Revenu imposable total (IR, y compris immo / PER si applicable)',
      v: formatEuro(simulation.ir.revenuImposable),
    });
    rows.push({
      k: 'Revenu par part (moteur)',
      v: `${simulation.ir.revenuParPart.toFixed(4)} € (${foyer.parts} part(s))`,
    });
    rows.push({
      k: 'Impôt brut',
      v: `${simulation.ir.impotBrut.toFixed(2)} € (arrondi affichage ${formatEuro(Math.round(simulation.ir.impotBrut))})`,
    });
    rows.push({
      k: 'Décote appliquée',
      v: `${simulation.ir.decote.toFixed(2)} € (${formatEuro(Math.round(simulation.ir.decote))})`,
    });
    rows.push({
      k: 'Impôt final (IR net)',
      v: `${simulation.ir.impotNet.toFixed(2).replace('.', ',')} € (~${simulation.ir.impotNet.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} €) · affichage ${formatEuro(irNetAffichageEuro(simulation.ir.impotNet))}`,
    });
    rows.push({
      k: 'Parts / isCouple',
      v: `${foyer.parts} / ${foyer.isCouple ? 'oui' : 'non'}`,
    });
    rows.push({
      k: 'PAS déjà payé (option simulation)',
      v: formatEuro(simulation.inputs.options?.prelevementSourceDejaPaye ?? 0),
    });

    return (
      <div className="mt-3 rounded border border-dashed border-amber-500/50 bg-amber-50/70 p-3 text-[11px] leading-relaxed text-amber-950 space-y-1 font-mono">
        <p className="font-sans font-semibold text-amber-900 border-b border-amber-200/80 pb-1 mb-1.5">
          Debug IR (dev uniquement)
        </p>
        {rows.map((r) => (
          <p key={r.k}>
            <span className="text-amber-800/85">{r.k} :</span> {r.v}
          </p>
        ))}
      </div>
    );
  }, [simulation, draftFoyer]);
  
  // Données
  const baseImposable = simulation.ir.revenuImposable;
  const irTotalMoteur = simulation.ir.impotNet;
  const irBrutArrondi = Math.round(simulation.ir.impotBrut);
  const decoteArrondie = Math.round(simulation.ir.decote);
  const irNetEuroAffichage = irNetAffichageEuro(simulation.ir.impotNet);
  const psTotal = simulation.ps.montant || 0;
  const psEuroAffichage = Math.round(psTotal);
  const totalImpotsEuroAffichage = irNetEuroAffichage + psEuroAffichage;

  const irSupplementaire = simulation.resume?.irSupplementaire ?? 0;
  const baseNuIrfPs = Math.max(0, simulation.consolidation.revenusFonciers);
  const baseBicIrfPs = Math.max(0, simulation.consolidation.revenusBIC);
  const irSuppAlloc = useMemo(
    () => allocateProRataTwoWeights(irSupplementaire, baseNuIrfPs, baseBicIrfPs),
    [irSupplementaire, baseNuIrfPs, baseBicIrfPs],
  );
  const psAlloc = useMemo(
    () => allocateProRataTwoWeights(psTotal, baseNuIrfPs, baseBicIrfPs),
    [psTotal, baseNuIrfPs, baseBicIrfPs],
  );
  const hasImmoFiscalNuOuBic =
    Math.abs(simulation.consolidation.revenusFonciers) > 0.005 ||
    Math.abs(simulation.consolidation.revenusBIC) > 0.005 ||
    Math.abs(irSupplementaire) > 0.005 ||
    psTotal > 0.005;
  
  const prelevementSourceDejaPaye = simulation.inputs?.options?.prelevementSourceDejaPaye || 0;
  const acomptesDejaPayes = simulation.inputs?.options?.acomptesDejaPayes || 0;
  const totalDejaPaye = prelevementSourceDejaPaye + acomptesDejaPayes;
  /** Solde réel (peut être négatif si trop-perçu) — affichage uniquement, sans modifier le moteur. */
  const soldeFiscalEstimeEuro = totalImpotsEuroAffichage - totalDejaPaye;

  /** IR : barème appliqué sur le quotient, puis × parts, puis décote (même ordre que le moteur) */
  const impotCalculeParPart =
    partsFoyer > 0 ? simulation.ir.impotBrut / partsFoyer : simulation.ir.impotBrut;
  const revenuParPartArrondi = Math.round(simulation.ir.revenuParPart);
  const impotParPartArrondi = Math.round(impotCalculeParPart);

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
                  <p className="text-xs text-gray-500 mt-1 italic">
                    Salaire + résultat foncier (NU) + résultat BIC (LMNP/LMP) – déficit foncier imputable – PER
                  </p>
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

                {/* Synthèse quotient / parts / décote (lien tranches ↔ impôt final) */}
                <div className="rounded-md border border-orange-200/90 bg-orange-50/50 px-3 py-2.5 text-xs text-gray-700">
                  <p className="text-[11px] text-gray-600 leading-snug mb-1.5">
                    Les tranches ci-dessus sont calculées sur <strong>une part</strong> de revenu (quotient familial).
                  </p>
                  <p className="text-[11px] text-gray-600 leading-snug mb-2">
                    L&apos;impôt issu de ce barème sur une part est ensuite{' '}
                    <strong>multiplié par le nombre de parts</strong> pour obtenir l&apos;impôt brut du foyer.
                  </p>
                  <ul className="space-y-1 text-[11px] text-gray-800 tabular-nums border-t border-orange-200/70 pt-2">
                    <li className="flex justify-between gap-3">
                      <span className="text-gray-600 shrink min-w-0">Revenu par part</span>
                      <span className="font-medium shrink-0">{formatEuro(revenuParPartArrondi)}</span>
                    </li>
                    <li className="flex justify-between gap-3">
                      <span className="text-gray-600 shrink min-w-0">Impôt calculé par part</span>
                      <span className="font-medium shrink-0">{formatEuro(impotParPartArrondi)}</span>
                    </li>
                    <li className="flex justify-between gap-3">
                      <span className="text-gray-600 shrink min-w-0">Nombre de parts</span>
                      <span className="font-medium shrink-0">{formatPartsFr(partsFoyer)}</span>
                    </li>
                    <li className="flex justify-between gap-3">
                      <span className="text-gray-600 shrink min-w-0">Impôt brut du foyer</span>
                      <span className="font-medium shrink-0">{formatEuro(irBrutArrondi)}</span>
                    </li>
                    <li className="flex justify-between gap-3">
                      <span className="text-gray-600 shrink min-w-0">Décote</span>
                      <span className="font-medium shrink-0">
                        {decoteArrondie > 0 ? `−${formatEuro(decoteArrondie)}` : formatEuro(0)}
                      </span>
                    </li>
                    <li className="flex justify-between gap-3 pt-1 border-t border-orange-200/70 font-semibold text-gray-900">
                      <span className="shrink min-w-0">Impôt final</span>
                      <span className="shrink-0">{formatEuro(irNetEuroAffichage)}</span>
                    </li>
                  </ul>
                  <p className="text-[11px] text-gray-600 leading-snug mt-2 pt-2 border-t border-orange-200/70">
                    La décote réduit ensuite l&apos;impôt brut du foyer. Le montant ci-dessus est l&apos;impôt final
                    (arrondi à l&apos;euro comme sur l&apos;avis).
                  </p>
                </div>

                <Separator className="bg-orange-300" />

                {/* Total IR */}
                <div className="bg-orange-100 border-2 border-orange-400 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
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
                      {partsFoyer > 1 && gainImpotParts != null && (
                        <p className="text-xs text-gray-500 mt-2">
                          Grâce à vos {formatPartsFr(partsFoyer)} parts, vous réduisez votre impôt d&apos;environ{' '}
                          {formatEuro(gainImpotParts)}.
                        </p>
                      )}
                    </div>
                    <span className="text-2xl font-bold text-orange-600 shrink-0">
                      {formatEuro(irNetEuroAffichage)}
                    </span>
                  </div>
                </div>
                {debugIrDevPanel}
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
                    <span className="text-sm text-gray-600">Assiette PS (revenus immobiliers retenus)</span>
                    <span className="font-semibold text-gray-700">
                      {formatEuro(simulation.ps.baseImposable || 0)}
                    </span>
                  </div>
                  <div className="ml-1 space-y-1 rounded-md bg-orange-50/60 px-2 py-1.5 text-[11px] text-gray-700">
                    <div className="flex justify-between gap-2">
                      <span>· Part location nue (NU), base retenue</span>
                      <span className="font-medium shrink-0">{formatEuro(baseNuIrfPs)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>· Part LMNP / LMP (BIC), base retenue</span>
                      <span className="font-medium shrink-0">{formatEuro(baseBicIrfPs)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Taux PS</span>
                    <span className="font-semibold text-gray-700">
                      {formatPercent(simulation.ps.taux || 0.172)}
                    </span>
                  </div>

                  <Separator className="bg-orange-300" />

                  <div className="bg-orange-100 border-2 border-orange-400 rounded-lg p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">Prélèvements sociaux (PS) sur l’immobilier</p>
                        <p className="text-xs text-gray-500 mt-1.5">
                          Montant unique calculé par le moteur sur l’assiette NU + BIC. Ventilation ci-dessous
                          <strong> indicative</strong> (même prorata que les bases retenues).
                        </p>
                        {(psAlloc.nu > 0.5 || psAlloc.bic > 0.5) && (
                          <ul className="mt-2 space-y-0.5 text-[11px] text-gray-600">
                            {psAlloc.nu > 0.5 && (
                              <li>
                                · Part liée à la <strong>location nue (NU)</strong> : {formatEuro(psAlloc.nu)}
                              </li>
                            )}
                            {psAlloc.bic > 0.5 && (
                              <li>
                                · Part liée au <strong>LMNP / BIC</strong> : {formatEuro(psAlloc.bic)}
                              </li>
                            )}
                          </ul>
                        )}
                        <p className="text-[10px] text-gray-500 mt-2">
                          Les PS ne sont pas réduits par le PER.
                        </p>
                      </div>
                      <span className="text-2xl font-bold text-orange-600 shrink-0">{formatEuro(psTotal)}</span>
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
                  Aucune base positive (location nue + LMNP/BIC) pour les prélèvements sociaux sur les revenus
                  immobiliers
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
                  <span className="font-semibold text-gray-700">{formatEuro(irNetEuroAffichage)}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">+ Prélèvements sociaux (bases immobilières NU + BIC)</span>
                  <span className="font-semibold text-gray-700">{formatEuro(psEuroAffichage)}</span>
                </div>
                
                <Separator className="bg-orange-300" />
                
                <div className="bg-orange-100 border-2 border-orange-400 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900">TOTAL IMPÔTS</p>
                      {hasImmoFiscalNuOuBic ? (
                        <>
                          <p className="text-xs text-gray-600 mt-1">
                            Impôt sur le revenu sans apport immobilier (référence barème) :{' '}
                            {formatEuro(irTotalMoteur - irSupplementaire)}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            <span className="font-medium text-gray-700">Impact fiscal immobilier (IR + PS)</span> :{' '}
                            <span
                              className={
                                irSupplementaire + psTotal >= 0 ? 'text-orange-600' : 'text-emerald-600'
                              }
                            >
                              {irSupplementaire + psTotal >= 0 ? '+' : ''}
                              {formatEuro(irSupplementaire + psTotal)}
                            </span>
                          </p>
                          {(Math.abs(irSupplementaire) > 0.5 || psTotal > 0.5) && (
                            <ul className="mt-1.5 space-y-0.5 text-[11px] text-gray-600 pl-1 border-l border-orange-200">
                              {Math.abs(irSupplementaire) > 0.5 && (
                                <>
                                  <li>
                                    · IR supplémentaire · <strong>location nue (NU)</strong> (indicatif) :{' '}
                                    {formatEuro(irSuppAlloc.nu)}
                                  </li>
                                  <li>
                                    · IR supplémentaire · <strong>LMNP / BIC</strong> (indicatif) :{' '}
                                    {formatEuro(irSuppAlloc.bic)}
                                  </li>
                                </>
                              )}
                              {psTotal > 0.5 && (
                                <>
                                  <li>
                                    · PS · part <strong>NU</strong> (indicatif) : {formatEuro(psAlloc.nu)}
                                  </li>
                                  <li>
                                    · PS · part <strong>LMNP / BIC</strong> (indicatif) : {formatEuro(psAlloc.bic)}
                                  </li>
                                </>
                              )}
                              <li className="text-[10px] text-gray-500 italic pt-0.5">
                                Ventilation IR au prorata des bases retenues (non linéaire ; ordre réel du barème).
                              </li>
                            </ul>
                          )}
                        </>
                      ) : null}
                    </div>
                    <span className="text-2xl font-bold text-orange-600">{formatEuro(totalImpotsEuroAffichage)}</span>
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

        {/* BLOC 6 : solde fiscal (reste à payer / remboursement / équilibre) */}
        <BlockCard
          title={
            soldeFiscalEstimeEuro > 0
              ? 'Reste à payer'
              : soldeFiscalEstimeEuro < 0
                ? 'Remboursement estimé'
                : 'Situation équilibrée'
          }
          icon={
            soldeFiscalEstimeEuro > 0 ? (
              <DollarSign className="h-5 w-5 text-orange-600" />
            ) : soldeFiscalEstimeEuro < 0 ? (
              <Coins className="h-5 w-5 text-emerald-600" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-gray-500" />
            )
          }
        >
          <Card
            className={`border-2 shadow-sm bg-white ${
              soldeFiscalEstimeEuro > 0
                ? 'border-orange-300'
                : soldeFiscalEstimeEuro < 0
                  ? 'border-emerald-300'
                  : 'border-gray-300'
            }`}
          >
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Total impôts calculés</span>
                  <span className="font-semibold text-gray-700">{formatEuro(totalImpotsEuroAffichage)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Déjà payé</span>
                  <span className="font-semibold text-gray-700">
                    {totalDejaPaye > 0 ? `– ${formatEuro(totalDejaPaye)}` : formatEuro(0)}
                  </span>
                </div>
                <Separator
                  className={
                    soldeFiscalEstimeEuro > 0
                      ? 'bg-orange-300'
                      : soldeFiscalEstimeEuro < 0
                        ? 'bg-emerald-300'
                        : 'bg-gray-200'
                  }
                />
                <div className="flex justify-between items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                  <span className="font-medium text-gray-800">Solde fiscal estimé</span>
                  <span
                    className={`text-lg font-bold tabular-nums ${
                      soldeFiscalEstimeEuro > 0
                        ? 'text-orange-600'
                        : soldeFiscalEstimeEuro < 0
                          ? 'text-emerald-600'
                          : 'text-gray-700'
                    }`}
                  >
                    {soldeFiscalEstimeEuro > 0 ? '+' : ''}
                    {formatEuro(soldeFiscalEstimeEuro)}
                  </span>
                </div>

                <div
                  className={`rounded-lg p-4 ${
                    soldeFiscalEstimeEuro > 0
                      ? 'bg-orange-100 border-2 border-orange-400'
                      : soldeFiscalEstimeEuro < 0
                        ? 'bg-emerald-100 border-2 border-emerald-400'
                        : 'bg-gray-100 border-2 border-gray-300'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-2xl shrink-0" aria-hidden>
                        {soldeFiscalEstimeEuro > 0 ? '💸' : soldeFiscalEstimeEuro < 0 ? '💰' : '✅'}
                      </span>
                      <span className="font-bold text-gray-900">
                        {soldeFiscalEstimeEuro > 0
                          ? 'Reste à payer'
                          : soldeFiscalEstimeEuro < 0
                            ? 'Remboursement estimé'
                            : 'Situation équilibrée'}
                      </span>
                    </div>
                    <span
                      className={`text-2xl font-bold tabular-nums shrink-0 ${
                        soldeFiscalEstimeEuro > 0
                          ? 'text-orange-600'
                          : soldeFiscalEstimeEuro < 0
                            ? 'text-emerald-600'
                            : 'text-gray-600'
                      }`}
                    >
                      {soldeFiscalEstimeEuro < 0
                        ? formatEuro(Math.abs(soldeFiscalEstimeEuro))
                        : formatEuro(soldeFiscalEstimeEuro)}
                    </span>
                  </div>
                  {soldeFiscalEstimeEuro > 0 && (
                    <p className="text-sm text-gray-700">Ce montant correspond à l&apos;impôt restant à régler.</p>
                  )}
                  {soldeFiscalEstimeEuro < 0 && (
                    <>
                      <p className="text-sm text-gray-700">
                        Vous avez trop payé. Ce montant devrait vous être remboursé par l&apos;administration fiscale.
                      </p>
                      <p className="text-xs text-gray-600 mt-2 italic">
                        Le remboursement intervient généralement après la validation de votre déclaration.
                      </p>
                    </>
                  )}
                  {soldeFiscalEstimeEuro === 0 && (
                    <p className="text-sm text-gray-700">
                      Vos paiements correspondent exactement à votre impôt estimé.
                    </p>
                  )}
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
                    const baseFiscalNette =
                      Math.max(0, simulation.consolidation.revenusFonciers) +
                      Math.max(0, simulation.consolidation.revenusBIC);
                    const tauxMargeComptable = loyersBruts > 0 ? (loyersBruts - chargesTotal) / loyersBruts : 0;
                    const tauxFiscaliteSurBasesIr =
                      baseFiscalNette > 0 ? Math.max(0, impotsSuppTotal) / baseFiscalNette : 0;

                    return (
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Loyers bruts annuels</span>
                          <span className="font-bold text-gray-800">{formatEuro(loyersBruts)}</span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">– Charges (tous biens, saisie agrégée)</span>
                          <span className="font-medium text-gray-600">-{formatEuro(chargesTotal)}</span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">– IR + PS liés à l&apos;immobilier (estimation)</span>
                          <span className="font-medium text-gray-600">-{formatEuro(Math.max(0, impotsSuppTotal))}</span>
                        </div>

                        <Separator className="bg-amber-200 my-1" />

                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-gray-800">= Résultat net après impôt</span>
                          <span className="font-bold text-gray-900">{formatEuro(beneficeNet)}</span>
                        </div>

                        <div className="bg-amber-100 rounded p-2 mt-2">
                          <p className="text-[10px] text-amber-900 font-mono">
                            <span className="font-semibold">Formule :</span> ({formatEuro(beneficeNet)} /{' '}
                            {formatEuro(loyersBruts)}) × 100 = {formatPercent(simulation.resume?.rendementNet || 0)}
                          </p>
                        </div>

                        <div className="mt-2 pt-2 border-t border-amber-200/70 space-y-1 text-[10px] text-amber-800/90">
                          <p>
                            Taux de marge comptable (loyers − charges saisies) / loyers →{' '}
                            <strong>{formatPercent(tauxMargeComptable)}</strong>
                          </p>
                          <p>
                            Taux de fiscalité immo. (IR+PS suppl.) / bases IR (NU + BIC retenues) →{' '}
                            <strong>~{formatPercent(tauxFiscaliteSurBasesIr)}</strong>
                          </p>
                        </div>

                        <p className="text-[10px] text-amber-700 italic mt-2">
                          💡 Sur 100 € de loyers encaissés, vous conservez{' '}
                          {((simulation.resume?.rendementNet || 0) * 100).toFixed(1).replace('.', ',')} € après charges
                          et fiscalité.
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
