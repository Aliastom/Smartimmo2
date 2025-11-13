'use client';

import React from 'react';
import { cn } from '@/utils/cn';

interface MiniRadialProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: 'success' | 'warning' | 'error' | 'info';
  className?: string;
  label?: string;
}

const colorClasses = {
  success: 'stroke-success',
  warning: 'stroke-warning',
  error: 'stroke-error',
  info: 'stroke-info'
};

export function MiniRadial({
  percentage,
  size = 60,
  strokeWidth = 6,
  color = 'success',
  className,
  label
}: MiniRadialProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <div className="relative">
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            className="text-base-300"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            className={cn('transition-all duration-500', colorClasses[color])}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-base-content">
            {Math.round(percentage)}%
          </span>
        </div>
      </div>
      {label && (
        <span className="text-xs text-base-content/70 text-center">
          {label}
        </span>
      )}
    </div>
  );
}
