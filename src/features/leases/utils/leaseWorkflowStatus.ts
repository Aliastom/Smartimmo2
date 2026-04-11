export type NormalizedLeaseContractStatus =
  | 'BROUILLON'
  | 'A_SIGNER'
  | 'SIGNE'
  | 'ACTIF'
  | 'RESILIE'
  | 'ARCHIVE';

export interface NormalizedLeaseContractStatusInfo {
  code: NormalizedLeaseContractStatus;
  label: string;
}

export type LeasePaymentHealthCode =
  | 'NON_DEMARRE'
  | 'CLOS'
  | 'RESILIE'
  | 'OK'
  | 'PARTIEL'
  | 'RETARD';

export interface LeasePaymentHealthInfo {
  code: LeasePaymentHealthCode;
  label: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
}

const STATUS_MAP: Record<string, NormalizedLeaseContractStatus> = {
  BROUILLON: 'BROUILLON',
  DRAFT: 'BROUILLON',
  A_SIGNER: 'A_SIGNER',
  A_ENVOYER: 'A_SIGNER',
  À_ENVOYER: 'A_SIGNER',
  TO_SEND: 'A_SIGNER',
  ENVOYE: 'A_SIGNER',
  ENVOYÉ: 'A_SIGNER',
  SENT: 'A_SIGNER',
  SIGNE: 'SIGNE',
  SIGNÉ: 'SIGNE',
  SIGNED: 'SIGNE',
  ACTIF: 'ACTIF',
  ACTIVE: 'ACTIF',
  RESILIE: 'RESILIE',
  RÉSILIÉ: 'RESILIE',
  TERMINATED: 'RESILIE',
  ARCHIVE: 'ARCHIVE',
  ARCHIVED: 'ARCHIVE',
  EXPIRED: 'ARCHIVE',
};

const CONTRACT_LABELS: Record<NormalizedLeaseContractStatus, string> = {
  BROUILLON: 'Brouillon',
  A_SIGNER: 'À signer',
  SIGNE: 'Signé',
  ACTIF: 'Actif',
  RESILIE: 'Résilié',
  ARCHIVE: 'Archivé',
};

export function normalizeLeaseContractStatus(status: string | null | undefined): NormalizedLeaseContractStatus {
  const key = String(status || '').trim().toUpperCase();
  return STATUS_MAP[key] ?? 'BROUILLON';
}

export function getLeaseContractStatusInfo(status: string | null | undefined): NormalizedLeaseContractStatusInfo {
  const code = normalizeLeaseContractStatus(status);
  return {
    code,
    label: CONTRACT_LABELS[code],
  };
}

export function isLeaseContractActive(status: string | null | undefined): boolean {
  return normalizeLeaseContractStatus(status) === 'ACTIF';
}

export function getLeasePaymentHealthInfo(
  status: string | null | undefined,
  timelineStatutGlobal: 'ok' | 'partiel' | 'retard'
): LeasePaymentHealthInfo {
  const contract = normalizeLeaseContractStatus(status);
  if (contract === 'BROUILLON' || contract === 'A_SIGNER' || contract === 'SIGNE') {
    return { code: 'NON_DEMARRE', label: 'Non démarré', tone: 'neutral' };
  }
  if (contract === 'RESILIE') {
    return { code: 'RESILIE', label: 'Résilié', tone: 'neutral' };
  }
  if (contract === 'ARCHIVE') {
    return { code: 'CLOS', label: 'Clos', tone: 'neutral' };
  }
  if (timelineStatutGlobal === 'ok') {
    return { code: 'OK', label: 'OK', tone: 'success' };
  }
  if (timelineStatutGlobal === 'partiel') {
    return { code: 'PARTIEL', label: 'Partiel', tone: 'warning' };
  }
  return { code: 'RETARD', label: 'Retard', tone: 'danger' };
}
