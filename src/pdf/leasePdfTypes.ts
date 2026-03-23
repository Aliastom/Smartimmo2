/**
 * Types partagés pour le PDF bail (React-PDF)
 */

export type LeasePdfLease = {
  id: string;
  type: string;
  startDate: string;
  endDate?: string | null;
  rentAmount: number;
  chargesRecupMensuelles?: number | null;
  deposit?: number | null;
  paymentDay?: number | null;
  notes?: string | null;
  furnishedType?: string | null;
  noticeMonths?: number | null;
  indexationType?: string | null;
  overridesJson?: string | null;
};

export type LeasePdfProperty = {
  name: string;
  address: string;
  city?: string | null;
  postalCode?: string | null;
  surface?: number | null;
  rooms?: number | null;
};

export type LeasePdfTenant = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  birthDate?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
};

/** Branding optionnel (priorité sur profile.logo si logoUrl défini) */
export type LeasePdfBranding = {
  logoUrl?: string | null;
};

export type LeasePdfProfile = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  company?: string;
  signature?: string;
  logo?: string;
};
