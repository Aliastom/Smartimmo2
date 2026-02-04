'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface SmartSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SmartSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SmartSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  id?: string;
  name?: string;
  'aria-label'?: string;
}

export function SmartSelect({
  value,
  onChange,
  options,
  placeholder = 'Sélectionner...',
  disabled = false,
  error = false,
  className = '',
  id,
  name,
  'aria-label': ariaLabel,
}: SmartSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [usePortal, setUsePortal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  // Détecter si on est sur mobile et si on doit utiliser un Portal
  useEffect(() => {
    const checkMobile = () => {
      // Utiliser un Portal sur mobile (< 640px) ou si on est dans une modale
      const isMobile = window.innerWidth < 640;
      const isInModal = containerRef.current?.closest('[role="dialog"]') !== null;
      setUsePortal(isMobile || isInModal);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Calculer la position du menu pour le Portal
  useEffect(() => {
    if (isOpen && usePortal && containerRef.current) {
      const updatePosition = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setMenuPosition({
            top: rect.bottom + window.scrollY + 4, // 4px de gap (mt-1)
            left: rect.left + window.scrollX,
            width: rect.width,
          });
        }
      };

      updatePosition();
      
      // Recalculer la position au scroll ou resize
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    } else {
      setMenuPosition(null);
    }
  }, [isOpen, usePortal]);

  // Fermer le menu si on clique en dehors (gère aussi le Portal)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current && 
        !containerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };

    if (isOpen) {
      // Utiliser capture phase pour intercepter avant que l'événement ne se propage
      document.addEventListener('mousedown', handleClickOutside, true);
      return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }
  }, [isOpen]);

  // Gérer la navigation clavier
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isOpen && focusedIndex >= 0 && options[focusedIndex]) {
          handleSelect(options[focusedIndex].value);
        } else {
          setIsOpen(!isOpen);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setFocusedIndex(0);
        } else {
          setFocusedIndex(prev => 
            prev < options.length - 1 ? prev + 1 : prev
          );
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setFocusedIndex(prev => (prev > 0 ? prev - 1 : 0));
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
      case 'Tab':
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
    }
  }, [disabled, isOpen, focusedIndex, options]);

  // Scroll vers l'option focusée
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const focusedElement = listRef.current.children[focusedIndex] as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [isOpen, focusedIndex]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setFocusedIndex(-1);
  };

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (!isOpen) {
        // Ouvrir et focuser l'option sélectionnée ou la première
        const currentIndex = options.findIndex(opt => opt.value === value);
        setFocusedIndex(currentIndex >= 0 ? currentIndex : 0);
      }
    }
  };

  return (
    <div 
      ref={containerRef}
      className={cn('relative w-full', className)}
    >
      {/* Champ de sélection */}
      <button
        type="button"
        id={id}
        name={name}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-full px-3 py-2 border rounded-lg bg-white',
          'flex items-center justify-between gap-2',
          'text-left text-sm',
          'transition-colors duration-200',
          'focus:outline-none',
          disabled
            ? 'bg-gray-100 cursor-not-allowed text-gray-400'
            : 'cursor-pointer',
          error
            ? 'border-red-500 focus:border-red-500 focus:ring-0'
            : 'border-gray-300 focus:border-orange-500 focus:ring-0',
          // Focus visible avec bordure orange fine
          'focus-visible:ring-0 focus-visible:border-orange-500',
          // Glow léger au focus
          'focus-visible:shadow-[0_0_0_1px_rgba(249,115,22,0.3)]'
        )}
      >
        <span className={cn(
          'flex-1 truncate',
          selectedOption ? 'text-gray-900' : 'text-gray-500'
        )}>
          {selectedOption ? (
            <span className="flex items-center gap-2">
              {selectedOption.icon && (
                <span className="text-gray-400 flex-shrink-0">
                  {selectedOption.icon}
                </span>
              )}
              <span>{selectedOption.label}</span>
            </span>
          ) : (
            placeholder
          )}
        </span>
        <ChevronDown 
          className={cn(
            'h-4 w-4 flex-shrink-0 transition-transform duration-200',
            isOpen ? 'transform rotate-180' : '',
            disabled ? 'text-gray-400' : 'text-gray-500'
          )} 
          aria-hidden="true"
        />
      </button>

      {/* Menu dropdown */}
      {isOpen && !disabled && (() => {
        const menuContent = (
        <div
            ref={menuRef}
            className={cn(
              'bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-hidden',
              usePortal && menuPosition
                ? 'fixed z-[9999]' // z-index très élevé pour être au-dessus de la modale (z-50)
                : 'absolute z-50 w-full mt-1'
            )}
            style={
              usePortal && menuPosition
                ? {
                    top: `${menuPosition.top}px`,
                    left: `${menuPosition.left}px`,
                    width: `${menuPosition.width}px`,
                  }
                : undefined
            }
          role="listbox"
        >
          <ul
            ref={listRef}
            className="py-1 overflow-y-auto max-h-64"
            role="listbox"
          >
            {options.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500 text-center">
                Aucune option disponible
              </li>
            ) : (
              options.map((option, index) => {
                const isSelected = option.value === value;
                const isFocused = index === focusedIndex;
                
                return (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => !option.disabled && handleSelect(option.value)}
                    onMouseEnter={() => setFocusedIndex(index)}
                    className={cn(
                      'relative px-3 py-2 cursor-pointer group',
                      'transition-all duration-200',
                      option.disabled && 'opacity-50 cursor-not-allowed',
                      // Fond pour option sélectionnée
                      isSelected && 'bg-gray-50',
                      // Fond pour option focusée (clavier)
                      isFocused && !isSelected && 'bg-gray-50'
                    )}
                  >
                    {/* Dégradé progressif au hover (gauche → droite) */}
                    <div
                      className={cn(
                        'absolute inset-0 rounded overflow-hidden',
                        'transition-opacity duration-200 ease-out',
                        // Afficher le dégradé au hover (souris) ou si focusée au clavier
                        (isFocused || false) ? 'opacity-10' : 'opacity-0 group-hover:opacity-10'
                      )}
                    >
                      <div
                        className="absolute inset-0 bg-gradient-to-r from-[#FF7A00] to-[#FF4D00]"
                        style={{
                          // Animation de remplissage progressif gauche→droite
                          transform: (isFocused || false) 
                            ? 'translateX(0)' 
                            : 'translateX(-100%)',
                          transition: 'transform 0.3s ease-out',
                        }}
                      />
                    </div>

                    {/* Contenu de l'option */}
                    <div className="relative flex items-center gap-2">
                      {option.icon && (
                        <span className="text-gray-400 text-xs flex-shrink-0">
                          {option.icon}
                        </span>
                      )}
                      <span className={cn(
                        'flex-1 text-sm',
                        isSelected ? 'text-gray-900 font-medium' : 'text-gray-700'
                      )}>
                        {option.label}
                      </span>
                      {isSelected && (
                        <Check className="h-4 w-4 text-orange-600 flex-shrink-0" aria-hidden="true" />
                      )}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
        );

        // Utiliser Portal sur mobile ou dans une modale
        if (usePortal && typeof window !== 'undefined') {
          return createPortal(menuContent, document.body);
        }

        return menuContent;
      })()}

      {/* Input caché pour les formulaires */}
      <input
        type="hidden"
        name={name}
        value={value}
        readOnly
      />
    </div>
  );
}

