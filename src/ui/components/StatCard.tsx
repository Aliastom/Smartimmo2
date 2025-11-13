'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  onClick?: () => void;
  isLoading?: boolean;
  'aria-label'?: string;
  className?: string;
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-primary',
  iconBgColor = 'bg-blue-100',
  onClick,
  isLoading = false,
  'aria-label': ariaLabel,
  className = '',
}: StatCardProps) {
  const isClickable = !!onClick;

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick?.();
    }
  };

  if (isLoading) {
    return (
      <div className="bg-base-100 rounded-lg border border-neutral-200 p-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="h-4 bg-neutral-200 rounded w-24 mb-3"></div>
            <div className="h-8 bg-neutral-200 rounded w-16 mb-2"></div>
            <div className="h-3 bg-neutral-200 rounded w-32"></div>
          </div>
          <div className={`w-12 h-12 ${iconBgColor} rounded-lg`}></div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-base-100 rounded-lg border border-neutral-200 p-6 ${
        isClickable
          ? 'cursor-pointer card-interactive focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
          : 'hover-float'
      } motion-safe:transition-all motion-reduce:transition-none ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={isClickable ? 0 : undefined}
      role={isClickable ? 'button' : undefined}
      aria-label={ariaLabel || `${title}: ${value}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-neutral-600 mb-2">{title}</p>
          <p className="text-2xl font-bold text-neutral-900 mb-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-neutral-500">{subtitle}</p>
          )}
        </div>
        <div className={`flex items-center justify-center w-12 h-12 ${iconBgColor} rounded-lg flex-shrink-0 ml-4`}>
          <Icon className={iconColor} size={24} />
        </div>
      </div>
    </div>
  );
}

