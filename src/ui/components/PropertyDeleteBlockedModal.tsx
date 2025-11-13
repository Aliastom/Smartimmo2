'use client';

import React from 'react';
import { X, AlertTriangle, Users, FileText, Receipt, Landmark, Home } from 'lucide-react';
import Link from 'next/link';

interface Blockers {
  leases: {
    active: number;
    signed: number;
    upcoming: number;
    draft: number;
    total: number;
  };
  occupants: number;
  transactions: number;
  documents: number;
  loans: number;
}

interface PropertyDeleteBlockedModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string;
  propertyName: string;
  blockers: Blockers;
}

export default function PropertyDeleteBlockedModal({
  isOpen,
  onClose,
  propertyId,
  propertyName,
  blockers
}: PropertyDeleteBlockedModalProps) {
  if (!isOpen) return null;

  const hasBlockers = Object.values(blockers).some(count => 
    typeof count === 'number' ? count > 0 : count.total > 0
  );

  if (!hasBlockers) return null;

  return (
    <div className="fixed inset-0 bg-base-content bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded-lg shadow-xl max-w-md w-full mx-4">
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
          <p className="text-neutral-600 mb-4">
            Ce bien ne peut pas être supprimé car des éléments y sont encore rattachés :
          </p>

          <div className="space-y-3">
            {/* Baux */}
            {blockers.Lease.total > 0 && (
              <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Home className="h-4 w-4 text-neutral-600" />
                  <span className="font-medium text-neutral-900">Baux</span>
                </div>
                <div className="text-sm text-neutral-600">
                  {blockers.Lease.active > 0 && `${blockers.Lease.active} actif(s)`}
                  {blockers.Lease.signed > 0 && `${blockers.Lease.signed} signé(s)`}
                  {blockers.Lease.upcoming > 0 && `${blockers.Lease.upcoming} à venir`}
                  {blockers.Lease.draft > 0 && `${blockers.Lease.draft} brouillon(s)`}
                </div>
              </div>
            )}

            {/* Occupants */}
            {blockers.occupants > 0 && (
              <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-neutral-600" />
                  <span className="font-medium text-neutral-900">Occupants</span>
                </div>
                <span className="text-sm text-neutral-600">{blockers.occupants}</span>
              </div>
            )}

            {/* Transactions */}
            {blockers.Transaction > 0 && (
              <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Receipt className="h-4 w-4 text-neutral-600" />
                  <span className="font-medium text-neutral-900">Transactions</span>
                </div>
                <span className="text-sm text-neutral-600">{blockers.Transaction}</span>
              </div>
            )}

            {/* Documents */}
            {blockers.Document > 0 && (
              <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-neutral-600" />
                  <span className="font-medium text-neutral-900">Documents</span>
                </div>
                <span className="text-sm text-neutral-600">{blockers.Document}</span>
              </div>
            )}

            {/* Prêts */}
            {blockers.Loan > 0 && (
              <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Landmark className="h-4 w-4 text-neutral-600" />
                  <span className="font-medium text-neutral-900">Prêts</span>
                </div>
                <span className="text-sm text-neutral-600">{blockers.Loan}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-neutral-200">
          {blockers.Lease.total > 0 && (
            <Link
              href={`/biens/${propertyId}/leases`}
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              Voir les baux
            </Link>
          )}
          {blockers.occupants > 0 && (
            <Link
              href={`/biens/${propertyId}/tenants`}
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              Voir les occupants
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
