'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { GestionnaireDelegueReportPanel } from '@/components/dashboard/GestionnaireDelegueReportPanel';

/**
 * Page Documents → Rapport gestionnaire délégué
 * Génération du rapport d'anomalies pour un gestionnaire délégué.
 */
export default function RapportGestionnairePage() {
  const searchParams = useSearchParams();
  const [month] = useState(() => {
    const m = searchParams?.get('month');
    if (m) return m;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Rapport gestionnaire délégué</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Générer et envoyer le rapport d'anomalies pour un gestionnaire délégué.
        </p>
      </div>
      <GestionnaireDelegueReportPanel currentMonth={month} mode="normal" />
    </div>
  );
}
