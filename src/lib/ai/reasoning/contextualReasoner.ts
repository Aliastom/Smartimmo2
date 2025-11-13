/**
 * COMPÉTENCE B - Raisonnement contextuel
 * Permet au Compagnon de répondre sans fonction dédiée
 * en exploitant contexte de page + données BDD + logique métier
 */

import { type UiContext } from '../context/getUiContext';
import { type NormalizedQuestion } from '../nlp/normalizeFr';

export interface ReasoningInput {
  question: string;
  normalized: NormalizedQuestion;
  uiContext: UiContext;
  recentHistory?: Array<{ question: string; answer: string }>;
}

export interface ReasoningOutput {
  answer: string;
  method?: string; // "Comment j'ai calculé"
  actionPlan?: ActionPlan;
  scope: 'global' | 'scoped';
  scopeLabel?: string; // Ex: "Bien Villa Familiale", "Bail #123"
  period?: {
    start: string; // ISO date
    end: string;
    inferred: boolean; // true si période inférée
  };
  entities: string[]; // IDs des entités mobilisées
  calculations?: Array<{
    label: string;
    formula: string;
    result: string;
  }>;
}

export interface ActionPlan {
  actions: Array<{
    op: 'read' | 'analyze' | 'explain';
    entity: string;
    where: Record<string, any>;
    fields?: string[];
  }>;
}

/**
 * Pipeline de raisonnement contextuel
 */
export async function reasonContextually(input: ReasoningInput): Promise<ReasoningOutput> {
  
  // ÉTAPE 1 : Comprendre l'intent
  const intent = detectIntent(input);
  console.log(`[Reasoning] Intent: ${intent.type}, Scope: ${intent.scope}`);
  
  // ÉTAPE 2 : Identifier les entités
  const entities = identifyEntities(input);
  console.log(`[Reasoning] Entities:`, entities);
  
  // ÉTAPE 3 : Résoudre la période
  const period = resolvePeriod(input, intent);
  console.log(`[Reasoning] Period:`, period);
  
  // ÉTAPE 4 : Déterminer le scope
  const scope = determineScope(input, entities);
  console.log(`[Reasoning] Scope: ${scope.type} (${scope.label || 'none'})`);
  
  // ÉTAPE 5 : Générer la réponse structurée
  const result: ReasoningOutput = {
    answer: '', // À remplir
    scope: scope.type,
    scopeLabel: scope.label,
    period: period ? {
      start: period.start.toISOString().split('T')[0],
      end: period.end.toISOString().split('T')[0],
      inferred: period.inferred,
    } : undefined,
    entities: entities.ids,
  };
  
  return result;
}

/**
 * Détecte l'intent de la question
 */
function detectIntent(input: ReasoningInput): {
  type: 'factual' | 'comparison' | 'trend' | 'diagnostic' | 'explanation' | 'projection';
  scope: 'page' | 'global';
} {
  const q = input.normalized.cleaned.toLowerCase();
  
  // Type d'intent
  let type: 'factual' | 'comparison' | 'trend' | 'diagnostic' | 'explanation' | 'projection';
  
  if (q.match(/pourquoi|qu'est-ce qui|diagnostic|urgences|alertes|problèmes/)) {
    type = 'diagnostic';
  } else if (q.match(/tendance|évolution|sur \d+ mois|historique/)) {
    type = 'trend';
  } else if (q.match(/entre.*et|vs|versus|par rapport|comparé|différence/)) {
    type = 'comparison';
  } else if (q.match(/si|projection|estimation|simuler/)) {
    type = 'projection';
  } else if (q.match(/pourquoi|comment.*fonctionne|explique/)) {
    type = 'explanation';
  } else {
    type = 'factual';
  }
  
  // Scope
  const scope = input.uiContext.entity ? 'page' : 'global';
  
  return { type, scope };
}

/**
 * Identifie les entités mobilisées
 */
function identifyEntities(input: ReasoningInput): {
  ids: string[];
  types: string[];
} {
  const ids: string[] = [];
  const types: string[] = [];
  
  // Depuis le contexte UI
  if (input.uiContext.scope.propertyId) {
    ids.push(input.uiContext.scope.propertyId);
    types.push('property');
  }
  
  if (input.uiContext.scope.leaseId) {
    ids.push(input.uiContext.scope.leaseId);
    types.push('lease');
  }
  
  if (input.uiContext.scope.tenantId) {
    ids.push(input.uiContext.scope.tenantId);
    types.push('tenant');
  }
  
  // Depuis la question (patterns simples)
  const q = input.normalized.cleaned.toLowerCase();
  
  if (q.match(/bien|propriété|villa|appartement/) && !input.uiContext.scope.propertyId) {
    types.push('property');
  }
  
  if (q.match(/bail|contrat|location/) && !input.uiContext.scope.leaseId) {
    types.push('lease');
  }
  
  if (q.match(/locataire|occupant/) && !input.uiContext.scope.tenantId) {
    types.push('tenant');
  }
  
  return { ids, types };
}

/**
 * Résout la période selon l'intent
 */
function resolvePeriod(input: ReasoningInput, intent: any): {
  start: Date;
  end: Date;
  inferred: boolean;
} | undefined {
  // Si déjà dans la question normalisée
  if (input.normalized.timeRange) {
    return {
      start: input.normalized.timeRange.start,
      end: input.normalized.timeRange.end,
      inferred: false,
    };
  }
  
  // Si dans le contexte UI
  if (input.uiContext.period) {
    return {
      start: input.uiContext.period.start,
      end: input.uiContext.period.end,
      inferred: false,
    };
  }
  
  // Sinon, inférer selon l'intent
  const now = new Date();
  
  if (intent.type === 'trend') {
    // 12 derniers mois
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start, end, inferred: true };
  }
  
  if (intent.type === 'factual' || intent.type === 'diagnostic') {
    // Mois courant
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start, end, inferred: true };
  }
  
  if (intent.type === 'comparison') {
    // Année courante
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    return { start, end, inferred: true };
  }
  
  return undefined;
}

