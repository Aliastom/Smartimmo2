'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import { BookOpen, ChevronRight, Calculator, FileText, GitBranch, History, AlertCircle, Check } from 'lucide-react';

interface FiscalParametersHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FiscalParametersHelpModal({ isOpen, onClose }: FiscalParametersHelpModalProps) {
  const [activeSection, setActiveSection] = useState<string>('intro');

  const sections = [
    { id: 'intro', label: 'Introduction', icon: BookOpen },
    { id: 'baremes', label: 'Barèmes fiscaux', icon: Calculator },
    { id: 'types-regimes', label: 'Types & Régimes', icon: GitBranch },
    { id: 'compatibilites', label: 'Compatibilités', icon: FileText },
    { id: 'historique', label: 'Historique', icon: History },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <BookOpen className="h-6 w-6 text-blue-600" />
            Documentation - Paramètres Fiscaux
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-6 flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r pr-4 overflow-y-auto">
            <nav className="space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeSection === section.id
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span className="text-left">{section.label}</span>
                    {activeSection === section.id && <ChevronRight className="h-4 w-4 ml-auto" />}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto pr-2">
            {activeSection === 'intro' && <IntroSection />}
            {activeSection === 'baremes' && <BaremesSection />}
            {activeSection === 'types-regimes' && <TypesRegimesSection />}
            {activeSection === 'compatibilites' && <CompatibilitiesSection />}
            {activeSection === 'historique' && <HistorySection />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IntroSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-3">Gestion des paramètres fiscaux</h3>
        <p className="text-gray-700 leading-relaxed">
          Ce module permet de configurer les <strong>barèmes fiscaux</strong> (impôts sur le revenu, prélèvements sociaux) 
          et les <strong>régimes d'imposition</strong> pour vos biens immobiliers.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">À quoi ça sert ?</h4>
        <ul className="text-sm text-blue-900 space-y-2">
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <span><strong>Calculer l'impôt</strong> sur vos revenus fonciers selon votre tranche marginale</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <span><strong>Appliquer les prélèvements sociaux</strong> (17.2% actuellement)</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <span><strong>Comparer les régimes</strong> : Réel vs Micro-foncier (abattement 30%)</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <span><strong>Historiser les modifications</strong> pour les années antérieures</span>
          </li>
        </ul>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Important
        </h4>
        <p className="text-sm text-yellow-900">
          Les barèmes évoluent <strong>chaque année</strong>. Pensez à mettre à jour vos paramètres en début d'année fiscale 
          pour garantir des calculs exacts.
        </p>
      </div>
    </div>
  );
}

function BaremesSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <Calculator className="h-5 w-5 text-blue-600" />
          Barèmes fiscaux
        </h3>
        <p className="text-gray-700 leading-relaxed mb-4">
          Les barèmes définissent les <strong>taux d'imposition</strong> par tranche de revenu 
          et les <strong>prélèvements sociaux</strong> applicables.
        </p>
      </div>

