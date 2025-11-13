'use client';

import React from 'react';
import { FileText, CheckCircle, Euro, Clock } from 'lucide-react';
import StatCard from '../common/StatCard';
import { formatCurrencyEUR } from '@/utils/format';
import { type Lease } from '../hooks/useLeases';

interface PropertyLeaseStatsProps {
  leases: Lease[];
}

export default function PropertyLeaseStats({ leases }: PropertyLeaseStatsProps) {
  // Calculer les statistiques
  const totalLeases = leases.length;
  const activeLeases = leases.filter(lease => lease.status === 'ACTIF').length;
  
  const totalMonthlyRent = leases
    .filter(lease => lease.status === 'ACTIF')
    .reduce((sum, lease) => sum + lease.rentAmount, 0);

  // Calculer les échéances dans les 60 prochains jours
  const now = new Date();
  const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  
  const expiringSoon = leases.filter(lease => {
    if (!lease.endDate) return false;
    const endDate = new Date(lease.endDate);
    return endDate >= now && endDate <= in60Days;
  }).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        title="Baux totaux"
        value={totalLeases}
        icon={<FileText className="h-5 w-5" />}
        color="blue"
      />
      <StatCard
        title="Actifs"
        value={activeLeases}
        icon={<CheckCircle className="h-5 w-5" />}
        color="green"
        subtitle={`${totalLeases > 0 ? Math.round((activeLeases / totalLeases) * 100) : 0}% du total`}
      />
      <StatCard
        title="Loyer mensuel total"
        value={formatCurrencyEUR(totalMonthlyRent)}
        icon={<Euro className="h-5 w-5" />}
        color="purple"
        subtitle="Baux actifs uniquement"
      />
      <StatCard
        title="Échéances < 60j"
        value={expiringSoon}
        icon={<Clock className="h-5 w-5" />}
        color={expiringSoon > 0 ? 'yellow' : 'gray'}
        subtitle={expiringSoon > 0 ? 'Attention requise' : 'Aucune échéance proche'}
      />
    </div>
  );
}
