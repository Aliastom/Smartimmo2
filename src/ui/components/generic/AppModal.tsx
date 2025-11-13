'use client';

import React from 'react';
import { 
  Modal, 
  ModalBox, 
  ModalHeader, 
  ModalFooter,
  BtnPrimary,
  BtnGhost,
  Focus,
  combineClasses 
} from '@/ui/tokens';

interface AppModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  primaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function AppModal({
  isOpen,
  onClose,
  title,
  children,
  primaryAction,
  secondaryAction,
  size = 'md',
  className = ''
}: AppModalProps) {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl'
  };

  return (
    <div className={Modal}>
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className={combineClasses(ModalBox, sizeClasses[size], className)}>
        {/* Header */}
        {title && (
          <div className={ModalHeader}>
            <h3 className="text-lg font-semibold">{title}</h3>
            <button
              className="btn btn-sm btn-circle btn-ghost ml-auto"
              onClick={onClose}
              aria-label="Fermer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="py-4">
          {children}
        </div>

        {/* Footer */}
        {(primaryAction || secondaryAction) && (
          <div className={ModalFooter}>
            {secondaryAction && (
              <button
                className={combineClasses(BtnGhost, Focus)}
                onClick={secondaryAction.onClick}
                disabled={secondaryAction.disabled}
              >
                {secondaryAction.label}
              </button>
            )}
            {primaryAction && (
              <button
                className={combineClasses(BtnPrimary, Focus)}
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled || primaryAction.loading}
              >
                {primaryAction.loading ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Chargement...
                  </>
                ) : (
                  primaryAction.label
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
