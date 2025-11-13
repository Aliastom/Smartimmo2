/**
 * KPI Registry - Catalogue exhaustif des métriques disponibles
 * Chaque KPI définit : label, requête SQL paramétrée, type, format
 */

export type Metric = {
  label: string;
  sql: string; // $1=userId (optionnel selon la table), $2=from, $3=to, $4=propertyId?, $5=tenantId?
  type: "number" | "currency" | "percent" | "days";
  format?: "€" | "%" | "count" | "days";
  supportsTime?: boolean;
  supportsProperty?: boolean;
  supportsTenant?: boolean;
};

export const KPI_REGISTRY: Record<string, Metric> = {
  // ═══════════════════════════════════════════════════════════════
  // BIENS
  // ═══════════════════════════════════════════════════════════════
  "properties.total.count": {
    label: "Nombre total de biens",
    sql: `SELECT COUNT(*) AS value FROM "Property" WHERE "isArchived" = false;`,
    type: "number",
    format: "count",
  },
  "properties.vacant.count": {
    label: "Nombre de biens vacants",
    sql: `SELECT COUNT(*) AS value FROM "Property" WHERE "isArchived" = false AND status = 'VACANT';`,
    type: "number",
    format: "count",
  },
  "properties.rented.count": {
    label: "Nombre de biens loués",
    sql: `SELECT COUNT(*) AS value FROM "Property" WHERE "isArchived" = false AND status = 'RENTED';`,
    type: "number",
    format: "count",
  },

  // ═══════════════════════════════════════════════════════════════
  // BAUX
  // ═══════════════════════════════════════════════════════════════
  "leases.total.count": {
    label: "Nombre total de baux",
    sql: `SELECT COUNT(*) AS value FROM "Lease";`,
    type: "number",
    format: "count",
  },
  "leases.active.count": {
    label: "Nombre de baux actifs",
    sql: `SELECT COUNT(*) AS value FROM "Lease" WHERE status = 'ACTIF';`,
    type: "number",
    format: "count",
  },
  "leases.ending.soon.count": {
    label: "Baux arrivant à échéance (<60j)",
    sql: `SELECT COUNT(*) AS value FROM "Lease" 
          WHERE status = 'ACTIF' 
          AND "endDate" IS NOT NULL 
          AND "endDate" <= (CURRENT_DATE + INTERVAL '60 days');`,
    type: "number",
    format: "count",
  },

  // ═══════════════════════════════════════════════════════════════
  // LOCATAIRES
  // ═══════════════════════════════════════════════════════════════
  "tenants.total.count": {
    label: "Nombre de locataires",
    sql: `SELECT COUNT(*) AS value FROM "Tenant";`,
    type: "number",
    format: "count",
  },
  "tenants.with.activeLease.count": {
    label: "Locataires avec bail actif",
    sql: `SELECT COUNT(DISTINCT t.id) AS value 
          FROM "Tenant" t 
          WHERE EXISTS (
            SELECT 1 FROM "Lease" l 
            WHERE l."tenantId" = t.id AND l.status = 'ACTIF'
          );`,
    type: "number",
    format: "count",
  },

  // ═══════════════════════════════════════════════════════════════
  // TRANSACTIONS - REVENUS & DÉPENSES (filtrables par période)
  // ═══════════════════════════════════════════════════════════════
  "income.total.sum": {
    label: "Revenus totaux",
    sql: `SELECT COALESCE(SUM(amount), 0) AS value 
          FROM "Transaction" t
          LEFT JOIN "Category" c ON t."categoryId" = c.id
          WHERE c.type = 'INCOME' 
          AND t.date >= $1 
          AND t.date < $2;`,
    type: "currency",
    format: "€",
    supportsTime: true,
  },
  "rents.received.sum": {
    label: "Loyers encaissés",
    sql: `SELECT COALESCE(SUM(amount), 0) AS value 
          FROM "Transaction" t
          LEFT JOIN "Category" c ON t."categoryId" = c.id
          WHERE c.type = 'INCOME' 
          AND c.slug = 'loyer'
          AND t.date >= $1 
          AND t.date < $2;`,
    type: "currency",
    format: "€",
    supportsTime: true,
  },
  "expenses.total.sum": {
    label: "Dépenses totales",
    sql: `SELECT COALESCE(SUM(amount), 0) AS value 
          FROM "Transaction" t
          LEFT JOIN "Category" c ON t."categoryId" = c.id
          WHERE c.type = 'EXPENSE' 
          AND t.date >= $1 
          AND t.date < $2;`,
    type: "currency",
    format: "€",
    supportsTime: true,
  },
  "cashflow.net.sum": {
    label: "Cashflow net (revenus - dépenses)",
    sql: `SELECT 
            (COALESCE(SUM(CASE WHEN c.type = 'INCOME' THEN t.amount ELSE 0 END), 0) -
             COALESCE(SUM(CASE WHEN c.type = 'EXPENSE' THEN t.amount ELSE 0 END), 0)) AS value
          FROM "Transaction" t
          LEFT JOIN "Category" c ON t."categoryId" = c.id
          WHERE t.date >= $1 
          AND t.date < $2;`,
    type: "currency",
    format: "€",
    supportsTime: true,
  },

  // ═══════════════════════════════════════════════════════════════
  // DOCUMENTS
  // ═══════════════════════════════════════════════════════════════
  "documents.total.count": {
    label: "Nombre total de documents",
    sql: `SELECT COUNT(*) AS value FROM "Document" WHERE "deletedAt" IS NULL;`,
    type: "number",
    format: "count",
  },
  "documents.ocr.pending.count": {
    label: "Documents non classés (OCR à traiter)",
    sql: `SELECT COUNT(*) AS value 
          FROM "Document" 
          WHERE "deletedAt" IS NULL 
          AND "ocrStatus" = 'pending';`,
    type: "number",
    format: "count",
  },
  "documents.by.property.count": {
    label: "Documents par bien",
    sql: `SELECT COUNT(*) AS value 
          FROM "Document" 
          WHERE "deletedAt" IS NULL 
          AND "propertyId" = $1;`,
    type: "number",
    format: "count",
    supportsProperty: true,
  },

  // ═══════════════════════════════════════════════════════════════
  // PRÊTS
  // ═══════════════════════════════════════════════════════════════
  "loans.active.count": {
    label: "Nombre de prêts actifs",
    sql: `SELECT COUNT(*) AS value FROM "Loan" WHERE "isActive" = true;`,
    type: "number",
    format: "count",
  },
  "loans.total.principal.sum": {
    label: "Capital emprunté total",
    sql: `SELECT COALESCE(SUM(principal), 0) AS value 
          FROM "Loan" 
          WHERE "isActive" = true;`,
    type: "currency",
    format: "€",
  },
};

