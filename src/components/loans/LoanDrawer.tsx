'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { X, Edit, Copy, Trash2, Download, FileText, Building2, Calendar, Euro, Percent, Clock, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getLoanRepositoryOffline } from '@/lib/offline/repositories/LoanRepositoryOffline';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { notify2 } from '@/lib/notify2';
import type { Loan } from '@/features/loans/hooks/useLoansData';

interface LoanDrawerProps {
  loan: Loan | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (loan: Loan) => void;
  onDuplicate: (loan: Loan) => void;
  onDelete: (loan: Loan) => void;
  propertyId?: string; // Pour émettre les events ciblés
}

export function LoanDrawer({
  loan,
  isOpen,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
  propertyId,
}: LoanDrawerProps) {
  const { organizationId } = useCurrentOrganization();
  const [statusOverride, setStatusOverride] = useState<'actif' | 'solde' | 'inactif' | null>(null);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);

  useEffect(() => {
    setStatusOverride(null);
  }, [loan?.id]);

  const safeLoan = loan;
  const schedule = safeLoan?.loanDisplay?.schedule || [];
  const currentCRD = safeLoan?.loanDisplay?.currentCRD ?? 0;
  const monthlyPayment = safeLoan?.loanDisplay?.monthlyPayment ?? safeLoan?.monthlyPayment ?? 0;
  const endDateIso = safeLoan?.loanDisplay?.endDateIso || safeLoan?.endDate || null;
  const totalCost = safeLoan?.loanDisplay?.totalCost ?? safeLoan?.principal ?? 0;
  const remainingInterests = safeLoan?.loanDisplay?.remainingInterests ?? 0;
  const repaidPercent = safeLoan?.loanDisplay?.repaidPercent ?? 0;
  const totalInsurance = schedule.reduce((sum, row) => sum + (row.paymentInsurance || 0), 0);

  const now = new Date();
  const nowMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const nextPayment = schedule.find((row) => row.date.substring(0, 7) > nowMonthKey) || null;
  const lastPayment = [...schedule].reverse().find((row) => row.date.substring(0, 7) <= nowMonthKey) || null;
  const paymentStatus = nextPayment ? 'À venir' : 'Terminé';

  const businessStatus = statusOverride || safeLoan?.loanBusinessStatus || (safeLoan?.isActive ? 'actif' : 'inactif');
  const statusBadge = businessStatus === 'actif'
    ? <Badge variant="success">Actif</Badge>
    : businessStatus === 'solde'
      ? <Badge variant="secondary">Soldé</Badge>
      : <Badge variant="warning">Inactif</Badge>;

  const chartData = useMemo(() => {
    if (schedule.length === 0) return [];
    const chartPoints = schedule.filter((row, idx) => idx % 12 === 0 || idx === schedule.length - 1);
    return chartPoints.map((row) => ({
      month: row.month,
      Principal: Math.round(row.paymentPrincipal),
      Intérêts: Math.round(row.paymentInterest),
      Assurance: Math.round(row.paymentInsurance),
      CRD: Math.round(row.remainingCapital),
    }));
  }, [schedule]);

  if (!isOpen || !safeLoan) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const formatRepaidPercent = (value: number) => {
    if (value <= 0) return '0 %';
    if (value < 1) return '< 1 %';
    if (value < 10) return `${value.toFixed(1)} %`;
    return `${Math.round(value)} %`;
  };

  const formatLoanTypeLabel = (rawType?: string | null) => {
    if (!rawType) return '—';
    const normalized = rawType.toUpperCase();
    const map: Record<string, string> = {
      IMMOBILIER: 'Prêt immobilier',
      TRAVAUX: 'Prêt travaux',
      PERSONNEL: 'Prêt personnel',
      AUTRE: 'Autre',
    };
    return map[normalized] || rawType;
  };

  const formatDurationLabel = (months: number) => {
    if (!months || months <= 0) return '—';
    if (months % 12 === 0) {
      const years = months / 12;
      return `${years} an${years > 1 ? 's' : ''} (${months} mois)`;
    }
    return `${months} mois`;
  };

  const exportCSV = () => {
    if (schedule.length === 0) return;

    const headers = ['Mois', 'Date', 'Principal', 'Intérêts', 'Assurance', 'Total', 'CRD'];
    const rows = schedule.map((row) => [
      row.month,
      row.date,
      row.paymentPrincipal.toFixed(2),
      row.paymentInterest.toFixed(2),
      row.paymentInsurance.toFixed(2),
      row.paymentTotal.toFixed(2),
      row.remainingCapital.toFixed(2),
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map((r) => r.join(';')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `echeancier_${loan.label.replace(/\s/g, '_')}.csv`;
    link.click();
  };

  const exportPDF = async () => {
    if (schedule.length === 0) return;

    try {
      // Import dynamique pour éviter les problèmes SSR
      const { pdf } = await import('@react-pdf/renderer');
      const { LoanAmortizationPdf } = await import('@/pdf/LoanAmortizationPdf');

      const pdfData = {
        loanLabel: loan.label,
        propertyName: loan.propertyName,
        principal: loan.principal,
        annualRatePct: loan.annualRatePct,
        durationMonths: loan.durationMonths,
        insurancePct: loan.insurancePct || 0,
        startDate: formatDate(loan.startDate),
        schedule: schedule,
      };

      const blob = await pdf(<LoanAmortizationPdf data={pdfData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `amortissement-${loan.label.replace(/\s+/g, '-')}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      notify2.error('Erreur lors de la génération du PDF');
    }
  };

  const handleStatusAction = async (targetStatus: 'actif' | 'solde') => {
    if (!organizationId) {
      notify2.error('Organisation requise');
      return;
    }

    setIsStatusUpdating(true);
    try {
      const repo = getLoanRepositoryOffline();
      const nextIsActive = targetStatus === 'actif';
      await repo.upsert({
        ...loan,
        id: loan.id,
        organizationId,
        isActive: nextIsActive,
        status: targetStatus, // champ transitoire pour statut métier explicite
      } as any, organizationId);

      setStatusOverride(targetStatus);
      if (propertyId) {
        window.dispatchEvent(new CustomEvent('loans:refresh', { detail: { scope: 'property', propertyId, reason: 'update' } }));
      } else {
        window.dispatchEvent(new CustomEvent('loans:refresh', { detail: { scope: 'global', reason: 'update' } }));
      }

      notify2.success(targetStatus === 'solde' ? 'Prêt marqué comme soldé' : 'Prêt réactivé');
    } catch (error: any) {
      console.error('Erreur mise à jour statut prêt:', error);
      notify2.error(error.message || 'Erreur lors de la mise à jour du statut');
    } finally {
      setIsStatusUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer - Mobile: plein écran, Desktop: side panel */}
      <div className="fixed right-0 top-0 h-screen w-full lg:w-auto lg:max-w-2xl bg-white shadow-xl transform transition-transform">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Détail du prêt
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {loan.label}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {/* Header cockpit */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm text-gray-600">Prêt</p>
                    <p className="text-lg font-semibold text-gray-900">{loan.label}</p>
                  </div>
                  {statusBadge}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Mensualité</p>
                    <p className="font-semibold text-cyan-600">{formatCurrency(monthlyPayment)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">CRD actuel</p>
                    <p className="font-semibold text-orange-600">{formatCurrency(currentCRD)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Date de fin</p>
                    <p className="font-medium text-gray-900">{formatDate(endDateIso)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">% remboursé</p>
                    <p className="font-medium text-gray-900">{formatRepaidPercent(repaidPercent)}</p>
                  </div>
                </div>
              </div>

              {/* Actions de statut explicites */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Actions</h3>
                  <p className="text-xs text-gray-600">Mettre a jour le statut metier du pret.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {businessStatus !== 'solde' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusAction('solde')}
                      disabled={isStatusUpdating}
                    >
                      Marquer comme soldé
                    </Button>
                  )}
                  {businessStatus !== 'actif' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusAction('actif')}
                      disabled={isStatusUpdating}
                    >
                      Réactiver
                    </Button>
                  )}
                  {isStatusUpdating && <span className="text-xs text-gray-500">Mise à jour...</span>}
                </div>
              </div>

              {/* Synthèse financière */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Synthèse financière</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Euro className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Capital initial</span>
                    </div>
                    <p className="font-medium">{formatCurrency(loan.principal)}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Euro className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Coût total</span>
                    </div>
                    <p className="font-medium">{formatCurrency(totalCost)}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Euro className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Intérêts restants</span>
                    </div>
                    <p className="font-medium">{formatCurrency(remainingInterests)}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Euro className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Assurance totale</span>
                    </div>
                    <p className="font-medium">{formatCurrency(totalInsurance)}</p>
                  </div>
                </div>
              </div>

              {/* Évolution */}
              {chartData.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Évolution</h3>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" label={{ value: 'Mois', position: 'insideBottom', offset: -5 }} />
                        <YAxis yAxisId="left" tickFormatter={(value) => `${Math.round(value)}€`} />
                        <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `${Math.round(value / 1000)}k€`} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} labelFormatter={(label) => `Mois ${label}`} />
                        <Legend />
                        <Line yAxisId="left" type="monotone" dataKey="Principal" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
                        <Line yAxisId="left" type="monotone" dataKey="Intérêts" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} />
                        {loan.insurancePct && loan.insurancePct > 0 && (
                          <Line yAxisId="left" type="monotone" dataKey="Assurance" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                        )}
                        <Line yAxisId="right" type="monotone" dataKey="CRD" stroke="#06b6d4" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Paiements */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Paiements</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Prochaine mensualité</span>
                    </div>
                    <p className="font-medium">
                      {nextPayment ? `${formatDate(nextPayment.date)} · ${formatCurrency(nextPayment.paymentTotal)}` : '—'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Dernière mensualité</span>
                    </div>
                    <p className="font-medium">
                      {lastPayment ? `${formatDate(lastPayment.date)} · ${formatCurrency(lastPayment.paymentTotal)}` : '—'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Statut paiement</span>
                    </div>
                    <p className="font-medium">{paymentStatus}</p>
                  </div>
                </div>
              </div>

              {/* Tableau d'amortissement (replié par défaut) */}
              {schedule.length > 0 && (
                <div className="border-t pt-4">
                  <details>
                    <summary className="flex items-center justify-between cursor-pointer list-none">
                      <h3 className="text-lg font-medium text-gray-900">Tableau d'amortissement</h3>
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    </summary>
                    <div className="mt-4">
                      <div className="flex items-center justify-end gap-2 mb-4">
                        <Button variant="outline" size="sm" onClick={exportCSV}>
                          <Download className="h-4 w-4 mr-2" />
                          CSV
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportPDF}>
                          <FileText className="h-4 w-4 mr-2" />
                          PDF
                        </Button>
                      </div>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="max-h-96 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">MOIS</th>
                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">DATE</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">PRINCIPAL</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">INTÉRÊTS</th>
                                {loan.insurancePct && loan.insurancePct > 0 && (
                                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">ASSURANCE</th>
                                )}
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">TOTAL</th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">CRD</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {schedule.map((row, idx) => {
                                const [year, month] = row.date.split('-');
                                const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1);
                                const formattedDate = dateObj.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
                                return (
                                  <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 text-gray-900">{row.month}</td>
                                    <td className="px-3 py-2 text-gray-600">{formattedDate}</td>
                                    <td className="px-3 py-2 text-right text-gray-900">{formatCurrency(row.paymentPrincipal)}</td>
                                    <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(row.paymentInterest)}</td>
                                    {loan.insurancePct && loan.insurancePct > 0 && (
                                      <td className="px-3 py-2 text-right text-gray-600">{formatCurrency(row.paymentInsurance)}</td>
                                    )}
                                    <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(row.paymentTotal)}</td>
                                    <td className="px-3 py-2 text-right font-semibold text-cyan-600">{formatCurrency(row.remainingCapital)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              )}

              {/* Informations techniques */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Informations techniques</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Type de prêt</p>
                    <p className="font-medium">{formatLoanTypeLabel((loan as any).loanType)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Taux</p>
                    <p className="font-medium">{loan.annualRatePct}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Durée</p>
                    <p className="font-medium">{formatDurationLabel(loan.durationMonths)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Différé</p>
                    <p className="font-medium">{loan.defermentMonths || 0} mois</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Jour de paiement</p>
                    <p className="font-medium">{(loan as any).paymentDay ? `Le ${(loan as any).paymentDay} du mois` : 'Non défini'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Bien</p>
                    <p className="font-medium flex items-center gap-1"><Building2 className="h-4 w-4 text-gray-500" />{loan.propertyName}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-4 border-t">
            <Button
              variant="outline"
              onClick={() => onEdit(loan)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Modifier
            </Button>
            <Button
              variant="outline"
              onClick={() => onDuplicate(loan)}
            >
              <Copy className="h-4 w-4 mr-2" />
              Dupliquer
            </Button>
            <Button
              variant="danger"
              onClick={() => onDelete(loan)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
