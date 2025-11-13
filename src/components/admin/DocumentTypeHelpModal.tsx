'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import { BookOpen, ChevronRight, FileText, Hash, Percent, ToggleRight, Code, Lock, Database, AlertCircle, Check } from 'lucide-react';

interface DocumentTypeHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DocumentTypeHelpModal({ isOpen, onClose }: DocumentTypeHelpModalProps) {
  const [activeSection, setActiveSection] = useState<string>('intro');

  const sections = [
    { id: 'intro', label: 'Introduction', icon: BookOpen },
    { id: 'types', label: 'Types de documents', icon: FileText },
    { id: 'keywords', label: 'Mots-clés & Poids', icon: Hash },
    { id: 'threshold', label: 'Seuil d\'auto-assignation', icon: Percent },
    { id: 'toggle', label: 'Toggle Transaction', icon: ToggleRight },
    { id: 'json-all', label: 'Configuration JSON', icon: Code },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <BookOpen className="h-6 w-6 text-blue-600" />
            Documentation - Gestion des Types de Documents
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-6 flex-1 overflow-hidden">
          {/* Sidebar navigation */}
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

          {/* Content area */}
          <div className="flex-1 overflow-y-auto pr-2">
            {activeSection === 'intro' && <IntroSection />}
            {activeSection === 'types' && <TypesSection />}
            {activeSection === 'keywords' && <KeywordsSection />}
            {activeSection === 'threshold' && <ThresholdSection />}
            {activeSection === 'toggle' && <ToggleSection />}
            {activeSection === 'json-all' && <JsonAllSection />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ========== SECTIONS ==========

function IntroSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-600" />
          Bienvenue dans la gestion des types de documents
        </h3>
        <p className="text-gray-700 leading-relaxed">
          Ce module permet de <strong>classifier automatiquement</strong> les documents uploadés dans votre système 
          et d'<strong>extraire des informations structurées</strong> (dates, montants, références, etc.) 
          pour pré-remplir automatiquement des transactions.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Comment ça fonctionne ?
        </h4>
        <ol className="space-y-2 text-sm text-blue-900">
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
            <span><strong>L'utilisateur upload un document</strong> (PDF, image, etc.)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
            <span><strong>L'OCR extrait le texte</strong> du document</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
            <span><strong>Le moteur de classification</strong> cherche les mots-clés de chaque type et calcule un score</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
            <span><strong>Si le score dépasse le seuil</strong>, le document est automatiquement classé</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">5</span>
            <span><strong>Si "Toggle Transaction" est activé</strong>, les données sont extraites et une transaction est pré-remplie</span>
          </li>
        </ol>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Check className="h-5 w-5 text-green-600" />
            <h4 className="font-semibold">Avantages</h4>
          </div>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• <strong>Gain de temps</strong> : classification automatique</li>
            <li>• <strong>Précision</strong> : extraction de données fiables</li>
            <li>• <strong>Traçabilité</strong> : documents liés aux transactions</li>
          </ul>
        </div>
        <div className="border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <h4 className="font-semibold">Points d'attention</h4>
          </div>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• Tester les regex avec vos documents réels</li>
            <li>• Ajuster les poids des mots-clés progressivement</li>
            <li>• Vérifier les transactions créées automatiquement</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function TypesSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          À quoi sert un type de document ?
        </h3>
        <p className="text-gray-700 leading-relaxed mb-4">
          Un <strong>type de document</strong> est une catégorie qui regroupe des documents ayant la même structure 
          et le même objectif. Exemples : "Quittance de loyer", "Relevé de compte propriétaire", "Facture travaux".
        </p>
      </div>

      <div className="bg-gray-50 border rounded-lg p-4">
        <h4 className="font-semibold mb-3">Exemple : Relevé de compte propriétaire</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <Badge className="bg-blue-100 text-blue-800">CODE</Badge>
            <span className="text-gray-700"><code className="bg-gray-200 px-2 py-0.5 rounded">RELEVE_COMPTE_PROP</code> - Identifiant unique</span>
          </div>
          <div className="flex items-start gap-2">
            <Badge className="bg-green-100 text-green-800">LIBELLÉ</Badge>
            <span className="text-gray-700">"Relevé de compte propriétaires" - Nom affiché à l'utilisateur</span>
          </div>
          <div className="flex items-start gap-2">
            <Badge className="bg-purple-100 text-purple-800">USAGE</Badge>
            <span className="text-gray-700">Document mensuel envoyé par l'agence au propriétaire avec le détail des loyers/charges</span>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-semibold mb-2">Quand créer un nouveau type ?</h4>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
            <span>Le document a une <strong>structure récurrente</strong> (même format chaque mois)</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
            <span>Vous voulez <strong>extraire des données</strong> (montants, dates, références)</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
            <span>Vous voulez <strong>créer automatiquement des transactions</strong> depuis ce document</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function KeywordsSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <Hash className="h-5 w-5 text-blue-600" />
          Mots-clés et Poids
        </h3>
        <p className="text-gray-700 leading-relaxed mb-4">
          Les <strong>mots-clés</strong> sont des termes caractéristiques d'un type de document. 
          Le moteur de classification les cherche dans le texte OCR et calcule un <strong>score</strong> 
          en fonction de leur <strong>poids</strong>.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Formule de calcul du score</h4>
        <div className="text-sm bg-blue-100 px-3 py-2 rounded font-mono">
          Score = Σ (Poids mots trouvés) / Σ (Tous les poids)
        </div>
        <p className="text-sm text-blue-800 mt-2">
          Le score est exprimé en <strong>pourcentage</strong> (0-100%). Plus il est élevé, plus le document correspond au type.
        </p>
      </div>

      <div>
        <h4 className="font-semibold mb-3">Exemple : Relevé de compte propriétaire</h4>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-4 py-2">Mot-clé</th>
                <th className="text-left px-4 py-2">Poids</th>
                <th className="text-left px-4 py-2">Pourquoi ce poids ?</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-4 py-2"><code className="bg-gray-100 px-2 py-0.5 rounded">relevé de compte</code></td>
                <td className="px-4 py-2"><Badge className="bg-green-100 text-green-800">10</Badge></td>
                <td className="px-4 py-2 text-gray-600">Terme principal, toujours présent</td>
              </tr>
              <tr>
                <td className="px-4 py-2"><code className="bg-gray-100 px-2 py-0.5 rounded">propriétaire</code></td>
                <td className="px-4 py-2"><Badge className="bg-blue-100 text-blue-800">8</Badge></td>
                <td className="px-4 py-2 text-gray-600">Distingue du relevé locataire</td>
              </tr>
              <tr>
                <td className="px-4 py-2"><code className="bg-gray-100 px-2 py-0.5 rounded">solde des recettes</code></td>
                <td className="px-4 py-2"><Badge className="bg-purple-100 text-purple-800">5</Badge></td>
                <td className="px-4 py-2 text-gray-600">Section spécifique, bon indicateur</td>
              </tr>
              <tr>
                <td className="px-4 py-2"><code className="bg-gray-100 px-2 py-0.5 rounded">loyer principal</code></td>
                <td className="px-4 py-2"><Badge className="bg-yellow-100 text-yellow-800">3</Badge></td>
                <td className="px-4 py-2 text-gray-600">Présent mais moins discriminant</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <h4 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Bonnes pratiques
        </h4>
        <ul className="text-sm text-orange-900 space-y-1">
          <li>• <strong>Poids élevé (8-10)</strong> : Termes uniques et toujours présents</li>
          <li>• <strong>Poids moyen (4-7)</strong> : Termes caractéristiques mais parfois absents</li>
          <li>• <strong>Poids faible (1-3)</strong> : Termes complémentaires ou génériques</li>
          <li>• Évitez les mots trop communs ("le", "de", "et")</li>
          <li>• Testez et ajustez progressivement les poids</li>
        </ul>
      </div>
    </div>
  );
}

function ThresholdSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <Percent className="h-5 w-5 text-blue-600" />
          Seuil d'auto-assignation
        </h3>
        <p className="text-gray-700 leading-relaxed mb-4">
          Le <strong>seuil</strong> est le score minimum requis pour qu'un document soit <strong>automatiquement classé</strong> 
          dans ce type. Il s'exprime en <strong>pourcentage</strong> (0-100%).
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="border border-red-200 bg-red-50 rounded-lg p-4">
          <div className="text-center mb-2">
            <Badge className="bg-red-600 text-white text-lg px-4 py-1">30-50%</Badge>
          </div>
          <h4 className="font-semibold text-red-900 text-center mb-2">Seuil Bas</h4>
          <p className="text-xs text-red-800">
            ⚠️ Risque élevé de <strong>faux positifs</strong>. 
            Le document sera classé même avec peu de mots-clés correspondants.
          </p>
        </div>
        <div className="border border-green-200 bg-green-50 rounded-lg p-4">
          <div className="text-center mb-2">
            <Badge className="bg-green-600 text-white text-lg px-4 py-1">60-80%</Badge>
          </div>
          <h4 className="font-semibold text-green-900 text-center mb-2">Seuil Optimal</h4>
          <p className="text-xs text-green-800">
            ✅ Bon équilibre entre <strong>précision</strong> et <strong>couverture</strong>. 
            Recommandé pour la plupart des types.
          </p>
        </div>
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
          <div className="text-center mb-2">
            <Badge className="bg-blue-600 text-white text-lg px-4 py-1">85-95%</Badge>
          </div>
          <h4 className="font-semibold text-blue-900 text-center mb-2">Seuil Élevé</h4>
          <p className="text-xs text-blue-800">
            🎯 Très précis mais risque de <strong>faux négatifs</strong>. 
            Utilisé pour les documents critiques.
          </p>
        </div>
      </div>

