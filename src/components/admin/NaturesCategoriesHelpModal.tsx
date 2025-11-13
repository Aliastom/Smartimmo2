'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import { BookOpen, ChevronRight, GitBranch, FolderTree, Check, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';

interface NaturesCategoriesHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NaturesCategoriesHelpModal({ isOpen, onClose }: NaturesCategoriesHelpModalProps) {
  const [activeSection, setActiveSection] = useState<string>('intro');

  const sections = [
    { id: 'intro', label: 'Introduction', icon: BookOpen },
    { id: 'natures', label: 'Natures de transactions', icon: GitBranch },
    { id: 'categories', label: 'Catégories', icon: FolderTree },
    { id: 'mapping', label: 'Lien Nature ↔ Catégorie', icon: GitBranch },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <BookOpen className="h-6 w-6 text-blue-600" />
            Documentation - Natures et Catégories de Transactions
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
            {activeSection === 'natures' && <NaturesSection />}
            {activeSection === 'categories' && <CategoriesSection />}
            {activeSection === 'mapping' && <MappingSection />}
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
        <h3 className="text-xl font-semibold mb-3">Vue d'ensemble</h3>
        <p className="text-gray-700 leading-relaxed">
          Les <strong>natures</strong> et <strong>catégories</strong> permettent de <strong>classifier et organiser vos transactions</strong> 
          pour une meilleure analyse financière et comptable.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-3">Hiérarchie : Nature → Catégorie</h4>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-green-600 text-white rounded-lg flex items-center justify-center font-bold flex-shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-blue-900">Nature : RECETTE_LOYER</p>
              <p className="text-sm text-blue-800">↳ Catégories possibles :</p>
              <ul className="text-sm text-blue-800 ml-4 mt-1">
                <li>• Loyer principal</li>
                <li>• Loyer + charges</li>
                <li>• Charges récupérables</li>
              </ul>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-red-600 text-white rounded-lg flex items-center justify-center font-bold flex-shrink-0">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-blue-900">Nature : DEPENSE_TRAVAUX</p>
              <p className="text-sm text-blue-800">↳ Catégories possibles :</p>
              <ul className="text-sm text-blue-800 ml-4 mt-1">
                <li>• Réparations locatives</li>
                <li>• Gros travaux</li>
                <li>• Entretien courant</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <GitBranch className="h-5 w-5 text-purple-600" />
            <h4 className="font-semibold">Nature</h4>
          </div>
          <p className="text-sm text-gray-700">
            Classification <strong>de haut niveau</strong> : type de flux financier (recette vs dépense) 
            et domaine (loyer, travaux, assurance, etc.)
          </p>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <FolderTree className="h-5 w-5 text-blue-600" />
            <h4 className="font-semibold">Catégorie</h4>
          </div>
          <p className="text-sm text-gray-700">
            Classification <strong>détaillée</strong> : précise le type exact de transaction 
            (déductible fiscalement, capitalisable, etc.)
          </p>
        </div>
      </div>
    </div>
  );
}

function NaturesSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-blue-600" />
          Natures de transactions
        </h3>
        <p className="text-gray-700 leading-relaxed mb-4">
          Une <strong>nature</strong> représente le <strong>type de flux financier</strong> et son domaine d'application.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border border-green-200 bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-5 w-5 text-green-600" />
            <h4 className="font-semibold text-green-900">RECETTES (INCOME)</h4>
          </div>
          <ul className="text-sm text-green-800 space-y-1">
            <li>• <strong>RECETTE_LOYER</strong> : Loyers perçus</li>
            <li>• <strong>RECETTE_CHARGES</strong> : Charges récupérées</li>
            <li>• <strong>RECETTE_AUTRE</strong> : Autres recettes</li>
          </ul>
        </div>
        <div className="border border-red-200 bg-red-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="h-5 w-5 text-red-600" />
            <h4 className="font-semibold text-red-900">DÉPENSES (EXPENSE)</h4>
          </div>
          <ul className="text-sm text-red-800 space-y-1">
            <li>• <strong>DEPENSE_TRAVAUX</strong> : Travaux et réparations</li>
            <li>• <strong>DEPENSE_GESTION</strong> : Commissions d'agence</li>
            <li>• <strong>DEPENSE_ASSURANCE</strong> : Assurances</li>
            <li>• <strong>DEPENSE_TAXE</strong> : Taxes foncières</li>
          </ul>
        </div>
      </div>

      <div className="bg-gray-50 border rounded-lg p-4">
        <h4 className="font-semibold mb-3">Propriétés d'une Nature</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <Badge className="bg-blue-100 text-blue-800">KEY</Badge>
            <span className="text-gray-700">Identifiant unique (ex: <code>RECETTE_LOYER</code>)</span>
          </div>
          <div className="flex items-start gap-2">
            <Badge className="bg-green-100 text-green-800">LABEL</Badge>
            <span className="text-gray-700">Libellé affiché (ex: "Loyer")</span>
          </div>
          <div className="flex items-start gap-2">
            <Badge className="bg-purple-100 text-purple-800">FLOW</Badge>
            <span className="text-gray-700">Type de flux : INCOME (recette) ou EXPENSE (dépense)</span>
          </div>
          <div className="flex items-start gap-2">
            <Badge className="bg-orange-100 text-orange-800">COMPATIBLE TYPES</Badge>
            <span className="text-gray-700">Types de documents compatibles (ex: QUITTANCE, RELEVE_COMPTE)</span>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Pourquoi c'est important ?
        </h4>
        <ul className="text-sm text-yellow-900 space-y-1">
          <li>• Les natures déterminent le <strong>sens du flux</strong> (+ ou -) dans votre comptabilité</li>
          <li>• Elles permettent de <strong>filtrer et analyser</strong> vos transactions par type</li>
          <li>• Elles sont utilisées pour les <strong>règles fiscales</strong> et les <strong>rapports</strong></li>
        </ul>
      </div>
    </div>
  );
}

function CategoriesSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <FolderTree className="h-5 w-5 text-blue-600" />
          Catégories de transactions
        </h3>
        <p className="text-gray-700 leading-relaxed mb-4">
          Une <strong>catégorie</strong> précise la nature de la transaction avec des attributs fiscaux et comptables.
        </p>
      </div>

      <div className="bg-gray-50 border rounded-lg p-4">
        <h4 className="font-semibold mb-3">Exemple : Catégories de RECETTE_LOYER</h4>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-4 py-2">Catégorie</th>
                <th className="text-left px-4 py-2">Déductible</th>
                <th className="text-left px-4 py-2">Capitalisable</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-4 py-2">Loyer principal</td>
                <td className="px-4 py-2"><Badge className="bg-red-100 text-red-800">Non</Badge></td>
                <td className="px-4 py-2"><Badge className="bg-red-100 text-red-800">Non</Badge></td>
              </tr>
              <tr>
                <td className="px-4 py-2">Loyer + charges</td>
                <td className="px-4 py-2"><Badge className="bg-red-100 text-red-800">Non</Badge></td>
                <td className="px-4 py-2"><Badge className="bg-red-100 text-red-800">Non</Badge></td>
              </tr>
              <tr>
                <td className="px-4 py-2">Charges récupérables</td>
                <td className="px-4 py-2"><Badge className="bg-green-100 text-green-800">Oui</Badge></td>
                <td className="px-4 py-2"><Badge className="bg-red-100 text-red-800">Non</Badge></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gray-50 border rounded-lg p-4">
        <h4 className="font-semibold mb-3">Propriétés d'une Catégorie</h4>
        <div className="space-y-3">
          <div className="border-l-4 border-blue-500 pl-4">
            <code className="text-sm font-semibold text-blue-700">deductible</code>
            <p className="text-sm text-gray-700 mt-1">
              Indique si la transaction est <strong>déductible fiscalement</strong> (pour le calcul de l'impôt sur le revenu foncier).
            </p>
            <div className="bg-blue-50 p-2 rounded text-xs mt-2">
              <strong>Exemple :</strong> Les charges récupérables sont déductibles, mais pas le loyer principal
            </div>
          </div>
          <div className="border-l-4 border-green-500 pl-4">
            <code className="text-sm font-semibold text-green-700">capitalizable</code>
            <p className="text-sm text-gray-700 mt-1">
              Indique si la dépense peut être <strong>capitalisée</strong> (ajoutée au prix de revient du bien, amortissable).
            </p>
            <div className="bg-green-50 p-2 rounded text-xs mt-2">
              <strong>Exemple :</strong> Les gros travaux (toiture, façade) sont capitalisables
            </div>
          </div>
        </div>
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h4 className="font-semibold text-purple-900 mb-2">Cas d'usage : Déclaration fiscale</h4>
        <p className="text-sm text-purple-800 mb-2">
          Quand vous générez votre <strong>déclaration 2044</strong>, le système filtre automatiquement :
        </p>
        <ul className="text-sm text-purple-800 space-y-1">
          <li>• Les <strong>recettes</strong> (loyers perçus) dans la case "Revenus bruts"</li>
          <li>• Les <strong>charges déductibles</strong> dans les cases correspondantes</li>
          <li>• Les <strong>travaux capitalisables</strong> sont exclus (amortissement séparé)</li>
        </ul>
      </div>
    </div>
  );
}

function MappingSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-3">Lien Nature ↔ Catégorie</h3>
        <p className="text-gray-700 leading-relaxed mb-4">
          Chaque <strong>nature</strong> a une liste de <strong>catégories compatibles</strong>. 
          Vous pouvez aussi définir une <strong>catégorie par défaut</strong> qui sera pré-sélectionnée.
        </p>
      </div>

      <div className="bg-gray-50 border rounded-lg p-4">
        <h4 className="font-semibold mb-3">Exemple complet</h4>
        <div className="space-y-4">
          <div className="border-l-4 border-green-500 pl-4">
            <p className="font-semibold text-green-900">Nature : RECETTE_LOYER</p>
            <p className="text-sm text-gray-700 mt-1">Catégories compatibles :</p>
            <ul className="text-sm text-gray-700 ml-4 mt-1">
              <li>• Loyer principal</li>
              <li>• Loyer + charges <Badge className="bg-green-100 text-green-800 ml-2">PAR DÉFAUT</Badge></li>
              <li>• Charges récupérables</li>
            </ul>
          </div>
          <div className="border-l-4 border-red-500 pl-4">
            <p className="font-semibold text-red-900">Nature : DEPENSE_GESTION</p>
            <p className="text-sm text-gray-700 mt-1">Catégories compatibles :</p>
            <ul className="text-sm text-gray-700 ml-4 mt-1">
              <li>• Commission agence <Badge className="bg-red-100 text-red-800 ml-2">PAR DÉFAUT</Badge></li>
              <li>• Honoraires</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">💡 Astuce : Import/Export</h4>
        <p className="text-sm text-blue-800">
          Utilisez les boutons <strong>Exporter</strong> et <strong>Importer</strong> pour sauvegarder votre configuration 
          ou la partager entre plusieurs environnements (dev, production).
        </p>
      </div>
    </div>
  );
}

