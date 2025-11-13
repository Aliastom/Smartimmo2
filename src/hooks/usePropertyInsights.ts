'use client';

import { useState, useEffect } from 'react';

export interface PropertyTransactionsInsights {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  transactionCount: number;
  unreconciledCount: number;
  anomalyCount: number;
  trend?: {
    revenue: string;
    expenses: string;
    net: string;
  };
  detail?: any;
}

export interface PropertyDocumentsInsights {
  totalDocuments: number;
  pendingDocuments: number;
  classifiedDocuments: number;
  ocrFailedDocuments: number;
  draftDocuments: number;
  classificationRate: number;
  detail?: any;
}

export interface PropertyLeasesInsights {
  hasActiveLease: boolean;
  leaseStartDate: Date | null;
  leaseEndDate: Date | null;
  monthlyRent: number;
  latePaymentsCount: number;
  upcomingDueDates: number;
  indexationInfo?: {
    lastDate: Date;
    rate: number;
  } | null;
  detail?: any;
}

export type PropertyInsights = 
  | PropertyTransactionsInsights 
  | PropertyDocumentsInsights 
  | PropertyLeasesInsights;

export function usePropertyInsights(
  propertyId: string,
  scope: 'transactions' | 'documents' | 'leases',
  period: 'month' | 'quarter' | 'year' = 'month',
  detail?: string
) {
  const [insights, setInsights] = useState<PropertyInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const params = new URLSearchParams({
          propertyId,
          scope,
          period
        });

        if (detail) {
          params.append('detail', detail);
        }

        const response = await fetch(`/api/insights/property?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Erreur de chargement des insights');
        }
        
        const data = await response.json();
        setInsights(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
        console.error('Erreur lors du chargement des insights property:', err);
      } finally {
        setLoading(false);
      }
    };

    if (propertyId && scope) {
      fetchInsights();
    }

    // Écouter les changements de filtres
    const handleFiltersChanged = () => {
      fetchInsights();
    };

    window.addEventListener('filters:changed', handleFiltersChanged);
    
    return () => {
      window.removeEventListener('filters:changed', handleFiltersChanged);
    };
  }, [propertyId, scope, period, detail]);

  return { insights, loading, error };
}

