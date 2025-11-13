/**
 * Exécuteur SQL sécurisé
 * Utilise le validateur AST + timeout + lecture seule
 */

import { PrismaClient } from '@prisma/client';
import { validateSql, SQL_EXEC_CONFIG, generateSqlCatalog } from './validator';

const prisma = new PrismaClient();

export interface SqlExecutionResult {
  ok: boolean;
  data?: any[];
  rowCount?: number;
  executedSql?: string;
  durationMs?: number;
  error?: string;
  warning?: string;
}

/**
 * Exécute une requête SQL de manière sécurisée
 * @param sql La requête SQL (sera validée)
 * @param params Paramètres optionnels (pour requêtes paramétrées)
 * @returns Résultat d'exécution avec données ou erreur
 */
export async function executeSafeSql(
  sql: string,
  params?: Record<string, any>
): Promise<SqlExecutionResult> {
  const startTime = Date.now();

  try {
    // 1. Valider la requête
    const validation = validateSql(sql);
    if (!validation.ok) {
      return {
        ok: false,
        error: validation.error,
      };
    }

    // 2. Utiliser la version sanitisée (avec LIMIT ajouté si besoin)
    const sqlToExecute = validation.sanitized || sql;

    // 3. Remplacer les paramètres si fournis (simple templating)
    let finalSql = sqlToExecute;
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        const placeholder = `:${key}`;
        const safeValue = escapeSqlValue(value);
        finalSql = finalSql.replace(new RegExp(placeholder, 'g'), safeValue);
      }
    }

    // 4. Exécuter avec timeout
    const data = await executeWithTimeout(finalSql, SQL_EXEC_CONFIG.timeoutMs);

    const durationMs = Date.now() - startTime;

    // 5. Retourner le résultat
    return {
      ok: true,
      data: Array.isArray(data) ? data : [],
      rowCount: Array.isArray(data) ? data.length : 0,
      executedSql: finalSql,
      durationMs,
      warning: validation.warning,
    };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;

    return {
      ok: false,
      error: `Erreur d'exécution SQL: ${error.message}`,
      durationMs,
    };
  }
}

/**
 * Exécute une requête avec un timeout
 */
async function executeWithTimeout(sql: string, timeoutMs: number): Promise<any> {
  return Promise.race([
    prisma.$queryRawUnsafe(sql),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout après ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * Échappe une valeur pour l'insertion SQL (protection basique contre injection)
 * Note: Idéalement utiliser des requêtes paramétrées natives, mais pour simplicité ici
 */
function escapeSqlValue(value: any): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }

  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }

  // String: échapper les quotes
  const strValue = String(value);
  return `'${strValue.replace(/'/g, "''")}'`;
}

/**
 * Génère des exemples de requêtes SQL pour l'agent
 */
export function getSqlExamples(): string[] {
  return [
    // Baux
    `SELECT COUNT(*) as count FROM "Lease" WHERE status IN ('ACTIF', 'EN_COURS', 'SIGNE')`,
    `SELECT "propertyId", COUNT(*) as leases_count FROM "Lease" WHERE status = 'ACTIF' GROUP BY "propertyId" LIMIT 50`,

    // Transactions / Cashflow
    `SELECT SUM(loyers_encaisses) as total, year, month FROM vw_cashflow_month WHERE year = :year GROUP BY year, month LIMIT 12`,
    `SELECT * FROM vw_cashflow_month WHERE year = EXTRACT(YEAR FROM CURRENT_DATE) AND month = EXTRACT(MONTH FROM CURRENT_DATE) LIMIT 100`,

    // Loyers impayés
    `SELECT tenant_name, balance_due, days_late FROM vw_rent_due WHERE status = 'DUE' ORDER BY balance_due DESC LIMIT 50`,
    `SELECT COUNT(*) as unpaid_count, SUM(balance_due) as total_due FROM vw_rent_due WHERE status IN ('DUE', 'PARTIAL')`,

    // Prêts
    `SELECT * FROM vw_loan_status WHERE "isActive" = true ORDER BY capital_remaining DESC LIMIT 50`,
    `SELECT SUM(capital_remaining) as total_debt, SUM(monthly_payment_total) as monthly_total FROM vw_loan_status WHERE "isActive" = true`,

    // Indexations
    `SELECT * FROM vw_indexations_upcoming WHERE months_until_anniversary <= 3 ORDER BY next_anniversary LIMIT 50`,

    // Documents
    `SELECT * FROM vw_docs_status WHERE status = 'MISSING' AND year_month >= TO_CHAR(CURRENT_DATE - INTERVAL '3 months', 'YYYY-MM') LIMIT 100`,
  ];
}

/**
 * Obtient le catalogue SQL pour l'agent
 */
export function getSqlCatalog(): string {
  return generateSqlCatalog();
}

/**
 * Masque les PII dans les résultats (email, téléphone)
 */
export function maskPii(data: any[]): any[] {
  return data.map((row) => {
    const masked: any = { ...row };

    // Masquer les emails
    if (masked.tenant_email || masked.email) {
      const email = masked.tenant_email || masked.email;
      const [username, domain] = email.split('@');
      masked.tenant_email = masked.email = `${username.substring(0, 2)}***@${domain}`;
    }

    // Masquer les téléphones
    if (masked.phone || masked.tenant_phone) {
      const phone = masked.phone || masked.tenant_phone;
      masked.phone = masked.tenant_phone = phone.substring(0, 4) + '******';
    }

    return masked;
  });
}

/**
 * Formatte les résultats SQL pour l'agent (plus lisible)
 */
export function formatSqlResults(results: any[], maxRows = 10): string {
  if (!results || results.length === 0) {
    return 'Aucun résultat.';
  }

  const displayRows = results.slice(0, maxRows);
  const hasMore = results.length > maxRows;

  let output = `Résultats (${results.length} ligne${results.length > 1 ? 's' : ''}):\n\n`;

  // Afficher sous forme de tableau markdown
  if (displayRows.length > 0) {
    const keys = Object.keys(displayRows[0]);
    
    // Header
    output += '| ' + keys.join(' | ') + ' |\n';
    output += '|' + keys.map(() => '---').join('|') + '|\n';

    // Rows
    for (const row of displayRows) {
      output += '| ' + keys.map((k) => formatValue(row[k])).join(' | ') + ' |\n';
    }

    if (hasMore) {
      output += `\n... et ${results.length - maxRows} ligne(s) supplémentaire(s).`;
    }
  }

  return output;
}

/**
 * Formate une valeur pour l'affichage
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return value.toFixed(2).replace(/\.00$/, '');
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (value instanceof Date) return value.toLocaleDateString('fr-FR');
  return String(value);
}

