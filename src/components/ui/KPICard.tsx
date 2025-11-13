'use client';

import React from 'react';
import { cn } from '@/utils/cn';
import { Card, CardContent } from './Card';
import { TrendingUp, TrendingDown, Minus, Building2, Users, DollarSign, FileText, Calendar, MapPin, AlertCircle, Activity, FileCheck, Percent } from 'lucide-react';

export interface KPICardProps {
  title: string;
  value: string | number;
  iconName: string;
  trend?: {
    value: number;
    label: string;
    period?: string;
  };
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'gray';
  className?: string;
}

const iconMap = {
  Building2,
  Users,
  DollarSign,
  FileText,
  Calendar,
  MapPin,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  FileCheck,
  Percent,
};

const colorClasses = {
  primary: {
    icon: 'bg-primary-100 text-primary-600',
    trend: 'text-primary-600',
    trendBg: 'bg-primary-50',
  },
  success: {
    icon: 'bg-success-100 text-success-600',
    trend: 'text-success-600',
    trendBg: 'bg-success-50',
  },
  warning: {
    icon: 'bg-warning-100 text-warning-600',
    trend: 'text-warning-600',
    trendBg: 'bg-warning-50',
  },
  danger: {
    icon: 'bg-danger-100 text-danger-600',
    trend: 'text-danger-600',
    trendBg: 'bg-danger-50',
  },
  gray: {
    icon: 'bg-gray-100 text-gray-600',
    trend: 'text-gray-600',
    trendBg: 'bg-gray-50',
  },
};

export function KPICard({ 
  title, 
  value, 
  iconName, 
  trend, 
  color = 'primary',
  className 
}: KPICardProps) {
  const Icon = iconMap[iconName as keyof typeof iconMap];
  const colors = colorClasses[color];

  const getTrendIcon = () => {
    if (!trend) return null;
    
    if (trend.value > 0) {
      return <TrendingUp className="h-4 w-4" />;
    } else if (trend.value < 0) {
      return <TrendingDown className="h-4 w-4" />;
    } else {
      return <Minus className="h-4 w-4" />;
    }
  };

  const getTrendColor = () => {
    if (!trend) return 'text-gray-500';
    
    if (trend.value > 0) {
      return 'text-success-600';
    } else if (trend.value < 0) {
      return 'text-danger-600';
    } else {
      return 'text-gray-500';
    }
  };

  return (
    <Card hover className={cn("h-full", className)}>
      <CardContent className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mb-2">{value}</p>
          
          {trend && (
            <div className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
              colors.trendBg,
              getTrendColor()
            )}>
              {getTrendIcon()}
              <span>{Math.abs(trend.value)}%</span>
              <span className="text-gray-500">{trend.label}</span>
              {trend.period && (
                <span className="text-gray-400">• {trend.period}</span>
              )}
            </div>
          )}
        </div>
        
        <div className={cn(
          "flex items-center justify-center w-12 h-12 rounded-2xl",
          colors.icon
        )}>
          <Icon className="h-6 w-6" />
        </div>
      </CardContent>
    </Card>
  );
}
