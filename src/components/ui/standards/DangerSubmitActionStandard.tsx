'use client';

import React from 'react';
import { Button, type ButtonProps } from '@/components/ui/Button';

/**
 * Bouton submit pour actions à fort impact (archivage, fusion, suppression définitive, etc.).
 * Ne pas utiliser {@link SaveActionStandard} pour ces flux : réservé à la persistance type création / édition.
 */
export interface DangerSubmitActionStandardProps
  extends Omit<ButtonProps, 'loading' | 'children' | 'variant'> {
  isLoading?: boolean;
  /** Libellé affiché quand `isLoading` est faux */
  label: string;
  loadingLabel?: string;
  /**
   * `danger` par défaut (suppression, fusion irréversible).
   * `primary` pour un submit à fort impact mais recommandé (ex. archivage dans une même modale).
   */
  visualVariant?: Extract<ButtonProps['variant'], 'danger' | 'primary' | 'success'>;
}

export function DangerSubmitActionStandard({
  isLoading = false,
  disabled,
  label,
  loadingLabel = 'Traitement...',
  visualVariant = 'danger',
  ...props
}: DangerSubmitActionStandardProps) {
  const text = isLoading ? loadingLabel : label;

  return (
    <Button
      variant={visualVariant}
      loading={isLoading}
      disabled={disabled || isLoading}
      {...props}
    >
      {text}
    </Button>
  );
}
