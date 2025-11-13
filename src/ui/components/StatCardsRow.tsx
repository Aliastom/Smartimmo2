'use client';

import React from 'react';

interface StatCardsRowProps {
  children: React.ReactNode;
  className?: string;
}

export default function StatCardsRow({ children, className = '' }: StatCardsRowProps) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 ${className}`}>
      {children}
    </div>
  );
}