      <div className="bg-gray-50 border rounded-lg p-4">
        <h4 className="font-semibold mb-3">Exemple de calcul</h4>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-gray-700 mb-2">Document analysé : <code className="bg-gray-200 px-2 py-0.5 rounded">Relevé_Compte_Oct2025.pdf</code></p>
            <p className="text-gray-600">Mots-clés trouvés :</p>
            <ul className="ml-4 text-gray-600">
              <li>• "relevé de compte" (poids 10) ✅</li>
              <li>• "propriétaire" (poids 8) ✅</li>
              <li>• "solde des recettes" (poids 5) ✅</li>
              <li>• "loyer principal" (poids 3) ❌ <span className="text-red-600">(absent)</span></li>
            </ul>
          </div>
          <div className="bg-blue-100 p-3 rounded">
            <p className="font-mono text-sm">Score = (10 + 8 + 5) / (10 + 8 + 5 + 3) = 23 / 26 = <strong className="text-blue-900">88.5%</strong></p>
          </div>
          <div>
            <p className="text-gray-700">Seuil configuré : <Badge className="bg-green-600 text-white">85%</Badge></p>
            <p className="text-green-700 font-semibold mt-1">✅ Document automatiquement classé en "Relevé de compte propriétaire"</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <ToggleRight className="h-5 w-5 text-blue-600" />
          Toggle "Ouvrir modal transaction automatiquement"
        </h3>
        <p className="text-gray-700 leading-relaxed mb-4">
          Quand ce toggle est <Badge className="bg-green-600 text-white">ACTIVÉ</Badge>, le système va :
        </p>
        <ol className="space-y-2 text-gray-700">
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
            <span><strong>Extraire les données</strong> du document (montants, dates, références) avec les regex configurés</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
            <span><strong>Pré-remplir une transaction</strong> avec ces données</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
            <span><strong>Ouvrir automatiquement</strong> la modal de transaction pour validation</span>
          </li>
        </ol>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border border-green-200 bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <ToggleRight className="h-5 w-5 text-green-600" />
            <h4 className="font-semibold text-green-900">Toggle ACTIVÉ</h4>
          </div>
          <p className="text-sm text-green-800 mb-2">Utilisé pour :</p>
          <ul className="text-sm text-green-800 space-y-1">
            <li>• Relevés de compte (loyers mensuels)</li>
            <li>• Factures travaux (dépenses)</li>
            <li>• Quittances de loyer (recettes)</li>
          </ul>
          <Badge className="bg-green-600 text-white mt-2">Automatisation maximale</Badge>
        </div>
        <div className="border border-gray-200 bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <ToggleRight className="h-5 w-5 text-gray-400" />
            <h4 className="font-semibold text-gray-900">Toggle DÉSACTIVÉ</h4>
          </div>
          <p className="text-sm text-gray-700 mb-2">Utilisé pour :</p>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>• Baux signés (documents de référence)</li>
            <li>• Titres de propriété (archivage)</li>
            <li>• Diagnostics techniques (consultation)</li>
          </ul>
          <Badge className="bg-gray-400 text-white mt-2">Classification uniquement</Badge>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Attention
        </h4>
        <p className="text-sm text-yellow-900">
          Pour que ce toggle fonctionne, vous <strong>devez configurer les JSON</strong> "Suggestions" et "Contextes" 
          avec les regex d'extraction et les mappings nécessaires. Voir la section "Configuration JSON" pour plus de détails.
        </p>
      </div>
    </div>
  );
}

