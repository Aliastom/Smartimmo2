/**
 * Configuration des variables d'environnement
 * Validation et export des variables Supabase
 */

function getEnvVar(key: string, required: boolean = true): string {
  const value = process.env[key];
  
  if (required && !value) {
    throw new Error(`❌ Variable d'environnement manquante: ${key}`);
  }
  
  return value || '';
}

// Variables publiques Supabase (accessibles côté client)
export const env = {
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: getEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  
  // Supabase Service Role (JAMAIS exposer côté client)
  SUPABASE_SERVICE_ROLE_KEY: getEnvVar('SUPABASE_SERVICE_ROLE_KEY', false),
  
  // App URL
  NEXT_PUBLIC_APP_URL: getEnvVar('NEXT_PUBLIC_APP_URL', false) || 
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'),
    
  // Database
  DATABASE_URL: getEnvVar('DATABASE_URL'),
  
  // Resend
  RESEND_API_KEY: getEnvVar('RESEND_API_KEY', false),
} as const;

// Type-safe env object
export type Env = typeof env;

