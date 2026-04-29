'use client';

interface MarketTabItem {
  key: string;
  label: string;
}

interface MarketTabsProps {
  tabs: MarketTabItem[];
  activeTab: string;
  onChange: (tab: string) => void;
}

/* eslint-disable-next-line @typescript-eslint/naming-convention -- composant React */
export function MarketTabs({ tabs, activeTab, onChange }: MarketTabsProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <nav className="flex min-w-max items-center px-1 py-1" aria-label="Onglets opportunites marche">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border border-violet-200 bg-violet-50 text-violet-700 shadow-sm'
                  : 'border border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab.label}
              <span
                aria-hidden
                className={`absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-colors ${
                  isActive ? 'h-1 bg-violet-600' : 'bg-transparent'
                }`}
              />
            </button>
          );
        })}
      </nav>
    </div>
  );
}
