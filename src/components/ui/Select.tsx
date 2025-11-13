'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options?: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Sélectionner...',
  disabled = false,
  className = '',
  children,
  ...rest
}: SelectProps) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={`
          w-full px-3 py-2 pr-10 border border-gray-300 rounded-md 
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500
          bg-white text-gray-900
          disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed
          appearance-none cursor-pointer
        `}
        {...rest}
      >
        {/* Mode 1 : avec options (nouveau) */}
        {options && (
          <>
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </>
        )}
        
        {/* Mode 2 : avec children (ancien, compatible) */}
        {children}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </div>
    </div>
  );
}
