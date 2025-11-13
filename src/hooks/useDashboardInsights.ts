'use client';

import { useState, useEffect } from 'react';

export interface DashboardInsights {
  // Biens
  totalProperties: number;
  occupiedProperties: number;
  vacantProperties: number;
  monthlyRevenue: number;
  occupationRate: number;
  
  // Locataires
  totalTenants: number;
  tenantsWithActiveLeases: number;
  tenantsWithoutLeases: number;
  overduePayments: number;
  
  // Transactions
  totalTransactions: number;
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  unreconciledTransactions: number;
  anomalies: number;
  upcomingDueDates: number;
  
  // Documents
  totalDocuments: number;
  pendingDocuments: number;
  classifiedDocuments: number;
  ocrFailedDocuments: number;
  draftDocuments: number;
  classificationRate: number;
}

export function useDashboardInsights(scope: 'biens' | 'locataires' | 'transactions' | 'documents') {
  const [insights, setInsights] = useState<Partial<DashboardInsights>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`/api/insights?scope=${scope}`);
        if (!response.ok) {
          throw new Error('Erreur de chargement des insights');
        }
        
        const data = await response.json();
        setInsights(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
        console.error('Erreur lors du chargement des insights:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchInsights();

    // Écouter les changements de filtres
    const handleFiltersChanged = () => {
      fetchInsights();
    };

    window.addEventListener('filters:changed', handleFiltersChanged);
    
    return () => {
      window.removeEventListener('filters:changed', handleFiltersChanged);
    };
  }, [scope]);

  return { insights, loading, error };
}
