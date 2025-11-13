'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Calendar, FileX, FileWarning, TrendingUp } from 'lucide-react';
import { InlineChips, ChipData } from '@/components/shared/InlineChips';
import { cn } from '@/utils/cn';

export interface BienAlertsData {
  retardsPaiement?: number;
  indexations?: number;
  bauxFinissant?: number;
  docsNonClasses?: number;
  transactionsNonRapprochees?: number;
}

export interface BienAlertsProps {
  alerts: BienAlertsData;
  propertyId: string;
  className?: string;
}

export function BienAlerts({ alerts, propertyId, className }: BienAlertsProps) {
  const chips: ChipData[] = [];

  // Retards de paiement
  if (alerts.retardsPaiement && alerts.retardsPaiement > 0) {
    chips.push({
      id: 'retards',
      label: 'Retards de paiement',
      count: alerts.retardsPaiement,
      href: `/biens/${propertyId}/transactions?filter=retards`,
      icon: <AlertCircle className="h-4 w-4" />,
      variant: 'danger'
    });
  }

  // Indexations à venir
  if (alerts.indexations && alerts.indexations > 0) {
    chips.push({
      id: 'indexations',
      label: 'Indexations à venir',
      count: alerts.indexations,
      href: `/biens/${propertyId}/baux?filter=indexations`,
      icon: <TrendingUp className="h-4 w-4" />,
      variant: 'warning'
    });
  }

  // Baux finissant < 60j
  if (alerts.bauxFinissant && alerts.bauxFinissant > 0) {
    chips.push({
      id: 'baux-finissant',
      label: 'Baux finissant < 60j',
      count: alerts.bauxFinissant,
      href: `/biens/${propertyId}/baux?filter=finissant`,
      icon: <Calendar className="h-4 w-4" />,
      variant: 'warning'
    });
  }

  // Documents non classés
  if (alerts.docsNonClasses && alerts.docsNonClasses > 0) {
    chips.push({
      id: 'docs-non-classes',
      label: 'Documents à classer',
      count: alerts.docsNonClasses,
      href: `/biens/${propertyId}/documents?filter=unclassified`,
      icon: <FileX className="h-4 w-4" />,
      variant: 'info'
    });
  }

  // Transactions non rapprochées
  if (alerts.transactionsNonRapprochees && alerts.transactionsNonRapprochees > 0) {
    chips.push({
      id: 'trans-non-rapprochees',
      label: 'Transactions non rapprochées',
      count: alerts.transactionsNonRapprochees,
      href: `/biens/${propertyId}/transactions?status=nonRapprochee`,
      icon: <FileWarning className="h-4 w-4" />,
      variant: 'info'
    });
  }

  if (chips.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className={cn('bg-white rounded-2xl shadow-sm border border-gray-200 p-6', className)}
    >
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Alertes & Actions requises
      </h2>
      <InlineChips chips={chips} />
    </motion.div>
  );
}

