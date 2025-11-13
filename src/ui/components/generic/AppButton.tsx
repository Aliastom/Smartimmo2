'use client';

import React from 'react';
import { 
  BtnPrimary, 
  BtnSecondary, 
  BtnAccent, 
  BtnGhost, 
  BtnOutline, 
  BtnLink,
  Focus,
  combineClasses 
} from '@/ui/tokens';

interface AppButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'outline' | 'link';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  'aria-label'?: string;
}

export function AppButton({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  onClick,
  type = 'button',
  'aria-label': ariaLabel
}: AppButtonProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case 'secondary':
        return BtnSecondary;
      case 'accent':
        return BtnAccent;
      case 'ghost':
        return BtnGhost;
      case 'outline':
        return BtnOutline;
      case 'link':
        return BtnLink;
      default:
        return BtnPrimary;
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'xs':
        return 'btn-xs';
      case 'sm':
        return 'btn-sm';
      case 'lg':
        return 'btn-lg';
      default:
        return 'btn-md';
    }
  };

  return (
    <button
      type={type}
      className={combineClasses(
        getVariantClasses(),
        getSizeClasses(),
        Focus,
        className
      )}
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={ariaLabel}
    >
      {loading ? (
        <>
          <span className="loading loading-spinner loading-sm"></span>
          Chargement...
        </>
      ) : (
        children
      )}
    </button>
  );
}
