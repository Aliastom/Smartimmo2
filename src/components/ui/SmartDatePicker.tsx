'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface SmartDatePickerProps {
  value: string; // Format YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  id?: string;
  name?: string;
  'aria-label'?: string;
  min?: string;
  max?: string;
}

const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const DAYS_OF_WEEK = ['lu', 'ma', 'me', 'je', 've', 'sa', 'di'];

export function SmartDatePicker({
  value,
  onChange,
  placeholder = 'Sélectionner une date',
  disabled = false,
  error = false,
  className = '',
  id,
  name,
  'aria-label': ariaLabel,
  min,
  max,
}: SmartDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (value) {
      const date = new Date(value);
      return { year: date.getFullYear(), month: date.getMonth() };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [usePortal, setUsePortal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  const selectedDate = value ? new Date(value) : null;

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

  // Calculer la position du calendrier pour le Portal
  useEffect(() => {
    if (isOpen && usePortal && containerRef.current) {
      const updatePosition = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const scrollY = window.scrollY || window.pageYOffset;
          const scrollX = window.scrollX || window.pageXOffset;
          
          // Calculer la position en tenant compte du scroll
          let top = rect.bottom + scrollY + 4; // 4px de gap (mt-1)
          let left = rect.left + scrollX;
          
          // Ajuster si le calendrier dépasse en bas
          const calendarHeight = 320; // Hauteur approximative du calendrier
          const viewportHeight = window.innerHeight;
          if (rect.bottom + calendarHeight > viewportHeight && rect.top > calendarHeight) {
            // Afficher au-dessus si possible
            top = rect.top + scrollY - calendarHeight - 4;
          }
          
          setMenuPosition({
            top,
            left,
            width: rect.width,
          });
        }
      };

      // Petit délai pour éviter le scroll automatique du navigateur
      const timeoutId = setTimeout(updatePosition, 0);
      
      // Recalculer la position au scroll ou resize
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      
      return () => {
        clearTimeout(timeoutId);
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
        calendarRef.current &&
        !calendarRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      // Utiliser capture phase pour détecter les clics avant qu'ils ne soient bloqués
      document.addEventListener('mousedown', handleClickOutside, true);
      return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }
  }, [isOpen]);

  // Navigation mois
  const goToPreviousMonth = () => {
    setCurrentMonth(prev => {
      if (prev.month === 0) {
        return { year: prev.year - 1, month: 11 };
      }
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => {
      if (prev.month === 11) {
        return { year: prev.year + 1, month: 0 };
      }
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth({ year: today.getFullYear(), month: today.getMonth() });
    onChange(today.toISOString().split('T')[0]);
    setIsOpen(false);
  };

  const clearDate = () => {
    onChange('');
    setIsOpen(false);
  };

  // Générer les jours du mois
  const getDaysInMonth = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7; // Convertir dimanche=0 à lundi=0

    const days: (number | null)[] = [];
    
    // Jours du mois précédent
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Jours du mois
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const handleDateSelect = (day: number) => {
    const date = new Date(currentMonth.year, currentMonth.month, day);
    const dateString = date.toISOString().split('T')[0];
    onChange(dateString);
    setIsOpen(false);
  };

  const isDateSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === currentMonth.month &&
      selectedDate.getFullYear() === currentMonth.year
    );
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === currentMonth.month &&
      today.getFullYear() === currentMonth.year
    );
  };

  const isDateDisabled = (day: number) => {
    const date = new Date(currentMonth.year, currentMonth.month, day);
    const dateString = date.toISOString().split('T')[0];
    
    if (min && dateString < min) return true;
    if (max && dateString > max) return true;
    
    return false;
  };

  const formatDisplayValue = () => {
    if (!value) return placeholder;
    const date = new Date(value);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const days = getDaysInMonth(currentMonth.year, currentMonth.month);

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
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) {
            setIsOpen(!isOpen);
          }
        }}
        disabled={disabled}
        aria-label={ariaLabel || 'Sélectionner une date'}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={cn(
          'w-full px-3 py-2 border rounded-lg bg-white text-left flex items-center justify-between',
          'focus:outline-none focus:ring-0 focus:border-orange-500 transition-colors',
          error ? 'border-red-500' : 'border-gray-300',
          disabled && 'bg-gray-100 cursor-not-allowed opacity-50',
          !value && 'text-gray-500'
        )}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-500'}>
          {formatDisplayValue()}
        </span>
        <Calendar className="h-4 w-4 text-orange-500" />
      </button>

      {/* Calendrier dropdown */}
      {isOpen && !disabled && (() => {
        const calendarContent = (
          <div
            ref={calendarRef}
            className={cn(
              'bg-white border border-gray-300 rounded-lg shadow-lg p-4 w-80',
              usePortal && menuPosition
                ? 'fixed z-[9999]' // z-index très élevé pour être au-dessus de la modale
                : 'absolute z-50 mt-1'
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
          >
          {/* Header avec navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors"
              aria-label="Mois précédent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">
                {MONTHS[currentMonth.month]} {currentMonth.year}
              </span>
            </div>
            
            <button
              type="button"
              onClick={goToNextMonth}
              className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors"
              aria-label="Mois suivant"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Jours de la semaine */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS_OF_WEEK.map(day => (
              <div
                key={day}
                className="text-xs font-medium text-gray-500 text-center py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grille des jours */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="h-8" />;
              }

              const selected = isDateSelected(day);
              const today = isToday(day);
              const disabled = isDateDisabled(day);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => !disabled && handleDateSelect(day)}
                  disabled={disabled}
                  className={cn(
                    'h-8 w-8 rounded text-sm transition-colors',
                    'focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1',
                    disabled
                      ? 'text-gray-300 cursor-not-allowed'
                      : selected
                      ? 'bg-orange-100 text-orange-700 font-medium border border-orange-300'
                      : today
                      ? 'bg-gray-50 text-gray-900 font-medium border border-gray-200'
                      : 'text-gray-700 hover:bg-orange-50 hover:text-orange-600'
                  )}
                  aria-label={`${day} ${MONTHS[currentMonth.month]} ${currentMonth.year}`}
                  aria-selected={selected}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer avec actions */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={clearDate}
              className="text-xs text-gray-600 hover:text-gray-900 transition-colors"
            >
              Effacer
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="text-xs text-gray-600 hover:text-gray-900 transition-colors"
            >
              Aujourd'hui
            </button>
          </div>
          </div>
        );

        return usePortal ? createPortal(calendarContent, document.body) : calendarContent;
      })()}
    </div>
  );
}


