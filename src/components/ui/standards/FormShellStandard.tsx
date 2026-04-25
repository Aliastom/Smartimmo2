'use client';

import React from 'react';
import { cn } from '@/utils/cn';
import { Button, type ButtonProps } from '@/components/ui/Button';
import { ActionFooterStandard } from './ActionFooterStandard';
import { SaveActionStandard, type SaveActionStandardProps } from './SaveActionStandard';

export interface FormShellStandardProps {
  id: string;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  children: React.ReactNode;
  className?: string;
}

export function FormShellStandard({
  id,
  onSubmit,
  children,
  className,
}: FormShellStandardProps) {
  return (
    <form id={id} onSubmit={onSubmit} className={className}>
      {children}
    </form>
  );
}

/**
 * Règle footers formulaires (Smartimmo) :
 * - **Défaut** : `FormShellStandardFooter` (annuler + `SaveActionStandard`) pour tout formulaire standard.
 * - **Exceptions autorisées** : footer sticky ; dialog compact sans bandeau standard ; login / page inline ;
 *   footer métier spécifique **validé** explicitement (document / revue).
 */
export interface FormShellStandardFooterProps {
  formId: string;
  onCancel: () => void;
  cancelLabel?: string;
  cancelVariant?: ButtonProps['variant'];
  cancelButtonProps?: Omit<ButtonProps, 'children' | 'variant' | 'type' | 'onClick'>;
  saveActionProps?: Omit<SaveActionStandardProps, 'type' | 'form'>;
  actionsClassName?: string;
  className?: string;
}

export function FormShellStandardFooter({
  formId,
  onCancel,
  cancelLabel = 'Annuler',
  cancelVariant = 'ghost',
  cancelButtonProps,
  saveActionProps,
  actionsClassName,
  className,
}: FormShellStandardFooterProps) {
  return (
    <ActionFooterStandard className={className}>
      <div className={cn('flex gap-3', actionsClassName)}>
        <Button
          variant={cancelVariant}
          type="button"
          onClick={onCancel}
          {...cancelButtonProps}
        >
          {cancelLabel}
        </Button>
        <SaveActionStandard
          type="submit"
          form={formId}
          {...saveActionProps}
        />
      </div>
    </ActionFooterStandard>
  );
}

