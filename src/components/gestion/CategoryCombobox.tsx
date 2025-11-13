import React, { useState, useEffect } from 'react';
import { ChevronDown, Check, Search, AlertCircle } from 'lucide-react';

interface Category {
  id: string;
  code: string;
  label: string;
  type: string;
}

interface CategoryComboboxProps {
  value: string;
  onChange: (code: string) => void;
  natureCode?: string; // Code de la nature pour filtrer les catégories
  disabled?: boolean;
  className?: string;
}

export function CategoryCombobox({ value, onChange, natureCode, disabled, className }: CategoryComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);

  // Charger les catégories
  useEffect(() => {
    if (!natureCode) {
      setCategories([]);
      return;
    }

    const fetchCategories = async () => {
      setLoading(true);
      try {
        const url = `/api/categories?natureCode=${encodeURIComponent(natureCode)}&search=${encodeURIComponent(search)}&limit=20`;
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setCategories(data.items);
        }
      } catch (error) {
        console.error('Erreur lors du chargement des catégories:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchCategories, 250);
    return () => clearTimeout(debounce);
  }, [search, natureCode]);

  // Charger la catégorie sélectionnée au montage
  useEffect(() => {
    if (value && natureCode && !selectedCategory) {
      fetch(`/api/categories?natureCode=${encodeURIComponent(natureCode)}&search=${encodeURIComponent(value)}&limit=1`)
        .then(res => res.json())
        .then(data => {
          const found = data.items.find((c: Category) => c.code === value);
          if (found) setSelectedCategory(found);
        });
    }
  }, [value, natureCode]);

  // Réinitialiser la sélection si la nature change
  useEffect(() => {
    if (value && selectedCategory && natureCode) {
      // Vérifier si la catégorie sélectionnée est toujours valide pour cette nature
      fetch(`/api/categories?natureCode=${encodeURIComponent(natureCode)}&limit=100`)
        .then(res => res.json())
        .then(data => {
          const isValid = data.items.some((c: Category) => c.code === value);
          if (!isValid) {
            // La catégorie n'est plus valide pour cette nature
            setSelectedCategory(null);
            onChange(''); // Réinitialiser
          }
        });
    }
  }, [natureCode]);

  const handleSelect = (category: Category) => {
    setSelectedCategory(category);
    onChange(category.code);
    setIsOpen(false);
    setSearch('');
  };

  const isDisabled = disabled || !natureCode;

  return (
    <div className={`relative ${className || ''}`}>
      <button
        type="button"
        onClick={() => !isDisabled && setIsOpen(!isOpen)}
        disabled={isDisabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-left focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed flex items-center justify-between"
        title={!natureCode ? 'Veuillez d\'abord sélectionner une nature' : ''}
      >
        <span className="truncate">
          {selectedCategory ? `${selectedCategory.label} — ${selectedCategory.code}` : 'Sélectionner une catégorie'}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-500" />
      </button>

      {!natureCode && (
        <div className="mt-1 flex items-center gap-1 text-xs text-orange-600">
          <AlertCircle className="h-3 w-3" />
          <span>Sélectionnez d'abord une nature</span>
        </div>
      )}

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
            {!loading && categories.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">Aucune catégorie trouvée</div>
            )}
            {!loading && categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => handleSelect(category)}
                className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
              >
                <span className="text-sm">
                  {category.label} — <span className="text-gray-500">{category.code}</span>
                </span>
                {value === category.code && <Check className="h-4 w-4 text-blue-600" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

