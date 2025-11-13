'use client';

import React from 'react';
import { 
  Field, 
  FieldError, 
  Select, 
  Textarea,
  FormGroup,
  FormLabel,
  FormError,
  combineClasses 
} from '@/ui/tokens';

interface AppInputProps {
  label?: string;
  error?: string;
  required?: boolean;
  className?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  name?: string;
  id?: string;
}

export function AppInput({
  label,
  error,
  required,
  className = '',
  type = 'text',
  placeholder,
  value,
  onChange,
  disabled,
  name,
  id
}: AppInputProps) {
  const inputId = id || name || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={FormGroup}>
      {label && (
        <label htmlFor={inputId} className={FormLabel}>
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </label>
      )}
      <input
        id={inputId}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        className={combineClasses(
          error ? FieldError : Field,
          className
        )}
      />
      {error && (
        <label className={FormError}>
          {error}
        </label>
      )}
    </div>
  );
}

interface AppSelectProps {
  label?: string;
  error?: string;
  required?: boolean;
  className?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  name?: string;
  id?: string;
  options: { value: string; label: string }[];
}

export function AppSelect({
  label,
  error,
  required,
  className = '',
  placeholder,
  value,
  onChange,
  disabled,
  name,
  id,
  options
}: AppSelectProps) {
  const selectId = id || name || `select-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={FormGroup}>
      {label && (
        <label htmlFor={selectId} className={FormLabel}>
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </label>
      )}
      <select
        id={selectId}
        name={name}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        className={combineClasses(
          error ? FieldError : Select,
          className
        )}
      >
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
      </select>
      {error && (
        <label className={FormError}>
          {error}
        </label>
      )}
    </div>
  );
}

interface AppTextareaProps {
  label?: string;
  error?: string;
  required?: boolean;
  className?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  name?: string;
  id?: string;
  rows?: number;
}

export function AppTextarea({
  label,
  error,
  required,
  className = '',
  placeholder,
  value,
  onChange,
  disabled,
  name,
  id,
  rows = 3
}: AppTextareaProps) {
  const textareaId = id || name || `textarea-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={FormGroup}>
      {label && (
        <label htmlFor={textareaId} className={FormLabel}>
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </label>
      )}
      <textarea
        id={textareaId}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        rows={rows}
        className={combineClasses(
          error ? FieldError : Textarea,
          className
        )}
      />
      {error && (
        <label className={FormError}>
          {error}
        </label>
      )}
    </div>
  );
}

interface AppCheckboxProps {
  label?: string;
  error?: string;
  className?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  id?: string;
}

export function AppCheckbox({
  label,
  error,
  className = '',
  checked,
  onChange,
  disabled,
  name,
  id
}: AppCheckboxProps) {
  const checkboxId = id || name || `checkbox-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className={FormGroup}>
      <label className="label cursor-pointer">
        <input
          id={checkboxId}
          name={name}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange?.(e.target.checked)}
          disabled={disabled}
          className={combineClasses(className)}
        />
        {label && (
          <span className="label-text ml-2">
            {label}
          </span>
        )}
      </label>
      {error && (
        <label className={FormError}>
          {error}
        </label>
      )}
    </div>
  );
}
