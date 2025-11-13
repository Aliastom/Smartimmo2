'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { ClientDataTable } from '@/components/ui/ClientDataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { TransactionWithRelations } from '@/lib/db/TransactionRepo';
import { 
  Building2, 
  Users, 
  FileText, 
  CreditCard,
  DollarSign,
  Calendar,
  MapPin,
  AlertCircle,
  Plus
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface DashboardClientProps {
  kpis: Array<{
    title: string;
    value: string;
    iconName: string;
    trend: { value: number; label: string; period: string };
    color: 'primary' | 'success' | 'warning' | 'danger' | 'gray';
    clickTarget: string;
  }>;
  recentTransactions: TransactionWithRelations[];
  upcomingTasks: Array<{
    id: string;
    title: string;
    date: string;
    priority: 'high' | 'medium' | 'low';
    type: string;
  }>;
}

export default function DashboardClient({ kpis, recentTransactions, upcomingTasks }: DashboardClientProps) {
  const router = useRouter();

  const handleKpiClick = (clickTarget: string) => {
    router.push(clickTarget);
  };

  const getStatusBadge = (transaction: TransactionWithRelations) => {
    if (transaction.paidAt) {
      return <Badge variant="success">Payé</Badge>;
    } else {
      return <Badge variant="warning">En attente</Badge>;
    }
  };

  const getNatureLabel = (nature?: string) => {
    const natureMap: Record<string, string> = {
      'LOYER': 'Loyer',
      'CHARGES': 'Charges',
      'DEPOT_GARANTIE_RECU': 'Dépôt de garantie reçu',
      'DEPOT_GARANTIE_RENDU': 'Dépôt de garantie rendu',
      'AVOIR_REGULARISATION': 'Avoir/Régularisation',
      'PENALITE_RETENUE': 'Pénalité retenue',
      'AUTRE': 'Autre'
    };
    return natureMap[nature || 'AUTRE'] || nature || 'Autre';
  };

  const formatAmount = (amount: number) => {
    const formatted = Math.abs(amount).toLocaleString('fr-FR');
    return amount >= 0 ? `+€${formatted}` : `-€${formatted}`;
  };

  // Formater les données pour l'affichage simple
  const formattedTransactions = recentTransactions.map(transaction => ({
    id: transaction.id,
    type: getNatureLabel(transaction.nature),
    Property: transaction.Property?.name || '-',
    tenant: transaction.lease?.Tenant ? `${transaction.lease.Tenant.firstName} ${transaction.lease.Tenant.lastName}` : '-',
    amount: formatAmount(transaction.amount),
    status: transaction.paidAt ? 'Payé' : 'En attente',
    date: new Date(transaction.date).toLocaleDateString('fr-FR')
  }));

  const transactionColumns = [
    { key: 'type', header: 'Type' },
    { key: 'property', header: 'Bien' },
    { key: 'tenant', header: 'Locataire' },
    { key: 'amount', header: 'Montant' },
    { key: 'status', header: 'Statut' },
    { key: 'date', header: 'Date' }
  ];

  function TaskCard({ task }: { task: typeof upcomingTasks[0] }) {
    const priorityColors = {
      high: 'border-danger-200 bg-danger-50',
      medium: 'border-warning-200 bg-warning-50',
      low: 'border-success-200 bg-success-50'
    };

    const priorityLabels = {
      high: 'Urgent',
      medium: 'Moyen',
      low: 'Faible'
    };

    const typeIcons = {
      payment: CreditCard,
      report: FileText,
      visit: MapPin,
      lease: FileText,
      document: FileText
    };

    const TypeIcon = typeIcons[task.type as keyof typeof typeIcons] || FileText;

    return (
      <Card className={`border-l-4 hover-lift ${priorityColors[task.priority]}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <TypeIcon className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">{task.title}</p>
                <p className="text-sm text-gray-500">{new Date(task.date).toLocaleDateString('fr-FR')}</p>
              </div>
            </div>
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
              task.priority === 'high' ? 'bg-danger-100 text-danger-800' :
              task.priority === 'medium' ? 'bg-warning-100 text-warning-800' :
              'bg-success-100 text-success-800'
            }`}>
              {priorityLabels[task.priority]}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Vue d'ensemble de votre portefeuille immobilier</p>
        </div>
        <Button>
          <Calendar className="h-4 w-4 mr-2" />
          Nouveau Rendez-vous
        </Button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, index) => (
          <div 
            key={index} 
            className="cursor-pointer"
            onClick={() => handleKpiClick(kpi.clickTarget)}
          >
            <StatCard {...kpi} />
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Transactions */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Transactions Récentes</CardTitle>
              <CardDescription>
                Dernières transactions de votre portefeuille
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ClientDataTable
                data={formattedTransactions}
                columns={transactionColumns}
                hover
                compact
              />
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Tasks */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Tâches à Venir</CardTitle>
              <CardDescription>
                Prochaines échéances et rendez-vous
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcomingTasks.length > 0 ? (
                  upcomingTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">Aucune tâche urgente</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions Rapides</CardTitle>
          <CardDescription>
            Accès direct aux fonctionnalités principales
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/biens/new">
              <Button variant="outline" className="h-20 w-full flex flex-col items-center justify-center gap-2 hover-scale">
                <Building2 className="h-6 w-6" />
                <span className="text-sm">Nouveau Bien</span>
              </Button>
            </Link>
            <Link href="/locataires/new">
              <Button variant="outline" className="h-20 w-full flex flex-col items-center justify-center gap-2 hover-scale">
                <Users className="h-6 w-6" />
                <span className="text-sm">Nouveau Locataire</span>
              </Button>
            </Link>
            <Link href="/documents">
              <Button variant="outline" className="h-20 w-full flex flex-col items-center justify-center gap-2 hover-scale">
                <FileText className="h-6 w-6" />
                <span className="text-sm">Nouveau Document</span>
              </Button>
            </Link>
            <Link href="/transactions/new">
              <Button variant="outline" className="h-20 w-full flex flex-col items-center justify-center gap-2 hover-scale">
                <CreditCard className="h-6 w-6" />
                <span className="text-sm">Nouvelle Transaction</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
