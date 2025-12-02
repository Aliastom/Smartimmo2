/**
 * DeclarationTab - Onglet Déclaration fiscale (Thème VERT)
 * 
 * Guide complet pour remplir les formulaires 2042 et 2044
 */

'use client';

import { useState } from 'react';
import { BlockCard } from '../BlockCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Separator } from '@/components/ui/Separator';
import { useExpertModeStore } from '@/store/expertModeStore';
import { ExpertDeclarationBlocks } from '../../expert/ExpertDeclarationBlocks';
import type { SimulationResult } from '@/types/fiscal';
import { generateCerfaPDF } from '@/lib/pdf/generateCerfaPDF';
import { 
  FileText, 
  Home, 
  Euro,
  CheckCircle2,
  Circle,
  Info,
  Download,
  Mail,
  ExternalLink,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  X,
  Calculator,
} from 'lucide-react';

interface DeclarationTabProps {
  simulation: SimulationResult;
  onExportPDF?: () => void;
}

// Type pour une case fiscale
interface FiscalCase {
  code: string;
  libelle: string;
  montant: number;
  provenance: string;
  formulaire: '2042' | '2044';
  explication: string;
  source?: string;
}

export function DeclarationTab({ simulation, onExportPDF }: DeclarationTabProps) {
  const { isExpertMode } = useExpertModeStore();
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState<FiscalCase | null>(null);
  const [showBiensDetail, setShowBiensDetail] = useState(false);
  
  const formatEuro = (amount: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const formatPercent = (rate: number) => `${(rate * 100).toFixed(1)} %`;

  // Génération automatique des cases fiscales
  const generateCases = (): FiscalCase[] => {
    const cases: FiscalCase[] = [];
    
    // FORMULAIRE 2042 - Déclaration principale
    cases.push({
      code: '1AJ',
      libelle: 'Salaires nets imposables',
      montant: simulation.inputs.foyer.salaire,
      provenance: 'Salaire',
      formulaire: '2042',
      explication: 'Votre salaire net imposable après abattement de 10% pour frais professionnels.',
      source: 'https://www.impots.gouv.fr/particulier/questions/comment-declarer-mes-salaires'
    });

    if (simulation.consolidation.revenusFonciers !== 0) {
      cases.push({
        code: '4BA',
        libelle: 'Revenus fonciers nets',
        montant: simulation.consolidation.revenusFonciers,
        provenance: 'Immobilier',
        formulaire: '2042',
        explication: 'Résultat net de vos revenus fonciers (loyers - charges). Ce montant sera ajouté à votre base imposable.',
        source: 'https://www.impots.gouv.fr/particulier/questions/comment-declarer-mes-revenus-fonciers'
      });
    }

    if (simulation.per && simulation.per.deductionUtilisee > 0) {
      cases.push({
        code: '6NS',
        libelle: 'Cotisations PER déductibles',
        montant: simulation.per.deductionUtilisee,
        provenance: 'PER',
        formulaire: '2042',
        explication: 'Montant des versements PER déductibles de votre revenu imposable. Attention : ce n\'est pas un crédit d\'impôt.',
        source: 'https://www.impots.gouv.fr/particulier/questions/quest-ce-que-le-plan-depargne-retraite-per'
      });
    }

    // FORMULAIRE 2044 - Revenus fonciers détaillés
    const totalLoyers = simulation.biens.reduce((sum, b) => sum + (b.recettesBrutes || 0), 0);
    const totalCharges = simulation.biens.reduce((sum, b) => sum + (b.chargesDeductibles || 0), 0);

    cases.push({
      code: '211',
      libelle: 'Loyers encaissés',
      montant: totalLoyers,
      provenance: 'Immobilier',
      formulaire: '2044',
      explication: `Total des loyers perçus sur l'année ${simulation.inputs.year} pour vos ${simulation.biens.length} bien(s).`,
    });

    cases.push({
      code: '229',
      libelle: 'Charges déductibles totales',
      montant: totalCharges,
      provenance: 'Immobilier',
      formulaire: '2044',
      explication: 'Somme de toutes vos charges déductibles : taxes, intérêts, assurances, frais de gestion, etc.',
    });

    cases.push({
      code: '420',
      libelle: 'Résultat foncier',
      montant: simulation.consolidation.revenusFonciers,
      provenance: 'Immobilier',
      formulaire: '2044',
      explication: 'Résultat net de votre activité foncière (loyers - charges). Ce montant sera reporté sur la 2042.',
    });

    return cases;
  };

  const cases = generateCases();
  const cases2042 = cases.filter(c => c.formulaire === '2042');
  const cases2044 = cases.filter(c => c.formulaire === '2044');

  const toggleStep = (caseCode: string) => {
    setCompletedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(caseCode)) {
        newSet.delete(caseCode);
      } else {
        newSet.add(caseCode);
      }
      return newSet;
    });
  };

  const openModal = (caseItem: FiscalCase) => {
    setSelectedCase(caseItem);
    setShowModal(true);
  };

  const progressPct = (completedSteps.size / cases.length) * 100;

  return (
    <div className="space-y-6 p-6">
      {/* Titre et sous-titre */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-emerald-600 mb-2 flex items-center justify-center gap-2">
          🟢 Déclaration fiscale
        </h2>
        <p className="text-gray-600">
          Ce que vous devez déclarer — Toutes les cases exactes à remplir
        </p>
      </div>

      {/* BLOC 1 : SYNTHÈSE EXPRESS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {/* Revenu imposable total */}
        <Card className="border border-emerald-300 bg-emerald-50/50 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-[10px] font-medium text-gray-600 mb-1">REVENU IMPOSABLE TOTAL</p>
                <p className="text-xl font-bold text-emerald-600 mb-1">
                  2042
                </p>
                <p className="text-sm text-gray-700">
                  {formatEuro(simulation.ir.revenuImposable)}
                </p>
              </div>
              <FileText className="h-5 w-5 text-emerald-400" />
            </div>
          </CardContent>
        </Card>

        {/* Revenu foncier net */}
        <Card className="border border-emerald-300 bg-emerald-50/50 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-[10px] font-medium text-gray-600 mb-1">REVENU FONCIER NET</p>
                <p className="text-xl font-bold text-emerald-600 mb-1">
                  2044
                </p>
                <p className="text-sm text-gray-700">
                  {formatEuro(simulation.consolidation.revenusFonciers)}
                </p>
              </div>
              <Home className="h-5 w-5 text-emerald-400" />
            </div>
          </CardContent>
        </Card>

        {/* Salaire net imposable */}
        <Card className="border border-emerald-300 bg-emerald-50/50 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-[10px] font-medium text-gray-600 mb-1">SALAIRE NET IMPOSABLE</p>
                <p className="text-xl font-bold text-emerald-600 mb-1">
                  1AJ
                </p>
                <p className="text-sm text-gray-700">
                  {formatEuro(simulation.inputs.foyer.salaire)}
                </p>
              </div>
              <Euro className="h-5 w-5 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* BLOC 2 : AFFECTATION PAR FORMULAIRE */}
      <BlockCard
        title="📄 Formulaire 2042 — Déclaration de revenus"
        icon={<FileText className="h-5 w-5 text-emerald-600" />}
      >
        <Card className="border-2 border-emerald-300 bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-emerald-200 bg-emerald-50">
                    <th className="text-left p-3 font-semibold text-gray-700">Case</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Libellé</th>
                    <th className="text-right p-3 font-semibold text-gray-700">Montant</th>
                    <th className="text-center p-3 font-semibold text-gray-700">Provenance</th>
                    <th className="text-center p-3 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cases2042.map((caseItem, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-emerald-50/30 transition-colors">
                      <td className="p-3">
                        <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300 font-mono">
                          {caseItem.code}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <span className="font-medium text-gray-900">{caseItem.libelle}</span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-lg font-bold text-emerald-600">
                          {formatEuro(Math.abs(caseItem.montant))}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="outline" className="text-xs">{caseItem.provenance}</Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openModal(caseItem)}
                          className="text-emerald-600 hover:text-emerald-700"
                        >
                          <Info className="h-4 w-4 mr-1" />
                          Détails
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </BlockCard>

      {/* BLOC 3 : FORMULAIRE 2044 */}
      <BlockCard
        title="🏠 Formulaire 2044 — Revenus fonciers"
        icon={<Home className="h-5 w-5 text-emerald-600" />}
      >
        <Card className="border-2 border-emerald-300 bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-emerald-200 bg-emerald-50">
                    <th className="text-left p-3 font-semibold text-gray-700">Case</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Libellé</th>
                    <th className="text-right p-3 font-semibold text-gray-700">Montant</th>
                    <th className="text-center p-3 font-semibold text-gray-700">Provenance</th>
                    <th className="text-center p-3 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cases2044.map((caseItem, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-emerald-50/30 transition-colors">
                      <td className="p-3">
                        <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300 font-mono">
                          {caseItem.code}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <span className="font-medium text-gray-900">{caseItem.libelle}</span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-lg font-bold text-emerald-600">
                          {formatEuro(Math.abs(caseItem.montant))}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="outline" className="text-xs">{caseItem.provenance}</Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openModal(caseItem)}
                          className="text-emerald-600 hover:text-emerald-700"
                        >
                          <Info className="h-4 w-4 mr-1" />
                          Détails
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </BlockCard>

      {/* BLOC 4 : PAS-À-PAS INTERACTIF */}
      <BlockCard
        title="✅ Pas-à-pas interactif"
        icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
        badge={
          <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300">
            {completedSteps.size} / {cases.length} complétées
          </Badge>
        }
      >
        <Card className="border-2 border-emerald-300 bg-white shadow-sm">
          <CardContent className="p-5">
            {/* Barre de progression */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Progression de la saisie</span>
                <span className="text-sm font-bold text-emerald-600">{progressPct.toFixed(0)}%</span>
              </div>
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500 rounded-full"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Liste des étapes */}
            <div className="space-y-3">
              {cases.map((caseItem, index) => {
                const isCompleted = completedSteps.has(caseItem.code);
                
                return (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 transition-all ${
                      isCompleted 
                        ? 'border-emerald-300 bg-emerald-50/50' 
                        : 'border-gray-200 bg-white hover:border-emerald-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleStep(caseItem.code)}
                          className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                            isCompleted
                              ? 'bg-emerald-500 border-emerald-500'
                              : 'border-gray-300 hover:border-emerald-400'
                          }`}
                        >
                          {isCompleted && <CheckCircle2 className="h-4 w-4 text-white" />}
                        </button>

                        {/* Instruction */}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            Étape {index + 1} : Formulaire {caseItem.formulaire}, case {caseItem.code}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            Reporter <span className="font-bold text-emerald-600">{formatEuro(Math.abs(caseItem.montant))}</span> dans "{caseItem.libelle}"
                          </p>
                        </div>
                      </div>

                      {/* Bouton détails */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openModal(caseItem)}
                        className="text-xs"
                      >
                        <Info className="h-3 w-3 mr-1" />
                        Aide
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </BlockCard>

      {/* BLOC 5 : ALERTES & CONSEILS */}
      <BlockCard
        title="💡 Alertes et conseils"
        icon={<AlertCircle className="h-5 w-5 text-amber-600" />}
      >
        <div className="space-y-3">
          {/* Conseil PER */}
          {simulation.per && (
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
              <p className="text-sm text-blue-900 font-medium mb-1">
                ℹ️ Les PS ne sont pas modifiés par le PER
              </p>
              <p className="text-xs text-blue-700">
                Votre versement PER réduit uniquement l'impôt sur le revenu, pas les prélèvements sociaux.
              </p>
            </div>
          )}

          {/* Conseil TMI */}
          {(() => {
            // Trouver la tranche actuelle
            const trancheActuelle = simulation.ir.detailsTranches?.find(
              d => d.tranche.rate === simulation.ir.trancheMarginate
            );
            const revenuParPart = simulation.ir.revenuImposable / (simulation.inputs.foyer?.parts || 1);
            const distancePlafond = trancheActuelle?.tranche.upper 
              ? trancheActuelle.tranche.upper - revenuParPart 
              : null;
            
            return (
              <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg">
                <p className="text-sm text-amber-900 font-medium mb-2">
                  ⚠️ Votre TMI actuel : {formatPercent(simulation.ir.trancheMarginate)}
                </p>
                {trancheActuelle && (
                  <div className="space-y-1 text-xs text-amber-700 mb-2">
                    <p>
                      • Seuil de votre tranche : {formatEuro(trancheActuelle.tranche.lower)} - {trancheActuelle.tranche.upper ? formatEuro(trancheActuelle.tranche.upper) : '∞'}
                    </p>
                    <p>
                      • Votre revenu par part : <span className="font-semibold">{formatEuro(revenuParPart)}</span>
                    </p>
                    {distancePlafond && distancePlafond > 0 && (
                      <p>
                        • Marge avant tranche supérieure : <span className="font-semibold text-amber-800">{formatEuro(distancePlafond)}</span>
                      </p>
                    )}
                  </div>
                )}
                <p className="text-xs text-amber-700">
                  Attention aux variations de revenus qui pourraient vous faire changer de tranche.
                </p>
              </div>
            );
          })()}

          {/* Conseil déficit */}
          {simulation.consolidation.deficitImputableRevenuGlobal > 0 && (
            <div className="bg-purple-50 border-l-4 border-purple-400 p-4 rounded-r-lg">
              <p className="text-sm text-purple-900 font-medium mb-1">
                📊 Déficit foncier imputé automatiquement
              </p>
              <p className="text-xs text-purple-700">
                Votre déficit de {formatEuro(simulation.consolidation.deficitImputableRevenuGlobal)} est automatiquement imputé sur le revenu global dans la limite des règles légales (10 700 €/an hors intérêts).
              </p>
            </div>
          )}
        </div>
      </BlockCard>

      {/* BLOC 6 : EXPORTS */}
      <BlockCard
        title="📥 Exporter votre déclaration"
        icon={<Download className="h-5 w-5 text-emerald-600" />}
      >
        <Card className="border-2 border-emerald-300 bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Button
                variant="outline"
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                onClick={() => generateCerfaPDF(simulation)}
              >
                <Download className="h-4 w-4 mr-2" />
                Export PDF CERFA
              </Button>

              <Button
                variant="outline"
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                onClick={() => {
                  // Export CSV avec format date
                  const now = new Date();
                  const dateStr = now.toLocaleDateString('fr-FR').replace(/\//g, '_');
                  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(/:/g, '_');
                  const filename = `Declaration_en_ligne_des_revenus_${simulation.inputs.year}_le_${dateStr}_a_${timeStr}_.csv`;
                  
                  const csvData = cases.map(c => 
                    `${c.formulaire};${c.code};${c.libelle};${c.montant}`
                  ).join('\n');
                  const blob = new Blob([`Formulaire;Case;Libellé;Montant\n${csvData}`], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = filename;
                  a.click();
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                Export CSV
              </Button>

              <Button
                variant="outline"
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                disabled
              >
                <Mail className="h-4 w-4 mr-2" />
                Envoyer par mail
              </Button>
            </div>
          </CardContent>
        </Card>
      </BlockCard>

      {/* BLOC 7 : DÉTAIL PAR BIEN (ACCORDION) */}
      <Card className="border border-gray-300 bg-white shadow-sm">
        <CardContent className="p-0">
          <button
            onClick={() => setShowBiensDetail(!showBiensDetail)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🔍</span>
              <span className="font-medium text-gray-900">
                Voir le détail de calcul par bien (justificatif)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300">
                {simulation.biens.length} bien(s)
              </Badge>
              {showBiensDetail ? <ChevronUp className="h-5 w-5 text-gray-600" /> : <ChevronDown className="h-5 w-5 text-gray-600" />}
            </div>
          </button>

          {showBiensDetail && (
            <div className="border-t border-gray-200 p-5 bg-gray-50">
              <div className="space-y-2">
                {simulation.biens.map((bien, index) => (
                  <div key={index} className="flex items-center justify-between text-sm p-3 bg-white rounded border border-gray-200">
                    <div className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-gray-500" />
                      <span className="font-medium text-gray-900">{bien.nom}</span>
                      <Badge variant="outline" className="text-xs">{bien.type}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-emerald-600">+{formatEuro(bien.recettesBrutes)}</span>
                      <span className="text-orange-600">-{formatEuro(bien.chargesDeductibles)}</span>
                      <span className={`font-bold ${bien.resultatFiscal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        = {bien.resultatFiscal >= 0 ? '+' : ''}{formatEuro(bien.resultatFiscal)}
                      </span>
                    </div>
                  </div>
                ))}
                
                <Separator className="my-3" />
                
                <div className="flex justify-between items-center bg-emerald-50 p-3 rounded border-2 border-emerald-300 font-semibold">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-emerald-600" />
                    <span className="text-gray-900">Résultat foncier total</span>
                  </div>
                  <span className="text-lg text-emerald-600">
                    {formatEuro(simulation.consolidation.revenusFonciers)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODE EXPERT : Blocs supplémentaires */}
      {isExpertMode && <ExpertDeclarationBlocks simulation={simulation} />}

      {/* MODALE : DÉTAILS D'UNE CASE */}
      {showModal && selectedCase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-emerald-50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">{selectedCase.code}</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedCase.libelle}</h3>
                  <p className="text-sm text-gray-600">Formulaire {selectedCase.formulaire}</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-emerald-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Montant */}
              <div className="bg-emerald-50 border-2 border-emerald-300 rounded-lg p-5 text-center">
                <p className="text-sm text-gray-600 mb-2">Montant à reporter</p>
                <p className="text-4xl font-bold text-emerald-600">
                  {formatEuro(Math.abs(selectedCase.montant))}
                </p>
              </div>

              {/* À quoi sert cette case */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4 text-emerald-600" />
                  À quoi sert cette case ?
                </h4>
                <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                  {selectedCase.explication}
                </p>
              </div>

              {/* Comment SmartImmo l'a calculé */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-emerald-600" />
                  Comment SmartImmo l'a calculé ?
                </h4>
                <p className="text-sm text-gray-700 bg-emerald-50 p-3 rounded border border-emerald-200">
                  Ce montant provient de : <strong>{selectedCase.provenance}</strong>
                </p>
              </div>

              {/* Lien officiel */}
              {selectedCase.source && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-emerald-600" />
                    Documentation officielle
                  </h4>
                  <a
                    href={selectedCase.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-emerald-600 hover:text-emerald-700 underline flex items-center gap-1"
                  >
                    Voir la documentation sur impots.gouv.fr
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  toggleStep(selectedCase.code);
                  setShowModal(false);
                }}
                className="border-emerald-300 text-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Marquer comme fait
              </Button>
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

