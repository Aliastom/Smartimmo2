// Service pour récupérer les documents d'un bail via l'API

export interface LeaseDocument {
  id: string;
  filenameOriginal: string;
  DocumentType: {
    code: string;
    label: string;
  };
  url: string;
  createdAt: string;
  status: string;
}

export interface LeaseDocumentsSummary {
  bailSigne: LeaseDocument | null;
  etatLieuxEntrant: LeaseDocument | null;
  etatLieuxSortant: LeaseDocument | null;
  assuranceLocataire: LeaseDocument | null;
  depotGarantie: LeaseDocument | null;
  otherDocuments: LeaseDocument[];
}

export class LeaseDocumentsService {
  /**
   * Récupère tous les documents liés à un bail via l'API
   */
  static async getLeaseDocuments(leaseId: string): Promise<LeaseDocumentsSummary> {
    try {
      const response = await fetch(`/api/leases/${leaseId}/documents`);
      
      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Erreur lors de la récupération des documents');
      }
      
      return result.data;
    } catch (error) {
      console.error('Erreur lors de la récupération des documents du bail:', error);
      return {
        bailSigne: null,
        etatLieuxEntrant: null,
        etatLieuxSortant: null,
        assuranceLocataire: null,
        depotGarantie: null,
        otherDocuments: []
      };
    }
  }

  /**
   * Vérifie si un type de document spécifique existe pour un bail
   */
  static async hasDocumentType(leaseId: string, documentTypeCode: string): Promise<boolean> {
    try {
      const summary = await this.getLeaseDocuments(leaseId);
      
      switch (documentTypeCode) {
        case 'BAIL_SIGNE':
          return summary.bailSigne !== null;
        case 'ETAT_LIEUX_ENTRANT':
          return summary.etatLieuxEntrant !== null;
        case 'ETAT_LIEUX_SORTANT':
          return summary.etatLieuxSortant !== null;
        case 'ASSURANCE_LOCATAIRE':
          return summary.assuranceLocataire !== null;
        case 'DEPOT_GARANTIE':
          return summary.depotGarantie !== null;
        default:
          return summary.otherDocuments.some(doc => doc.DocumentType.code === documentTypeCode);
      }
    } catch (error) {
      console.error('Erreur lors de la vérification du type de document:', error);
      return false;
    }
  }
}
