/**
 * KpiCard - Carte de KPI réutilisable
 * 
 * Affiche une valeur principale avec titre, sous-légende et variation optionnelle
 */

'use client';

import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ReactNode } from 'react';

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  variation?: {
    value: number;
    label?: string;
  };
  icon?: ReactNode;
  valueColor?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function KpiCard({
  title,
  value,
  subtitle,
  variation,
  icon,
  valueColor = 'text-gray-900',
  size = 'md',
  className = '',
}: KpiCardProps) {
  const sizeClasses = {
    sm: 'text-xl',
    md: 'text-3xl',
    lg: 'text-4xl',
  };

  const getVariationColor = (val: number) => {
    if (val > 0) return 'text-emerald-600 bg-emerald-50';
    if (val < 0) return 'text-rose-600 bg-rose-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getVariationIcon = (val: number) => {
    if (val > 0) return <TrendingUp className="h-3 w-3" />;
    if (val < 0) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  return (
    <Card className={`border-gray-200 shadow-sm hover:shadow-md transition-shadow ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Titre (sr-only pour accessibilité) */}
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              {title}
            </p>

            {/* Valeur principale */}
            <div className="flex items-baseline gap-2">
              <p className={`font-bold ${sizeClasses[size]} ${valueColor} tracking-tight`}>
                {value}
              </p>
              
              {/* Variation optionnelle */}
              {variation && (
                <Badge 
                  variant="outline" 
                  className={`${getVariationColor(variation.value)} border-0 text-xs font-semibold flex items-center gap-0.5`}
                >
                  {getVariationIcon(variation.value)}
                  {Math.abs(variation.value).toFixed(1)}%
                  {variation.label && ` ${variation.label}`}
                </Badge>
              )}
            </div>

            {/* Sous-légende */}
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>

          {/* Icône optionnelle */}
          {icon && (
            <div className="ml-3 text-gray-400">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

