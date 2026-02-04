'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface SmartSelectAdvancedOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
  disabled?: boolean;
}

export interface SmartSelectAdvancedGroup {
  group: string;
  icon?: string;
  options: SmartSelectAdvancedOption[];
}

export interface SmartSelectAdvancedProps {
  value: string;
  onChange: (value: string) => void;
  groups: SmartSelectAdvancedGroup[];
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  id?: string;
  name?: string;
  'aria-label'?: string;
  searchPlaceholder?: string;
}

export function SmartSelectAdvanced({
  value,
  onChange,
  groups,
  placeholder = 'Sélectionner...',
  disabled = false,
  error = false,
  className = '',
  id,
  name,
  'aria-label': ariaLabel,
  searchPlaceholder = 'Rechercher...',
}: SmartSelectAdvancedProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Trouver l'option sélectionnée
  const selectedOption = useMemo(() => {
    for (const group of groups) {
      const option = group.options.find(opt => opt.value === value);
      if (option) return { ...option, group: group.group };
    }
    return null;
  }, [value, groups]);

  // Filtrer les options selon la recherche
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;

    const query = searchQuery.toLowerCase();
    return groups
      .map(group => ({
        ...group,
        options: group.options.filter(
          opt =>
            opt.label.toLowerCase().includes(query) ||
            opt.description?.toLowerCase().includes(query) ||
            opt.value.toLowerCase().includes(query)
        ),
      }))
      .filter(group => group.options.length > 0);
  }, [groups, searchQuery]);

  // Calculer l'index global pour la navigation clavier
  const getGlobalIndex = (groupIndex: number, optionIndex: number) => {
    let index = 0;
    for (let i = 0; i < groupIndex; i++) {
      index += filteredGroups[i].options.length;
    }
    return index + optionIndex;
  };

  const getOptionFromGlobalIndex = (globalIndex: number) => {
    let currentIndex = 0;
    for (let groupIndex = 0; groupIndex < filteredGroups.length; groupIndex++) {
      const group = filteredGroups[groupIndex];
      for (let optionIndex = 0; optionIndex < group.options.length; optionIndex++) {
        if (currentIndex === globalIndex) {
          return { groupIndex, optionIndex, option: group.options[optionIndex] };
        }
        currentIndex++;
      }
    }
    return null;
  };

  const totalOptions = filteredGroups.reduce((sum, group) => sum + group.options.length, 0);

  // Fermer le menu si on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
        setFocusedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Focus sur l'input de recherche quand le menu s'ouvre
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Navigation clavier
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = prev < totalOptions - 1 ? prev + 1 : 0;
          scrollToOption(next);
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex(prev => {
          const next = prev > 0 ? prev - 1 : totalOptions - 1;
          scrollToOption(next);
          return next;
        });
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const option = getOptionFromGlobalIndex(focusedIndex);
        if (option && !option.option.disabled) {
          handleSelect(option.option.value);
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        setSearchQuery('');
        setFocusedIndex(-1);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, focusedIndex, totalOptions]);

  const scrollToOption = (index: number) => {
    if (!listRef.current) return;
    
    const option = getOptionFromGlobalIndex(index);
    if (!option) return;

    const optionElement = listRef.current.querySelector(
      `[data-group-index="${option.groupIndex}"][data-option-index="${option.optionIndex}"]`
    ) as HTMLElement;
    
    if (optionElement) {
      optionElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery('');
    setFocusedIndex(-1);
  };

  const handleOpen = () => {
    if (!disabled) {
      setIsOpen(true);
      setFocusedIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Input caché pour react-hook-form */}
      <input
        type="hidden"
        name={name}
        value={value}
        id={id}
      />

      {/* Bouton déclencheur */}
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        aria-label={ariaLabel || placeholder}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={cn(
          'w-full px-3 py-2 border rounded-lg bg-white text-left flex items-center justify-between group',
          'focus:outline-none focus:ring-0 focus-visible:border-orange-500 focus-visible:shadow-[0_0_0_1px_rgba(249,115,22,0.3)]',
          'transition-colors duration-200',
          'hover:border-orange-300',
          error ? 'border-red-500' : 'border-gray-300',
          disabled && 'bg-gray-100 cursor-not-allowed opacity-50',
          !value && 'text-gray-500',
          isOpen && 'border-orange-500'
        )}
        onMouseEnter={(e) => {
          if (!isOpen && !disabled) {
            const chevron = e.currentTarget.querySelector('svg');
            if (chevron) {
              chevron.classList.remove('text-gray-400');
              chevron.classList.add('text-orange-500');
            }
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen && !disabled) {
            const chevron = e.currentTarget.querySelector('svg');
            if (chevron) {
              chevron.classList.remove('text-orange-500');
              chevron.classList.add('text-gray-400');
            }
          }
        }}
      >
        <span className={selectedOption ? 'text-gray-900' : 'text-gray-500'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={cn(
          'h-4 w-4 transition-all duration-200',
          isOpen 
            ? 'text-orange-500 rotate-180' 
            : 'text-gray-400'
        )} />
      </button>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-hidden flex flex-col"
          role="listbox"
        >
          {/* Barre de recherche */}
          <div className="p-2 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400 transition-colors duration-200 search-icon-smart-select" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setFocusedIndex(-1);
                }}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:ring-0 focus-visible:border-orange-500 focus-visible:shadow-[0_0_0_1px_rgba(249,115,22,0.3)] transition-colors duration-200"
                autoFocus
                onFocus={(e) => {
                  // Changer la couleur de l'icône Search au focus
                  const searchIcon = e.currentTarget.parentElement?.querySelector('.search-icon-smart-select');
                  if (searchIcon) {
                    searchIcon.classList.remove('text-gray-400');
                    searchIcon.classList.add('text-orange-500');
                  }
                }}
                onBlur={(e) => {
                  // Remettre la couleur par défaut de l'icône Search
                  const searchIcon = e.currentTarget.parentElement?.querySelector('.search-icon-smart-select');
                  if (searchIcon) {
                    searchIcon.classList.remove('text-orange-500');
                    searchIcon.classList.add('text-gray-400');
                  }
                }}
              />
            </div>
          </div>

          {/* Liste des options */}
          <div ref={listRef} className="overflow-y-auto max-h-64 smart-select-scrollbar">
            {filteredGroups.length === 0 ? (
              <div className="px-3 py-4 text-center text-gray-500 text-sm">
                Aucun résultat
              </div>
            ) : (
              filteredGroups.map((group, groupIndex) => (
                <div key={group.group}>
                  {/* En-tête de groupe (non cliquable) */}
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                    {group.icon && <span>{group.icon}</span>}
                    {group.group}
                  </div>

                  {/* Options du groupe */}
                  {group.options.map((option, optionIndex) => {
                    const globalIndex = getGlobalIndex(groupIndex, optionIndex);
                    const isFocused = focusedIndex === globalIndex;
                    const isSelected = value === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => !option.disabled && handleSelect(option.value)}
                        disabled={option.disabled}
                        data-group-index={groupIndex}
                        data-option-index={optionIndex}
                        role="option"
                        aria-selected={isSelected}
                        className={cn(
                          'w-full px-3 py-2 text-left transition-colors duration-200',
                          'focus:outline-none focus:ring-0',
                          option.disabled
                            ? 'text-gray-400 cursor-not-allowed'
                            : isSelected
                            ? 'bg-gray-50 text-gray-900 font-medium'
                            : isFocused
                            ? 'bg-orange-50 text-gray-900'
                            : 'text-gray-900 hover:bg-orange-50'
                        )}
                        onMouseEnter={() => setFocusedIndex(globalIndex)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className={cn(
                              isSelected ? 'font-medium' : 'font-normal'
                            )}>{option.label}</span>
                            {option.description && (
                              <span className="text-xs text-gray-500">
                                {option.description}
                              </span>
                            )}
                          </div>
                          {isSelected && (
                            <Check className="h-4 w-4 text-orange-600 flex-shrink-0 ml-2" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

