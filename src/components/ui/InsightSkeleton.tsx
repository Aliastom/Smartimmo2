'use client';

import React from 'react';
import { cn } from '@/utils/cn';

interface InsightSkeletonProps {
  className?: string;
}

export function InsightSkeleton({ className }: InsightSkeletonProps) {
  return (
    <div className={cn(
      'w-full h-12 md:h-11 rounded-xl bg-base-300/40 animate-pulse',
      className
    )} />
  );
}

export function InsightBarSkeleton() {
  return (
    <div className="flex flex-wrap gap-2 items-stretch sticky top-0 z-10 bg-base-100/80 backdrop-blur border-b border-base-300 p-4 min-h-[50px]">
      <InsightSkeleton />
      <InsightSkeleton />
      <InsightSkeleton />
      <InsightSkeleton />
    </div>
  );
}
