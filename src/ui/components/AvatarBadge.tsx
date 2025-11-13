import React from 'react';
import { cn } from '@/utils/cn';

interface AvatarBadgeProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  text?: string;
  imgSrc?: string;
  ring?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[9px]',
  sm: 'w-8 h-8 text-[13px]',
  md: 'w-10 h-10 text-[16px]',
  lg: 'w-12 h-12 text-[20px]',
};

export function AvatarBadge({
  size = 'sm',
  text,
  imgSrc,
  ring = true,
  className,
}: AvatarBadgeProps) {
  const sizeClass = sizeClasses[size];

  return (
    <div className="avatar">
      {imgSrc ? (
        <img
          className="rounded-full"
          src={imgSrc}
          alt={text ? `Avatar de ${text}` : 'Avatar utilisateur'}
        />
      ) : (
        <div
          className={cn(
            'rounded-full bg-primary text-primary-content flex items-center justify-center font-semibold select-none',
            'leading-[1]', // Line-height de 1 pour un centrage parfait
            sizeClass,
            ring && 'ring ring-primary/30 ring-offset-2 ring-offset-base-100',
            className
          )}
          style={{ 
            lineHeight: '1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center'
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
}
