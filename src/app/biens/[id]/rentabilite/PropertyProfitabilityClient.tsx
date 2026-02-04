'use client';

import React from 'react';
import { PieChart, TrendingUp } from 'lucide-react';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { BackToPropertyButton } from '@/components/shared/BackToPropertyButton';

interface PropertyProfitabilityClientProps {
  propertyId: string;
  propertyName: string;
}

export default function PropertyProfitabilityClient({ propertyId, propertyName }: PropertyProfitabilityClientProps) {
  return (
    <div className="space-y-6">
      {/* Le titre et le menu contextuel sont déjà dans PropertyHeader via le layout */}
      <div className="flex items-center justify-end mb-6">
        <BackToPropertyButton propertyId={propertyId} propertyName={propertyName} />
      </div>

      {/* Contenu rentabilité */}
      <div className="text-center py-12">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <PieChart className="h-16 w-16 text-blue-500" />
            <TrendingUp className="h-8 w-8 text-green-500 absolute -bottom-1 -right-1" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Analyse de rentabilité
        </h3>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          Les outils d'analyse de rentabilité seront bientôt disponibles pour vous aider à optimiser vos investissements
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto mt-8">
          <div className="bg-blue-50 rounded-lg p-6 text-left">
            <div className="text-3xl mb-2">💰</div>
            <h4 className="font-semibold text-gray-900 mb-1">Taux de rendement</h4>
            <p className="text-sm text-gray-600">Calcul automatique brut et net</p>
          </div>
          
          <div className="bg-green-50 rounded-lg p-6 text-left">
            <div className="text-3xl mb-2">📈</div>
            <h4 className="font-semibold text-gray-900 mb-1">Cash-flow</h4>
            <p className="text-sm text-gray-600">Suivi mensuel et prévisions</p>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-6 text-left">
            <div className="text-3xl mb-2">🎯</div>
            <h4 className="font-semibold text-gray-900 mb-1">Objectifs</h4>
            <p className="text-sm text-gray-600">Définissez et suivez vos cibles</p>
          </div>
        </div>
      </div>
    </div>
  );
}

