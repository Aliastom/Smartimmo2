'use client';

import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/utils/cn';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-2xl font-medium transition-all duration-150 ease-out focus-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 shadow-soft hover:shadow-soft-lg",
        ghost: "text-gray-700 hover:bg-gray-100 active:bg-gray-200",
        soft: "bg-primary-50 text-primary-600 hover:bg-primary-100 active:bg-primary-200",
        success: "bg-success-500 text-white hover:bg-success-600 active:bg-success-700 shadow-soft hover:shadow-soft-lg",
        warning: "bg-warning-500 text-white hover:bg-warning-600 active:bg-warning-700 shadow-soft hover:shadow-soft-lg",
        danger: "bg-danger-500 text-white hover:bg-danger-600 active:bg-danger-700 shadow-soft hover:shadow-soft-lg",
        outline: "border border-gray-300 text-gray-700 hover:bg-gray-50 active:bg-gray-100",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        xl: "h-14 px-8 text-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    asChild = false, 
    loading = false,
    disabled,
    children,
    ...props 
  }, ref) => {
    const isDisabled = disabled || loading;
    const Comp = asChild ? Slot : "button";

    // Si asChild est true, on ne peut pas ajouter d'éléments supplémentaires
    // car Slot attend un seul enfant
    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          disabled={isDisabled}
          ref={ref}
          {...props}
        >
          {children}
        </Comp>
      );
    }

    // Si asChild est false, on peut gérer le loading spinner
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={isDisabled}
        ref={ref}
        {...props}
      >
        {loading && (
          <svg
            className="mr-2 h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </Comp>
    );
  }
);

Button.displayName = "Button";

export { Button };
