/**
 * Helpers pour seed/reset des données de test
 * 
 * Utilise les endpoints /api/test/seed et /api/test/reset
 */

import { APIRequestContext, expect } from 'playwright/test';

/**
 * Token de test (doit être configuré dans les variables d'environnement)
 */
const TEST_TOKEN = process.env.TEST_API_TOKEN || 'test-token-change-me';

/**
 * Interface pour les données de seed
 */
export interface TestSeedData {
  organizationId: string;
  properties?: Array<{
    name: string;
    type: string;
    address: string;
    city: string;
    postalCode: string;
    surface: number;
    rooms: number;
    acquisitionPrice: number;
    managementCompanyId?: string;
  }>;
  tenants?: Array<{
    firstName: string;
    lastName: string;
    email: string;
  }>;
  leases?: Array<{
    propertyId: string;
    tenantId: string;
    startDate: string;
    endDate?: string;
    rentAmount: number;
    status: string;
  }>;
  transactions?: Array<{
    propertyId: string;
    leaseId?: string;
    date: string;
    nature: string;
    amount: number;
    label: string;
  }>;
}

/**
 * Seed les données de test via l'API
 */
export async function seedTestData(
  request: APIRequestContext,
  data: TestSeedData
): Promise<{ success: boolean; data?: any; error?: string }> {
  const response = await request.post('/api/test/seed', {
    headers: {
      'Content-Type': 'application/json',
      'X-Test-Token': TEST_TOKEN,
    },
    data,
  });
  
  if (!response.ok()) {
    const error = await response.text();
    return {
      success: false,
      error: `Seed failed: ${response.status()} ${error}`,
    };
  }
  
  const result = await response.json();
  return result;
}

/**
 * Reset toutes les données de test
 */
export async function resetTestData(
  request: APIRequestContext,
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  const response = await request.post('/api/test/reset', {
    headers: {
      'Content-Type': 'application/json',
      'X-Test-Token': TEST_TOKEN,
    },
    data: { organizationId },
  });
  
  if (!response.ok()) {
    const error = await response.text();
    return {
      success: false,
      error: `Reset failed: ${response.status()} ${error}`,
    };
  }
  
  const result = await response.json();
  return result;
}

/**
 * Crée un dataset de test minimal pour les tests E2E
 */
export function createMinimalTestSeed(organizationId: string): TestSeedData {
  const today = new Date();
  
  return {
    organizationId,
    properties: [
      {
        name: 'Appartement Test E2E',
        type: 'apartment',
        address: '123 Rue Test',
        city: 'Paris',
        postalCode: '75001',
        surface: 50,
        rooms: 2,
        acquisitionPrice: 200000,
        notaryFees: 10000,
        currentValue: 220000,
        acquisitionDate: today.toISOString().split('T')[0], // Format YYYY-MM-DD
        status: 'vacant',
      },
    ],
    tenants: [
      {
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean.dupont@test.e2e',
      },
    ],
    leases: [
      {
        propertyId: '', // Sera rempli après création du bien
        tenantId: '', // Sera rempli après création du locataire
        startDate: new Date().toISOString().split('T')[0],
        rentAmount: 800,
        status: 'ACTIF',
      },
    ],
    transactions: [
      {
        propertyId: '', // Sera rempli après création du bien
        date: new Date().toISOString().split('T')[0],
        nature: 'LOYER',
        amount: 800,
        label: 'Loyer Test E2E',
      },
    ],
  };
}
