'use client';

import React from 'react';
import { AlertCircle, Eye } from 'lucide-react';
import { Property } from '../../domain/entities/Property';

interface MissingRentAlertProps {
  properties: Property[];
  onPropertyClick: (propertyId: string) => void;
}

export default function MissingRentAlert({ properties, onPropertyClick }: MissingRentAlertProps) {
  const currentMonth = new Date();
  const currentYear = currentMonth.getFullYear();
  const currentMonthNum = currentMonth.getMonth() + 1;
  
  // Trouver les biens loués sans loyer ce mois-ci
  const propertiesWithoutRent = properties.filter(property => {
    if (property.status !== 'rented') return false;
    
    // Ici on devrait vérifier s'il y a une transaction de type 'rent' pour ce mois
    // Pour l'instant, on simule avec une logique basique
    return true; // Simplification pour la démo
  });

  if (propertiesWithoutRent.length === 0) {
    return null;
  }

  return (
    <div className="bg-warning-600 text-base-100 p-4 rounded-lg shadow-card">
      <div className="flex items-center space-x-3 mb-3">
        <AlertCircle size={24} />
        <h3 className="font-medium text-lg">Loyers en attente</h3>
      </div>
      
      <p className="mb-4">
        {propertiesWithoutRent.length} bien{propertiesWithoutRent.length > 1 ? 's' : ''} loué{propertiesWithoutRent.length > 1 ? 's' : ''} sans loyer reçu pour {currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}.
      </p>
      
      <div className="space-y-2">
        {propertiesWithoutRent.map(property => (
          <div key={property.id} className="flex items-center justify-between bg-warning-700 p-3 rounded">
            <div>
              <h4 className="font-medium">{property.name}</h4>
              <p className="text-sm text-warning-200">{property.address}</p>
            </div>
            <button
              onClick={() => onPropertyClick(property.id)}
              className="flex items-center space-x-2 bg-warning-800 hover:bg-warning-900 px-3 py-1 rounded transition-colors"
            >
              <Eye size={16} />
              <span>Voir le bien</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
