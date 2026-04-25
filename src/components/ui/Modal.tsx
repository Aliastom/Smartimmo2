'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/utils/cn';
import { ActionFooterStandard, ModalHeaderStandard } from '@/components/ui/standards';
// ⚠️ IMPORT: cn est déjà importé, utilisé pour les classes conditionnelles

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  showCloseButton?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  footerAlreadyStandardized?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: 'max-w-sm',
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-5xl', // ✅ Augmenté de 4xl à 5xl pour plus d'espace
  full: 'max-w-full mx-4',
};

export function Modal({
  isOpen,
  onClose,
  title,
  showCloseButton = true,
  children,
  footer,
  footerAlreadyStandardized = false,
  size = 'md',
  closeOnBackdropClick = true,
  closeOnEscape = true,
  className,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape) {
        onClose();
      }
    };

    // Sauvegarder la position de scroll actuelle
    const scrollY = window.scrollY;
    
    // Bloquer le scroll du body de manière agressive pour iOS
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    
    // Empêcher le scroll du body et du backdrop sur iOS
    const preventBodyScroll = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      // Si on touche le backdrop ou le container principal (pas le contenu scrollable), empêcher
      if (!target.closest('.modal-scrollable-content')) {
        e.preventDefault();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('touchmove', preventBodyScroll, { passive: false });

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('touchmove', preventBodyScroll);
      
      // Restaurer le scroll
      document.body.classList.remove('modal-open');
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, [isOpen, closeOnEscape, onClose]);

  if (typeof window === 'undefined') return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && closeOnBackdropClick) {
      onClose();
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-3 md:p-4"
          style={{ touchAction: 'none' }} // Empêche le drag sur iOS
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onTouchStart={(e) => {
            // Empêche la propagation du touch au backdrop
            if (e.target !== e.currentTarget) {
              e.stopPropagation();
            }
          }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            style={{ touchAction: 'none' }} // Empêche le drag sur iOS
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleBackdropClick}
            onTouchStart={(e) => {
              // Si on touche le backdrop, fermer la modal
              if (e.target === e.currentTarget && closeOnBackdropClick) {
                onClose();
              }
            }}
          />

          {/* Modal - Mobile: quasi plein écran avec cadre, Desktop: centré */}
          <motion.div
            className={cn(
              "relative bg-white rounded-2xl shadow-2xl border border-gray-200 md:border-base-200 flex flex-col",
              // Mobile: quasi full-screen avec marges
              "w-[calc(100vw-24px)] h-[calc(100dvh-24px)]",
              // Desktop: taille adaptative selon size prop (xl = max-w-5xl)
              "md:w-auto md:h-auto md:max-h-[85vh]",
              // ⚠️ CORRECTION: En desktop, utiliser sizeClasses[size] au lieu de max-w-full pour éviter les modales trop larges
              // Si className contient déjà max-w-*, il prendra la priorité
              sizeClasses[size],
              "overflow-hidden", // ⚠️ CRITIQUE: Forcer overflow-hidden sur le container principal pour éviter les débordements
              className
            )}
            style={{ 
              borderRadius: '1rem', // ⚠️ CORRECTION: Forcer rounded-2xl (1rem) partout pour éviter les angles carrés
              display: 'flex',
              flexDirection: 'column',
              touchAction: 'none', // Empêche le drag sur iOS
              overflow: 'hidden' // ⚠️ CRITIQUE: Double protection - overflow hidden pour éviter les angles carrés
            }}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
            onTouchStart={(e) => e.stopPropagation()} // Empêche la propagation du touch
          >
            {/* Header */}
            <ModalHeaderStandard
              title={title}
              titleId="modal-title"
              onClose={onClose}
              showCloseButton={showCloseButton}
            />

            {/* Body - Scrollable avec safe areas iOS */}
            <div 
              className="p-4 md:p-6 overflow-y-auto flex-1 modal-scrollable-content bg-white min-h-0"
              style={{ 
                minHeight: 0,
                WebkitOverflowScrolling: 'touch',
                overflowY: 'auto',
                overflowX: 'hidden',
                touchAction: 'pan-y', // Permet uniquement le scroll vertical
                overscrollBehavior: 'contain', // Empêche le scroll de se propager
                // ⚠️ CRITIQUE: S'assurer que le body ne crée pas de débordement visuel
                borderRadius: '0' // Pas de radius sur le body, le parent gère les coins arrondis
              }}
            >
              {children}
            </div>

            {/* Footer - Sticky avec safe-area iOS */}
            {footer && (
              footerAlreadyStandardized ? (
                <div className="flex-shrink-0 rounded-b-2xl overflow-hidden">
                  {footer}
                </div>
              ) : (
                <ActionFooterStandard
                  className="flex-shrink-0 rounded-b-2xl overflow-hidden"
                  stickyMobile={false}
                >
                  {footer}
                </ActionFooterStandard>
              )
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
