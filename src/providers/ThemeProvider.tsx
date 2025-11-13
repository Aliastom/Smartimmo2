'use client';

import React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ThemeProviderProps } from 'next-themes/dist/types';
import { NoSSR } from '@/ui/components/NoSSR';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NoSSR>
      <NextThemesProvider
        attribute="data-theme"
        defaultTheme="smartimmo"
        enableSystem={false}
        disableTransitionOnChange={false}
        storageKey="smartimmo-theme"
        themes={["smartimmo", "smartimmo-warm", "smartimmo-cool", "light", "corporate", "dark"]}
        {...props}
      >
        {children}
      </NextThemesProvider>
    </NoSSR>
  );
}
