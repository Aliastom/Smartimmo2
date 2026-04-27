'use client';

import type { ReactNode } from 'react';

interface MarketTabPanelProps {
  activeTab: string;
  tabKey: string;
  children: ReactNode;
}

export function MarketTabPanel({ activeTab, tabKey, children }: MarketTabPanelProps) {
  if (activeTab !== tabKey) return null;
  return <section className="space-y-4">{children}</section>;
}
