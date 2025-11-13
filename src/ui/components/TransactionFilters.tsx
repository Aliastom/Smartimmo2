'use client';

import React from 'react';
import { Filter, Calendar, Building2, Tag } from 'lucide-react';
import { Property } from '../../domain/entities/Property';
import { Category } from '../../domain/entities/Category';

interface TransactionFiltersProps {
  properties: Property[];
  categories: Category[];
  filters: {
    propertyId: string;
    categoryId: string;
    startDate: string;
    endDate: string;
  };
  onFilterChange: (filters: any) => void;
}

export default function TransactionFilters({
  properties,
  categories,
  filters,
  onFilterChange,
}: TransactionFiltersProps) {

  return (
    <div className="bg-base-100 rounded-lg shadow-card p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Filter size={20} className="text-primary-700" />
        <h3 className="text-lg font-semibold text-neutral-900">Filtres</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div>
          <label htmlFor="property" className="block text-sm font-medium text-neutral-700 mb-2">
            Bien
          </label>
          <select
            id="property"
            value={filters.propertyId}
            onChange={(e) => onFilterChange({ ...filters, propertyId: e.target.value })}
            className="w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
          >
            <option value="">Tous les biens</option>
            {properties.map(property => (
              <option key={property.id} value={property.id}>{property.name}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-neutral-700 mb-2">
            Catégorie
          </label>
          <select
            id="category"
            value={filters.categoryId}
            onChange={(e) => onFilterChange({ ...filters, categoryId: e.target.value })}
            className="w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
          >
            <option value="">Toutes les catégories</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-neutral-700 mb-2">
            Date début
          </label>
          <input
            type="date"
            id="startDate"
            value={filters.startDate}
            onChange={(e) => onFilterChange({ ...filters, startDate: e.target.value })}
            className="w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
          />
        </div>
        
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-neutral-700 mb-2">
            Date fin
          </label>
          <input
            type="date"
            id="endDate"
            value={filters.endDate}
            onChange={(e) => onFilterChange({ ...filters, endDate: e.target.value })}
            className="w-full border border-neutral-300 rounded-md shadow-sm p-2 focus:ring-primary-700 focus:border-primary-700"
          />
        </div>
      </div>
      
      <div className="mt-4 flex justify-end">
        <button
          onClick={() => onFilterChange({
            propertyId: '',
            categoryId: '',
            startDate: '',
            endDate: '',
          })}
          className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-800 transition-colors"
        >
          Réinitialiser les filtres
        </button>
      </div>
    </div>
  );
}
