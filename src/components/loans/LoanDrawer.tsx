'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Edit, Copy, Trash2, X, Download, FileText } from 'lucide-react';
import { Loan } from './LoansTable';
import { buildSchedule } from '@/lib/finance/amortization';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAlert } from '@/hooks/useAlert';

interface LoanDrawerProps {
  loan: Loan | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (loan: Loan) => void;
  onDuplicate: (loan: Loan) => void;
  onDelete: (loan: Loan) => void;
}

export function LoanDrawer({
  loan,
  isOpen,
  onClose,
  onEdit,
  onDuplicate,
  onDelete,
}: LoanDrawerProps) {
  const { showAlert } = useAlert();
  const [schedule, setSchedule] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [currentMonthIndex, setCurrentMonthIndex] = useState<number>(-1);
  const [highlightCurrentRow, setHighlightCurrentRow] = useState<boolean>(false);
  const currentRowRef = useRef<HTMLTableRowElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loan) return;

    // Calculer le tableau d'amortissement
    const computed = buildSchedule({
      principal: loan.principal,
      annualRatePct: loan.annualRatePct,
      durationMonths: loan.durationMonths,
      defermentMonths: loan.defermentMonths,
      insurancePct: loan.insurancePct || 0,
      startDate: new Date(loan.startDate),
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

  if (!loan) return null;

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
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
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
    <Drawer isOpen={isOpen} onClose={onClose} size="2xl">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{loan.label}</h2>
            <p className="text-sm text-gray-600 mt-1">{loan.propertyName}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={loan.isActive ? 'success' : 'secondary'}>
              {loan.isActive ? 'Actif' : 'Inactif'}
            </Badge>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Informations principales */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Informations du prêt</h3>
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
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Capital emprunté</p>
                <p className="text-lg font-semibold text-gray-900">{formatCurrency(loan.principal)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Mensualité</p>
                <p className="text-lg font-semibold text-cyan-600">{loan.monthlyPayment ? formatCurrency(loan.monthlyPayment) : '—'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Taux annuel</p>
                <p className="text-lg font-semibold text-gray-900">{loan.annualRatePct}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Durée</p>
                <p className="text-lg font-semibold text-gray-900">{loan.durationMonths} mois</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Différé</p>
                <p className="text-lg font-semibold text-gray-900">{loan.defermentMonths} mois</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Assurance</p>
                <p className="text-lg font-semibold text-gray-900">
                  {loan.insurancePct ? `${loan.insurancePct}% /an` : 'Aucune'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Date de début</p>
                <p className="text-lg font-semibold text-gray-900">{formatDate(loan.startDate)}</p>
              </div>
              {schedule.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600">CRD Actuel</p>
                  <p className="text-lg font-semibold text-orange-600">
                    {formatCurrency(
                      currentMonthIndex >= 0 && currentMonthIndex < schedule.length
                        ? schedule[currentMonthIndex]?.remainingCapital || 0
                        : schedule[schedule.length - 1]?.remainingCapital || 0
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Graphique d'amortissement */}
          {chartData.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Évolution de l'amortissement</h3>
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
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Tableau d'amortissement</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div ref={tableContainerRef} className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Mois</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Principal</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Intérêts</th>
                        {loan.insurancePct && loan.insurancePct > 0 && (
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Assurance</th>
                        )}
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
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
                              ${shouldHighlight ? 'animate-pulse-highlight' : ''}
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
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 flex gap-2">
          <Button variant="outline" onClick={() => onEdit(loan)} className="flex-1">
            <Edit className="h-4 w-4 mr-2" />
            Modifier
          </Button>
          <Button variant="outline" onClick={() => onDuplicate(loan)} className="flex-1">
            <Copy className="h-4 w-4 mr-2" />
            Dupliquer
          </Button>
          <Button variant="destructive" onClick={() => onDelete(loan)} className="flex-1">
            <Trash2 className="h-4 w-4 mr-2" />
            Archiver
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

