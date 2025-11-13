/**
 * Validateur SQL sécurisé avec parser AST
 * Refuse toute requête non-SELECT ou dangereuse
 */

import { parse as parseSql } from 'pgsql-ast-parser';

// Liste blanche des fonctions autorisées
const ALLOWED_FUNCTIONS = new Set([
  // Agrégats
  'count', 'sum', 'avg', 'min', 'max', 'array_agg', 'string_agg',
  // Date/Time
  'now', 'current_date', 'current_timestamp', 'date_trunc', 'extract', 'age', 'to_date', 'to_char',
  // String
  'concat', 'lower', 'upper', 'trim', 'substring', 'replace', 'split_part', 'length',
  // Math
  'round', 'floor', 'ceil', 'abs', 'power', 'sqrt',
  // Cast
  'cast',
  // Conditionnels
  'coalesce', 'nullif', 'case',
  // Autres
  'make_date', 'lpad',
]);

// Liste blanche des tables/vues autorisées
const ALLOWED_TABLES = new Set([
  // Tables principales
  'Property', 'Lease', 'Tenant', 'Transaction', 'Loan', 'Document', 'Payment',
  'Category', 'DocumentType', 'ManagementCompany',
  // Vues analytiques V3+ (anciennes)
  'vw_cashflow_month', 'vw_rent_due', 'vw_loan_status', 
  'vw_indexations_upcoming', 'vw_docs_status',
  // Vues analytiques V1 (nouvelles - pack SQL)
  'v_loyers_encaissements_mensuels',
  'v_loyers_a_encaisser_courant',
  'v_echeances_3_mois',
  'v_prets_statut',
  'v_documents_statut',
  'v_cashflow_global',
  'v_loyers_en_retard', // V2 - avec accounting_month + nature configurée
  // Tables de config
  'AppConfig', 'AppSetting',
]);

// Limites de sécurité
const MAX_LIMIT = 500;
const MAX_QUERY_LENGTH = 5000;
const TIMEOUT_MS = 5000;

export interface SqlValidationResult {
  ok: boolean;
  error?: string;
  warning?: string;
  sanitized?: string; // Requête nettoyée/modifiée si besoin
}

/**
 * Valide une requête SQL avant exécution
 * @param sql La requête SQL à valider
 * @returns Résultat de validation
 */
export function validateSql(sql: string): SqlValidationResult {
  // 1. Vérifier la longueur
  if (sql.length > MAX_QUERY_LENGTH) {
    return {
      ok: false,
      error: `La requête est trop longue (max ${MAX_QUERY_LENGTH} caractères)`,
    };
  }

  // 2. Nettoyer et normaliser
  const cleanSql = sql.trim();

  // 3. Parser le SQL avec pgsql-ast-parser
  let statements;
  try {
    statements = parseSql(cleanSql);
  } catch (error: any) {
    return {
      ok: false,
      error: `Erreur de syntaxe SQL: ${error.message}`,
    };
  }

  // 4. Vérifier qu'il n'y a qu'un seul statement
  if (statements.length !== 1) {
    return {
      ok: false,
      error: 'Une seule requête SQL est autorisée à la fois',
    };
  }

  const statement = statements[0];

  // 5. Vérifier que c'est un SELECT (pas de modifications)
  if (statement.type !== 'select') {
    return {
      ok: false,
      error: `Seules les requêtes SELECT sont autorisées (reçu: ${statement.type.toUpperCase()})`,
    };
  }

  // 6. Vérifier qu'il y a un LIMIT
  let hasLimit = false;
  let limitValue = 0;

  if ('limit' in statement && statement.limit) {
    hasLimit = true;
    // Extraire la valeur du LIMIT
    if (typeof statement.limit === 'object' && 'value' in statement.limit) {
      limitValue = Number(statement.limit.value) || 0;
    }
  }

  // 7. Vérifier que le LIMIT n'est pas trop élevé
  if (hasLimit && limitValue > MAX_LIMIT) {
    return {
      ok: false,
      error: `Le LIMIT est trop élevé (max ${MAX_LIMIT}, reçu: ${limitValue})`,
    };
  }

  // 8. Ajouter un LIMIT si absent (en retournant le SQL modifié)
  let sanitizedSql = cleanSql;
  if (!hasLimit) {
    // Ajouter un LIMIT par défaut
    sanitizedSql = `${cleanSql.replace(/;$/, '')} LIMIT ${MAX_LIMIT}`;
  }

  // 9. Vérifier les tables/vues référencées
  const tableValidation = validateTables(statement);
  if (!tableValidation.ok) {
    return tableValidation;
  }

  // 10. Vérifier les fonctions utilisées
  const functionValidation = validateFunctions(statement);
  if (!functionValidation.ok) {
    return functionValidation;
  }

  // 11. Vérifier qu'il n'y a pas de sous-requêtes complexes ou de CTEs dangereux
  const complexityValidation = validateComplexity(statement);
  if (!complexityValidation.ok) {
    return complexityValidation;
  }

  // Tout est OK
  return {
    ok: true,
    sanitized: sanitizedSql,
    warning: hasLimit ? undefined : `LIMIT ${MAX_LIMIT} ajouté automatiquement`,
  };
}

