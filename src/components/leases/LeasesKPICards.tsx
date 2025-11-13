'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { 
  FileText, 
  Building2, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Edit,
  FileSignature,
  Calendar,
  Shield
} from 'lucide-react';

export interface LeaseKPIs {
  total: number;
  active: number;
  toSign: number;
  expiringIn90Days: number;
  terminated: number;
  draft: number;
  signed: number;
  missingDocuments: number;
  indexationDue: number;
}

interface LeasesKPICardsProps {
  kpis: LeaseKPIs;
  onFilterChange?: (filter: string, value: any) => void;
  loading?: boolean;
}

interface KPICardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'secondary';
  badge?: string;
  onClick?: () => void;
  loading?: boolean;
}

function KPICard({ title, value, icon, color, badge, onClick, loading }: KPICardProps) {
  const colorClasses = {
    primary: 'bg-blue-50 border-blue-200 text-blue-700',
    success: 'bg-green-50 border-green-200 text-green-700',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    danger: 'bg-red-50 border-red-200 text-red-700',
    info: 'bg-cyan-50 border-cyan-200 text-cyan-700',
    secondary: 'bg-gray-50 border-gray-200 text-gray-700'
  };

  const iconColorClasses = {
    primary: 'text-blue-600',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    danger: 'text-red-600',
    info: 'text-cyan-600',
    secondary: 'text-gray-600'
  };

  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 hover:shadow-md ${onClick ? 'hover:scale-105' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-gray-600">
            {title}
          </CardTitle>
          {badge && (
            <Badge variant="outline" className="text-xs">
              {badge}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className={`text-2xl font-bold ${colorClasses[color]}`}>
            {loading ? '...' : value.toLocaleString()}
          </div>
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            <div className={`h-5 w-5 ${iconColorClasses[color]}`}>
              {icon}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function LeasesKPICards({ kpis, onFilterChange, loading = false }: LeasesKPICardsProps) {
  const handleCardClick = (filterType: string, filterValue: any) => {
    if (onFilterChange) {
      onFilterChange(filterType, filterValue);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
      {/* Total Baux */}
      <KPICard
        title="Total Baux"
        value={kpis.total}
        icon={<FileText className="h-5 w-5" />}
        color="primary"
        onClick={() => handleCardClick('status', [])}
        loading={loading}
      />

      {/* Baux Actifs */}
      <KPICard
        title="Baux Actifs"
        value={kpis.active}
        icon={<CheckCircle className="h-5 w-5" />}
        color="success"
        badge="En cours"
        onClick={() => handleCardClick('status', ['ACTIF'])}
        loading={loading}
      />

      {/* Baux à Signer */}
      <KPICard
        title="À Signer"
        value={kpis.toSign}
        icon={<FileSignature className="h-5 w-5" />}
        color="warning"
        badge="ENVOYÉ"
        onClick={() => handleCardClick('status', ['ENVOYÉ'])}
        loading={loading}
      />

      {/* Baux Expirant */}
      <KPICard
        title="Expirant < 90j"
        value={kpis.expiringIn90Days}
        icon={<Calendar className="h-5 w-5" />}
        color="danger"
        badge="Urgent"
        onClick={() => handleCardClick('upcomingExpiration', true)}
        loading={loading}
      />

      {/* Baux Résiliés */}
      <KPICard
        title="Résiliés"
        value={kpis.terminated}
        icon={<XCircle className="h-5 w-5" />}
        color="secondary"
        onClick={() => handleCardClick('status', ['RÉSILIÉ'])}
        loading={loading}
      />

      {/* Brouillons */}
      <KPICard
        title="Brouillons"
        value={kpis.draft}
        icon={<Edit className="h-5 w-5" />}
        color="info"
        onClick={() => handleCardClick('status', ['BROUILLON'])}
        loading={loading}
      />

      {/* Signés */}
      <KPICard
        title="Signés"
        value={kpis.signed}
        icon={<Shield className="h-5 w-5" />}
        color="info"
        onClick={() => handleCardClick('status', ['SIGNÉ'])}
        loading={loading}
      />

      {/* Sans Documents */}
      <KPICard
        title="Sans Bail Signé"
        value={kpis.missingDocuments}
        icon={<AlertTriangle className="h-5 w-5" />}
        color="warning"
        badge="⚠️"
        onClick={() => handleCardClick('missingDocuments', true)}
        loading={loading}
      />

      {/* Indexation Due */}
      <KPICard
        title="Indexation Due"
        value={kpis.indexationDue}
        icon={<Clock className="h-5 w-5" />}
        color="warning"
        badge="📈"
        onClick={() => handleCardClick('indexationDue', true)}
        loading={loading}
      />
    </div>
  );
}

// Composant pour afficher les KPIs en mode compact (pour les petits écrans)
export function LeasesKPICardsCompact({ kpis, onFilterChange, loading = false }: LeasesKPICardsProps) {
  const handleCardClick = (filterType: string, filterValue: any) => {
    if (onFilterChange) {
      onFilterChange(filterType, filterValue);
    }
  };

  const kpiItems = [
    { title: 'Total', value: kpis.total, color: 'primary', icon: <FileText className="h-4 w-4" />, onClick: () => handleCardClick('status', []) },
    { title: 'Actifs', value: kpis.active, color: 'success', icon: <CheckCircle className="h-4 w-4" />, onClick: () => handleCardClick('status', ['ACTIF']) },
    { title: 'À Signer', value: kpis.toSign, color: 'warning', icon: <FileSignature className="h-4 w-4" />, onClick: () => handleCardClick('status', ['ENVOYÉ']) },
    { title: 'Expirant', value: kpis.expiringIn90Days, color: 'danger', icon: <Calendar className="h-4 w-4" />, onClick: () => handleCardClick('upcomingExpiration', true) },
    { title: 'Résiliés', value: kpis.terminated, color: 'secondary', icon: <XCircle className="h-4 w-4" />, onClick: () => handleCardClick('status', ['RÉSILIÉ']) }
  ];

  return (
    <div className="grid grid-cols-5 gap-2 mb-4">
      {kpiItems.map((item, index) => (
        <Card 
          key={index}
          className="cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105"
          onClick={item.onClick}
        >
          <CardContent className="p-3">
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">
                {loading ? '...' : item.value}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {item.title}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
