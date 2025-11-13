'use client';

import React from 'react';
import { cn } from '@/utils/cn';

interface MiniDonutProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: 'success' | 'warning' | 'error';
  className?: string;
}

const colorClasses = {
  success: 'stroke-success',
  warning: 'stroke-warning', 
  error: 'stroke-error'
};

export function MiniDonut({
  percentage,
  size = 40,
  strokeWidth = 4,
  color = 'success',
  className
}: MiniDonutProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn('flex items-center justify-center', className)}>
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
          className={cn('transition-all duration-300', colorClasses[color])}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-xs font-semibold text-base-content">
        {Math.round(percentage)}%
      </span>
    </div>
  );
}
