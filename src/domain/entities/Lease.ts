export interface Lease {
  id: string;
  propertyId: string;
  tenantId: string;
  type: string; // 'residential' | 'commercial'
  furnishedType?: string; // 'vide' | 'meuble' | 'garage'
  startDate: Date;
  endDate?: Date;
  rentAmount: number;
  charges?: number;
  deposit?: number;
  paymentDay?: number;
  notes?: string;
  noticeMonths?: number;
  indexationType?: string;
  overridesJson?: string;
  status: string; // 'BROUILLON' | 'ENVOYÉ' | 'SIGNÉ' | 'ACTIF' | 'RÉSILIÉ' | 'ARCHIVÉ'
  signedPdfUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
