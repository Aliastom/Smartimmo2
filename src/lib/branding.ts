/**
 * Branding centralisé Smartimmo
 * Utilisé pour PDF, emails et interface web
 */

const APP_BASE = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_APP_URL
  ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  : 'http://localhost:3000';

export const BRANDING = {
  name: 'Smartimmo',
  /** Chemin relatif du logo (pour Next.js Image, layout, etc.) */
  logoUrl: '/logo-smartimmo.png',
  primaryColor: '#6D28D9',
  secondaryColor: '#B100D6',
} as const;

/** Retourne l’URL absolue du logo (pour PDF / emails côté serveur) */
export function getLogoEmailUrl(): string {
  return APP_BASE + BRANDING.logoUrl;
}

export function getLogoPdfUrl(): string {
  return APP_BASE + BRANDING.logoUrl;
}

/**
 * Branding par organisation (multi-tenant futur)
 * Pour l’instant, retourne le branding par défaut
 */
export function getBrandingForOrg(_organizationId?: string | null) {
  return { ...BRANDING, logoEmailUrl: getLogoEmailUrl(), logoPdfUrl: getLogoPdfUrl() };
}
