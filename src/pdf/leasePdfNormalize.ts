import type {
  LeasePdfBranding,
  LeasePdfLease,
  LeasePdfProfile,
  LeasePdfProperty,
  LeasePdfTenant,
} from './leasePdfTypes';
import type { LeasePdfClausesConfig } from './leasePdfClauses';

function toIso(d: unknown): string | null {
  if (d == null) return null;
  if (typeof d === 'string') return d;
  if (d instanceof Date) return d.toISOString();
  return null;
}

/** Accepte un bail partiel (API, Prisma) et produit la forme attendue par les sections PDF */
export function normalizeLeaseForPdf(raw: Record<string, unknown>): LeasePdfLease {
  return {
    id: String(raw.id ?? ''),
    type: String(raw.type ?? 'residential'),
    startDate: toIso(raw.startDate) ?? '',
    endDate: toIso(raw.endDate),
    rentAmount: Number(raw.rentAmount ?? 0),
    chargesRecupMensuelles: raw.chargesRecupMensuelles != null ? Number(raw.chargesRecupMensuelles) : null,
    deposit: raw.deposit != null ? Number(raw.deposit) : null,
    paymentDay: raw.paymentDay != null ? Number(raw.paymentDay) : null,
    notes: raw.notes != null ? String(raw.notes) : null,
    furnishedType: raw.furnishedType != null ? String(raw.furnishedType) : null,
    noticeMonths: raw.noticeMonths != null ? Number(raw.noticeMonths) : null,
    indexationType: raw.indexationType != null ? String(raw.indexationType) : null,
    overridesJson: raw.overridesJson != null ? String(raw.overridesJson) : null,
  };
}

export function normalizePropertyForPdf(raw: Record<string, unknown>): LeasePdfProperty {
  return {
    name: String(raw.name ?? ''),
    address: String(raw.address ?? ''),
    city: raw.city != null ? String(raw.city) : null,
    postalCode: raw.postalCode != null ? String(raw.postalCode) : null,
    surface: raw.surface != null ? Number(raw.surface) : null,
    rooms: raw.rooms != null ? Number(raw.rooms) : null,
  };
}

export function normalizeTenantForPdf(raw: Record<string, unknown>): LeasePdfTenant {
  return {
    firstName: String(raw.firstName ?? ''),
    lastName: String(raw.lastName ?? ''),
    email: String(raw.email ?? ''),
    phone: raw.phone != null ? String(raw.phone) : null,
    birthDate: toIso(raw.birthDate),
    address: raw.address != null ? String(raw.address) : null,
    postalCode: raw.postalCode != null ? String(raw.postalCode) : null,
    city: raw.city != null ? String(raw.city) : null,
  };
}

export function normalizeProfileForPdf(raw?: Record<string, unknown> | null): LeasePdfProfile | undefined {
  if (!raw) return undefined;
  return {
    firstName: String(raw.firstName ?? ''),
    lastName: String(raw.lastName ?? ''),
    email: raw.email != null ? String(raw.email) : undefined,
    phone: raw.phone != null ? String(raw.phone) : undefined,
    address: raw.address != null ? String(raw.address) : undefined,
    city: raw.city != null ? String(raw.city) : undefined,
    postalCode: raw.postalCode != null ? String(raw.postalCode) : undefined,
    company: raw.company != null ? String(raw.company) : undefined,
    signature: raw.signature != null ? String(raw.signature) : undefined,
    logo: raw.logo != null ? String(raw.logo) : undefined,
  };
}

export type LeasePdfIncomingProps = {
  lease: Record<string, unknown>;
  property?: Record<string, unknown>;
  tenant?: Record<string, unknown>;
  /** Alias historique route GET /api/leases/[id]/pdf */
  Property?: Record<string, unknown>;
  Tenant?: Record<string, unknown>;
  profile?: Record<string, unknown> | null;
  generatedAt?: string;
  /** Logo URL / data URL explicite (ex. marque organisation) */
  branding?: LeasePdfBranding | Record<string, unknown> | null;
  /** Surcharge des clauses modulaires (fusionnée après overridesJson du bail) */
  clausesConfig?: Partial<LeasePdfClausesConfig>;
};

function asRecord(v: unknown): Record<string, unknown> | undefined {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return undefined;
}

function normalizeBranding(raw?: LeasePdfBranding | Record<string, unknown> | null): LeasePdfBranding | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const logoUrl = r.logoUrl;
  if (logoUrl != null && String(logoUrl).trim() !== '') {
    return { logoUrl: String(logoUrl) };
  }
  return undefined;
}

export function normalizeLeasePdfBundle(p: LeasePdfIncomingProps) {
  const leaseRec = asRecord(p.lease) ?? {};
  const propertyRaw =
    asRecord(p.property) ??
    asRecord(p.Property) ??
    asRecord(leaseRec.Property);
  const tenantRaw =
    asRecord(p.tenant) ??
    asRecord(p.Tenant) ??
    asRecord(leaseRec.Tenant);
  if (!propertyRaw || !tenantRaw) {
    throw new Error('LeasePdf: property et tenant sont requis (imbriqués dans lease ou passés en props).');
  }
  return {
    lease: normalizeLeaseForPdf(p.lease),
    property: normalizePropertyForPdf(propertyRaw),
    tenant: normalizeTenantForPdf(tenantRaw),
    profile: normalizeProfileForPdf(p.profile ?? undefined),
    branding: normalizeBranding(p.branding ?? undefined),
    generatedAt: p.generatedAt,
  };
}
