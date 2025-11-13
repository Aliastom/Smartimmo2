import React from 'react';
import { getCategoryTone, getCategoryLabel, getCategoryClasses } from '../../utils/transactionCategory';

interface TransactionCategoryBadgeProps {
  category: string;
  className?: string;
}

export default function TransactionCategoryBadge({ category, className = '' }: TransactionCategoryBadgeProps) {
  const tone = getCategoryTone(category);
  const label = getCategoryLabel(category);
  const classes = getCategoryClasses(tone);

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${classes} ${className}`}>
      {label}
    </span>
  );
}