/**
 * Détermine le scope (global vs scopé)
 */
function determineScope(input: ReasoningInput, entities: any): {
  type: 'global' | 'scoped';
  label?: string;
} {
  // Si entité dans le contexte UI
  if (input.uiContext.entity) {
    const labels: Record<string, string> = {
      property: 'Bien',
      lease: 'Bail',
      tenant: 'Locataire',
      loan: 'Prêt',
      transaction: 'Transaction',
      document: 'Document',
    };
    
    return {
      type: 'scoped',
      label: `${labels[input.uiContext.entity.type]} ${input.uiContext.entity.label || input.uiContext.entity.id}`,
    };
  }
  
  // Si mention explicite dans la question
  if (entities.ids.length > 0) {
    return {
      type: 'scoped',
      label: `Entité ${entities.types[0]}`,
    };
  }
  
  // Sinon global
  return { type: 'global' };
}

/**
 * Génère un plan d'actions JSON
 */
export function generateActionPlan(
  intent: string,
  entities: string[],
  period?: { start: Date; end: Date }
): ActionPlan | undefined {
  const actions: ActionPlan['actions'] = [];
  
  // Exemple : lecture de transactions si factual sur loyers
  if (intent === 'factual') {
    actions.push({
      op: 'read',
      entity: 'transactions',
      where: {
        type: 'loyer',
        sens: 'in',
        period: period 
          ? `${period.start.toISOString().split('T')[0]}/${period.end.toISOString().split('T')[0]}`
          : 'current_month',
      },
      fields: ['id', 'date', 'montant', 'statut', 'bail_id'],
    });
  }
  
  if (actions.length === 0) {
    return undefined;
  }
  
  return { actions };
}

/**
 * Formate une réponse selon les règles de la Compétence B
 */
export function formatContextualAnswer(
  result: ReasoningOutput,
  template: 'factual' | 'comparison' | 'trend' | 'diagnostic' | 'explanation' | 'projection'
): string {
  let answer = result.answer;
  
  // Ajouter le scope si scopé
  if (result.scope === 'scoped' && result.scopeLabel) {
    answer = answer.replace(/^/, `**[${result.scopeLabel}]** `);
  }
  
  // Ajouter la période si inférée
  if (result.period && result.period.inferred) {
    answer += `\n\n📅 Période utilisée : ${result.period.start} → ${result.period.end} (inférée)`;
  }
  
  // Ajouter la méthode si présente
  if (result.method) {
    answer += `\n\n📐 Méthode : ${result.method}`;
  }
  
  // Ajouter le plan d'actions si présent
  if (result.actionPlan) {
    answer += `\n\n${JSON.stringify(result.actionPlan)}`;
  }
  
  return answer;
}

/**
 * Règles de calcul prêtes à l'emploi
 */
export const CALCULATION_RULES = {
  // Loyers encaissés
  loyersEncaisses: (period: string) => ({
    formula: `SUM(amount) WHERE nature='LOYER' AND paidAt IS NOT NULL AND accounting_month='${period}'`,
    description: 'Somme des transactions de loyer payées',
  }),
  
  // Impayés
  impayes: () => ({
    formula: `SELECT * FROM v_loyers_en_retard WHERE priorite IN ('URGENT', 'IMPORTANT')`,
    description: 'Loyers en retard basés sur accounting_month',
  }),
  
  // Dépôt manquant
  depotManquant: () => ({
    formula: `deposit IS NULL OR deposit = 0`,
    description: 'Bail sans dépôt de garantie',
  }),
  
  // Bail proche expiration
  bailExpiration: (days: number = 90) => ({
    formula: `endDate BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${days} days'`,
    description: `Baux expirant dans ${days} jours`,
  }),
  
  // Taux d'occupation (simplifié)
  tauxOccupation: () => ({
    formula: `COUNT(DISTINCT leaseId WHERE status='ACTIF') / COUNT(DISTINCT propertyId) * 100`,
    description: 'Pourcentage de biens avec bail actif',
  }),
  
  // Indexation non appliquée
  indexNonAppliquee: () => ({
    formula: `lastIndexationDate < CURRENT_DATE - INTERVAL '12 months'`,
    description: 'Baux sans indexation depuis 12 mois',
  }),
};

