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

  // Mettre à jour la valeur initiale si elle change
  useEffect(() => {
    if (initialValue !== inputValue) {
      setInputValue(initialValue);
    }
  }, [initialValue]);

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

    if (value.trim().length >= 3) {
      searchAddresses(value);
      setIsOpen(true);
    } else {
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

