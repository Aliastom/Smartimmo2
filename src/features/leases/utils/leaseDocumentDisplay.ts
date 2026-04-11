import { normalizeLeaseContractStatus } from './leaseWorkflowStatus';

type LeaseDocumentLike = {
  status?: string | null;
  metadata?: string | null;
  tagsJson?: string | null;
  documentTypeCode?: string | null;
};

export interface LeaseDocumentDisplayInfo {
  label: string;
  isSigned: boolean;
  badgeLabel: string;
  badgeVariant: 'secondary' | 'warning' | 'success';
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function hasExplicitSignedFlag(document: LeaseDocumentLike | null | undefined): boolean {
  if (!document) return false;

  const metadata = parseJsonObject(document.metadata);
  const tags = parseJsonObject(document.tagsJson);

  const directFlags: unknown[] = [
    metadata?.isSigned,
    metadata?.signed,
    metadata?.signatureCompleted,
    metadata?.signatureStatus,
    tags?.isSigned,
    tags?.signed,
    tags?.signatureCompleted,
    tags?.signatureStatus,
  ];

  return directFlags.some((value) => {
    if (value === true) return true;
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      return v === 'true' || v === 'signed' || v === 'completed' || v === 'done';
    }
    return false;
  });
}

function isSignedByLeaseStatus(leaseStatus: string | null | undefined): boolean {
  const normalized = normalizeLeaseContractStatus(leaseStatus);
  if (normalized === 'ACTIF' || normalized === 'RESILIE') return true;

  const raw = String(leaseStatus || '').trim().toUpperCase();
  return raw === 'SIGNE' || raw === 'SIGNÉ' || raw === 'SIGNED';
}

function isSentForSignature(leaseStatus: string | null | undefined): boolean {
  const raw = String(leaseStatus || '').trim().toUpperCase();
  return raw.includes('ENVOY') || raw === 'SENT';
}

export function getLeaseDocumentDisplayInfo(
  leaseStatus: string | null | undefined,
  document: LeaseDocumentLike | null | undefined
): LeaseDocumentDisplayInfo {
  if (!document) {
    return {
      label: 'Aucun document',
      isSigned: false,
      badgeLabel: 'Projet',
      badgeVariant: 'secondary',
    };
  }

  const signed = hasExplicitSignedFlag(document) || isSignedByLeaseStatus(leaseStatus);
  if (signed) {
    return {
      label: 'Bail signé',
      isSigned: true,
      badgeLabel: 'Signé',
      badgeVariant: 'success',
    };
  }

  const normalized = normalizeLeaseContractStatus(leaseStatus);
  if (normalized === 'A_SIGNER') {
    return {
      label: isSentForSignature(leaseStatus) ? 'Bail envoyé pour signature' : 'Bail à signer',
      isSigned: false,
      badgeLabel: 'À signer',
      badgeVariant: 'warning',
    };
  }

  return {
    label: 'Projet de bail',
    isSigned: false,
    badgeLabel: 'Projet',
    badgeVariant: 'secondary',
  };
}
