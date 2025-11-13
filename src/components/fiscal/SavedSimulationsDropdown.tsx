/**
 * SavedSimulationsDropdown - Version ultra-compacte pour le header
 * 
 * Mini-dropdown avec actions rapides
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Folder, ChevronDown, FileText, Trash2, Loader2 } from 'lucide-react';

interface SavedSimulation {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  dateCalcul?: string;
}

interface SavedSimulationsDropdownProps {
  simulations: SavedSimulation[];
  currentSimulationId: string | null;
  onLoad: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}

export function SavedSimulationsDropdown({
  simulations,
  currentSimulationId,
  onLoad,
  onDelete,
}: SavedSimulationsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fermer au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('Supprimer cette simulation ?')) {
      return;
    }

    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleLoad = (id: string) => {
    onLoad(id);
    setIsOpen(false);
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  if (simulations.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bouton trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-violet-300 transition-colors"
      >
        <Folder className="h-3.5 w-3.5 text-violet-600" />
        <span className="hidden sm:inline">Sauvegardes</span>
        <Badge variant="secondary" className="bg-violet-600 text-white border-0 text-[10px] h-4 px-1.5 ml-0.5">
          {simulations.length}
        </Badge>
        <ChevronDown className={`h-3 w-3 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-violet-200">
            <div className="flex items-center gap-2">
              <Folder className="h-3.5 w-3.5 text-violet-600" />
              <span className="text-xs font-semibold text-gray-800">Mes simulations</span>
            </div>
          </div>

          {/* Liste */}
          <div className="max-h-[280px] overflow-y-auto">
            {simulations.map((sim) => {
              const isActive = sim.id === currentSimulationId;
              const dateValue = sim.dateCalcul || sim.createdAt || sim.updatedAt;
              
              return (
                <div
                  key={sim.id}
                  className={`
                    px-3 py-2 border-b border-gray-100 last:border-0 transition-colors
                    ${isActive 
                      ? 'bg-violet-50' 
                      : 'hover:bg-gray-50'
                    }
                  `}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-xs font-semibold truncate ${isActive ? 'text-violet-900' : 'text-gray-900'}`}>
                        {sim.name}
                      </h4>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {formatDate(dateValue)}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!isActive && (
                        <button
                          onClick={() => handleLoad(sim.id)}
                          className="p-1 rounded hover:bg-violet-100 text-violet-600 transition-colors"
                          title="Charger"
                        >
                          <FileText className="h-3 w-3" />
                        </button>
                      )}
                      
                      <button
                        onClick={(e) => handleDelete(sim.id, e)}
                        disabled={deletingId === sim.id}
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                        title="Supprimer"
                      >
                        {deletingId === sim.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