/**
 * Valide que toutes les tables/vues sont dans la liste blanche
 */
function validateTables(statement: any): SqlValidationResult {
  const tables = extractTables(statement);

  for (const table of tables) {
    if (!ALLOWED_TABLES.has(table)) {
      return {
        ok: false,
        error: `Table/vue non autorisée: "${table}". Tables autorisées: ${Array.from(ALLOWED_TABLES).join(', ')}`,
      };
    }
  }

  return { ok: true };
}

/**
 * Extrait récursivement toutes les tables référencées
 */
function extractTables(node: any, tables: Set<string> = new Set()): Set<string> {
  if (!node || typeof node !== 'object') return tables;

  // Si c'est une référence à une table
  if (node.type === 'table' && node.name) {
    tables.add(typeof node.name === 'string' ? node.name : node.name.name);
  }

  // Parcourir récursivement
  for (const key in node) {
    if (Array.isArray(node[key])) {
      node[key].forEach((item: any) => extractTables(item, tables));
    } else if (typeof node[key] === 'object') {
      extractTables(node[key], tables);
    }
  }

  return tables;
}

/**
 * Valide que toutes les fonctions sont dans la liste blanche
 */
function validateFunctions(statement: any): SqlValidationResult {
  const functions = extractFunctions(statement);

  for (const func of functions) {
    const funcLower = func.toLowerCase();
    if (!ALLOWED_FUNCTIONS.has(funcLower)) {
      return {
        ok: false,
        error: `Fonction non autorisée: "${func}". Fonctions autorisées: ${Array.from(ALLOWED_FUNCTIONS).join(', ')}`,
      };
    }
  }

  return { ok: true };
}

/**
 * Extrait récursivement toutes les fonctions appelées
 */
function extractFunctions(node: any, functions: Set<string> = new Set()): Set<string> {
  if (!node || typeof node !== 'object') return functions;

  // Si c'est un appel de fonction
  if (node.type === 'call' && node.function) {
    const funcName = typeof node.function === 'string' ? node.function : node.function.name;
    if (funcName) {
      functions.add(funcName);
    }
  }

  // Parcourir récursivement
  for (const key in node) {
    if (Array.isArray(node[key])) {
      node[key].forEach((item: any) => extractFunctions(item, functions));
    } else if (typeof node[key] === 'object') {
      extractFunctions(node[key], functions);
    }
  }

  return functions;
}

/**
 * Valide que la requête n'est pas trop complexe
 */
function validateComplexity(statement: any): SqlValidationResult {
  // Compter les CTEs (WITH clauses)
  if ('with' in statement && Array.isArray(statement.with) && statement.with.length > 3) {
    return {
      ok: false,
      error: 'Trop de CTEs (WITH clauses). Maximum 3 autorisées.',
    };
  }

  // Compter les JOINs
  const joinCount = countJoins(statement);
  if (joinCount > 5) {
    return {
      ok: false,
      error: `Trop de JOINs (${joinCount}). Maximum 5 autorisés.`,
    };
  }

  return { ok: true };
}

/**
 * Compte le nombre de JOINs dans la requête
 */
function countJoins(node: any, count = 0): number {
  if (!node || typeof node !== 'object') return count;

  if (node.type === 'join') {
    count++;
  }

  for (const key in node) {
    if (Array.isArray(node[key])) {
      node[key].forEach((item: any) => {
        count = countJoins(item, count);
      });
    } else if (typeof node[key] === 'object') {
      count = countJoins(node[key], count);
    }
  }

  return count;
}

