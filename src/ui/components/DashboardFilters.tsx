'use client';

import React from 'react';
import { Calendar, Filter } from 'lucide-react';

interface DashboardFiltersProps {
  selectedYear: number;
  selectedMonth: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
}

export default function DashboardFilters({ 
  selectedYear, 
  selectedMonth, 
  onYearChange, 
  onMonthChange 
}: DashboardFiltersProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    { value: 0, label: 'Tous les mois' },
    { value: 1, label: 'Janvier' },
    { value: 2, label: 'Février' },
    { value: 3, label: 'Mars' },
    { value: 4, label: 'Avril' },
    { value: 5, label: 'Mai' },
    { value: 6, label: 'Juin' },
    { value: 7, label: 'Juillet' },
    { value: 8, label: 'Août' },
    { value: 9, label: 'Septembre' },
    { value: 10, label: 'Octobre' },
    { value: 11, label: 'Novembre' },
    { value: 12, label: 'Décembre' },
  ];

  return (
    <div className="bg-base-100 rounded-lg shadow-card p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Filter size={20} className="text-primary-700" />
        <h3 className="text-lg font-semibold text-neutral-900">Filtres</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="year" className="block text-sm font-medium text-neutral-700 mb-2">
            Année
          </label>
          <select
            id="year"
            value={selectedYear}
            onChange={(e) => onYearChange(parseInt(e.target.value))}
            className="w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label htmlFor="month" className="block text-sm font-medium text-neutral-700 mb-2">
            Mois
          </label>
          <select
            id="month"
            value={selectedMonth}
            onChange={(e) => onMonthChange(parseInt(e.target.value))}
            className="w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
          >
            {months.map(month => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
