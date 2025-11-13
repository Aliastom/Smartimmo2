'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import { BookOpen, ChevronRight, Zap, TestTube, Code, AlertCircle, Check } from 'lucide-react';

interface SignalsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SignalsHelpModal({ isOpen, onClose }: SignalsHelpModalProps) {
  const [activeSection, setActiveSection] = useState<string>('intro');

  const sections = [
    { id: 'intro', label: 'Introduction', icon: BookOpen },
    { id: 'what', label: 'Qu\'est-ce qu\'un signal ?', icon: Zap },
    { id: 'regex', label: 'Regex et Flags', icon: Code },
    { id: 'usage', label: 'Utilisation pratique', icon: TestTube },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <BookOpen className="h-6 w-6 text-blue-600" />
            Documentation - Signaux de Classification
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
            {activeSection === 'what' && <WhatSection />}
            {activeSection === 'regex' && <RegexSection />}
            {activeSection === 'usage' && <UsageSection />}
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
        <h3 className="text-xl font-semibold mb-3">Catalogue de Signaux</h3>
        <p className="text-gray-700 leading-relaxed">
          Les <strong>signaux</strong> sont des <strong>patterns regex réutilisables</strong> qui complètent les mots-clés 
          pour améliorer la <strong>précision de la classification</strong> des documents.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Différence : Mots-clés vs Signaux</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-white p-3 rounded border">
            <p className="font-semibold text-blue-900 mb-1">Mots-clés</p>
            <ul className="text-blue-800 space-y-1">
              <li>• Termes simples</li>
              <li>• Recherche exacte</li>
              <li>• Ex: "quittance", "loyer"</li>
            </ul>
          </div>
          <div className="bg-white p-3 rounded border">
            <p className="font-semibold text-purple-900 mb-1">Signaux</p>
            <ul className="text-purple-800 space-y-1">
              <li>• Patterns regex complexes</li>
              <li>• Détection de structure</li>
              <li>• Ex: "Montant : 450,00€"</li>
            </ul>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-semibold mb-2">Comment ça fonctionne ?</h4>
        <ol className="space-y-2 text-gray-700">
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
            <span>Vous créez un <strong>signal</strong> avec un regex (ex: détection d'IBAN)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
            <span>Vous l'<strong>associez à un type de document</strong> avec un poids</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
            <span>Lors de la classification, le signal est <strong>testé sur le texte OCR</strong></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
            <span>Si le regex matche, le <strong>poids du signal s'ajoute au score</strong> du type</span>
          </li>
        </ol>
      </div>
    </div>
  );
}

function WhatSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-600" />
          Qu'est-ce qu'un signal ?
        </h3>
        <p className="text-gray-700 leading-relaxed mb-4">
          Un signal est une <strong>règle de détection avancée</strong> basée sur des expressions régulières (regex) 
          qui permet d'identifier des <strong>structures ou patterns spécifiques</strong> dans le texte OCR.
        </p>
      </div>

      <div>
        <h4 className="font-semibold mb-3">Exemples de signaux utiles</h4>
        <div className="space-y-3">
          <div className="border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-blue-100 text-blue-800">HAS_IBAN</Badge>
              <span className="text-sm text-gray-600">Détecte un IBAN</span>
            </div>
            <code className="text-xs bg-gray-100 p-2 rounded block">
              FR[0-9]{'{'} 2{'}'}[ ]?[0-9]{'{'} 4{'}'}[ ]?[0-9]{'{'} 4{'}'}[ ]?[0-9]{'{'} 4{'}'}[ ]?[0-9]{'{'} 4{'}'}[ ]?[0-9]{'{'} 4{'}'}
            </code>
            <p className="text-xs text-gray-600 mt-2">
              <strong>Usage :</strong> Pour identifier les RIB, relevés bancaires, factures avec coordonnées bancaires
            </p>
          </div>
          <div className="border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-green-100 text-green-800">HAS_SIGNATURE</Badge>
              <span className="text-sm text-gray-600">Détecte "Signature" ou "Signé le"</span>
            </div>
            <code className="text-xs bg-gray-100 p-2 rounded block">
              (signé|signature|fait à).{'{'}0,50{'}'}(le |à )?[0-9]{'{'}2{'}'}/[0-9]{'{'}2{'}'}/[0-9]{'{'}4{'}'}
            </code>
            <p className="text-xs text-gray-600 mt-2">
              <strong>Usage :</strong> Pour identifier les contrats, baux signés, actes notariés
            </p>
          </div>
          <div className="border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-purple-100 text-purple-800">HAS_MONTANT_LOYER</Badge>
              <span className="text-sm text-gray-600">Détecte "Loyer : XXX€"</span>
            </div>
            <code className="text-xs bg-gray-100 p-2 rounded block">
              loyer.{'{'}0,20{'}'}[0-9]{'{'}1,4{'}'}[,.]?[0-9]{'{'}0,2{'}'}.*€
            </code>
            <p className="text-xs text-gray-600 mt-2">
              <strong>Usage :</strong> Pour identifier les quittances, relevés de loyer
            </p>
          </div>
        </div>
      </div>

      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <h4 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Quand utiliser un signal plutôt qu'un mot-clé ?
        </h4>
        <ul className="text-sm text-orange-900 space-y-1">
          <li>• <strong>Pattern structurel</strong> : dates, montants, codes (IBAN, SIRET)</li>
          <li>• <strong>Combinaison de mots</strong> : "Loyer du mois de..."</li>
          <li>• <strong>Réutilisation</strong> : même pattern pour plusieurs types de documents</li>
          <li>• <strong>Précision élevée</strong> : éviter les faux positifs des mots simples</li>
        </ul>
      </div>
    </div>
  );
}

function RegexSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <Code className="h-5 w-5 text-blue-600" />
          Regex et Flags
        </h3>
        <p className="text-gray-700 leading-relaxed mb-4">
          Chaque signal contient une <strong>expression régulière</strong> et des <strong>flags</strong> qui modifient son comportement.
        </p>
      </div>

      <div className="bg-gray-50 border rounded-lg p-4">
        <h4 className="font-semibold mb-3">Flags disponibles</h4>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <Badge className="bg-blue-100 text-blue-800">i</Badge>
            <div className="flex-1">
              <p className="font-semibold text-sm">Case insensitive</p>
              <p className="text-xs text-gray-600">Ignore majuscules/minuscules (recommandé pour OCR)</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Badge className="bg-green-100 text-green-800">u</Badge>
            <div className="flex-1">
              <p className="font-semibold text-sm">Unicode</p>
              <p className="text-xs text-gray-600">Gère les accents et caractères spéciaux (É, È, Ç, etc.)</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Badge className="bg-purple-100 text-purple-800">m</Badge>
            <div className="flex-1">
              <p className="font-semibold text-sm">Multiline</p>
              <p className="text-xs text-gray-600">^ et $ matchent début/fin de ligne (utile pour documents multi-pages)</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Badge className="bg-orange-100 text-orange-800">s</Badge>
            <div className="flex-1">
              <p className="font-semibold text-sm">Dotall</p>
              <p className="text-xs text-gray-600">Le point . matche aussi les sauts de ligne</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Combinaison recommandée</h4>
        <div className="flex items-center gap-2 mb-2">
          <code className="bg-blue-100 px-3 py-1 rounded font-semibold text-blue-900">iu</code>
          <span className="text-sm text-blue-800">= Case insensitive + Unicode</span>
        </div>
        <p className="text-sm text-blue-800">
          Cette combinaison fonctionne bien pour la plupart des documents français avec accents et variations de casse dues à l'OCR.
        </p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-900 mb-2">💡 Testez vos regex</h4>
        <p className="text-sm text-yellow-900">
          Utilisez le bouton <strong>"Tester"</strong> directement dans l'interface pour vérifier que votre regex 
          matche bien le texte attendu avant de l'associer à un type de document.
        </p>
      </div>
    </div>
  );
}

function UsageSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <TestTube className="h-5 w-5 text-blue-600" />
          Utilisation pratique
        </h3>
        <p className="text-gray-700 leading-relaxed mb-4">
          Les signaux sont <strong>associés aux types de documents</strong> avec un <strong>poids</strong>. 
          Plus le poids est élevé, plus le signal est important pour la classification.
        </p>
      </div>

      <div className="bg-gray-50 border rounded-lg p-4">
        <h4 className="font-semibold mb-3">Exemple complet : Bail signé</h4>
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-semibold text-gray-900 mb-2">Configuration du type "BAIL_SIGNE" :</p>
            <div className="space-y-2">
              <div className="border-l-4 border-blue-500 pl-3">
                <p className="font-semibold">Mots-clés (total : 20 points)</p>
                <ul className="text-gray-700 ml-4">
                  <li>• "bail" (poids 8)</li>
                  <li>• "location" (poids 6)</li>
                  <li>• "locataire" (poids 6)</li>
                </ul>
              </div>
              <div className="border-l-4 border-purple-500 pl-3">
                <p className="font-semibold">Signaux (total : 15 points)</p>
                <ul className="text-gray-700 ml-4">
                  <li>• HAS_SIGNATURE (poids 10)</li>
                  <li>• HAS_DATE_DEBUT_FIN (poids 5)</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="bg-green-50 p-3 rounded">
            <p className="font-semibold mb-1">Résultat :</p>
            <p className="text-green-800">
              Un document avec "bail", "location", "locataire" <strong>ET</strong> une signature détectée 
              obtiendra un score élevé (28/35 = 80%), même si d'autres mots sont absents.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
          <Check className="h-5 w-5" />
          Bonnes pratiques
        </h4>
        <ul className="text-sm text-green-900 space-y-1">
          <li>• <strong>Réutilisez</strong> les signaux entre plusieurs types de documents</li>
          <li>• Donnez un <strong>poids élevé (8-10)</strong> aux signaux très discriminants (signature, IBAN)</li>
          <li>• <strong>Testez</strong> toujours votre regex avec du texte OCR réel (pas parfait !)</li>
          <li>• Utilisez les <strong>flags "iu"</strong> par défaut pour gérer l'OCR imparfait</li>
        </ul>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Workflow : Créer et utiliser un signal</h4>
        <ol className="text-sm text-blue-800 space-y-2">
          <li>1. <strong>Créer le signal</strong> : Code, regex, description</li>
          <li>2. <strong>Tester</strong> avec du texte OCR réel</li>
          <li>3. <strong>Associer au type de document</strong> dans la page "Types de documents"</li>
          <li>4. <strong>Définir un poids</strong> selon l'importance du signal</li>
          <li>5. <strong>Tester la classification</strong> avec un vrai document</li>
        </ol>
      </div>
    </div>
  );
}

