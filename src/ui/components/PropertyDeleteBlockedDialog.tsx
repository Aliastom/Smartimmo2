'use client';

import React from 'react';
import { X, AlertTriangle, Users, FileText, Receipt, Landmark, Home, Camera } from 'lucide-react';
import Link from 'next/link';

interface HardBlockers {
  leases: {
    active: number;
    signed: number;
    upcoming: number;
    draft: number;
    total: number;
  };
  loans: {
    active: number;
    total: number;
  };
}

interface SoftInfo {
  occupants: number;
  transactions: number;
  documents: number;
  photos: number;
}

interface PropertyDeleteBlockedDialogProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string;
  propertyName: string;
  hardBlockers: HardBlockers;
  softInfo: SoftInfo;
}

export default function PropertyDeleteBlockedDialog({
  isOpen,
  onClose,
  propertyId,
  propertyName,
  hardBlockers,
  softInfo
}: PropertyDeleteBlockedDialogProps) {
  if (!isOpen) return null;

  const hasHardBlockers = hardBlockers.Lease.total > 0 || hardBlockers.Loan.active > 0;
  const hasSoftInfo = Object.values(softInfo).some(count => count > 0);

  if (!hasHardBlockers) return null;

  return (
    <div className="fixed inset-0 bg-base-content bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded-lg shadow-xl max-w-lg w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-100 rounded-full">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <h2 className="text-lg font-semibold text-neutral-900">
              Suppression impossible
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-neutral-600 mb-6">
            Ce bien ne peut pas être supprimé tant que des éléments bloquants existent.
          </p>

          {/* Section A: À faire pour supprimer */}
          {hasHardBlockers && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center">
                <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full mr-2">
                  Bloquant
                </span>
                À faire pour supprimer
              </h3>
              <div className="space-y-3">
                {/* Baux */}
                {hardBlockers.Lease.total > 0 && (
                  <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Home className="h-4 w-4 text-error" />
                      <span className="font-medium text-neutral-900">Baux</span>
                    </div>
                    <div className="text-sm text-neutral-600">
                      Terminer/supprimer les baux en cours, signés ou à venir
                      {hardBlockers.Lease.active > 0 && ` (actifs: ${hardBlockers.Lease.active})`}
                      {hardBlockers.Lease.signed > 0 && ` (signés: ${hardBlockers.Lease.signed})`}
                      {hardBlockers.Lease.upcoming > 0 && ` (à venir: ${hardBlockers.Lease.upcoming})`}
                      {hardBlockers.Lease.draft > 0 && ` (brouillons: ${hardBlockers.Lease.draft})`}
                    </div>
                  </div>
                )}

                {/* Prêts */}
                {hardBlockers.Loan.active > 0 && (
                  <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Landmark className="h-4 w-4 text-error" />
                      <span className="font-medium text-neutral-900">Prêts</span>
                    </div>
                    <div className="text-sm text-neutral-600">
                      Clôturer ou supprimer le(s) prêt(s) actif(s) ({hardBlockers.Loan.active})
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section B: Informations (aucune action requise) */}
          {hasSoftInfo && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-neutral-900 mb-3 flex items-center">
                <span className="px-2 py-1 bg-base-200 text-base-content text-xs rounded-full mr-2">
                  Info
                </span>
                Informations (aucune action requise)
              </h3>
              <div className="space-y-2">
                {softInfo.occupants > 0 && (
                  <div className="flex items-center justify-between p-2 bg-base-200 rounded">
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-base-content opacity-80" />
                      <span className="text-sm text-base-content opacity-90">Occupants</span>
                    </div>
                    <span className="text-sm text-base-content opacity-80">{softInfo.occupants}</span>
                  </div>
                )}
                {softInfo.Transaction > 0 && (
                  <div className="flex items-center justify-between p-2 bg-base-200 rounded">
                    <div className="flex items-center space-x-2">
                      <Receipt className="h-4 w-4 text-base-content opacity-80" />
                      <span className="text-sm text-base-content opacity-90">Transactions</span>
                    </div>
                    <span className="text-sm text-base-content opacity-80">{softInfo.Transaction}</span>
                  </div>
                )}
                {softInfo.Document > 0 && (
                  <div className="flex items-center justify-between p-2 bg-base-200 rounded">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-base-content opacity-80" />
                      <span className="text-sm text-base-content opacity-90">Documents</span>
                    </div>
                    <span className="text-sm text-base-content opacity-80">{softInfo.Document}</span>
                  </div>
                )}
                {softInfo.Photo > 0 && (
                  <div className="flex items-center justify-between p-2 bg-base-200 rounded">
                    <div className="flex items-center space-x-2">
                      <Camera className="h-4 w-4 text-base-content opacity-80" />
                      <span className="text-sm text-base-content opacity-90">Photos</span>
                    </div>
                    <span className="text-sm text-base-content opacity-80">{softInfo.Photo}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-base-content opacity-70 mt-3">
                Ces éléments n'empêchent pas la suppression. Ils seront supprimés/détachés avec le bien.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-neutral-200">
          {hardBlockers.Lease.total > 0 && (
            <Link
              href={`/biens/${propertyId}/leases`}
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              Voir les baux
            </Link>
          )}
          {hardBlockers.Loan.active > 0 && (
            <Link
              href={`/biens/${propertyId}/loans`}
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              Voir les prêts
            </Link>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary-600 text-base-100 text-sm font-medium rounded-md hover:bg-primary-700 transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
