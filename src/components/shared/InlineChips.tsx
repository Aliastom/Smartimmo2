'use client';

import React, { useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/utils/cn';
import { Badge } from '@/components/ui/Badge';
import { LucideIcon } from 'lucide-react';

export interface ChipData {
  id: string;
  label: string;
  count: number;
  href: string;
  icon?: React.ReactNode;
  variant?: 'warning' | 'info' | 'success' | 'danger' | 'default';
}

export interface InlineChipsProps {
  chips: ChipData[];
  className?: string;
}

const variantClasses = {
  warning: 'bg-warning-100 text-warning-800 border-warning-200 hover:bg-warning-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200',
  success: 'bg-success-100 text-success-800 border-success-200 hover:bg-success-200',
  danger: 'bg-danger-100 text-danger-800 border-danger-200 hover:bg-danger-200',
  default: 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200',
};

export function InlineChips({ chips, className }: InlineChipsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!scrollRef.current) return;
      
      if (e.key === 'ArrowLeft') {
        scrollRef.current.scrollBy({ left: -100, behavior: 'smooth' });
      } else if (e.key === 'ArrowRight') {
        scrollRef.current.scrollBy({ left: 100, behavior: 'smooth' });
      }
    };

    const el = scrollRef.current;
    if (el) {
      el.addEventListener('keydown', handleKeyDown);
      return () => el.removeEventListener('keydown', handleKeyDown);
    }
  }, []);

  if (!chips.length) {
    return null;
  }

  return (
    <div className={cn('relative', className)}>
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide scroll-smooth"
        role="list"
        tabIndex={0}
        aria-label="Alertes"
      >
        {chips.map((chip, index) => (
          <motion.div
            key={chip.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Link
              href={chip.href}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all duration-150',
                'whitespace-nowrap min-h-[44px] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                variantClasses[chip.variant || 'default']
              )}
              aria-label={`${chip.label}: ${chip.count} élément${chip.count > 1 ? 's' : ''}`}
            >
              {chip.icon && (
                <span className="flex-shrink-0">
                  {chip.icon}
                </span>
              )}
              <span>{chip.label}</span>
              <span className="font-bold ml-1">
                {chip.count}
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

