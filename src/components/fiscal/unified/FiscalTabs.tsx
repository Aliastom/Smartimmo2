/**
 * FiscalTabs - Navigation par onglets à icônes pour l'Espace Fiscal
 * 
 * 5 onglets : Simulation, Synthèse, Détails, Projections, Optimisations
 */

'use client';

import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';
import { SlidersHorizontal, BarChart2, FileText, TrendingUp, Sparkles } from 'lucide-react';
import type { FiscalTab } from '@/hooks/useFiscalTabs';

interface Tab {
  id: FiscalTab;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  disabled?: boolean;
}

const TABS: Tab[] = [
  { id: 'simulation', icon: SlidersHorizontal, label: 'Simulation' },
  { id: 'synthese', icon: BarChart2, label: 'Synthèse' },
  { id: 'details', icon: FileText, label: 'Détails fiscaux' },
  { id: 'projections', icon: TrendingUp, label: 'Projections' },
  { id: 'optimisations', icon: Sparkles, label: 'Optimisations' },
];

interface FiscalTabsProps {
  activeTab: FiscalTab;
  onTabChange: (tab: FiscalTab) => void;
  hasSimulation: boolean;
  badges?: Partial<Record<FiscalTab, number>>;
  className?: string;
}

export function FiscalTabs({ 
  activeTab, 
  onTabChange, 
  hasSimulation,
  badges, 
  className = '' 
}: FiscalTabsProps) {
  return (
    <TooltipProvider>
      <div
        role="tablist"
        aria-label="Navigation fiscale"
        className={`flex items-center gap-2 bg-white/90 backdrop-blur-sm border-b border-gray-200 px-4 py-3 ${className}`}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isDisabled = !hasSimulation && tab.id !== 'simulation';
          const badgeCount = badges?.[tab.id];

          return (
            <Tooltip key={tab.id}>
              <TooltipTrigger asChild>
                <Button
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`tabpanel-${tab.id}`}
                  aria-label={tab.label}
                  onClick={() => !isDisabled && onTabChange(tab.id)}
                  variant="ghost"
                  disabled={isDisabled}
                  className={`
                    relative h-12 px-4 rounded-2xl transition-all
                    ${isActive 
                      ? 'bg-gradient-to-br from-purple-100 to-blue-100 shadow-md ring-2 ring-purple-300' 
                      : isDisabled
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:bg-gray-100 hover:shadow-sm'
                    }
                  `}
                >
                  <div className="relative">
                    <Icon 
                      className={`h-5 w-5 ${
                        isActive 
                          ? 'text-purple-600' 
                          : isDisabled
                          ? 'text-gray-400'
                          : 'text-gray-600'
                      }`} 
                      aria-hidden="true"
                    />
                    {/* Underline doux pour onglet actif */}
                    {isActive && (
                      <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full shadow-sm" />
                    )}
                  </div>
                  
                  {/* Badge optionnel */}
                  {badgeCount !== undefined && badgeCount > 0 && (
                    <Badge 
                      variant="outline" 
                      className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] px-1 bg-rose-500 text-white border-0 text-xs font-bold"
                    >
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              
              <TooltipContent>
                <p className="font-medium">{tab.label}</p>
                {isDisabled && <p className="text-xs text-gray-400">Effectuez d'abord une simulation</p>}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

