/**
 * POST /api/ai/sql
 * Endpoint SQL direct - traduit question FR → SQL → exécution sécurisée
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeSafeSql, maskPii, formatSqlResults } from '@/lib/ai/sql/executor';
import { generateCompletion } from '@/lib/ai/clients/mistral';
import { randomUUID } from 'crypto';
import catalogData from '@/lib/ai/sql/catalog.json';
import { aiConfig } from '@/lib/ai/config';
import { requireAuth } from '@/lib/auth/getCurrentUser';


// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Vérifier si l'IA est activée
  if (!aiConfig.isEnabled()) {
    return NextResponse.json(
      { error: 'L\'assistant IA est actuellement désactivé' },
      { status: 503 }
    );
  }

  await requireAuth();

  try {
    const body = await request.json();

    const {
      question,
      scope, // {propertyId?, leaseId?, tenantId?, periodStart?, periodEnd?}
      mode = 'auto', // 'auto' | 'sql-only' | 'plan-first'
    } = body;

    // Validation
    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { error: 'La question est requise' },
        { status: 400 }
      );
    }

    const correlationId = randomUUID();
    console.log(`[API:sql:${correlationId}] Question: "${question.substring(0, 100)}..."`);

    // Étape 1 : Plan (sauf si sql-only)
    let plan = '';
    if (mode !== 'sql-only') {
      plan = await generatePlan(question, scope);
      console.log(`[API:sql:${correlationId}] Plan: ${plan.substring(0, 100)}...`);
    }

    // Étape 2 : Génération SQL
    const sql = await generateSqlFromQuestion(question, scope, plan);
    console.log(`[API:sql:${correlationId}] SQL: ${sql.substring(0, 200)}...`);

    // Étape 3 : Exécution sécurisée
    const sqlResult = await executeSafeSql(sql);

    if (!sqlResult.ok) {
      return NextResponse.json({
        ok: false,
        error: sqlResult.error,
        plan,
        sql,
        correlationId,
      });
    }

    // Étape 4 : Masquage PII si besoin
    let data = sqlResult.data || [];
    if (data.length > 0 && shouldMaskPii(scope)) {
      data = maskPii(data);
    }

    // Étape 5 : Formatage
    const formatted = formatSqlResults(data, 50);

    // Retour
    return NextResponse.json({
      ok: true,
      plan,
      sql: sqlResult.executedSql || sql,
      rows: data,
      rowCount: data.length,
      formatted,
      metadata: {
        durationMs: sqlResult.durationMs,
        correlationId,
        mode,
      },
    });
  } catch (error: any) {
    console.error('[API:sql] Erreur:', error);

    return NextResponse.json(
      {
        ok: false,
        error: 'Erreur lors de l\'exécution SQL',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * Génère un plan d'action avant la requête SQL
 */
async function generatePlan(question: string, scope: any): Promise<string> {
  const scopeInfo = scope
    ? `Scope: ${JSON.stringify(scope)}`
    : 'Scope: global (toutes données)';

  const prompt = `Tu es un analyste SQL pour Smartimmo.

Question: "${question}"
${scopeInfo}

En 1-2 phrases courtes, explique quelle(s) table(s)/vue(s) tu vas interroger et pourquoi.
Exemples:
- "Je vais compter les baux avec status ACTIF dans la table Lease."
- "Je vais utiliser v_loyers_a_encaisser_courant pour voir les impayés du mois."

Ton plan:`;

  const plan = await generateCompletion(prompt, { maxTokens: 200 });
  return plan.trim();
}

/**
 * Génère une requête SQL depuis une question FR
 */
async function generateSqlFromQuestion(
  question: string,
  scope: any,
  plan: string
): Promise<string> {
  const catalog = catalogData as any;

  // Construire le contexte des tables/vues disponibles
  const tablesInfo = catalog.tables
    .map((t: any) => `- ${t.name} (${t.aliasFr}): ${t.columns.slice(0, 5).map((c: any) => c.name).join(', ')}...`)
    .join('\n');

  const viewsInfo = catalog.views
    .map((v: any) => `- ${v.name}: ${v.description}`)
    .join('\n');

  const scopeConditions = buildScopeConditions(scope);

  const prompt = `Tu es un expert SQL pour Smartimmo (PostgreSQL).

## CATALOGUE DISPONIBLE

Tables:
${tablesInfo}

Vues analytiques (à privilégier):
${viewsInfo}

## RÈGLES
- READ-ONLY : Seul SELECT autorisé
- TOUJOURS ajouter LIMIT (max 500)
- PAS de SELECT *
- Colonnes explicites uniquement
- Utiliser les vues quand possible
- Format PostgreSQL strict
${scopeConditions ? `- FILTRER PAR: ${scopeConditions}` : ''}

## QUESTION
"${question}"

${plan ? `## TON PLAN\n${plan}\n` : ''}

Génère UNIQUEMENT la requête SQL (pas de markdown, pas d'explication).
SQL:`;

  const sql = await generateCompletion(prompt, { maxTokens: 500, temperature: 0.3 });

  // Nettoyer le SQL (retirer markdown si présent)
  let cleanSql = sql.trim()
    .replace(/^```sql\n?/i, '')
    .replace(/^```\n?/, '')
    .replace(/\n?```$/,'')
    .trim();

  // Ajouter LIMIT si absent
  if (!cleanSql.toLowerCase().includes('limit')) {
    cleanSql += ' LIMIT 100';
  }

  return cleanSql;
}

/**
 * Construit les conditions de scope
 */
function buildScopeConditions(scope: any): string {
  if (!scope) return '';

  const conditions: string[] = [];

  if (scope.propertyId) {
    conditions.push(`"propertyId" = '${scope.propertyId}'`);
  }

  if (scope.leaseId) {
    conditions.push(`"leaseId" = '${scope.leaseId}'`);
  }

  if (scope.tenantId) {
    conditions.push(`"tenantId" = '${scope.tenantId}'`);
  }

  if (scope.periodStart && scope.periodEnd) {
    conditions.push(`date BETWEEN '${scope.periodStart}' AND '${scope.periodEnd}'`);
  }

  return conditions.join(' AND ');
}

/**
 * Détermine si on doit masquer les PII
 */
function shouldMaskPii(scope: any): boolean {
  // Par défaut, masquer si pas de scope spécifique
  return !scope || !scope.propertyId;
}

// GET pour documentation
export async function GET() {
  await requireAuth();
  return NextResponse.json({
    endpoint: '/api/ai/sql',
    method: 'POST',
    description: 'Traduit une question FR en SQL et l\'exécute de manière sécurisée',
    body: {
      question: 'string (required) - Question en français',
      scope: 'object (optional) - {propertyId?, leaseId?, tenantId?, periodStart?, periodEnd?}',
      mode: 'string (optional) - "auto" | "sql-only" | "plan-first"',
    },
    response: {
      ok: 'boolean',
      plan: 'string - Plan d\'exécution',
      sql: 'string - Requête SQL exécutée',
      rows: 'array - Résultats',
      rowCount: 'number',
      formatted: 'string - Résultats formatés en markdown',
      metadata: 'object',
    },
  });
}



