'use client';

import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  placeholder?: string;
  onSearch?: (value: string) => void;
}

export function SearchInput({ 
  placeholder = "Rechercher...", 
  onSearch, 
  className,
  onChange,
  ...props 
}: SearchInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e);
    onSearch?.(e.target.value);
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
      <input
        type="text"
        placeholder={placeholder}
        className={cn(
          "input-base w-full pl-10 pr-4",
          className
        )}
        onChange={handleChange}
        {...props}
      />
    </div>
  );
}
