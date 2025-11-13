/**
 * Générateur de catalogue SQL dynamique depuis Prisma
 * Extrait tables, colonnes, relations + alias FR
 */

import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Alias FR → tables Prisma
export const TABLE_ALIASES_FR: Record<string, string> = {
  bien: 'Property',
  biens: 'Property',
  propriété: 'Property',
  propriétés: 'Property',
  immeuble: 'Property',
  appartement: 'Property',
  
  locataire: 'Tenant',
  locataires: 'Tenant',
  
  bail: 'Lease',
  baux: 'Lease',
  location: 'Lease',
  
  transaction: 'Transaction',
  transactions: 'Transaction',
  mouvement: 'Transaction',
  
  prêt: 'Loan',
  prêts: 'Loan',
  emprunt: 'Loan',
  emprunts: 'Loan',
  crédit: 'Loan',
  
  document: 'Document',
  documents: 'Document',
  fichier: 'Document',
  
  paiement: 'Payment',
  règlement: 'Payment',
  
  catégorie: 'Category',
  
  échéance: 'EcheanceRecurrente',
  écheances: 'EcheanceRecurrente',
};

// Alias FR → colonnes (pattern matching)
export const COLUMN_ALIASES_FR: Record<string, Record<string, string>> = {
  Property: {
    nom: 'name',
    adresse: 'address',
    'code postal': 'postalCode',
    ville: 'city',
    type: 'type',
    surface: 'surface',
    pièces: 'rooms',
    'date acquisition': 'acquisitionDate',
    'prix acquisition': 'acquisitionPrice',
    'frais notaire': 'notaryFees',
    'valeur actuelle': 'currentValue',
    statut: 'status',
  },
  
  Tenant: {
    prénom: 'firstName',
    nom: 'lastName',
    email: 'email',
    téléphone: 'phone',
    'date naissance': 'birthDate',
    nationalité: 'nationality',
    profession: 'occupation',
    employeur: 'employer',
    'revenu mensuel': 'monthlyIncome',
    statut: 'status',
  },
  
  Lease: {
    type: 'type',
    'date début': 'startDate',
    'date fin': 'endDate',
    loyer: 'rentAmount',
    'montant loyer': 'rentAmount',
    charges: 'chargesRecupMensuelles',
    'charges récupérables': 'chargesRecupMensuelles',
    'charges non récupérables': 'chargesNonRecupMensuelles',
    dépôt: 'deposit',
    'dépôt de garantie': 'deposit',
    caution: 'deposit',
    statut: 'status',
    'jour paiement': 'paymentDay',
    indexation: 'indexationType',
    'type indexation': 'indexationType',
  },
  
  Transaction: {
    montant: 'amount',
    date: 'date',
    'date paiement': 'paidAt',
    'payé le': 'paidAt',
    nature: 'nature',
    catégorie: 'categoryId',
    libellé: 'label',
    référence: 'reference',
    statut: 'rapprochementStatus',
    mois: 'month',
    année: 'year',
  },
  
  Loan: {
    libellé: 'label',
    capital: 'principal',
    'capital initial': 'principal',
    taux: 'annualRatePct',
    'taux annuel': 'annualRatePct',
    durée: 'durationMonths',
    'durée mois': 'durationMonths',
    mensualité: 'monthlyPayment',
    'date début': 'startDate',
    'date fin': 'endDate',
    actif: 'isActive',
  },
  
  Document: {
    nom: 'fileName',
    'nom fichier': 'fileName',
    type: 'documentTypeId',
    statut: 'status',
    'statut ocr': 'ocrStatus',
    'texte ocr': 'extractedText',
    'date upload': 'uploadedAt',
    'uploadé le': 'uploadedAt',
  },
};

// Synonymes métier → conditions SQL
export const BUSINESS_SYNONYMS: Record<string, string> = {
  'baux actifs': "status IN ('ACTIF', 'SIGNE', 'EN_COURS')",
  'baux en cours': "status IN ('ACTIF', 'SIGNE', 'EN_COURS')",
  'loyers encaissés': "nature = 'LOYER' AND \"paidAt\" IS NOT NULL",
  'loyers payés': "nature = 'LOYER' AND \"paidAt\" IS NOT NULL",
  'loyers reçus': "nature = 'LOYER' AND \"paidAt\" IS NOT NULL",
  'loyers dus': "nature = 'LOYER' AND \"paidAt\" IS NULL",
  'loyers impayés': "nature = 'LOYER' AND \"paidAt\" IS NULL",
  'en retard': "\"paidAt\" IS NULL AND date < CURRENT_DATE - INTERVAL '5 days'",
  'documents à classer': "status = 'pending'",
  'prêts actifs': "\"isActive\" = true",
  'capital restant dû': 'remainingPrincipal',
  'crd': 'remainingPrincipal',
};

/**
 * Structure du catalogue SQL
 */
