'use client';

import React from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Edit, Eye, Copy, Archive } from 'lucide-react';
import Link from 'next/link';

export interface Loan {
  id: string;
  propertyId: string;
  propertyName: string;
  label: string;
  principal: number;
  annualRatePct: number;
  durationMonths: number;
  defermentMonths: number;
  insurancePct: number | null;
  startDate: string;
  isActive: boolean;
  monthlyPayment?: number;
}

interface LoansTableProps {
  loans: Loan[];
  isLoading?: boolean;
  onEdit?: (loan: Loan) => void;
  onView?: (loan: Loan) => void;
  onDuplicate?: (loan: Loan) => void;
  onArchive?: (loan: Loan) => void;
  onToggleActive?: (loan: Loan, isActive: boolean) => void;
  userRole?: 'ADMIN' | 'USER';
}

export function LoansTable({
  loans,
  isLoading,
  onEdit,
  onView,
  onDuplicate,
  onArchive,
  onToggleActive,
  userRole = 'USER',
}: LoansTableProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  };

  if (isLoading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Libellé</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bien</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Capital Initial</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Mensualité</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Taux</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Durée</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Début</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assurance</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actif</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i}>
                <td colSpan={10} className="px-4 py-3">
                  <div className="h-12 bg-gray-100 rounded animate-pulse"></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (loans.length === 0) {
    return (
      <div className="p-12 text-center">
        <p className="text-gray-500 mb-4">Aucun prêt trouvé</p>
        {userRole === 'ADMIN' && onEdit && (
          <Button onClick={() => onEdit({} as Loan)}>
            Créer un prêt
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Libellé</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bien</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Capital Initial</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Mensualité</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Taux</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Durée</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Début</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assurance</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actif</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {loans.map((loan) => (
            <tr key={loan.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium text-gray-900">{loan.label}</td>
              <td className="px-4 py-3 text-sm">
                <Link
                  href={`/biens/${loan.propertyId}/loans`}
                  className="text-primary-600 hover:underline"
                >
                  {loan.propertyName}
                </Link>
              </td>
              <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                {formatCurrency(loan.principal)}
              </td>
              <td className="px-4 py-3 text-sm text-right font-semibold text-cyan-600">
                {loan.monthlyPayment ? formatCurrency(loan.monthlyPayment) : '—'}
              </td>
              <td className="px-4 py-3 text-sm text-right text-gray-600">{loan.annualRatePct}%</td>
              <td className="px-4 py-3 text-sm text-right text-gray-600">{loan.durationMonths} mois</td>
              <td className="px-4 py-3 text-sm text-gray-600">{formatDate(loan.startDate)}</td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {loan.insurancePct ? `${loan.insurancePct}%/an` : '—'}
              </td>
              <td className="px-4 py-3 text-center">
                {userRole === 'ADMIN' ? (
                  <Switch
                    checked={loan.isActive}
                    onCheckedChange={(checked) => onToggleActive?.(loan, checked)}
                  />
                ) : (
                  <Badge variant={loan.isActive ? 'success' : 'secondary'}>
                    {loan.isActive ? 'Actif' : 'Inactif'}
                  </Badge>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onView?.(loan)}
                    title="Voir le détail"
                    className="h-8 w-8 p-0"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {userRole === 'ADMIN' && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit?.(loan)}
                        title="Éditer"
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDuplicate?.(loan)}
                        title="Dupliquer"
                        className="h-8 w-8 p-0"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onArchive?.(loan)}
                        title="Archiver"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
