/**
 * Manifest des variables requises pour la génération de baux PDF
 * Format: "objet.champ" pour navigation dans les données
 */

export type LeaseType = 'vide' | 'meuble' | 'garage';

export interface LeaseManifestField {
  path: string;
  label: string;
  required: boolean;
  defaultValue?: any;
}

export const leaseManifest: Record<LeaseType, LeaseManifestField[]> = {
  vide: [
    // Bailleur
    { path: 'landlord.fullName', label: 'Nom complet du bailleur', required: true },
    { path: 'landlord.address1', label: 'Adresse du bailleur', required: true },
    { path: 'landlord.postalCode', label: 'Code postal du bailleur', required: true },
    { path: 'landlord.city', label: 'Ville du bailleur', required: true },
    { path: 'landlord.email', label: 'Email du bailleur', required: true },
    { path: 'landlord.phone', label: 'Téléphone du bailleur', required: false },
    
    // Locataire
    { path: 'tenant.firstName', label: 'Prénom du locataire', required: true },
    { path: 'tenant.lastName', label: 'Nom du locataire', required: true },
    { path: 'tenant.email', label: 'Email du locataire', required: true },
    { path: 'tenant.phone', label: 'Téléphone du locataire', required: false },
    { path: 'tenant.birthDate', label: 'Date de naissance du locataire', required: false },
    
    // Bien
    { path: 'property.name', label: 'Nom du bien', required: true },
    { path: 'property.address', label: 'Adresse du bien', required: true },
    { path: 'property.postalCode', label: 'Code postal du bien', required: true },
    { path: 'property.city', label: 'Ville du bien', required: true },
    { path: 'property.surface', label: 'Surface habitable (m²)', required: true },
    { path: 'property.rooms', label: 'Nombre de pièces principales', required: true },
    
    // Bail
    { path: 'lease.startDate', label: 'Date de début du bail', required: true },
    { path: 'lease.rentAmount', label: 'Montant du loyer hors charges', required: true },
    { path: 'lease.charges', label: 'Montant des charges', required: false, defaultValue: 0 },
    { path: 'lease.deposit', label: 'Dépôt de garantie', required: false, defaultValue: 0 },
    { path: 'lease.paymentDay', label: 'Jour de paiement', required: true, defaultValue: 1 },
    { path: 'lease.noticeMonths', label: 'Préavis (mois)', required: false, defaultValue: 3 },
    { path: 'lease.indexationType', label: 'Type d\'indexation', required: false, defaultValue: 'IRL' },
  ],
  
  meuble: [
    // Bailleur
    { path: 'landlord.fullName', label: 'Nom complet du bailleur', required: true },
    { path: 'landlord.address1', label: 'Adresse du bailleur', required: true },
    { path: 'landlord.postalCode', label: 'Code postal du bailleur', required: true },
    { path: 'landlord.city', label: 'Ville du bailleur', required: true },
    { path: 'landlord.email', label: 'Email du bailleur', required: true },
    
    // Locataire
    { path: 'tenant.firstName', label: 'Prénom du locataire', required: true },
    { path: 'tenant.lastName', label: 'Nom du locataire', required: true },
    { path: 'tenant.email', label: 'Email du locataire', required: true },
    { path: 'tenant.phone', label: 'Téléphone du locataire', required: false },
    
    // Bien
    { path: 'property.name', label: 'Nom du bien', required: true },
    { path: 'property.address', label: 'Adresse du bien', required: true },
    { path: 'property.postalCode', label: 'Code postal du bien', required: true },
    { path: 'property.city', label: 'Ville du bien', required: true },
    { path: 'property.surface', label: 'Surface habitable (m²)', required: true },
    
    // Bail
    { path: 'lease.startDate', label: 'Date de début du bail', required: true },
    { path: 'lease.rentAmount', label: 'Montant du loyer charges comprises', required: true },
    { path: 'lease.deposit', label: 'Dépôt de garantie', required: true },
    { path: 'lease.paymentDay', label: 'Jour de paiement', required: false, defaultValue: 1 },
    { path: 'lease.noticeMonths', label: 'Préavis (mois)', required: false, defaultValue: 1 },
  ],
  
  garage: [
    // Bailleur
    { path: 'landlord.fullName', label: 'Nom complet du bailleur', required: true },
    { path: 'landlord.address1', label: 'Adresse du bailleur', required: true },
    { path: 'landlord.city', label: 'Ville du bailleur', required: true },
    
    // Locataire
    { path: 'tenant.firstName', label: 'Prénom du locataire', required: true },
    { path: 'tenant.lastName', label: 'Nom du locataire', required: true },
    
    // Bien (garage)
    { path: 'property.name', label: 'Désignation du garage', required: true },
    { path: 'property.address', label: 'Adresse du garage', required: true },
    { path: 'property.city', label: 'Ville', required: true },
    
    // Bail
    { path: 'lease.startDate', label: 'Date de début', required: true },
    { path: 'lease.endDate', label: 'Date de fin', required: false },
    { path: 'lease.rentAmount', label: 'Loyer mensuel', required: true },
    { path: 'lease.deposit', label: 'Dépôt de garantie', required: false, defaultValue: 0 },
  ],
};

/**
 * Récupère le manifest pour un type de bail donné
 */
export function getManifestForLeaseType(type: LeaseType): LeaseManifestField[] {
  return leaseManifest[type] || leaseManifest.vide;
}

/**
 * Récupère uniquement les champs obligatoires
 */
export function getRequiredFields(type: LeaseType): LeaseManifestField[] {
  return getManifestForLeaseType(type).filter(f => f.required);
}

