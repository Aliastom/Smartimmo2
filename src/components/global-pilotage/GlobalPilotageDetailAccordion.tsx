'use client';

import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface GlobalPilotageDetailAccordionProps {
  open: boolean;
  onToggle: () => void;
  title: string;
  children: React.ReactNode;
}

/** Accordéon « Détail complet » — fermé par défaut, comme la page Échéances globale. */
export function GlobalPilotageDetailAccordion({
  open,
  onToggle,
  title,
  children,
}: GlobalPilotageDetailAccordionProps) {
  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-center justify-between gap-2 text-left text-sm font-medium text-gray-800 hover:text-gray-900"
        >
          <span>{title}</span>
          {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
        </button>
      </div>
      {open ? <div className="space-y-6 pt-1">{children}</div> : null}
    </>
  );
}
