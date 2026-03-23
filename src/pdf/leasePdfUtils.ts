import type { LeasePdfLease } from './leasePdfTypes';

export const euro = (v?: number | null) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(v ?? 0));

export const frDate = (v?: string | null) => {
  if (!v) return 'Non définie';
  try {
    return new Date(v).toLocaleDateString('fr-FR');
  } catch {
    return 'Non définie';
  }
};

export const joinAddress = (a?: string | null, cp?: string | null, city?: string | null) =>
  [a, cp, city].filter(Boolean).join(' ');

export const leaseTypeTitle = (type: string, furnishedType?: string | null) => {
  if (type === 'garage') return 'Contrat de location — Emplacement de stationnement';
  if (furnishedType === 'meuble' || furnishedType === 'MEUBLE') return 'Contrat de location — Logement meublé';
  return 'Contrat de location — Logement vide';
};

export const propertyTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    residential: 'Logement',
    commercial: 'Local commercial',
    garage: 'Emplacement / garage',
  };
  return map[type] || type;
};

/** Durée rédigée + détail années/mois pour texte légal */
export function computeLeaseDuration(lease: LeasePdfLease): { text: string; years: number; months: number } {
  const start = lease.startDate ? new Date(lease.startDate) : null;
  const end = lease.endDate ? new Date(lease.endDate) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { text: 'trois (3) ans', years: 3, months: 0 };
  }
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  if (months < 0) {
    years--;
    months += 12;
  }
  let text = '';
  if (years > 0 && months > 0) {
    text = `${years === 1 ? 'un (1) an' : `${years} ans`} et ${months === 1 ? 'un (1) mois' : `${months} mois`}`;
  } else if (years > 0) {
    text = years === 1 ? 'un (1) an' : `${years} ans`;
  } else if (months > 0) {
    text = months === 1 ? 'un (1) mois' : `${months} mois`;
  } else {
    const diff = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    text = diff === 1 ? 'un (1) jour' : `${diff} jours`;
  }
  return { text, years, months };
}

/** Préavis locataire (mois) : loi 89 — 3 mois vide, 1 mois meublé ; sinon noticeMonths du bail */
export function tenantNoticeMonths(lease: LeasePdfLease): number {
  if (lease.noticeMonths != null && lease.noticeMonths > 0) return lease.noticeMonths;
  const f = lease.furnishedType?.toLowerCase();
  if (f === 'meuble' || f === 'meublé') return 1;
  return 3;
}
