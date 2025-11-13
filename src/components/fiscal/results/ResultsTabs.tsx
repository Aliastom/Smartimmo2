/**
 * ResultsTabs - Navigation par onglets à icônes avec tooltips
 * 
 * ARIA-compliant, tooltips au survol, badge optionnel
 */

'use client';

import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';
import { BarChart2, FileText, TrendingUp, Sparkles } from 'lucide-react';
import type { ResultsTab } from '@/hooks/useResultsRouting';

interface Tab {
  id: ResultsTab;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: number;
}

const TABS: Tab[] = [
  { id: 'synthese', icon: BarChart2, label: 'Synthèse' },
  { id: 'details', icon: FileText, label: 'Détails fiscaux' },
  { id: 'projections', icon: TrendingUp, label: 'Projections' },
  { id: 'optimisations', icon: Sparkles, label: 'Optimisations' },
];

interface ResultsTabsProps {
  activeTab: ResultsTab;
  onTabChange: (tab: ResultsTab) => void;
  badges?: Partial<Record<ResultsTab, number>>;
  className?: string;
}

export function ResultsTabs({ activeTab, onTabChange, badges, className = '' }: ResultsTabsProps) {
  return (
    <TooltipProvider>
      <div
        role="tablist"
        aria-label="Navigation des résultats"
        className={`flex items-center gap-2 bg-white/80 backdrop-blur-sm border-b border-gray-200 px-4 py-2 ${className}`}
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const badgeCount = badges?.[tab.id];

          return (
            <Tooltip key={tab.id}>
              <TooltipTrigger asChild>
                <Button
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`tabpanel-${tab.id}`}
                  aria-label={tab.label}
                  onClick={() => onTabChange(tab.id)}
                  variant="ghost"
                  className={`
                    relative h-12 px-4 rounded-2xl transition-all
                    ${isActive 
                      ? 'bg-gradient-to-br from-purple-50 to-blue-50 shadow-sm ring-2 ring-purple-200' 
                      : 'hover:bg-gray-50'
                    }
                  `}
                >
                  <Icon 
                    className={`h-5 w-5 ${isActive ? 'text-purple-600' : 'text-gray-600'}`} 
                    aria-hidden="true"
                  />
                  
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
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

