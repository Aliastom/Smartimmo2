'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import { BookOpen, ChevronRight, Building, Calculator, Settings, GitBranch, AlertCircle, Check, Percent } from 'lucide-react';

interface GestionDelegueHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GestionDelegueHelpModal({ isOpen, onClose }: GestionDelegueHelpModalProps) {
  const [activeSection, setActiveSection] = useState<string>('intro');

  const sections = [
    { id: 'intro', label: 'Introduction', icon: BookOpen },
    { id: 'concept', label: 'Concept de gestion déléguée', icon: Building },
    { id: 'codes', label: 'Codes système', icon: GitBranch },
    { id: 'commission', label: 'Calcul des commissions', icon: Calculator },
    { id: 'workflow', label: 'Workflow automatique', icon: Settings },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <BookOpen className="h-6 w-6 text-blue-600" />
            Documentation - Gestion Déléguée
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
            {activeSection === 'concept' && <ConceptSection />}
            {activeSection === 'codes' && <CodesSection />}
            {activeSection === 'commission' && <CommissionSection />}
            {activeSection === 'workflow' && <WorkflowSection />}
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
        <h3 className="text-xl font-semibold mb-3">Configuration de la gestion déléguée</h3>
        <p className="text-gray-700 leading-relaxed">
          Ce module permet de configurer le <strong>système de gestion déléguée</strong> pour gérer automatiquement 
          les <strong>loyers perçus</strong> et les <strong>commissions d'agence</strong> associées.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Qu'est-ce que la gestion déléguée ?</h4>
        <p className="text-sm text-blue-900 mb-3">
          C'est un <strong>mode de gestion</strong> où une agence immobilière gère vos locations et prélève 
          une <strong>commission</strong> sur chaque loyer encaissé.
        </p>
        <div className="bg-blue-100 p-3 rounded text-sm">
          <p className="font-semibold text-blue-900 mb-1">Exemple :</p>
          <p className="text-blue-800">
            Loyer encaissé : <strong>300€</strong> + Charges : <strong>15€</strong> = <strong>315€</strong><br />
            Commission agence (5%) : <strong>15.75€</strong> HT → <strong>18.90€</strong> TTC (TVA 20%)<br />
            Versement au propriétaire : <strong>315€ - 18.90€ = 296.10€</strong>
          </p>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Activation de la fonctionnalité
        </h4>
        <p className="text-sm text-yellow-900">
          Le toggle <strong>"Activer la gestion déléguée"</strong> doit être activé pour que le système 
          crée automatiquement les <strong>transactions de commission</strong> lorsque vous enregistrez un loyer.
        </p>
      </div>
    </div>
  );
}

function ConceptSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <Building className="h-5 w-5 text-blue-600" />
          Concept de gestion déléguée
        </h3>
        <p className="text-gray-700 leading-relaxed mb-4">
          Quand vous déléguez la gestion de vos biens à une agence, chaque <strong>encaissement de loyer</strong> 
          génère automatiquement une <strong>dépense de commission</strong>.
        </p>
      </div>

      <div className="bg-gray-50 border rounded-lg p-4">
        <h4 className="font-semibold mb-3">Flux de trésorerie</h4>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 text-white rounded-lg flex items-center justify-center font-bold">+</div>
            <div className="flex-1">
              <p className="font-semibold text-green-900">Recette : Loyer encaissé</p>
              <p className="text-gray-600">Ex: 315€ (loyer 300€ + charges 15€)</p>
            </div>
            <Badge className="bg-green-100 text-green-800">RECETTE_LOYER</Badge>
          </div>
          <div className="border-t pt-2">
            <p className="text-center text-gray-500 text-xs mb-2">↓ Génère automatiquement</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 text-white rounded-lg flex items-center justify-center font-bold">-</div>
            <div className="flex-1">
              <p className="font-semibold text-red-900">Dépense : Commission d'agence</p>
              <p className="text-gray-600">Ex: 18.90€ TTC (5% de 315€ + TVA 20%)</p>
            </div>
            <Badge className="bg-red-100 text-red-800">DEPENSE_GESTION</Badge>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Avantages de l'automatisation</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Gain de temps</strong> : Plus besoin de saisir manuellement les commissions</li>
          <li>• <strong>Fiabilité</strong> : Calcul automatique, pas d'erreur de saisie</li>
          <li>• <strong>Traçabilité</strong> : Lien automatique entre loyer et commission</li>
          <li>• <strong>Comptabilité exacte</strong> : Montants HT/TTC calculés précisément</li>
        </ul>
      </div>
    </div>
  );
}

function CodesSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-blue-600" />
          Codes système
        </h3>
        <p className="text-gray-700 leading-relaxed mb-4">
          Les <strong>codes système</strong> permettent au système de reconnaître automatiquement 
          les transactions de loyer et de gestion pour appliquer la logique de commission.
        </p>
      </div>

      <div className="space-y-4">
        <div className="border-l-4 border-green-500 pl-4">
          <h4 className="font-semibold text-green-900 mb-2">Codes pour le LOYER</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <Badge className="bg-green-100 text-green-800">Nature</Badge>
              <div>
                <p className="font-semibold">RECETTE_LOYER</p>
                <p className="text-gray-600">Nature de la transaction de loyer encaissé</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-green-100 text-green-800">Catégorie</Badge>
              <div>
                <p className="font-semibold">Loyer + charges</p>
                <p className="text-gray-600">Catégorie par défaut pour les loyers avec charges incluses</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-l-4 border-red-500 pl-4">
          <h4 className="font-semibold text-red-900 mb-2">Codes pour la COMMISSION</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <Badge className="bg-red-100 text-red-800">Nature</Badge>
              <div>
                <p className="font-semibold">DEPENSE_GESTION</p>
                <p className="text-gray-600">Nature de la commission d'agence</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-red-100 text-red-800">Catégorie</Badge>
              <div>
                <p className="font-semibold">Commission agence</p>
                <p className="text-gray-600">Catégorie pour les frais de gestion</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h4 className="font-semibold text-purple-900 mb-2">⚙️ Comment ça fonctionne ?</h4>
        <p className="text-sm text-purple-800 mb-2">
          Quand vous créez une transaction avec :
        </p>
        <div className="space-y-1 text-sm text-purple-800 ml-4">
          <p>• Nature = <code className="bg-purple-100 px-1 rounded">RECETTE_LOYER</code></p>
          <p>• Catégorie = <code className="bg-purple-100 px-1 rounded">Loyer + charges</code></p>
        </div>
        <p className="text-sm text-purple-800 mt-2">
          → Le système sait que c'est un loyer et <strong>génère automatiquement la commission</strong> associée.
        </p>
      </div>
    </div>
  );
}

function CommissionSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <Calculator className="h-5 w-5 text-blue-600" />
          Calcul des commissions
        </h3>
        <p className="text-gray-700 leading-relaxed mb-4">
          Le système calcule automatiquement le montant de la commission selon les paramètres configurés.
        </p>
      </div>

      <div className="bg-gray-50 border rounded-lg p-4">
        <h4 className="font-semibold mb-3">Paramètres de calcul</h4>
        <div className="space-y-3">
          <div className="border-l-4 border-blue-500 pl-4">
            <code className="text-sm font-semibold text-blue-700">Base de calcul</code>
            <p className="text-sm text-gray-700 mt-1">
              Sur quel montant calculer la commission ?
            </p>
            <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
              <div className="bg-blue-50 p-2 rounded">
                <p className="font-semibold text-blue-900">Encaissement réel ✅</p>
                <p className="text-blue-800">Commission sur le loyer effectivement perçu</p>
              </div>
              <div className="bg-gray-100 p-2 rounded">
                <p className="font-semibold text-gray-700">Loyer théorique</p>
                <p className="text-gray-600">Commission sur le loyer contractuel</p>
              </div>
            </div>
          </div>

          <div className="border-l-4 border-green-500 pl-4">
            <code className="text-sm font-semibold text-green-700">TVA applicable</code>
            <p className="text-sm text-gray-700 mt-1">
              La commission d'agence est-elle soumise à la TVA ?
            </p>
            <div className="bg-green-50 p-2 rounded text-xs mt-2">
              <p className="text-green-800">
                Généralement <strong>OUI</strong> (TVA à 20%) pour les agences assujetties
              </p>
            </div>
          </div>

          <div className="border-l-4 border-purple-500 pl-4">
            <code className="text-sm font-semibold text-purple-700">Taux de TVA</code>
            <p className="text-sm text-gray-700 mt-1">
              Taux de TVA appliqué sur la commission (généralement 20%)
            </p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-3">Exemple de calcul détaillé</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-blue-800">Loyer hors charges</span>
            <span className="font-semibold text-blue-900">300.00 €</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-blue-800">+ Charges récupérables</span>
            <span className="font-semibold text-blue-900">15.00 €</span>
          </div>
          <div className="border-t pt-2 flex justify-between items-center">
            <span className="text-blue-900 font-semibold">= Base de commission</span>
            <span className="font-bold text-blue-900">315.00 €</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-blue-800">× Taux de commission</span>
            <span className="font-semibold text-blue-900">5%</span>
          </div>
          <div className="border-t pt-2 flex justify-between items-center">
            <span className="text-blue-900 font-semibold">= Commission HT</span>
            <span className="font-bold text-blue-900">15.75 €</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-blue-800">+ TVA (20%)</span>
            <span className="font-semibold text-blue-900">3.15 €</span>
          </div>
          <div className="border-t-2 border-blue-300 pt-2 flex justify-between items-center bg-blue-100 -mx-3 px-3 py-2 rounded">
            <span className="text-blue-900 font-bold">= Commission TTC</span>
            <span className="font-bold text-blue-900 text-lg">18.90 €</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkflowSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
          <Settings className="h-5 w-5 text-blue-600" />
          Workflow automatique
        </h3>
        <p className="text-gray-700 leading-relaxed mb-4">
          Une fois la gestion déléguée <strong>activée et configurée</strong>, voici ce qui se passe automatiquement.
        </p>
      </div>

      <div className="bg-gradient-to-r from-green-50 to-blue-50 border rounded-lg p-4">
        <h4 className="font-semibold mb-3">Scénario : Enregistrement d'un loyer</h4>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">1</div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Vous créez une transaction</p>
              <p className="text-xs text-gray-600">Nature = RECETTE_LOYER, Catégorie = Loyer + charges, Montant = 315€</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">2</div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Le système détecte les codes</p>
              <p className="text-xs text-gray-600">Nature et catégorie correspondent aux codes système configurés</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">3</div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Calcul de la commission</p>
              <p className="text-xs text-gray-600">Base : 315€, Taux : 5%, TVA : 20% → Commission TTC : 18.90€</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">4</div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Création automatique</p>
              <p className="text-xs text-gray-600">Transaction de commission créée et liée à la transaction parent</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
          <Check className="h-5 w-5" />
          Champs pré-remplis automatiquement
        </h4>
        <p className="text-sm text-green-800 mb-2">Dans la transaction de commission :</p>
        <ul className="text-sm text-green-800 space-y-1">
          <li>• <strong>Date</strong> : Même date que la transaction parent</li>
          <li>• <strong>Bien & Bail</strong> : Liés au même bien/bail</li>
          <li>• <strong>Nature</strong> : DEPENSE_GESTION (configurée)</li>
          <li>• <strong>Catégorie</strong> : Commission agence (configurée)</li>
          <li>• <strong>Montant</strong> : Calculé automatiquement</li>
          <li>• <strong>Libellé</strong> : "Commission de gestion - [Bien]"</li>
          <li>• <strong>Breakdown détaillé</strong> : Base, Taux, TVA, Total TTC</li>
        </ul>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Points d'attention
        </h4>
        <ul className="text-sm text-yellow-900 space-y-1">
          <li>• Vérifiez que les <strong>codes système sont bien définis</strong> dans les natures/catégories</li>
          <li>• Le taux de commission peut être <strong>personnalisé par bail</strong></li>
          <li>• Les commissions générées sont <strong>modifiables manuellement</strong> si besoin</li>
        </ul>
      </div>
    </div>
  );
}