export interface SqlCatalog {
  version: string;
  generatedAt: string;
  tables: TableInfo[];
  views: ViewInfo[];
  aliasesFr: {
    tables: Record<string, string>;
    columns: Record<string, Record<string, string>>;
    synonyms: Record<string, string>;
  };
}

export interface TableInfo {
  name: string;
  aliasFr?: string;
  columns: ColumnInfo[];
  relations: RelationInfo[];
  description?: string;
}

export interface ColumnInfo {
  name: string;
  type: string;
  aliasFr?: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  description?: string;
}

export interface RelationInfo {
  name: string;
  type: 'one-to-many' | 'many-to-one' | 'one-to-one' | 'many-to-many';
  relatedTable: string;
  foreignKey?: string;
}

export interface ViewInfo {
  name: string;
  description?: string;
  columns: string[];
}

/**
 * Génère le catalogue SQL depuis le schéma Prisma
 */
export async function generateSqlCatalog(): Promise<SqlCatalog> {
  const prisma = new PrismaClient();

  // Tables autorisées (whitelist)
  const allowedTables = [
    'Property', 'Lease', 'Tenant', 'Transaction', 'Loan', 'Document',
    'Payment', 'Category', 'DocumentType', 'ManagementCompany',
    'EcheanceRecurrente', 'Photo', 'OccupancyHistory',
  ];

  // Vues autorisées
  const allowedViews = [
    'v_loyers_encaissements_mensuels',
    'v_loyers_a_encaisser_courant',
    'v_echeances_3_mois',
    'v_prets_statut',
    'v_documents_statut',
    'v_cashflow_global',
  ];

  const tables: TableInfo[] = [];

  // Introspection simplifiée (schema hardcodé pour l'instant)
  // En production, utiliser Prisma.dmmf ou introspection SQL
  
  // Property
  tables.push({
    name: 'Property',
    aliasFr: 'Bien immobilier',
    description: 'Biens immobiliers (appartements, maisons, etc.)',
    columns: [
      { name: 'id', type: 'String', nullable: false, isPrimaryKey: true, isForeignKey: false, aliasFr: 'identifiant' },
      { name: 'name', type: 'String', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'nom' },
      { name: 'address', type: 'String', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'adresse' },
      { name: 'postalCode', type: 'String', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'code postal' },
      { name: 'city', type: 'String', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'ville' },
      { name: 'type', type: 'String', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'type' },
      { name: 'surface', type: 'Float', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'surface' },
      { name: 'rooms', type: 'Int', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'pièces' },
      { name: 'acquisitionPrice', type: 'Float', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'prix acquisition' },
      { name: 'currentValue', type: 'Float', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'valeur actuelle' },
      { name: 'status', type: 'String', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'statut' },
    ],
    relations: [
      { name: 'leases', type: 'one-to-many', relatedTable: 'Lease' },
      { name: 'loans', type: 'one-to-many', relatedTable: 'Loan' },
      { name: 'transactions', type: 'one-to-many', relatedTable: 'Transaction' },
    ],
  });

  // Lease
  tables.push({
    name: 'Lease',
    aliasFr: 'Bail',
    description: 'Baux de location',
    columns: [
      { name: 'id', type: 'String', nullable: false, isPrimaryKey: true, isForeignKey: false },
      { name: 'propertyId', type: 'String', nullable: false, isPrimaryKey: false, isForeignKey: true, aliasFr: 'bien' },
      { name: 'tenantId', type: 'String', nullable: false, isPrimaryKey: false, isForeignKey: true, aliasFr: 'locataire' },
      { name: 'type', type: 'String', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'type' },
      { name: 'startDate', type: 'DateTime', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'date début' },
      { name: 'endDate', type: 'DateTime', nullable: true, isPrimaryKey: false, isForeignKey: false, aliasFr: 'date fin' },
      { name: 'rentAmount', type: 'Float', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'loyer' },
      { name: 'deposit', type: 'Float', nullable: true, isPrimaryKey: false, isForeignKey: false, aliasFr: 'dépôt de garantie' },
      { name: 'chargesRecupMensuelles', type: 'Float', nullable: true, isPrimaryKey: false, isForeignKey: false, aliasFr: 'charges récupérables' },
      { name: 'status', type: 'String', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'statut' },
      { name: 'indexationType', type: 'String', nullable: true, isPrimaryKey: false, isForeignKey: false, aliasFr: 'type indexation' },
    ],
    relations: [
      { name: 'property', type: 'many-to-one', relatedTable: 'Property', foreignKey: 'propertyId' },
      { name: 'tenant', type: 'many-to-one', relatedTable: 'Tenant', foreignKey: 'tenantId' },
      { name: 'transactions', type: 'one-to-many', relatedTable: 'Transaction' },
    ],
  });

  // Tenant
  tables.push({
    name: 'Tenant',
    aliasFr: 'Locataire',
    description: 'Locataires',
    columns: [
      { name: 'id', type: 'String', nullable: false, isPrimaryKey: true, isForeignKey: false },
      { name: 'firstName', type: 'String', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'prénom' },
      { name: 'lastName', type: 'String', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'nom' },
      { name: 'email', type: 'String', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'email' },
      { name: 'phone', type: 'String', nullable: true, isPrimaryKey: false, isForeignKey: false, aliasFr: 'téléphone' },
      { name: 'monthlyIncome', type: 'Float', nullable: true, isPrimaryKey: false, isForeignKey: false, aliasFr: 'revenu mensuel' },
      { name: 'status', type: 'String', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'statut' },
    ],
    relations: [
      { name: 'leases', type: 'one-to-many', relatedTable: 'Lease' },
    ],
  });

  // Transaction
  tables.push({
    name: 'Transaction',
    aliasFr: 'Transaction',
    description: 'Transactions financières',
    columns: [
      { name: 'id', type: 'String', nullable: false, isPrimaryKey: true, isForeignKey: false },
      { name: 'propertyId', type: 'String', nullable: false, isPrimaryKey: false, isForeignKey: true },
      { name: 'leaseId', type: 'String', nullable: true, isPrimaryKey: false, isForeignKey: true },
      { name: 'label', type: 'String', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'libellé' },
      { name: 'amount', type: 'Float', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'montant' },
      { name: 'date', type: 'DateTime', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'date' },
      { name: 'paidAt', type: 'DateTime', nullable: true, isPrimaryKey: false, isForeignKey: false, aliasFr: 'date paiement' },
      { name: 'nature', type: 'String', nullable: true, isPrimaryKey: false, isForeignKey: false, aliasFr: 'nature' },
      { name: 'month', type: 'Int', nullable: true, isPrimaryKey: false, isForeignKey: false, aliasFr: 'mois' },
      { name: 'year', type: 'Int', nullable: true, isPrimaryKey: false, isForeignKey: false, aliasFr: 'année' },
    ],
    relations: [
      { name: 'property', type: 'many-to-one', relatedTable: 'Property', foreignKey: 'propertyId' },
      { name: 'lease', type: 'many-to-one', relatedTable: 'Lease', foreignKey: 'leaseId' },
    ],
  });

  // Loan
  tables.push({
    name: 'Loan',
    aliasFr: 'Prêt',
    description: 'Prêts immobiliers',
    columns: [
      { name: 'id', type: 'String', nullable: false, isPrimaryKey: true, isForeignKey: false },
      { name: 'propertyId', type: 'String', nullable: false, isPrimaryKey: false, isForeignKey: true },
      { name: 'label', type: 'String', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'libellé' },
      { name: 'principal', type: 'Decimal', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'capital initial' },
      { name: 'annualRatePct', type: 'Decimal', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'taux annuel' },
      { name: 'durationMonths', type: 'Int', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'durée en mois' },
      { name: 'startDate', type: 'DateTime', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'date début' },
      { name: 'endDate', type: 'DateTime', nullable: true, isPrimaryKey: false, isForeignKey: false, aliasFr: 'date fin' },
      { name: 'isActive', type: 'Boolean', nullable: false, isPrimaryKey: false, isForeignKey: false, aliasFr: 'actif' },
    ],
    relations: [
      { name: 'property', type: 'many-to-one', relatedTable: 'Property', foreignKey: 'propertyId' },
    ],
  });

  // Vues
  const views: ViewInfo[] = allowedViews.map(viewName => ({
    name: viewName,
    columns: [], // À compléter si besoin
    description: getViewDescription(viewName),
  }));

  const catalog: SqlCatalog = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    tables,
    views,
    aliasesFr: {
      tables: TABLE_ALIASES_FR,
      columns: COLUMN_ALIASES_FR,
      synonyms: BUSINESS_SYNONYMS,
    },
  };

  await prisma.$disconnect();

  return catalog;
}

function getViewDescription(viewName: string): string {
  const descriptions: Record<string, string> = {
    v_loyers_encaissements_mensuels: 'Encaissements de loyers par mois, bien et bail',
    v_loyers_a_encaisser_courant: 'Loyers dus vs payés pour le mois courant',
    v_echeances_3_mois: 'Échéances à venir sur 90 jours (indexations + prêts)',
    v_prets_statut: 'Statut des prêts (CRD, mensualités, échéances)',
    v_documents_statut: 'Suivi des documents par type et période',
    v_cashflow_global: 'Cashflow global (entrées vs sorties)',
  };
  return descriptions[viewName] || '';
}

/**
 * Sauvegarde le catalogue en JSON
 */
export async function saveCatalogToFile(catalog: SqlCatalog, outputPath?: string): Promise<void> {
  const path = outputPath || resolve(__dirname, './catalog.json');
  writeFileSync(path, JSON.stringify(catalog, null, 2), 'utf-8');
  console.log(`✅ Catalogue SQL sauvegardé: ${path}`);
}



