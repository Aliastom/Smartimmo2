'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Loader2, AlertCircle, Check } from 'lucide-react';
import { useAddressAutocomplete, AddressSuggestion } from '@/hooks/useAddressAutocomplete';

interface AddressAutocompleteProps {
  onAddressSelect: (address: {
    street: string;
    postcode: string;
    city: string;
  }) => void;
  initialValue?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
}

export default function AddressAutocomplete({
  onAddressSelect,
  initialValue = '',
  disabled = false,
  className = '',
  placeholder = 'Ex: 123 Rue de la Paix, Paris',
  required = false,
  error,
}: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(initialValue);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    suggestions,
    isLoading,
    error: apiError,
    isApiAvailable,
    searchAddresses,
    selectAddress,
    clearSuggestions,
  } = useAddressAutocomplete();

  // Mettre à jour la valeur initiale si elle change (mais éviter les boucles)
  useEffect(() => {
    if (initialValue !== undefined && initialValue !== inputValue && !isOpen) {
      setInputValue(initialValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]); // Ne pas inclure inputValue et isOpen pour éviter les boucles

  // Gérer le clic en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setSelectedIndex(-1);

    // En mode offline ou si l'API n'est pas disponible, mettre à jour l'adresse manuellement en temps réel
    // MAIS seulement si on est vraiment offline (pas si l'API est juste en chargement)
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isOffline && !isApiAvailable && value.trim().length > 0) {
      // Extraire l'adresse manuellement (format simple : "adresse code_postal ville" ou "adresse, code_postal ville")
      const parts = value.split(/[,\s]+/).filter(p => p.length > 0);
      if (parts.length >= 2) {
        // Essayer de détecter code postal (5 chiffres en France) et ville
        const postcodeMatch = parts.find(p => /^\d{5}$/.test(p));
        if (postcodeMatch) {
          const postcodeIndex = parts.indexOf(postcodeMatch);
          const street = parts.slice(0, postcodeIndex).join(' ');
          const postcode = postcodeMatch;
          const city = parts.slice(postcodeIndex + 1).join(' ') || '';
          
          onAddressSelect({
            street: street || value,
            postcode: postcode,
            city: city || '',
          });
          return; // Ne pas rechercher si on a déjà parsé l'adresse
        }
      }
      
      // Si pas de code postal détecté, utiliser toute la valeur comme adresse
      // (le code postal et la ville seront remplis manuellement dans les champs séparés)
      onAddressSelect({
        street: value,
        postcode: '',
        city: '',
      });
    }

    // En mode online avec API disponible, rechercher des suggestions
    if (value.trim().length >= 3 && isApiAvailable && !isOffline) {
      searchAddresses(value);
      setIsOpen(true);
    } else if (!isOffline) {
      // En ligne mais pas assez de caractères ou API non disponible, fermer les suggestions
      clearSuggestions();
      setIsOpen(false);
    }
  };

  const handleSelectSuggestion = (suggestion: AddressSuggestion) => {
    setInputValue(suggestion.label);
    setIsOpen(false);
    selectAddress(suggestion);
    
    onAddressSelect({
      street: suggestion.street,
      postcode: suggestion.postcode,
      city: suggestion.city,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const handleFocus = () => {
    if (suggestions.length > 0) {
      setIsOpen(true);
    }
  };

  // Gérer le blur : valider l'adresse saisie manuellement si aucune suggestion n'a été sélectionnée
  const handleBlur = () => {
    // Attendre un peu pour permettre le clic sur une suggestion
    setTimeout(() => {
      setIsOpen(false);
      
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      
      // Si l'utilisateur a tapé quelque chose mais n'a pas sélectionné de suggestion
      // (soit parce que l'API n'est pas disponible, soit parce qu'il a tapé manuellement)
      if (inputValue.trim().length > 0) {
        // Essayer de parser l'adresse
        const parts = inputValue.split(/[,\s]+/).filter(p => p.length > 0);
        if (parts.length >= 2) {
          const postcodeMatch = parts.find(p => /^\d{5}$/.test(p));
          if (postcodeMatch) {
            const postcodeIndex = parts.indexOf(postcodeMatch);
            const street = parts.slice(0, postcodeIndex).join(' ');
            const postcode = postcodeMatch;
            const city = parts.slice(postcodeIndex + 1).join(' ') || '';
            
            onAddressSelect({
              street: street || inputValue,
              postcode: postcode,
              city: city || '',
            });
            return;
          }
        }
        
        // Sinon, utiliser la valeur tapée comme adresse
        // (l'utilisateur remplira le code postal et la ville dans les champs séparés)
        onAddressSelect({
          street: inputValue,
          postcode: '',
          city: '',
        });
      }
    }, 200);
  };

  const showDropdown = isOpen && (suggestions.length > 0 || isLoading || apiError);

  return (
    <div className="relative w-full">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MapPin className="h-4 w-4 text-gray-400" />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
            error ? 'border-red-500' : 'border-gray-300'
          } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''} ${className}`}
          autoComplete="off"
        />

        {isLoading && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <Loader2 className="h-4 w-4 text-primary-500 animate-spin" />
          </div>
        )}

        {!isApiAvailable && !isLoading && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <AlertCircle className="h-4 w-4 text-orange-500" title="Mode manuel" />
          </div>
        )}
      </div>

      {/* Messages d'erreur/info */}
      {error && (
        <p className="text-red-500 text-sm mt-1">{error}</p>
      )}
      
      {apiError && !error && (
        <p className="text-orange-600 text-xs mt-1 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {apiError}
        </p>
      )}

      {/* Dropdown de suggestions */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto"
        >
          {isLoading && suggestions.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Recherche en cours...
            </div>
          )}

          {suggestions.length > 0 && (
            <ul className="py-1">
              {suggestions.map((suggestion, index) => (
                <li
                  key={`${suggestion.label}-${index}`}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`px-4 py-2 cursor-pointer flex items-start gap-2 transition-colors ${
                    selectedIndex === index
                      ? 'bg-primary-50 text-primary-700'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary-500" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {suggestion.street}
                    </div>
                    <div className="text-xs text-gray-500">
                      {suggestion.postcode} {suggestion.city}
                    </div>
                    {suggestion.context && (
                      <div className="text-xs text-gray-400 truncate">
                        {suggestion.context}
                      </div>
                    )}
                  </div>
                  {selectedIndex === index && (
                    <Check className="h-4 w-4 text-primary-500 flex-shrink-0" />
                  )}
                </li>
              ))}
            </ul>
          )}

          {!isLoading && suggestions.length === 0 && !apiError && (
            <div className="px-4 py-3 text-sm text-gray-500">
              Aucune adresse trouvée
            </div>
          )}
        </div>
      )}
    </div>
  );
}

