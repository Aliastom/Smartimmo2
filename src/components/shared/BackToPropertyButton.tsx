'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

export interface BackToPropertyButtonProps {
  propertyId: string;
  propertyName?: string;
  className?: string;
}

export function BackToPropertyButton({ 
  propertyId, 
  propertyName,
  className 
}: BackToPropertyButtonProps) {
  return (
    <Link href="/biens">
      <Button
        variant="outline"
        className={cn('flex items-center gap-1.5 whitespace-nowrap', className)}
        aria-label="Retour à la liste des biens"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Liste des biens</span>
      </Button>
    </Link>
  );
}

