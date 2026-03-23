'use client';

import React, { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { notify2 } from '@/lib/notify2';
import type { LeaseWithDetails } from '@/lib/services/leasesService';
import { getLocalDB } from '@/lib/offline/db';

interface LeaseIndexationModalProps {
  isOpen: boolean;
  lease: LeaseWithDetails | null;
  onClose: () => void;
  onApplied?: () => void;
}

function addOneYear(date: Date): Date {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + 1);
  return next;
}

export function LeaseIndexationModal({ isOpen, lease, onClose, onApplied }: LeaseIndexationModalProps) {
  const [variationPct, setVariationPct] = useState<number>(2);
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  const currentRent = lease?.rentAmount ?? 0;
  const indexType = lease?.indexationType || 'IRL';
  const referenceDate = useMemo(() => {
    if (!lease?.startDate) return new Date().toISOString().slice(0, 10);
    return addOneYear(new Date(lease.startDate)).toISOString().slice(0, 10);
  }, [lease?.startDate]);

  const newRent = useMemo(() => {
    const value = currentRent * (1 + variationPct / 100);
    return Math.round(value * 100) / 100;
  }, [currentRent, variationPct]);
  const delta = useMemo(() => Math.round((newRent - currentRent) * 100) / 100, [newRent, currentRent]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

  const handleApply = async () => {
    if (!lease) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/leases/${lease.id}/index-rent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newRentAmount: newRent,
          effectiveDate,
          indexType: String(indexType).toUpperCase(),
          reason: 'INDEXATION_V1',
          notes: `Indexation appliquée via workflow V1 (${variationPct.toFixed(2)}%).`,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || "Échec de l'application de l'indexation");
      }
      const payload = await response.json();
      try {
        const db = await getLocalDB();
        const nowIso = new Date().toISOString();
        await db.Lease.update(lease.id, { rentAmount: newRent, updatedAt: nowIso, _localUpdatedAt: nowIso } as any);
        if (payload?.indexation?.id) {
          await db.RentIndexation.put({
            id: payload.indexation.id,
            leaseId: lease.id,
            organizationId: lease.organizationId,
            previousRentAmount: currentRent,
            newRentAmount: newRent,
            effectiveDate: payload.indexation.effectiveDate || effectiveDate,
            indexType: payload.indexation.indexType || String(indexType).toUpperCase(),
            indexValue: variationPct,
            createdAt: payload.indexation.createdAt || nowIso,
            createdBy: null,
          } as any);
        }
      } catch {
        // best effort local mirror
      }
      window.dispatchEvent(
        new CustomEvent('leases:refresh', { detail: { scope: 'global', reason: 'indexation', leaseId: lease.id } })
      );
      notify2.success('Indexation appliquée', 'Le nouveau loyer est pris en compte.');
      onApplied?.();
      onClose();
    } catch (error) {
      notify2.error('Erreur', error instanceof Error ? error.message : "Impossible d'appliquer l'indexation");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !lease) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Indexer le loyer"
      size="md"
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={handleApply} disabled={submitting}>
            {submitting ? 'Application...' : "Appliquer l'indexation"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Loyer actuel</p>
          <p className="text-lg font-semibold text-gray-900">{formatCurrency(currentRent)}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-gray-500">Type d'indexation</p>
            <p className="text-sm font-medium text-gray-900">{String(indexType).toUpperCase()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Date de référence</p>
            <p className="text-sm font-medium text-gray-900">{new Date(referenceDate).toLocaleDateString('fr-FR')}</p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date d'effet</label>
          <input
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Variation (%)</label>
          <input
            type="number"
            step="0.1"
            value={variationPct}
            onChange={(e) => setVariationPct(parseFloat(e.target.value) || 0)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-1">
          <p className="text-sm text-blue-900">
            Nouveau loyer proposé : <span className="font-semibold">{formatCurrency(newRent)}</span>
          </p>
          <p className="text-sm text-blue-900">
            Variation : <span className="font-medium">{formatCurrency(delta)}</span> ({variationPct.toFixed(2)}%)
          </p>
        </div>
      </div>
    </Modal>
  );
}

