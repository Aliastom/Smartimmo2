/**
 * Wrapper pour BiensClient (mode normal)
 * Utilise PropertiesPageCore avec les données du Server Component
 */

'use client';

import { PropertiesPageCore } from '@/features/properties/PropertiesPageCore';
import type { PropertyWithRelations } from '@/lib/db/PropertyRepo';
import type { Property, Transaction } from '@/features/analytics/types';

interface BiensClientWrapperProps {
  initialData: {
    data: PropertyWithRelations[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
  stats: Array<{
    title: string;
    value: string;
    iconName: string;
    trend: { value: number; label: string; period: string };
    color: 'primary' | 'success' | 'warning' | 'danger' | 'gray';
  }>;
  properties: Property[];
  transactions: Transaction[];
}

export default function BiensClientWrapper({
  initialData,
  stats,
  properties,
  transactions,
}: BiensClientWrapperProps) {
  return (
    <PropertiesPageCore
      mode="normal"
      initialData={initialData}
      initialStats={stats}
      initialPropertiesForCharts={properties}
      initialTransactionsForCharts={transactions}
    />
  );
}
