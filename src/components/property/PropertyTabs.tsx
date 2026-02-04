'use client';

import React, { useState, useRef, useEffect } from 'react';
// ✅ OFFLINE-FIRST: Retiré useSearchParams() pour éviter les fetch RSC
// ✅ OFFLINE-FIRST: Retiré Link de Next.js pour éviter les navigations RSC
import { Receipt, FileText, CalendarClock, FileSignature, Landmark, Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { usePropertyTabCounts } from './usePropertyTabCounts';

// ⚠️ GUARD DEV-ONLY : Vérifier qu'on n'utilise pas <Link> ou router
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  // Vérifier qu'on n'importe pas Link ou useRouter
  // (vérification statique - à vérifier manuellement dans le code)
  // Si vous voyez cette erreur, c'est qu'un import a été ajouté par erreur
}

interface PropertyTabsProps {
  propertyId: string;
  activeTab: string; // ✅ Prop au lieu de searchParams.get('tab')
  onTabChange: (tabId: string) => void; // ✅ Callback pour changement d'onglet
}

interface TabConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const PROPERTY_TABS: TabConfig[] = [
  { id: 'transactions', label: 'Transactions', icon: Receipt },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'deadlines', label: 'Échéances', icon: CalendarClock },
  { id: 'lease', label: 'Baux', icon: FileSignature },
  { id: 'loans', label: 'Prêts', icon: Landmark },
] as const;

