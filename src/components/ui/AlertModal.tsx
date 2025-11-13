'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AlertCircle, AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

export type AlertType = 'info' | 'success' | 'warning' | 'error';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: AlertType;
  confirmLabel?: string;
}

const alertConfig = {
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-900',
    iconColor: 'text-blue-600',
  },
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-900',
    iconColor: 'text-green-600',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-900',
    iconColor: 'text-yellow-600',
  },
  error: {
    icon: XCircle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-900',
    iconColor: 'text-red-600',
  },
};

export function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  confirmLabel = 'OK',
}: AlertModalProps) {
  const config = alertConfig[type];
  const Icon = config.icon;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || (type === 'error' ? 'Erreur' : type === 'warning' ? 'Attention' : type === 'success' ? 'Succès' : 'Information')}
      size="sm"
    >
      <div className="space-y-4">
        <div className={cn(
          'flex items-start gap-3 p-4 rounded-lg border',
          config.bgColor,
          config.borderColor
        )}>
          <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', config.iconColor)} />
          <div className="flex-1">
            <p className={cn('text-sm whitespace-pre-wrap', config.textColor)}>
              {message}
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={onClose} variant="primary">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
