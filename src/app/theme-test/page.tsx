'use client';

import React from 'react';
import { ThemeSwitcher } from '@/ui/components/ThemeSwitcher';
import { ThemeDemo } from '@/ui/components/ThemeDemo';

export default function ThemeTestPage() {
  return (
    <div className="min-h-screen bg-base-100">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold text-base-content mb-8">
          Test des thèmes daisyUI + next-themes
        </h1>
        
        <div className="space-y-8">
          <ThemeSwitcher />
          <ThemeDemo />
        </div>
      </div>
    </div>
  );
}
