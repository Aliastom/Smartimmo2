'use client';

import React from 'react';
import { Sliders, Sparkles } from 'lucide-react';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { BackToPropertyButton } from '@/components/shared/BackToPropertyButton';

interface PropertyComingSoonClientProps {
  propertyId: string;
  propertyName: string;
}

export default function PropertyComingSoonClient({ propertyId, propertyName }: PropertyComingSoonClientProps) {
  return (
    <div className="space-y-6">
      {/* Le titre et le menu contextuel sont déjà dans PropertyHeader via le layout */}
      <div className="flex items-center justify-end mb-6">
        <BackToPropertyButton propertyId={propertyId} propertyName={propertyName} />
      </div>

      {/* Contenu coming soon */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-12 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <Sliders className="h-20 w-20 text-blue-500" />
              <Sparkles className="h-8 w-8 text-yellow-400 absolute -top-2 -right-2 animate-pulse" />
            </div>
          </div>
          
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            De nouvelles fonctionnalités arrivent bientôt !
          </h2>
          
          <p className="text-lg text-gray-600 mb-6 max-w-2xl mx-auto">
            Nous travaillons sur des outils innovants pour améliorer la gestion de vos biens immobiliers.
            Restez connecté pour découvrir les prochaines fonctionnalités.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 text-left">
            <div className="bg-white rounded-lg p-4 border border-blue-100">
              <div className="text-2xl mb-2">📊</div>
              <h3 className="font-semibold text-gray-900 mb-1">Analyses avancées</h3>
              <p className="text-sm text-gray-600">Rapports détaillés et prévisions</p>
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-blue-100">
              <div className="text-2xl mb-2">🤖</div>
              <h3 className="font-semibold text-gray-900 mb-1">Automatisations</h3>
              <p className="text-sm text-gray-600">Tâches récurrentes simplifiées</p>
            </div>
            
            <div className="bg-white rounded-lg p-4 border border-blue-100">
              <div className="text-2xl mb-2">📱</div>
              <h3 className="font-semibold text-gray-900 mb-1">App mobile</h3>
              <p className="text-sm text-gray-600">Gérez vos biens en déplacement</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

