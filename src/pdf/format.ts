import { format, isValid, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Utilitaires de formatage français pour les PDF
 */

/**
 * Formatte un montant en euros avec format français
 */
export function formatMoney(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) {
    return '0,00 €';
  }
  
  const num = typeof amount === 'string' ? parseFloat(amount.replace(',', '.')) : amount;
  
  if (isNaN(num)) {
    return '0,00 €';
  }
  
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(num);
}

/**
 * Formatte une date au format français (dd/MM/yyyy)
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) {
    return '';
  }
  
  try {
    let dateObj: Date;
    
    if (typeof date === 'string') {
      dateObj = parseISO(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return '';
    }
    
    if (!isValid(dateObj)) {
      return '';
    }
    
    return format(dateObj, 'dd/MM/yyyy', { locale: fr });
  } catch (error) {
    return '';
  }
}

/**
 * Formatte une date au format long français (ex: "12 février 2025")
 */
export function formatDateLong(date: string | Date | null | undefined): string {
  if (!date) {
    return '';
  }
  
  try {
    let dateObj: Date;
    
    if (typeof date === 'string') {
      dateObj = parseISO(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return '';
    }
    
    if (!isValid(dateObj)) {
      return '';
    }
    
    return format(dateObj, 'dd MMMM yyyy', { locale: fr });
  } catch (error) {
    return '';
  }
}

/**
 * Nettoie et parse un nombre de manière sécurisée
 */
export function parseNumber(value: any, defaultValue: number = 0): number {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  
  if (typeof value === 'number') {
    return isNaN(value) ? defaultValue : value;
  }
  
  if (typeof value === 'string') {
    const trimmed = value.trim().replace(',', '.');
    const parsed = parseFloat(trimmed);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  
  return defaultValue;
}

/**
 * Nettoie et parse un entier de manière sécurisée
 */
export function parseInteger(value: any, defaultValue: number = 0): number {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  
  if (typeof value === 'number') {
    return isNaN(value) ? defaultValue : Math.round(value);
  }
  
  if (typeof value === 'string') {
    const parsed = parseInt(value.trim(), 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  
  return defaultValue;
}

/**
 * Trim une chaîne de manière sécurisée
 */
export function trimString(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'string') {
    return value.trim();
  }
  
  return String(value).trim();
}

/**
 * Formatte un nombre en lettres (simplifié)
 */
export function formatMoneyInWords(amount: number): string {
  // Implémentation simplifiée - à améliorer si nécessaire
  const rounded = Math.round(amount * 100) / 100;
  return `${rounded.toFixed(2)} euros`;
}

/**
 * Convertit une valeur en nombre sécurisé (0 accepté)
 */
export function toSafeNumber(value: any): number | null {
  const parsed = parseNumber(value, NaN);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Vérifie si une valeur est remplie (0 accepté comme valide)
 */
export function isFilled(value: any): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  
  if (typeof value === 'string') {
    return value.trim() !== '';
  }
  
  if (typeof value === 'number') {
    // 0 est une valeur valide, NaN ne l'est pas
    return !isNaN(value);
  }
  
  return !!value;
}

