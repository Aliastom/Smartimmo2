import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <div className="mx-auto w-24 h-24 bg-base-200 rounded-full flex items-center justify-center mb-4">
        <Icon size={32} className="text-base-content opacity-60" />
      </div>
      <h3 className="text-lg font-medium text-base-content mb-2">{title}</h3>
      <p className="text-base-content opacity-70 mb-6 max-w-sm mx-auto">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="bg-primary-700 text-base-100 px-4 py-2 rounded-md shadow-md hover:bg-primary-800 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
