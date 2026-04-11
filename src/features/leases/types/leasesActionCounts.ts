export interface LeasesActionCounts {
  partiels: number;
  retards: number;
  expirant90: number;
  indexations: number;
  leaseIdsPartiels: Set<string>;
  leaseIdsRetards: Set<string>;
  leaseIdsExpirant90: Set<string>;
  leaseIdsIndexations: Set<string>;
}
