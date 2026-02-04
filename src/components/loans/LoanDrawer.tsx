'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Edit, Copy, Trash2, Download, FileText, Building2, Calendar, Euro, Info, Percent, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { Loan } from './LoansTable';
import { buildSchedule, crdAtDate } from '@/lib/finance/amortization';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAlert } from '@/hooks/useAlert';
import { getLoanRepositoryOffline } from '@/lib/offline/repositories/LoanRepositoryOffline';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { notify2 } from '@/lib/notify2';

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
  const { showAlert } = useAlert();
  const { organizationId } = useCurrentOrganization();
  const [schedule, setSchedule] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(-1);
  const [highlightCurrentRow, setHighlightCurrentRow] = useState<boolean>(false);
  const [currentCRD, setCurrentCRD] = useState<number>(0);
  const [localLoan, setLocalLoan] = useState<Loan | null>(loan);
  const [isToggling, setIsToggling] = useState(false);
  const currentRowRef = useRef<HTMLTableRowElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Synchroniser localLoan avec loan quand il change
  useEffect(() => {
    setLocalLoan(loan);
  }, [loan]);

  useEffect(() => {
    if (!loan) return;

    // Calculer le tableau d'amortissement
    const computed = buildSchedule({
      principal: loan.principal,
      annualRatePct: loan.annualRatePct,
      durationMonths: loan.durationMonths,
      defermentMonths: loan.defermentMonths || 0,
      insurancePct: loan.insurancePct || 0,
      startDate: new Date(loan.startDate),
      paymentDay: (loan as any).paymentDay || undefined,
    });

    setSchedule(computed);

    // Calculer le mois actuel du prêt
    const startDate = new Date(loan.startDate);
    const today = new Date();
    const monthsDiff = (today.getFullYear() - startDate.getFullYear()) * 12 + 
                      (today.getMonth() - startDate.getMonth());
    
    // Le mois actuel est à l'index monthsDiff (0-based), sauf si le prêt n'a pas encore commencé
    const currentIdx = monthsDiff >= 0 && monthsDiff < computed.length ? monthsDiff : -1;
    setCurrentMonthIndex(currentIdx);

    // Calculer le CRD actuel
    if (currentIdx >= 0 && currentIdx < computed.length) {
      setCurrentCRD(computed[currentIdx]?.remainingCapital || 0);
    } else if (computed.length > 0) {
      // Si le prêt n'a pas encore commencé, utiliser le capital initial
      setCurrentCRD(loan.principal);
    } else {
      setCurrentCRD(0);
    }

    // Préparer les données pour le graphique (tous les 12 mois + dernière échéance)
    const chartPoints = computed.filter((row, idx) => idx % 12 === 0 || idx === computed.length - 1);
    const chartFormatted = chartPoints.map((row) => ({
      month: row.month,
      Principal: Math.round(row.paymentPrincipal),
      Intérêts: Math.round(row.paymentInterest),
      Assurance: Math.round(row.paymentInsurance),
      CRD: Math.round(row.remainingCapital),
    }));

    setChartData(chartFormatted);
  }, [loan]);

  // Effet pour scroller vers le mois actuel et appliquer la surbrillance
  useEffect(() => {
    if (isOpen && currentMonthIndex >= 0 && currentRowRef.current && tableContainerRef.current) {
      // Petit délai pour s'assurer que le drawer est bien ouvert et rendu
      setTimeout(() => {
        if (currentRowRef.current && tableContainerRef.current) {
          // Scroller vers la ligne du mois actuel
          const rowTop = currentRowRef.current.offsetTop;
          const containerHeight = tableContainerRef.current.clientHeight;
          const rowHeight = currentRowRef.current.clientHeight;
          
          // Centrer la ligne dans le conteneur
          tableContainerRef.current.scrollTop = rowTop - (containerHeight / 2) + (rowHeight / 2);
          
          // Activer la surbrillance
          setHighlightCurrentRow(true);
          
          // Désactiver la surbrillance après 3 secondes
          setTimeout(() => {
            setHighlightCurrentRow(false);
          }, 3000);
        }
      }, 300);
    }
  }, [isOpen, currentMonthIndex]);

  if (!isOpen || !loan) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const formatDateShort = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
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
      await showAlert({
        type: 'error',
        title: 'Erreur',
        message: 'Erreur lors de la génération du PDF',
      });
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
              {/* Statut et montant principal */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={localLoan?.isActive ? 'success' : 'secondary'}>
                      {localLoan?.isActive ? 'Actif' : 'Inactif'}
                    </Badge>
                  </div>
                  {currentCRD > 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-gray-600">CRD Actuel</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {formatCurrency(currentCRD)}
                      </p>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Capital emprunté</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(loan.principal)}
                  </p>
                </div>
              </div>

              {/* Toggle Actif/Inactif */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={localLoan?.isActive ?? false}
                    onCheckedChange={async (checked) => {
                      if (!organizationId || !localLoan) {
                        notify2.error('Organisation requise');
                        return;
                      }

                      setIsToggling(true);
                      try {
                        // ✅ Optimistic update
                        setLocalLoan(prev => prev ? { ...prev, isActive: checked } : null);
                        
                        const loanRepo = getLoanRepositoryOffline();
                        await loanRepo.upsert({ ...localLoan, id: localLoan.id, isActive: checked, organizationId }, organizationId);
                        
                        // ✅ Émettre un événement ciblé pour rafraîchir les hooks
                        if (propertyId) {
                          window.dispatchEvent(new CustomEvent('loans:refresh', { 
                            detail: { scope: 'property', propertyId, reason: 'update' } 
                          }));
                        } else {
                          window.dispatchEvent(new CustomEvent('loans:refresh', { 
                            detail: { scope: 'global', reason: 'update' } 
                          }));
                        }
                        
                        notify2.success(checked ? 'Prêt activé' : 'Prêt désactivé');
                      } catch (error: any) {
                        console.error('Erreur lors de la mise à jour du prêt:', error);
                        // ✅ Rollback en cas d'erreur
                        setLocalLoan(prev => prev ? { ...prev, isActive: !checked } : null);
                        notify2.error('Erreur', error.message || 'Erreur lors de la mise à jour');
                      } finally {
                        setIsToggling(false);
                      }
                    }}
                    disabled={isToggling}
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900">
                      Marquer comme actif
                    </span>
                    {isToggling && (
                      <span className="text-xs text-gray-500 ml-2">Enregistrement...</span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Cette modification est automatiquement sauvegardée.
                </p>
              </div>

              {/* Informations du prêt */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Informations du prêt</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Capital emprunté */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Euro className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Capital emprunté</span>
                    </div>
                    <p className="font-medium">{formatCurrency(loan.principal)}</p>
                  </div>

                  {/* Mensualité */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Euro className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Mensualité</span>
                    </div>
                    <p className="font-medium">{loan.monthlyPayment ? formatCurrency(loan.monthlyPayment) : '—'}</p>
                  </div>

                  {/* Taux annuel */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Percent className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Taux annuel</span>
                    </div>
                    <p className="font-medium">{loan.annualRatePct}%</p>
                  </div>

                  {/* Durée */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Durée</span>
                    </div>
                    <p className="font-medium">{loan.durationMonths} mois</p>
                  </div>

                  {/* Différé */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Différé</span>
                    </div>
                    <p className="font-medium">{loan.defermentMonths || 0} mois</p>
                  </div>

                  {/* Assurance */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Assurance</span>
                    </div>
                    <p className="font-medium">{loan.insurancePct ? `${loan.insurancePct}% /an` : 'Aucune'}</p>
                  </div>

                  {/* Date de début */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Date de début</span>
                    </div>
                    <p className="font-medium">{formatDate(loan.startDate)}</p>
                  </div>

                  {/* Jour de paiement */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Jour de paiement</span>
                    </div>
                    <p className="font-medium">
                      {(loan as any).paymentDay ? `Le ${(loan as any).paymentDay} du mois` : 'Non défini'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bien */}
              <div className="border-t pt-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Bien</span>
                  </div>
                  <p className="font-medium">{loan.propertyName}</p>
                </div>
              </div>

              {/* Graphique d'amortissement */}
              {chartData.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Évolution de l'amortissement</h3>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="month" 
                          label={{ value: 'Mois', position: 'insideBottom', offset: -5 }}
                        />
                        {/* Axe gauche pour les paiements mensuels */}
                        <YAxis 
                          yAxisId="left"
                          label={{ value: 'Paiements (€)', angle: -90, position: 'insideLeft' }}
                          tickFormatter={(value) => `${Math.round(value)}€`}
                        />
                        {/* Axe droit pour le CRD */}
                        <YAxis 
                          yAxisId="right"
                          orientation="right"
                          label={{ value: 'CRD (€)', angle: 90, position: 'insideRight' }}
                          tickFormatter={(value) => `${Math.round(value / 1000)}k€`}
                        />
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          labelFormatter={(label) => `Mois ${label}`}
                        />
                        <Legend />
                        <Line 
                          yAxisId="left"
                          type="monotone" 
                          dataKey="Principal" 
                          stroke="#3b82f6" 
                          strokeWidth={2} 
                          name="Principal" 
                          dot={{ r: 2 }}
                        />
                        <Line 
                          yAxisId="left"
                          type="monotone" 
                          dataKey="Intérêts" 
                          stroke="#ef4444" 
                          strokeWidth={2} 
                          name="Intérêts" 
                          dot={{ r: 2 }}
                        />
                        {loan.insurancePct && loan.insurancePct > 0 && (
                          <Line 
                            yAxisId="left"
                            type="monotone" 
                            dataKey="Assurance" 
                            stroke="#f59e0b" 
                            strokeWidth={2} 
                            name="Assurance" 
                            dot={{ r: 2 }}
                          />
                        )}
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="CRD" 
                          stroke="#06b6d4" 
                          strokeWidth={3} 
                          name="CRD" 
                          strokeDasharray="5 5"
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Tableau d'amortissement */}
              {schedule.length > 0 && (
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Tableau d'amortissement</h3>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={exportCSV}>
                        <Download className="h-4 w-4 mr-2" />
                        CSV
                      </Button>
                      <Button variant="outline" size="sm" onClick={exportPDF}>
                        <FileText className="h-4 w-4 mr-2" />
                        PDF
                      </Button>
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div ref={tableContainerRef} className="max-h-96 overflow-y-auto">
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
                            // Convertir la date YYYY-MM en format lisible
                            const [year, month] = row.date.split('-');
                            const dateObj = new Date(parseInt(year), parseInt(month) - 1);
                            const formattedDate = dateObj.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
                            
                            const isCurrentMonth = idx === currentMonthIndex;
                            const shouldHighlight = isCurrentMonth && highlightCurrentRow;
                            
                            return (
                              <tr 
                                key={idx} 
                                ref={isCurrentMonth ? currentRowRef : null}
                                className={`
                                  hover:bg-gray-50 
                                  ${isCurrentMonth ? 'bg-cyan-50 border-l-4 border-l-cyan-500' : ''}
                                  ${shouldHighlight ? 'animate-pulse' : ''}
                                `}
                              >
                                <td className={`px-3 py-2 ${isCurrentMonth ? 'font-semibold text-cyan-900' : 'text-gray-900'}`}>
                                  {row.month}
                                </td>
                                <td className={`px-3 py-2 ${isCurrentMonth ? 'font-semibold text-cyan-900' : 'text-gray-600'}`}>
                                  {formattedDate}
                                </td>
                                <td className={`px-3 py-2 text-right ${isCurrentMonth ? 'font-semibold text-cyan-900' : 'text-gray-900'}`}>
                                  {formatCurrency(row.paymentPrincipal)}
                                </td>
                                <td className={`px-3 py-2 text-right ${isCurrentMonth ? 'font-semibold text-cyan-900' : 'text-gray-600'}`}>
                                  {formatCurrency(row.paymentInterest)}
                                </td>
                                {loan.insurancePct && loan.insurancePct > 0 && (
                                  <td className={`px-3 py-2 text-right ${isCurrentMonth ? 'font-semibold text-cyan-900' : 'text-gray-600'}`}>
                                    {formatCurrency(row.paymentInsurance)}
                                  </td>
                                )}
                                <td className={`px-3 py-2 text-right font-semibold ${isCurrentMonth ? 'text-cyan-900' : 'text-gray-900'}`}>
                                  {formatCurrency(row.paymentTotal)}
                                </td>
                                <td className={`px-3 py-2 text-right font-semibold ${isCurrentMonth ? 'text-cyan-900' : 'text-cyan-600'}`}>
                                  {formatCurrency(row.remainingCapital)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Informations système */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Informations système</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">ID Prêt</p>
                    <p className="font-mono text-xs text-gray-500">{loan.id}</p>
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
