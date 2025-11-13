import React, { useState, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

interface Nature {
  code: string;
  label: string;
  flow: string | null;
}

interface NatureComboboxProps {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  className?: string;
}

export function NatureCombobox({ value, onChange, disabled, className }: NatureComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [natures, setNatures] = useState<Nature[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNature, setSelectedNature] = useState<Nature | null>(null);

  // Charger les natures
  useEffect(() => {
    const fetchNatures = async () => {
      setLoading(true);
      try {
        const url = `/api/natures?search=${encodeURIComponent(search)}&limit=20`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setNatures(data.items);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des natures:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchNatures, 250);
    return () => clearTimeout(debounce);
  }, [search]);

  // Charger la nature sélectionnée au montage
  useEffect(() => {
    if (value && !selectedNature) {
      fetch(`/api/natures?search=${encodeURIComponent(value)}&limit=1`)
        .then(res => res.json())
        .then(data => {
          const found = data.items.find((n: Nature) => n.code === value);
          if (found) setSelectedNature(found);
        });
    }
  }, [value]);

  const handleSelect = (nature: Nature) => {
    setSelectedNature(nature);
    onChange(nature.code);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className={`relative ${className || ''}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-left focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed flex items-center justify-between"
      >
        <span className="truncate">
          {selectedNature ? `${selectedNature.label} — ${selectedNature.code}` : 'Sélectionner une nature'}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-500" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>
          </div>
          <div className="py-1">
            {loading && <div className="px-3 py-2 text-sm text-gray-500">Chargement...</div>}
            {!loading && natures.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">Aucune nature trouvée</div>
            )}
            {!loading && natures.map((nature) => (
              <button
                key={nature.code}
                type="button"
                onClick={() => handleSelect(nature)}
                className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
              >
                <span className="text-sm">
                  {nature.label} — <span className="text-gray-500">{nature.code}</span>
                </span>
                {value === nature.code && <Check className="h-4 w-4 text-blue-600" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