export function PropertyTabs({ propertyId, activeTab: activeTabProp, onTabChange }: PropertyTabsProps) {
  // ✅ OFFLINE-FIRST: Utiliser activeTab prop directement (plus de useSearchParams)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const counts = usePropertyTabCounts(propertyId);
  const [loadingTab, setLoadingTab] = useState<string | null>(null);
  const [clickedTab, setClickedTab] = useState<string | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // ✅ Utiliser activeTab prop directement (source de vérité)
  const validActiveTab = activeTabProp;

  // Détecter le changement d'onglet et afficher un loader
  useEffect(() => {
    // Nettoyer le timeout précédent
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }

    // Afficher le loader immédiatement lors du changement d'onglet
    setLoadingTab(validActiveTab);
    
    // Réinitialiser clickedTab quand l'onglet actif change
    setClickedTab(validActiveTab);

    // Masquer le loader après 1.5 secondes (ou quand le contenu est prêt)
    loadingTimeoutRef.current = setTimeout(() => {
      setLoadingTab(null);
    }, 1500);

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [validActiveTab]);
  
  // Trouver l'index de l'onglet actif
  const activeIndex = PROPERTY_TABS.findIndex(tab => tab.id === validActiveTab);
  
  // Trouver l'index de l'onglet cliqué
  const clickedIndex = clickedTab ? PROPERTY_TABS.findIndex(tab => tab.id === clickedTab) : -1;
  
  // Index à utiliser pour le thumb (hovered > clicked > active)
  // Le hover a la priorité, puis l'onglet cliqué, puis l'onglet actif depuis la prop
  const thumbIndex = hoveredIndex !== null 
    ? hoveredIndex 
    : (clickedIndex >= 0 ? clickedIndex : activeIndex);
  
  // ✅ OFFLINE-FIRST: Handler pour changement d'onglet (appelle le callback parent)
  const handleTabClick = (tabId: string) => {
    // Appeler le callback parent (PropertyDetailView) qui gère le state local et la sync URL
    onTabChange(tabId);
  };

  const [thumbPosition, setThumbPosition] = useState(0);
  const [thumbWidth, setThumbWidth] = useState(0);

  // Référence au conteneur scrollable pour calculer la position
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Mettre à jour la position et la largeur du thumb
  useEffect(() => {
    const updateThumb = () => {
      if (tabRefs.current[thumbIndex] && scrollContainerRef.current) {
        const tab = tabRefs.current[thumbIndex];
        
        // offsetLeft donne la position par rapport au conteneur parent (scrollContainerRef)
        // Cela prend automatiquement en compte le padding et le gap
        const position = tab.offsetLeft;
        const width = tab.offsetWidth;
        
        setThumbPosition(position);
        setThumbWidth(width);
      }
    };

    // Délai pour s'assurer que le DOM est rendu
    const timeoutId = setTimeout(updateThumb, 0);
    
    // Réécouter les changements de taille de fenêtre
    window.addEventListener('resize', updateThumb);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', updateThumb);
    };
  }, [thumbIndex, validActiveTab]);

  return (
    <div className="relative w-full lg:w-auto">
      {/* Conteneur principal avec scroll horizontal sur mobile */}
      <div className="relative rounded-xl bg-white p-1 border border-base-200 shadow-sm overflow-hidden lg:overflow-visible">
        {/* Wrapper scrollable sur mobile uniquement */}
        <div 
          ref={scrollContainerRef}
          className="relative flex items-center gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory px-4 lg:px-0 lg:overflow-x-visible lg:snap-none lg:inline-flex"
        >
          {/* Thumb glissant - un seul élément qui se déplace */}
          <span
            className={cn(
              'absolute top-1 bottom-1 rounded-lg transition-all duration-150 ease-out z-0',
              hoveredIndex !== null ? 'bg-red-500' : 'bg-orange-500'
            )}
            style={{
              left: `${thumbPosition}px`,
              width: `${thumbWidth}px`,
            }}
            aria-hidden="true"
          />
          
          {PROPERTY_TABS.map((tab, index) => {
            const isActive = validActiveTab === tab.id;
            const isClicked = clickedTab === tab.id;
            const isHovered = hoveredIndex === index;
            // Le texte est blanc si :
            // - cet onglet est survolé, OU
            // - cet onglet est cliqué (et aucun autre n'est survolé), OU
            // - cet onglet est actif (et aucun autre n'est survolé ou cliqué)
            const shouldBeWhite = isHovered || (isClicked && hoveredIndex === null) || (isActive && hoveredIndex === null && !clickedTab);
            const Icon = tab.icon;
            
            // Récupérer le count pour cet onglet
            const count = counts[tab.id as keyof typeof counts];
            const showCount = count !== undefined && count > 0;
            
            // Afficher le loader si cet onglet est en train de charger
            const isLoading = loadingTab === tab.id;
            
            // ✅ OFFLINE-FIRST: Handler pour changement d'onglet
            const handleClick = (e: React.MouseEvent) => {
              e.preventDefault();
              
              // Nettoyer le timeout précédent
              if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
              }
              
              // Déplacer le thumb immédiatement vers l'onglet cliqué
              setClickedTab(tab.id);
              
              // Déclencher le loader immédiatement au clic
              setLoadingTab(tab.id);
              
              // Appeler le callback parent (gère le state local + sync URL)
              handleTabClick(tab.id);
              
              // Masquer le loader après 1.5 secondes
              loadingTimeoutRef.current = setTimeout(() => {
                setLoadingTab(null);
              }, 1500);
            };
            
            return (
              <button
                key={tab.id}
                ref={(el) => { tabRefs.current[index] = el; }}
                onClick={handleClick}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={cn(
                  'inline-flex items-center gap-2 px-3 sm:px-5 py-2 text-xs sm:text-sm font-semibold uppercase transition-colors duration-150 ease-out',
                  'focus:outline-none',
                  'relative z-10 whitespace-nowrap flex-shrink-0',
                  'h-9 lg:h-auto min-w-max snap-start',
                  'cursor-pointer border-none bg-transparent',
                  shouldBeWhite
                    ? 'text-white'
                    : 'text-orange-600'
                )}
                type="button"
                aria-label={`Onglet ${tab.label}`}
              >
                {/* Afficher le loader pendant le chargement, sinon le nombre ou l'icône */}
                {isLoading ? (
                  <Loader2 className={cn(
                    "h-4 w-4 flex-shrink-0 animate-spin",
                    shouldBeWhite ? "text-white" : "text-orange-600"
                  )} />
                ) : showCount ? (
                  <span className="text-xs font-bold min-w-[16px] w-4 flex items-center justify-center">
                    {count > 99 ? '99+' : count}
                  </span>
                ) : (
                  <Icon className="h-4 w-4 flex-shrink-0" />
                )}
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

