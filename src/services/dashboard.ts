/**
 * Service client pour le dashboard Patrimoine
 * Fetcher avec gestion d'erreurs
 */

import { PatrimoineResponse, PatrimoineFilters } from '@/types/dashboard';

export async function fetchPatrimoineData(
  filters: PatrimoineFilters
): Promise<PatrimoineResponse> {
  const params = new URLSearchParams({
    from: filters.from,
    to: filters.to,
    mode: filters.mode,
  });

  if (filters.propertyId) {
    params.append('propertyId', filters.propertyId);
  }
  if (filters.type) {
    params.append('type', filters.type);
  }
  if (filters.leaseStatus) {
    params.append('leaseStatus', filters.leaseStatus);
  }

  const response = await fetch(`/api/dashboard/patrimoine?${params.toString()}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Erreur lors du chargement des données' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

