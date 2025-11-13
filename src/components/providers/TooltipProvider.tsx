'use client';

import { TooltipProvider as RadixTooltipProvider } from '@radix-ui/react-tooltip';

interface TooltipProviderProps {
  children: React.ReactNode;
}

export function TooltipProvider({ children }: TooltipProviderProps) {
  return (
    <RadixTooltipProvider delayDuration={300}>
      {children}
    </RadixTooltipProvider>
  );
}
