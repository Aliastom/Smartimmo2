'use client';

import React from 'react';
import { Button, type ButtonProps } from '@/components/ui/Button';

/**
 * Submit « enregistrer / créer » (persistance métier standard).
 * Pour archivage, suppression définitive, fusion destructive, etc., utiliser {@link DangerSubmitActionStandard}.
 */
export interface SaveActionStandardProps extends Omit<ButtonProps, 'loading' | 'children' | 'variant'> {
  mode?: 'create' | 'edit';
  isLoading?: boolean;
  labelCreate?: string;
  labelEdit?: string;
  loadingLabel?: string;
}

export function SaveActionStandard({
  mode = 'edit',
  isLoading = false,
  disabled,
  labelCreate = 'Créer',
  labelEdit = 'Enregistrer',
  loadingLabel = 'Enregistrement...',
  ...props
}: SaveActionStandardProps) {
  const label = isLoading ? loadingLabel : mode === 'create' ? labelCreate : labelEdit;

  return (
    <Button
      variant="primary"
      loading={isLoading}
      disabled={disabled || isLoading}
      {...props}
    >
      {label}
    </Button>
  );
}

