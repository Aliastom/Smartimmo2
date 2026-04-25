'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/utils/cn';
import { ActionFooterStandard, DrawerHeaderStandard } from '@/components/ui/standards';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Si true, le footer n’est pas enveloppé dans ActionFooterStandard (ex. contenu déjà fourni par FormShellStandardFooter). */
  footerAlreadyStandardized?: boolean;
  side?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  noPadding?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'w-80',
  md: 'w-96',
  lg: 'w-[28rem]',
  xl: 'w-[32rem]',
  '2xl': 'w-full max-w-2xl',
  full: 'w-full max-w-none',
};

export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  footer,
  side = 'right',
  size = 'md',
  closeOnBackdropClick = true,
  closeOnEscape = true,
  noPadding = false,
  className,
  footerAlreadyStandardized = false,
}: DrawerProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, closeOnEscape, onClose]);

  if (typeof window === 'undefined') return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnBackdropClick) {
      onClose();
    }
  };

  const slideVariants = {
    initial: {
      x: side === 'right' ? '100%' : '-100%',
    },
    animate: {
      x: 0,
    },
    exit: {
      x: side === 'right' ? '100%' : '-100%',
    },
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleBackdropClick}
          />

          {/* Drawer */}
          <motion.div
            className={cn(
              "relative h-full bg-white shadow-soft-lg border border-gray-200 flex flex-col",
              sizeClasses[size],
              side === 'left' ? 'border-r' : 'border-l ml-auto',
              className
            )}
            variants={slideVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'drawer-title' : undefined}
          >
            {/* Header - affiché uniquement si un titre est fourni */}
            {title && (
              <DrawerHeaderStandard
                title={title}
                titleId="drawer-title"
                onClose={onClose}
              />
            )}

            {/* Body */}
            <div className={cn(
              "flex-1 overflow-y-auto",
              !noPadding && "p-6"
            )}>
              {children}
            </div>

            {/* Footer */}
            {footer &&
              (footerAlreadyStandardized ? (
                <div className="flex-shrink-0 overflow-hidden">{footer}</div>
              ) : (
                <ActionFooterStandard className="flex-shrink-0">{footer}</ActionFooterStandard>
              ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
