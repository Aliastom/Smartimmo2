/**
 * FiscalKPICard - Carte KPI pour le module fiscal
 * 
 * Composant réutilisable pour afficher les métriques fiscales
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FiscalKPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: {
    value: number;
    label: string;
    isPositive?: boolean;
  };
  badge?: {
    text: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
  };
  className?: string;
  onClick?: () => void;
}

export function FiscalKPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-blue-600',
  trend,
  badge,
  className,
  onClick,
}: FiscalKPICardProps) {
  const formattedValue = typeof value === 'number'
    ? new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)
    : value;
  
  return (
    <Card
      className={cn(
        'transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-lg hover:scale-[1.02]',
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">
          {title}
        </CardTitle>
        {Icon && (
          <Icon className={cn('h-5 w-5', iconColor)} />
        )}
      </CardHeader>
      
      <CardContent className="space-y-2">
        <div className="flex items-baseline justify-between">
          <div className="text-2xl font-bold text-gray-900">
            {formattedValue}
          </div>
          
          {badge && (
            <Badge variant={badge.variant || 'default'} className="ml-2">
              {badge.text}
            </Badge>
          )}
        </div>
        
        {subtitle && (
          <p className="text-sm text-gray-500">{subtitle}</p>
        )}
        
        {trend && (
          <div className="flex items-center gap-1 text-sm">
            {trend.value > 0 ? (
              <>
                <TrendingUp className={cn(
                  'h-4 w-4',
                  trend.isPositive ? 'text-green-600' : 'text-red-600'
                )} />
                <span className={cn(
                  'font-medium',
                  trend.isPositive ? 'text-green-600' : 'text-red-600'
                )}>
                  +{trend.value.toFixed(1)}%
                </span>
              </>
            ) : trend.value < 0 ? (
              <>
                <TrendingDown className={cn(
                  'h-4 w-4',
                  trend.isPositive ? 'text-red-600' : 'text-green-600'
                )} />
                <span className={cn(
                  'font-medium',
                  trend.isPositive ? 'text-red-600' : 'text-green-600'
                )}>
                  {trend.value.toFixed(1)}%
                </span>
              </>
            ) : (
              <>
                <Minus className="h-4 w-4 text-gray-500" />
                <span className="font-medium text-gray-500">
                  0%
                </span>
              </>
            )}
            <span className="text-gray-500 ml-1">{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

