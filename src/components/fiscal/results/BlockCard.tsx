/**
 * BlockCard - Carte sectionnelle avec titre, actions et contenu collapsible
 */

'use client';

import { useState, ReactNode } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface BlockCardProps {
  title: string;
  icon?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  defaultCollapsed?: boolean;
  collapsible?: boolean;
  className?: string;
}

export function BlockCard({
  title,
  icon,
  badge,
  actions,
  children,
  defaultCollapsed = false,
  collapsible = false,
  className = '',
}: BlockCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  return (
    <Card className={`border-gray-200 shadow-sm rounded-2xl ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon && <div className="text-gray-600">{icon}</div>}
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {badge && <div className="ml-2">{badge}</div>}
          </div>

          <div className="flex items-center gap-2">
            {actions && <div className="flex items-center gap-2">{actions}</div>}
            
            {collapsible && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="h-8 w-8 p-0"
                aria-label={isCollapsed ? 'Déplier' : 'Replier'}
              >
                {isCollapsed ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

