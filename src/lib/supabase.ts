/**
 * Client Supabase pour le navigateur (côté client)
 * Utilisé dans les composants React avec 'use client'
 */

import { createBrowserClient as createBrowserClientBase } from '@supabase/ssr';

/**
 * Crée un client Supabase pour le navigateur
 * À utiliser uniquement dans les composants clients ('use client')
 */
export function createBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Validation au runtime
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Variables Supabase manquantes: NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY');
    throw new Error('Configuration Supabase incomplète');
  }

  return createBrowserClientBase(supabaseUrl, supabaseAnonKey);
}

