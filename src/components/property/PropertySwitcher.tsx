'use client';

import React, { useState, useEffect, useMemo } from 'react';
// ✅ OFFLINE-FIRST: Retiré useRouter pour éviter les navigations RSC en offline
import { ChevronDown, Search, Building2 } from 'lucide-react';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import type { LocalProperty } from '@/lib/offline/db';
import { cn } from '@/utils/cn';

interface PropertySwitcherProps {
  currentPropertyId: string;
  currentTab: string;
  onNavigate: (propertyId: string, tab: string) => void;
  mode: 'app-shell';
  rentalMode?: string;
  // Permet d'ouvrir le switcher depuis l'extérieur (via ref)
  defaultOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}


export function PropertySwitcher({
  currentPropertyId,
  currentTab,
  onNavigate,
  mode,
  rentalMode,
  defaultOpen = false,
  onOpenChange,
}: PropertySwitcherProps) {
  // ✅ OFFLINE-FIRST: Retiré useRouter pour éviter les navigations RSC en offline
  const { organizationId } = useCurrentOrganization();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  // ✅ Synchroniser l'état avec la prop defaultOpen uniquement quand elle passe à true
  // (permet d'ouvrir le switcher depuis l'extérieur, mais l'état interne reste maître)
  const prevDefaultOpenRef = React.useRef(defaultOpen);
  useEffect(() => {
    // Si defaultOpen passe de false à true, ouvrir le switcher
    if (defaultOpen && !prevDefaultOpenRef.current && !isOpen) {
      setIsOpen(true);
    }
    prevDefaultOpenRef.current = defaultOpen;
  }, [defaultOpen, isOpen]);
  
  // Gérer les changements d'état internes
  const handleToggle = (newState: boolean) => {
    setIsOpen(newState);
    onOpenChange?.(newState);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [properties, setProperties] = useState<LocalProperty[]>([]);
  const [currentProperty, setCurrentProperty] = useState<LocalProperty | null>(null);
  const [loading, setLoading] = useState(true);

  // Ref pour le conteneur du dropdown (pour détecter les clics extérieurs)
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // ✅ Charger les propriétés (PASSIF - ne modifie jamais l'URL)
  useEffect(() => {
    if (!organizationId) {
      setProperties([]);
      setCurrentProperty(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadProperties() {
      try {
        setLoading(true);
        const propRepo = getPropertyRepositoryOffline();
        const allProperties = await propRepo.getAll(organizationId);
        
        if (!cancelled) {
          setProperties(allProperties || []);
          const current = allProperties?.find(p => p.id === currentPropertyId) || null;
          setCurrentProperty(current);
        }
      } catch (error) {
        console.error('[PropertySwitcher] Erreur chargement propriétés:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProperties();

    return () => {
      cancelled = true;
    };
    // ✅ Dépendances stables : pas de navigation déclenchée ici
  }, [organizationId, currentPropertyId]);

  // ✅ Gérer la fermeture au clic extérieur (sans overlay fullscreen qui masque le contenu)
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      // Si le clic est en dehors du dropdown, fermer
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        // ✅ Uniquement changement d'état local, AUCUNE navigation
        handleToggle(false);
        setSearchQuery('');
      }
    };

    // Attendre un tick pour éviter de fermer immédiatement après l'ouverture
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Filtrer les propriétés selon la recherche
  const filteredProperties = useMemo(() => {
    if (!searchQuery.trim()) return properties;
    const query = searchQuery.toLowerCase();
    return properties.filter(p => 
      p.name?.toLowerCase().includes(query) ||
      p.address?.toLowerCase().includes(query)
    );
  }, [properties, searchQuery]);

  // ✅ OFFLINE-FIRST: Navigation atomique vers une section d'un bien (client-side uniquement)
  const handleNavigate = (propertyId: string, tab: string) => {
    // ✅ OFFLINE-FIRST: Utiliser window.history.pushState() pour éviter les navigations RSC
    // Même approche que PropertiesPageCore.handlePropertyClick
    const newUrl = `/app?view=property&propertyId=${propertyId}&tab=${tab}`;
    console.log('[PropertySwitcher] 🧭 Navigation via history.pushState (offline-first):', newUrl);
    
    // ✅ Navigation client-side pure : window.history.pushState() ne déclenche pas de fetch RSC
    // useSearchParams() dans AppShellClient réagira automatiquement au changement d'URL
    window.history.pushState({ view: 'property', propertyId, tab }, '', newUrl);
    
    // ✅ Déclencher un événement personnalisé pour forcer le re-render de useSearchParams()
    // (nécessaire car pushState ne déclenche pas automatiquement le re-render dans Next.js)
    window.dispatchEvent(new PopStateEvent('popstate'));
    
    // Appeler le callback pour notifier le parent (optionnel, pour logging)
    onNavigate(propertyId, tab);
    
    // Fermer le dropdown
    handleToggle(false);
    setSearchQuery('');
  };


  if (loading || !currentProperty) {
    return (
      <div className="px-3 py-2 text-sm text-gray-500">
        <Building2 className="h-4 w-4 inline mr-2" />
        Chargement...
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bouton principal : bien courant */}
      {/* ✅ OUVERTURE 100% PASSIVE : setIsOpen uniquement, aucun effet secondaire */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          // ✅ Uniquement changement d'état local, AUCUNE navigation
          handleToggle(!isOpen);
        }}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
          'hover:bg-gray-100 text-gray-700',
          isOpen && 'bg-gray-100'
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
        type="button"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Building2 className="h-4 w-4 flex-shrink-0 text-gray-500" />
          <span className="truncate">{currentProperty.name || 'Bien sans nom'}</span>
        </div>
        <ChevronDown 
          className={cn(
            'h-4 w-4 flex-shrink-0 text-gray-400 transition-transform',
            isOpen && 'transform rotate-180'
          )}
        />
      </button>

      {/* Dropdown */}
      {/* ✅ PAS d'overlay fullscreen - utilise un EventListener sur document pour détecter les clics extérieurs */}
      {isOpen && (
        <div 
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[100] max-h-[400px] flex flex-col"
          onClick={(e) => {
            // Empêcher la propagation vers le document
            e.stopPropagation();
          }}
        >
            {/* Recherche */}
            <div className="p-2 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un bien..."
                  value={searchQuery}
                  onChange={(e) => {
                    // ✅ Recherche 100% PASSIVE : uniquement changement d'état local
                    e.preventDefault();
                    e.stopPropagation();
                    setSearchQuery(e.target.value);
                  }}
                  onFocus={(e) => {
                    // ✅ Focus 100% PASSIVE : empêcher toute propagation
                    e.stopPropagation();
                  }}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            {/* Liste des biens */}
            <div className="overflow-y-auto flex-1">
              {filteredProperties.length === 0 ? (
                <div className="px-3 py-4 text-sm text-gray-500 text-center">
                  Aucun bien trouvé
                </div>
              ) : (
                <>
                  <div className="text-xs font-semibold text-gray-500 uppercase px-3 py-2">
                    Autres biens
                  </div>
                  {filteredProperties.map((property) => (
                    <button
                      key={property.id}
                      onClick={() => handleNavigate(property.id, 'transactions')}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                        property.id === currentPropertyId
                          ? 'bg-primary-50 text-primary-600 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 flex-shrink-0 text-gray-400" />
                        <span className="truncate">{property.name || 'Bien sans nom'}</span>
                      </div>
                      {property.address && (
                        <div className="text-xs text-gray-500 truncate ml-6 mt-0.5">
                          {property.address}
                        </div>
                      )}
                    </button>
                  ))}
                </>
              )}
            </div>
        </div>
      )}
    </div>
  );
}
