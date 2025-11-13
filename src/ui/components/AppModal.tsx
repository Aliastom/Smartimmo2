'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/utils/cn';
import { X } from 'lucide-react';

interface AppModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnBackdrop?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-7xl',
};

export function AppModal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  className = '',
}: AppModalProps) {
  // Gestion de l'escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Empêcher le scroll du body
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
  };

  const animationVariants = {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.96 },
  };

  const transition = {
    duration: 0.18,
    ease: [0.4, 0, 0.2, 1],
  };

  // Respecter prefers-reduced-motion
  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal modal-open">
          {/* Backdrop */}
          <motion.div
            className="modal-backdrop bg-base-300 backdrop-blur-sm"
            style={{ opacity: 0.4 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.15 }}
            onClick={handleBackdropClick}
          />
          
          {/* Modal Box */}
          <motion.div
            className={cn(
              'modal-box bg-base-100 text-base-content border border-base-300 shadow-xl',
              sizeClasses[size],
              className
            )}
            variants={prefersReducedMotion ? {} : animationVariants}
            initial={prefersReducedMotion ? {} : "initial"}
            animate={prefersReducedMotion ? {} : "animate"}
            exit={prefersReducedMotion ? {} : "exit"}
            transition={prefersReducedMotion ? { duration: 0 } : transition}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
          >
            {/* Header */}
            {(title || closeOnBackdrop) && (
              <div className="flex items-center justify-between mb-4">
                {title && (
                  <h3 
                    id="modal-title"
                    className="text-lg font-semibold text-base-content"
                  >
                    {title}
                  </h3>
                )}
                {closeOnBackdrop && (
                  <button
                    onClick={onClose}
                    className="btn btn-ghost btn-sm btn-circle focus-ring"
                    aria-label="Fermer la modale"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Body */}
            <div className="modal-body">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="modal-action">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// Composant pour les boutons de footer standard
interface ModalFooterProps {
  onCancel?: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error';
  loading?: boolean;
  children?: React.ReactNode;
}

export function ModalFooter({
  onCancel,
  onConfirm,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  confirmVariant = 'primary',
  loading = false,
  children,
}: ModalFooterProps) {
  if (children) {
    return <div className="flex justify-end gap-2">{children}</div>;
  }

  return (
    <div className="flex justify-end gap-2">
      {onCancel && (
        <button
          onClick={onCancel}
          className="btn btn-ghost focus-ring"
          disabled={loading}
        >
          {cancelText}
        </button>
      )}
      {onConfirm && (
        <button
          onClick={onConfirm}
          className={cn('btn focus-ring', `btn-${confirmVariant}`)}
          disabled={loading}
        >
          {loading && <span className="loading loading-spinner loading-sm"></span>}
          {confirmText}
        </button>
      )}
    </div>
  );
}
