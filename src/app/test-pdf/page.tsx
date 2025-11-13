'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useLeasePdfGenerator } from '@/hooks/useLeasePdfGenerator';

export default function TestPdfPage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const { generatePdfAndEml } = useLeasePdfGenerator();

  const testLeaseData = {
    id: 'test-lease-123',
    type: 'residential',
    startDate: '2024-01-01',
    endDate: '2027-01-01',
    rentAmount: 750,
    charges: 50,
    deposit: 800,
    paymentDay: 1,
    status: 'DRAFT',
    notes: 'Test de clauses particulières :\n\n- Animaux autorisés avec caution supplémentaire de 200€\n- Interdiction de fumer dans les parties communes\n- Rénovation de la cuisine prévue en 2025\n- Parking privé inclus dans le loyer',
    furnishedType: 'vide',
  };

  const testProperty = {
    name: 'Appartement T3',
    address: '85 rue Paris',
    city: 'Paris',
    postalCode: '75015',
    surface: 128,
    rooms: 6,
  };

  const testTenant = {
    firstName: 'Test',
    lastName: 'Locataire',
    email: 'test@example.com',
    phone: '0123456789',
    birthDate: '1990-01-01',
  };

  const handleGeneratePdf = async () => {
    setIsGenerating(true);
    try {
      await generatePdfAndEml({
        lease: testLeaseData,
        property: testProperty,
        tenant: testTenant,
        profile: {
          firstName: 'Jean',
          lastName: 'Dupont',
          company: 'SmartImmo',
          address: '69 rue Pierre Mendes France',
          city: 'Tergnier',
          postalCode: '02700',
          signature: null, // Pas de signature pour le test
        },
        generatedAt: new Date().toLocaleDateString('fr-FR'),
      });
    } catch (error) {
      console.error('Erreur lors de la génération:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Test du Template PDF</h1>
        
        <div className="bg-gray-50 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">Données de test</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Bail:</strong> {testLeaseData.type} - {testLeaseData.rentAmount}€/mois</p>
            <p><strong>Bien:</strong> {testProperty.name} - {testProperty.address}, {testProperty.city}</p>
            <p><strong>Locataire:</strong> {testTenant.firstName} {testTenant.lastName}</p>
            <p><strong>Clauses:</strong> {testLeaseData.notes ? 'Oui' : 'Non'}</p>
          </div>
        </div>

        <Button 
          onClick={handleGeneratePdf} 
          disabled={isGenerating}
          className="w-full"
        >
          {isGenerating ? 'Génération en cours...' : 'Générer PDF + EML de test'}
        </Button>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">Nouveau Template</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✅ Bandeaux bleus (#2F54EB) pour chaque section</li>
            <li>✅ Structure complète avec toutes les sections légales</li>
            <li>✅ Clauses et conditions particulières intégrées</li>
            <li>✅ Signatures avec colonnes séparées</li>
            <li>✅ Design professionnel identique à vos anciens PDFs</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
