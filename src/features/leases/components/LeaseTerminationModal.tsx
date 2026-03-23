'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { LeaseWithDetails } from '@/lib/services/leasesService';

interface LeaseTerminationModalProps {
  isOpen: boolean;
  lease: LeaseWithDetails | null;
  onClose: () => void;
  onConfirm: (payload: { effectiveEndDate: string; reason?: string }) => Promise<void>;
}

export function LeaseTerminationModal({ isOpen, lease, onClose, onConfirm }: LeaseTerminationModalProps) {
  const [effectiveEndDate, setEffectiveEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!effectiveEndDate) {
      setError('La date de fin effective est obligatoire.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm({ effectiveEndDate, reason: reason.trim() || undefined });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !lease) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Résilier le bail"
      size="md"
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={submitting}>
            {submitting ? 'Résiliation...' : 'Confirmer la résiliation'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Bail concerné</p>
          <p className="text-sm font-medium text-gray-900">
            {lease.Property?.name} - {lease.Tenant?.firstName} {lease.Tenant?.lastName}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin effective</label>
          <input
            type="date"
            value={effectiveEndDate}
            onChange={(e) => setEffectiveEndDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Motif (optionnel)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
            placeholder="Ex: départ locataire, vente du bien..."
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </Modal>
  );
}