      <div className="bg-gray-50 border rounded-lg p-4">
        <h4 className="font-semibold mb-3">Exemple : Barème IR 2025</h4>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-4 py-2">Tranche</th>
                <th className="text-left px-4 py-2">Revenu annuel</th>
                <th className="text-left px-4 py-2">Taux</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-4 py-2">1</td>
                <td className="px-4 py-2">0 → 11 294 €</td>
                <td className="px-4 py-2"><Badge className="bg-gray-100 text-gray-800">0%</Badge></td>
              </tr>
              <tr>
                <td className="px-4 py-2">2</td>
                <td className="px-4 py-2">11 295 → 28 797 €</td>
                <td className="px-4 py-2"><Badge className="bg-blue-100 text-blue-800">11%</Badge></td>
              </tr>
              <tr>
                <td className="px-4 py-2">3</td>
                <td className="px-4 py-2">28 798 → 82 341 €</td>
                <td className="px-4 py-2"><Badge className="bg-green-100 text-green-800">30%</Badge></td>
              </tr>
              <tr>
                <td className="px-4 py-2">4</td>
                <td className="px-4 py-2">82 342 → 177 106 €</td>
                <td className="px-4 py-2"><Badge className="bg-orange-100 text-orange-800">41%</Badge></td>
              </tr>
              <tr>
                <td className="px-4 py-2">5</td>
                <td className="px-4 py-2">Au-delà de 177 106 €</td>
                <td className="px-4 py-2"><Badge className="bg-red-100 text-red-800">45%</Badge></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Prélèvements sociaux</h4>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-sm text-blue-800 mb-1">Taux global actuel (2025) :</p>
            <div className="text-3xl font-bold text-blue-900">17.2%</div>
          </div>
          <div className="flex-1 text-xs text-blue-800">
            <ul>
              <li>• CSG : 9.2%</li>
              <li>• CRDS : 0.5%</li>
              <li>• Prélèvement social : 4.5%</li>
              <li>• Contribution additionnelle : 0.3%</li>
              <li>• Prélèvement de solidarité : 2.7%</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function TypesRegimesSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-3">Types & Régimes d'imposition</h3>
        <p className="text-gray-700 leading-relaxed mb-4">
          Différents régimes fiscaux s'appliquent selon le type de bien et vos revenus locatifs.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">Régime RÉEL</h4>
          <p className="text-sm text-blue-800 mb-2">Déduction des charges réelles</p>
          <div className="bg-blue-100 p-2 rounded text-xs mb-2">
            <strong>Avantages :</strong>
            <ul className="mt-1 space-y-1">
              <li>• Déduction de toutes les charges</li>
              <li>• Intérêts d'emprunt déductibles</li>
              <li>• Amortissement possible (LMNP)</li>
            </ul>
          </div>
          <Badge className="bg-blue-600 text-white">Recommandé si charges &gt; 30% des loyers</Badge>
        </div>
        <div className="border border-green-200 bg-green-50 rounded-lg p-4">
          <h4 className="font-semibold text-green-900 mb-2">Régime MICRO-FONCIER</h4>
          <p className="text-sm text-green-800 mb-2">Abattement forfaitaire de 30%</p>
          <div className="bg-green-100 p-2 rounded text-xs mb-2">
            <strong>Avantages :</strong>
            <ul className="mt-1 space-y-1">
              <li>• Simplicité (pas de justificatifs)</li>
              <li>• Abattement automatique</li>
              <li>• Moins de paperasse</li>
            </ul>
          </div>
          <Badge className="bg-green-600 text-white">Limité à 15 000€ de revenus annuels</Badge>
        </div>
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h4 className="font-semibold text-purple-900 mb-2">Types de propriété</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="font-semibold text-purple-900">Location nue</p>
            <p className="text-xs text-purple-800">Régime : Réel ou Micro-foncier</p>
          </div>
          <div>
            <p className="font-semibold text-purple-900">Location meublée (LMNP)</p>
            <p className="text-xs text-purple-800">Régime : Réel ou Micro-BIC</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CompatibilitiesSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-3">Compatibilités fiscales</h3>
        <p className="text-gray-700 leading-relaxed mb-4">
          Définit quelles <strong>combinaisons</strong> de type de propriété, régime d'imposition et nature de charges sont <strong>valides fiscalement</strong>.
        </p>
      </div>

      <div className="bg-gray-50 border rounded-lg p-4">
        <h4 className="font-semibold mb-3">Exemples de règles</h4>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Location nue + Réel → Intérêts d'emprunt déductibles</p>
              <p className="text-gray-600">Vous pouvez déduire 100% des intérêts de votre prêt immobilier</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">LMNP + Réel → Amortissement du bien possible</p>
              <p className="text-gray-600">Vous pouvez amortir le bien et les meubles sur plusieurs années</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Location nue + Micro-foncier → Pas de déduction détaillée</p>
              <p className="text-gray-600">Abattement forfaitaire de 30% uniquement, pas de charge déductible</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-900 mb-2">💡 Conseil</h4>
        <p className="text-sm text-yellow-900">
          Consultez un <strong>expert-comptable</strong> pour déterminer le régime le plus avantageux 
          selon votre situation (nombre de biens, montant des charges, taux d'imposition).
        </p>
      </div>
    </div>
  );
}

function HistorySection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <History className="h-5 w-5 text-blue-600" />
          Historique des modifications
        </h3>
        <p className="text-gray-700 leading-relaxed mb-4">
          Toutes les modifications des barèmes et paramètres fiscaux sont <strong>historisées</strong> 
          pour permettre des calculs rétroactifs sur les années antérieures.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Pourquoi c'est important ?</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Calculs rétroactifs</strong> : Recalculer l'impôt des années précédentes</li>
          <li>• <strong>Contrôle fiscal</strong> : Justifier les calculs avec les barèmes officiels</li>
          <li>• <strong>Simulations</strong> : Comparer l'évolution de votre imposition</li>
        </ul>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h4 className="font-semibold text-green-900 mb-2">Exemple</h4>
        <p className="text-sm text-green-800">
          Si vous modifiez le taux de prélèvements sociaux de 17.2% à 17.5% en 2026, 
          l'ancien taux (17.2%) restera <strong>archivé</strong> et sera utilisé pour les calculs sur 2025 et avant.
        </p>
      </div>
    </div>
  );
}

