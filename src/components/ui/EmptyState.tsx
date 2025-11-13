'use client';

import React from 'react';
import { cn } from '@/utils/cn';

import { 
  Building2, 
  Users, 
  FileText, 
  CreditCard, 
  Search, 
  Inbox, 
  FolderOpen, 
  Package 
} from 'lucide-react';

const iconMap = {
  Building2,
  Users,
  FileText,
  CreditCard,
  Search,
  Inbox,
  FolderOpen,
  Package,
};

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ 
  icon = 'Inbox',
  title, 
  description, 
  action, 
  className 
}: EmptyStateProps) {
  const Icon = iconMap[icon as keyof typeof iconMap] || Inbox;

  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-6 text-center",
      className
    )}>
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-4">
        <Icon className="h-8 w-8" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-gray-600 mb-6 max-w-sm">{description}</p>
      )}
      {action && (
        <div>{action}</div>
      )}
    </div>
  );
}
