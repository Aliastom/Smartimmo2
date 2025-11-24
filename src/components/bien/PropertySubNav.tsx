'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLoading } from '@/contexts/LoadingContext';
import { Loader2 } from 'lucide-react';

interface PropertySubNavProps {
  propertyId: string;
  activeTab?: string;
  rentalMode?: string;
  counts?: {
    transactions?: number;
    documents?: number;
    photos?: number;
    baux?: number;
    echeances?: number;
    loans?: number;
  };
}

  const allTabs = [
    { id: 'transactions', label: 'Transactions', href: '/transactions', emoji: '💰', hue: 1, countKey: 'transactions' as const },
    { id: 'documents', label: 'Documents', href: '/documents', emoji: '📄', hue: 210, countKey: 'documents' as const },
    { id: 'photos', label: 'Photos', href: '/photos', emoji: '📷', hue: 280, countKey: 'photos' as const },
    { id: 'baux', label: 'Baux', href: '/leases', emoji: '📝', hue: 50, countKey: 'baux' as const },
    { id: 'echeances', label: 'Échéances', href: '/echeances', emoji: '📅', hue: 150, countKey: 'echeances' as const },
    { id: 'loans', label: 'Prêts', href: '/loans', emoji: '💳', hue: 186, countKey: 'loans' as const },
  ];

export function PropertySubNav({ propertyId, activeTab, rentalMode, counts }: PropertySubNavProps) {
  // Filtrer les tabs : masquer "Baux" pour les biens Airbnb
  const tabs = allTabs.filter(tab => {
    if (tab.id === 'baux' && rentalMode === 'SEASONAL_AIRBNB') {
      return false;
    }
    return true;
  });
  const pathname = usePathname();
  const { isLoading } = useLoading();

  return (
    <div className="w-full overflow-x-auto sm:overflow-x-visible">
      <div className="property-glass-nav min-w-max sm:min-w-0">
        {tabs.map((tab, index) => {
          const href = `/biens/${propertyId}${tab.href}`;
          const isActive = activeTab ? tab.id === activeTab : pathname.startsWith(href);
          const count = tab.countKey && counts ? counts[tab.countKey] : undefined;
          const isTabLoading = isLoading(href);

          return (
            <Link
              key={tab.id}
              href={href}
              className={`glass-item ${isActive ? 'glass-item-active' : ''}`}
              style={{ '--hue': `${tab.hue}deg` } as React.CSSProperties}
              prefetch={true}
            >
              {isTabLoading ? (
                // Afficher le loader orange à la place de l'emoji
                <>
                  <span className="glass-icon glass-mono" id={`blur-${index}`} aria-hidden="true">
                    <Loader2 className="h-5 w-5 animate-spin sidebar-loader-orange" />
                  </span>
                  <span className="glass-icon glass-mono" aria-hidden="true">
                    <Loader2 className="h-5 w-5 animate-spin sidebar-loader-orange" />
                  </span>
                  <span className="glass-icon glass-midl" aria-hidden="true" style={{ backgroundImage: `-moz-element(#blur-${index})` }}>
                    <Loader2 className="h-5 w-5 animate-spin sidebar-loader-orange" />
                  </span>
                  <span className="glass-icon glass-grey" aria-hidden="true">
                    <Loader2 className="h-5 w-5 animate-spin sidebar-loader-orange" />
                  </span>
                </>
              ) : (
                // Afficher l'emoji normal
                <>
                  <span className="glass-icon glass-mono" id={`blur-${index}`} aria-hidden="true">{tab.emoji}</span>
                  <span className="glass-icon glass-mono" aria-hidden="true">{tab.emoji}</span>
                  <span className="glass-icon glass-midl" aria-hidden="true" style={{ backgroundImage: `-moz-element(#blur-${index})` }}>{tab.emoji}</span>
                  <span className="glass-icon glass-grey" aria-hidden="true">{tab.emoji}</span>
                </>
              )}
              {tab.label}
              {count !== undefined && count > 0 && (
                <span className="glass-count">{count}</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