function JsonAllSection() {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <Code className="h-5 w-5 text-blue-600" />
          Configuration JSON - Vue d'ensemble
        </h3>
        <p className="text-gray-700 leading-relaxed mb-4">
          Les 4 champs JSON permettent de configurer finement l'extraction de données et la création automatique de transactions.
        </p>
      </div>

      {/* Contextes par défaut */}
      <div className="border-l-4 border-blue-500 pl-4">
        <h4 className="text-lg font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <Code className="h-5 w-5" />
          1. Contextes par défaut (defaultContexts)
        </h4>
        <p className="text-sm text-gray-700 mb-3">
          Définit les valeurs par défaut et les mappings nature/catégorie pour les transactions.
        </p>
        <div className="bg-gray-50 border rounded-lg p-3 mb-3">
          <code className="text-xs block whitespace-pre font-mono text-gray-800">
{`{
  "autoCreateAboveConfidence": 0.92,
  "natureCategorieMap": {
    "RECETTE_LOYER": "Loyer + charges",
    "DEPENSE_GESTION": "Commission agence"
  }
}`}
          </code>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <Badge className="bg-blue-100 text-blue-800 flex-shrink-0">autoCreateAboveConfidence</Badge>
            <p className="text-gray-700">Seuil de confiance (0-1) pour créer la transaction sans demander validation à l'utilisateur</p>
          </div>
          <div className="flex items-start gap-2">
            <Badge className="bg-green-100 text-green-800 flex-shrink-0">natureCategorieMap</Badge>
            <p className="text-gray-700">Mapping automatique entre natures de transaction et catégories</p>
          </div>
        </div>
      </div>

      {/* Configuration des suggestions */}
      <div className="border-l-4 border-purple-500 pl-4">
        <h4 className="text-lg font-semibold text-purple-900 mb-2 flex items-center gap-2">
          <Code className="h-5 w-5" />
          2. Configuration des suggestions (suggestionsConfig)
        </h4>
        <p className="text-sm text-gray-700 mb-3">
          Contient les regex d'extraction, les mappings et les règles de post-processing.
        </p>
        <div className="bg-gray-50 border rounded-lg p-3 mb-3">
          <code className="text-xs block whitespace-pre font-mono text-gray-800">
{`{
  "regex": {
    "total_recettes": "Solde des recettes[\\\\s\\\\S]{0,100}?(\\\\d[\\\\d\\\\s,]*\\\\d{2})",
    "provisions_charges": "PROVISIONS\\\\s+CHARGES.*?(\\\\d{1,3})"
  },
  "mapping": {
    "total_encaissements": { "from": "total_recettes", "group": 1 },
    "charges_encaisse": { "from": "provisions_charges", "group": 1 }
  },
  "postprocess": {
    "amount": "parseAmount(total_encaissements)",
    "chargesRecup": "parseAmount(charges_encaisse)",
    "montantLoyer": "subtract(amount, chargesRecup)"
  }
}`}
          </code>
        </div>
        <div className="space-y-3">
          <div>
            <h5 className="font-semibold text-sm mb-1">Section "regex"</h5>
            <p className="text-sm text-gray-700">
              Expressions régulières pour extraire des données du texte OCR. Chaque regex peut avoir plusieurs groupes de capture ().
            </p>
            <div className="bg-purple-50 p-2 rounded text-xs mt-1">
              <strong>Exemple :</strong> <code>total_recettes</code> cherche "Solde des recettes" suivi d'un montant
            </div>
          </div>
          <div>
            <h5 className="font-semibold text-sm mb-1">Section "mapping"</h5>
            <p className="text-sm text-gray-700">
              Associe les groupes de capture des regex à des champs de données. <code>from</code> = nom du regex, <code>group</code> = numéro du groupe.
            </p>
            <div className="bg-purple-50 p-2 rounded text-xs mt-1">
              <strong>Exemple :</strong> <code>total_encaissements</code> prend le groupe 1 du regex <code>total_recettes</code>
            </div>
          </div>
          <div>
            <h5 className="font-semibold text-sm mb-1">Section "postprocess"</h5>
            <p className="text-sm text-gray-700">
              Calculs et transformations appliqués après extraction. Supporte : <code>parseAmount()</code>, <code>sum()</code>, <code>subtract()</code>.
            </p>
            <div className="bg-purple-50 p-2 rounded text-xs mt-1">
              <strong>Exemple :</strong> <code>montantLoyer = subtract(amount, chargesRecup)</code> calcule loyer = total - charges
            </div>
          </div>
        </div>
      </div>

      {/* Verrouillages */}
      <div className="border-l-4 border-red-500 pl-4">
        <h4 className="text-lg font-semibold text-red-900 mb-2 flex items-center gap-2">
          <Lock className="h-5 w-5" />
          3. Verrouillages de champs (flowLocks)
        </h4>
        <p className="text-sm text-gray-700 mb-3">
          Permet de verrouiller certains champs de la transaction selon des conditions.
        </p>
        <div className="bg-gray-50 border rounded-lg p-3 mb-3">
          <code className="text-xs block whitespace-pre font-mono text-gray-800">
{`[
  {
    "if": "nature == 'DEPENSE_GESTION'",
    "lock": ["categoryId"],
    "reason": "Catégorie automatique pour commissions"
  }
]`}
          </code>
        </div>
        <div className="bg-red-50 p-3 rounded text-sm">
          <p className="font-semibold text-red-900 mb-1">Cas d'usage :</p>
          <p className="text-red-800">
            Quand une transaction a la nature "DEPENSE_GESTION", le champ "Catégorie" sera <strong>grisé et non modifiable</strong> 
            pour garantir qu'on utilise toujours la catégorie "Commission agence".
          </p>
        </div>
      </div>

      {/* Métadonnées */}
      <div className="border-l-4 border-gray-500 pl-4">
        <h4 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <Database className="h-5 w-5" />
          4. Métadonnées (metaSchema)
        </h4>
        <p className="text-sm text-gray-700 mb-3">
          Définit les champs extraits, le seuil de confiance minimum et la version de la configuration.
        </p>
        <div className="bg-gray-50 border rounded-lg p-3 mb-3">
          <code className="text-xs block whitespace-pre font-mono text-gray-800">
{`{
  "fields": ["periode", "montant", "bien"],
  "confidenceThreshold": 0.6,
  "version": "v1.0",
  "requiredFields": ["montant", "periode"]
}`}
          </code>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <Badge className="bg-gray-100 text-gray-800 flex-shrink-0">fields</Badge>
            <p className="text-gray-700">Liste des champs extraits (documentation et monitoring)</p>
          </div>
          <div className="flex items-start gap-2">
            <Badge className="bg-orange-100 text-orange-800 flex-shrink-0">confidenceThreshold</Badge>
            <p className="text-gray-700">Seuil minimum de confiance (0.6 = 60%). Si en dessous, affiche un avertissement</p>
          </div>
          <div className="flex items-start gap-2">
            <Badge className="bg-red-100 text-red-800 flex-shrink-0">requiredFields</Badge>
            <p className="text-gray-700">Champs obligatoires. Si absent, l'utilisateur reçoit une alerte</p>
          </div>
        </div>
      </div>

      {/* Workflow complet */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border rounded-lg p-4">
        <h4 className="font-semibold mb-3">🎯 Workflow complet : Upload → Transaction</h4>
        <div className="space-y-2 text-sm text-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">1</div>
            <div className="flex-1">
              <p className="font-semibold">Upload du document</p>
              <p className="text-xs text-gray-600">L'utilisateur télécharge un PDF (ex: Relevé de compte)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">2</div>
            <div className="flex-1">
              <p className="font-semibold">OCR + Classification</p>
              <p className="text-xs text-gray-600">Le texte est extrait, les mots-clés sont cherchés, le score est calculé</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">3</div>
            <div className="flex-1">
              <p className="font-semibold">Extraction des données (si toggle = ON)</p>
              <p className="text-xs text-gray-600">Les regex extraient : total (415€), charges (15€), période (08/2025), locataire</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">4</div>
            <div className="flex-1">
              <p className="font-semibold">Calculs (postprocess)</p>
              <p className="text-xs text-gray-600">Loyer = 415 - 15 = 400€</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">5</div>
            <div className="flex-1">
              <p className="font-semibold">Pré-remplissage transaction</p>
              <p className="text-xs text-gray-600">La modal s'ouvre avec : Bien (42B), Bail (Tosetto), Loyer (400€), Charges (15€), Période (08/2025)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">6</div>
            <div className="flex-1">
              <p className="font-semibold">Validation & Création</p>
              <p className="text-xs text-gray-600">L'utilisateur vérifie et clique "Créer". Le document est lié à la transaction.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Fonctions disponibles */}
      <div>
        <h4 className="font-semibold mb-3">Fonctions disponibles dans "postprocess"</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="border rounded-lg p-3">
            <code className="text-sm font-semibold text-blue-700">parseAmount(field)</code>
            <p className="text-xs text-gray-600 mt-1">Convertit un texte en nombre (gère €, espaces, virgules)</p>
            <div className="bg-blue-50 p-2 rounded text-xs mt-2">
              <strong>Exemple :</strong> <code>"415,00 €"</code> → <code>415</code>
            </div>
          </div>
          <div className="border rounded-lg p-3">
            <code className="text-sm font-semibold text-green-700">sum(field1, field2)</code>
            <p className="text-xs text-gray-600 mt-1">Additionne deux champs</p>
            <div className="bg-green-50 p-2 rounded text-xs mt-2">
              <strong>Exemple :</strong> <code>sum(loyer, charges)</code> → <code>315</code>
            </div>
          </div>
          <div className="border rounded-lg p-3">
            <code className="text-sm font-semibold text-orange-700">subtract(field1, field2)</code>
            <p className="text-xs text-gray-600 mt-1">Soustrait deux champs</p>
            <div className="bg-orange-50 p-2 rounded text-xs mt-2">
              <strong>Exemple :</strong> <code>subtract(total, charges)</code> → <code>400</code>
            </div>
          </div>
          <div className="border rounded-lg p-3">
            <code className="text-sm font-semibold text-purple-700">Valeurs constantes</code>
            <p className="text-xs text-gray-600 mt-1">Assigner directement une valeur fixe</p>
            <div className="bg-purple-50 p-2 rounded text-xs mt-2">
              <strong>Exemple :</strong> <code>"nature": "RECETTE_LOYER"</code>
            </div>
          </div>
        </div>
      </div>

      {/* Exemple complet */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 border rounded-lg p-4">
        <h4 className="font-semibold mb-3">📋 Exemple complet : Relevé de compte propriétaire</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <h5 className="font-semibold mb-2">Configuration</h5>
            <ul className="space-y-1 text-gray-700">
              <li>• <strong>Seuil :</strong> 85%</li>
              <li>• <strong>Toggle transaction :</strong> Activé</li>
              <li>• <strong>Regex :</strong> total_recettes, provisions_charges, periode_bandeau, locataire</li>
              <li>• <strong>Postprocess :</strong> Calcul loyer = total - charges</li>
            </ul>
          </div>
          <div>
            <h5 className="font-semibold mb-2">Résultat</h5>
            <ul className="space-y-1 text-gray-700">
              <li>• <strong>Classification :</strong> Automatique (score 88%)</li>
              <li>• <strong>Extraction :</strong> 415€ total, 15€ charges</li>
              <li>• <strong>Calcul :</strong> 400€ loyer</li>
              <li>• <strong>Transaction :</strong> Pré-remplie automatiquement</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-900 mb-2">💡 Conseils pour créer vos regex</h4>
        <ul className="text-sm text-yellow-900 space-y-1">
          <li>• Testez vos regex sur <a href="https://regex101.com/" target="_blank" className="text-blue-600 underline">regex101.com</a> avant de les ajouter</li>
          <li>• Utilisez <code className="bg-yellow-100 px-1 rounded">[\s\S]</code> pour capturer n'importe quel caractère (y compris sauts de ligne)</li>
          <li>• Limitez la portée avec <code className="bg-yellow-100 px-1 rounded">{'{ }'}0,100{'}'}</code> pour éviter de capturer trop de texte</li>
          <li>• Échappez les caractères spéciaux : <code className="bg-yellow-100 px-1 rounded">\.</code> pour un point, <code className="bg-yellow-100 px-1 rounded">\s</code> pour un espace</li>
        </ul>
      </div>
    </div>
  );
}

