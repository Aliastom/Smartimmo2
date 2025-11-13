'use client';

import React from 'react';
import { X, Edit, Trash2, Copy, Calendar, Euro, Building2, FileText, Tag, Info, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';
import {
  EcheanceRecurrente,
  ECHEANCE_TYPE_LABELS,
  PERIODICITE_LABELS,
  SENS_LABELS,
  TYPE_COLORS,
} from '@/types/echeance';
import Link from 'next/link';

interface EcheanceDrawerProps {
  echeance: EcheanceRecurrente | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (echeance: EcheanceRecurrente) => void;
  onDuplicate: (echeance: EcheanceRecurrente) => void;
  onDelete: (echeance: EcheanceRecurrente) => void;
}

export function EcheanceDrawer({
  echeance,
  isOpen,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
}: EcheanceDrawerProps) {
  if (!isOpen || !echeance) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return '—';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

      {/* Drawer */}
      <div
        className="relative ml-auto h-full bg-white shadow-lg border-l border-gray-200 w-full max-w-lg flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Détails de l'échéance</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Libellé et statut */}
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">{echeance.label}</h3>
            <div className="flex items-center gap-2">
              <Badge className={TYPE_COLORS[echeance.type]}>
                {ECHEANCE_TYPE_LABELS[echeance.type]}
              </Badge>
              <Badge className={echeance.sens === 'DEBIT' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                {SENS_LABELS[echeance.sens]}
              </Badge>
              <Badge variant={echeance.isActive ? 'success' : 'secondary'}>
                {echeance.isActive ? (
                  <><CheckCircle className="h-3 w-3 mr-1" /> Actif</>
                ) : (
                  <><XCircle className="h-3 w-3 mr-1" /> Inactif</>
                )}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Informations principales */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Euro className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-600">Montant</p>
                <p className="text-lg font-semibold text-gray-900">{formatCurrency(echeance.montant)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-600">Périodicité</p>
                <p className="text-base font-medium text-gray-900">{PERIODICITE_LABELS[echeance.periodicite]}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Tag className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-gray-600">Charge récupérable</p>
                <p className="text-base font-medium text-gray-900">
                  {echeance.recuperable ? 'Oui' : 'Non'}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Dates */}
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Date de début</p>
              <p className="text-base font-medium text-gray-900">{formatDate(echeance.startAt)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Date de fin</p>
              <p className="text-base font-medium text-gray-900">
                {echeance.endAt ? formatDate(echeance.endAt) : 'Aucune (récurrence infinie)'}
              </p>
            </div>
          </div>

          <Separator />

          {/* Relations */}
          {(echeance.Property || echeance.Lease) && (
            <>
              <div className="space-y-4">
                {echeance.Property && (
                  <div className="flex items-start gap-3">
                    <Building2 className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-600 mb-1">Bien</p>
                      <Link
                        href={`/biens/${echeance.Property.id}/transactions`}
                        className="text-base font-medium text-primary-600 hover:underline"
                      >
                        {echeance.Property.name}
                      </Link>
                    </div>
                  </div>
                )}

                {echeance.Lease && (
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-600 mb-1">Bail</p>
                      <p className="text-base font-medium text-gray-900">
                        {echeance.Lease.type} - {echeance.Lease.status}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <Separator />
            </>
          )}

          {/* Métadonnées */}
          <div className="space-y-2 text-xs text-gray-500">
            <p>
              <span className="font-medium">Créée le :</span>{' '}
              {formatDate(echeance.createdAt)}
            </p>
            <p>
              <span className="font-medium">Modifiée le :</span>{' '}
              {formatDate(echeance.updatedAt)}
            </p>
            <p>
              <span className="font-medium">ID :</span> {echeance.id}
            </p>
          </div>
        </div>

        {/* Footer avec actions */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 flex-shrink-0">
          <Button variant="ghost" onClick={() => onDelete(echeance)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer
          </Button>
          <Button variant="outline" onClick={() => onDuplicate(echeance)}>
            <Copy className="h-4 w-4 mr-2" />
            Dupliquer
          </Button>
          <Button onClick={() => onEdit(echeance)}>
            <Edit className="h-4 w-4 mr-2" />
            Éditer
          </Button>
        </div>
      </div>
    </div>
  );
}