/**
 * Génère un catalogue SQL automatique depuis Prisma
 * (pour aider l'agent à comprendre le schéma)
 */
export function generateSqlCatalog(): string {
  return `
# CATALOGUE SQL - SMARTIMMO

## Tables principales

### Property (Biens immobiliers)
- id, name, type, address, postalCode, city
- surface, rooms, acquisitionDate, acquisitionPrice
- status, occupation, isArchived

### Lease (Baux)
- id, propertyId, tenantId, type
- startDate, endDate, rentAmount, deposit
- status, indexationType

### Tenant (Locataires)
- id, firstName, lastName, email, phone
- status, monthlyIncome

### Transaction (Transactions)
- id, propertyId, leaseId, amount, date
- label, nature, paidAt, rapprochementStatus

### Loan (Prêts)
- id, propertyId, label, principal
- annualRatePct, durationMonths, startDate, endDate
- isActive

### Document (Documents)
- id, propertyId, leaseId, documentTypeId
- fileName, ocrStatus, extractedText
- uploadedAt, deletedAt

### Payment (Paiements - ancien système)
- id, propertyId, leaseId, amount, date
- nature, categoryId

## Vues analytiques (Pack V1)

### v_loyers_encaissements_mensuels
Encaissements de loyers par mois, par bien et bail.
- mois (date), propertyId, leaseId
- loyer_encaisse, loyer_total, nb_baux

### v_loyers_a_encaisser_courant
Loyers dus vs payés pour le mois courant.
- lease_id, property_id, tenant_id
- property_name, tenant_name, tenant_email
- mois, loyer_du, deja_paye, reste_a_payer
- statut ('PAYE' | 'PARTIEL' | 'IMPAYE')

### v_echeances_3_mois
Échéances à 3 mois : indexations + prêts.
- type ('INDEXATION_BAIL' | 'PRET')
- property_id, ref_id, property_name
- montant_actuel, due_date, meta_code, description

### v_prets_statut
Statut des prêts : CRD, mensualité, échéance.
- loan_id, property_id, property_name, label
- capital_initial, taux_annuel
- capital_restant_du, mensualite
- date_debut, date_fin, mois_restants, actif

### v_documents_statut
Documents par type et période.
- property_id, lease_id, type_code, type_label
- periode (YYYY-MM), annee, mois
- ocr_status, status, nb_documents

### v_cashflow_global
Cashflow global : entrées vs sorties.
- mois, property_id, property_name
- entrees, sorties, solde_net

## Vues analytiques (anciennes - à migrer)

### vw_cashflow_month
- year, month, propertyId, property_name
- loyers_encaisses, charges_payees, solde

### vw_rent_due
- lease_id, propertyId, property_name
- tenantId, tenant_name, tenant_email
- expected_amount, paid_amount, balance_due
- status ('PAID' | 'PARTIAL' | 'DUE')
- days_late, year, month

### vw_loan_status
- id, propertyId, property_name, label
- initial_principal, annual_rate
- monthly_payment_total, capital_remaining
- months_remaining, isActive

### vw_indexations_upcoming
- lease_id, propertyId, property_name
- tenantId, tenant_name, current_rent
- indexationType, next_anniversary
- days_until_anniversary, months_until_anniversary

### vw_docs_status
- year_month, doc_type_code, doc_type_label
- docs_received, status ('RECEIVED' | 'MISSING')

## Exemples de requêtes

\`\`\`sql
-- Baux actifs
SELECT COUNT(*) FROM "Lease" WHERE status IN ('ACTIF', 'EN_COURS', 'SIGNE') LIMIT 100;

-- Loyers encaissés ce mois
SELECT SUM(loyers_encaisses) FROM vw_cashflow_month 
WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)
  AND month = EXTRACT(MONTH FROM CURRENT_DATE);

-- Loyers impayés
SELECT tenant_name, tenant_email, balance_due, days_late 
FROM vw_rent_due 
WHERE status = 'DUE' 
ORDER BY balance_due DESC 
LIMIT 50;
\`\`\`
`;
}

/**
 * Configuration pour l'exécution SQL
 */
export const SQL_EXEC_CONFIG = {
  maxLimit: MAX_LIMIT,
  timeoutMs: TIMEOUT_MS,
  readOnly: true, // Toujours en lecture seule
};

