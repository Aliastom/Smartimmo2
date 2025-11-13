import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  color?: 'primary' | 'success' | 'danger' | 'warning';
}

const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  change,
  trend = 'neutral',
  icon,
  color = 'primary',
}) => {
  const trendIcon =
    trend === 'up' ? (
      <TrendingUp size={16} className="text-success-700" />
    ) : trend === 'down' ? (
      <TrendingDown size={16} className="text-danger-700" />
    ) : (
      <Minus size={16} className="text-neutral-500" />
    );

  const changeColorClass =
    trend === 'up'
      ? 'text-success-700'
      : trend === 'down'
      ? 'text-danger-700'
      : 'text-neutral-500';

  const cardColorClass = {
    primary: 'bg-primary-100 text-primary-900',
    success: 'bg-success-100 text-success-800',
    danger: 'bg-danger-100 text-danger-700',
    warning: 'bg-warning-600 text-base-100',
  }[color];

  return (
    <div className={`rounded-lg shadow-card p-6 flex items-center justify-between hover-float ${cardColorClass}`}>
      <div>
        <p className="text-sm font-medium text-neutral-700">{title}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
        {change && (
          <div className="flex items-center mt-2 text-sm">
            {trendIcon}
            <span className={`ml-1 ${changeColorClass}`}>{change}</span>
          </div>
        )}
      </div>
      {icon && <div className="text-primary-700 opacity-70">{icon}</div>}
    </div>
  );
};

export default KpiCard;
