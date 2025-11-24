'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatCurrencyEUR } from '@/utils/format';
import type { PreviewReservation, PreviewResult } from '@/lib/services/airbnbImportService';

const formatCurrency = formatCurrencyEUR;

interface AirbnbImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  preview: PreviewResult | null;
  isPreviewLoading: boolean;
  previewError: string | null;
  onConfirm: () => void;
  isImporting: boolean;
}

export function AirbnbImportPreviewModal({
  isOpen,
  onClose,
  preview,
  isPreviewLoading,
  previewError,
  onConfirm,
  isImporting,
}: AirbnbImportPreviewModalProps) {
  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === 'N/A') return dateStr;
    try {
      if (dateStr.includes('T')) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR');
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const columns: Column<PreviewReservation>[] = [
    {
      key: 'confirmationCode',
      header: 'Code de confirmation',
      render: (value) => (
        <span className="font-mono text-sm font-medium">{value as string}</span>
      ),
    },
    {
      key: 'guest',
      header: 'Voyageur',
    },
    {
      key: 'startDate',
      header: 'Date de début',
      render: (value) => formatDate(value as string),
    },
    {
      key: 'endDate',
      header: 'Date de fin',
      render: (value) => formatDate(value as string),
    },
    {
      key: 'nights',
      header: 'Nuits',
      render: (value) => (
        <span className="text-center block">{value as number}</span>
      ),
      className: 'text-center',
    },
    {
      key: 'grossRevenue',
      header: 'Revenus bruts',
      render: (value) => (
        <span className="font-medium text-green-600">
          {formatCurrency(value as number)}
        </span>
      ),
      className: 'text-right',
    },
    {
      key: 'serviceFee',
      header: 'Frais de service',
      render: (value) => (
        <span className="text-red-600">
          -{formatCurrency(value as number)}
        </span>
      ),
      className: 'text-right',
    },
    {
      key: 'cleaningFee',
      header: 'Frais de ménage',
      render: (value) => (
        <span className="text-red-600">
          -{formatCurrency(value as number)}
        </span>
      ),
      className: 'text-right',
    },
    {
      key: 'transactionDate',
      header: 'Date transaction',
      render: (value) => formatDate(value as string),
    },
  ];

  const formatPeriod = (period: { from: string; to: string }) => {
    try {
      const from = new Date(period.from);
      const to = new Date(period.to);
      return `${from.toLocaleDateString('fr-FR')} - ${to.toLocaleDateString('fr-FR')}`;
    } catch {
      return 'N/A';
    }
  };

  const calculateNetRevenue = () => {
    if (!preview) return 0;
    return (
      preview.totalGrossRevenue -
      preview.totalServiceFee -
      preview.totalCleaningFee
    );
  };

  const footer = !isPreviewLoading ? (
    <div className="flex items-center justify-end gap-3">
      <Button
        variant="outline"
        onClick={onClose}
        disabled={isImporting}
      >
        Annuler
      </Button>
      <Button
        variant="default"
        onClick={onConfirm}
        disabled={!preview || preview.reservations.length === 0 || isImporting}
      >
        {isImporting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Import en cours...
          </>
        ) : (
          'Confirmer l\'import'
        )}
      </Button>
    </div>
  ) : undefined;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Prévisualisation de l'import Airbnb"
      size="xl"
      footer={footer}
      closeOnBackdropClick={!isImporting}
    >
      <div className="space-y-6">
        {/* État de chargement */}
        {isPreviewLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-3 text-gray-600">
              Analyse du fichier CSV en cours...
            </span>
          </div>
        )}

        {/* Erreur de prévisualisation */}
        {previewError && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3" />
              <div>
                <h3 className="text-sm font-medium text-red-800">
                  Erreur lors de l'analyse
                </h3>
                <p className="mt-1 text-sm text-red-700">{previewError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Prévisualisation des données */}
        {preview && !isPreviewLoading && (
          <>
            {/* Résumé */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <div className="text-sm text-gray-600">Réservations</div>
                <div className="text-2xl font-semibold text-gray-900">
                  {preview.totalReservations}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Revenus bruts</div>
                <div className="text-2xl font-semibold text-green-600">
                  {formatCurrency(preview.totalGrossRevenue)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Frais totaux</div>
                <div className="text-2xl font-semibold text-red-600">
                  -{formatCurrency(preview.totalServiceFee + preview.totalCleaningFee)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Revenus nets</div>
                <div className="text-2xl font-semibold text-gray-900">
                  {formatCurrency(calculateNetRevenue())}
                </div>
              </div>
            </div>

            {/* Période */}
            {preview.period && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">Période:</span>{' '}
                {formatPeriod(preview.period)}
              </div>
            )}

            {/* Erreurs */}
            {preview.errors && preview.errors.length > 0 && (
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3" />
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Avertissements ({preview.errors.length})
                    </h3>
                    <ul className="mt-2 list-disc list-inside space-y-1">
                      {preview.errors.slice(0, 5).map((error, index) => (
                        <li key={index} className="text-sm text-yellow-700">
                          {error}
                        </li>
                      ))}
                      {preview.errors.length > 5 && (
                        <li className="text-sm text-yellow-700">
                          ... et {preview.errors.length - 5} autre(s)
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Tableau des réservations */}
            {preview.reservations.length > 0 ? (
              <div className="border border-gray-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                <DataTable
                  data={preview.reservations}
                  columns={columns}
                  compact
                />
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Aucune réservation valide trouvée dans le fichier.
              </div>
            )}

            {/* Information sur les transactions */}
            {preview.reservations.length > 0 && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                <div className="flex items-start">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
                  <div>
                    <h3 className="text-sm font-medium text-blue-800">
                      Transactions qui seront créées
                    </h3>
                    <p className="mt-1 text-sm text-blue-700">
                      {preview.totalReservations} transaction(s) mère (loyer) +{' '}
                      {preview.reservations.filter((r) => r.serviceFee > 0)
                        .length}{' '}
                      transaction(s) frais de service +{' '}
                      {preview.reservations.filter((r) => r.cleaningFee > 0)
                        .length}{' '}
                      transaction(s) frais de ménage ={' '}
                      <strong>
                        {preview.totalReservations +
                          preview.reservations.filter((r) => r.serviceFee > 0)
                            .length +
                          preview.reservations.filter((r) => r.cleaningFee > 0)
                            .length}{' '}
                        transaction(s) au total
                      </strong>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </Modal>
  );
}

