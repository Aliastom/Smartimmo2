/**
 * COMPÉTENCE C - Moteur Logique Interne
 * Cerveau procédural qui structure le raisonnement avant chaque réponse
 */

import { type UiContext } from '../context/getUiContext';
import { type NormalizedQuestion } from '../nlp/normalizeFr';

/**
 * Types d'intention détectés
 */
export type Intent = 
  | 'factuelle'      // Réponse directe chiffrée
  | 'comparaison'    // Delta entre deux périodes
  | 'tendance'       // Évolution dans le temps
  | 'diagnostic'     // Anomalies / alertes
  | 'explication'    // "pourquoi / comment"
  | 'projection';    // Estimation ou simulation

/**
 * Structure du raisonnement interne
 */
export interface ReasoningTrace {
  intent: Intent;
  scope: {
    type: 'global' | 'scoped';
    entity?: string;
    entityId?: string;
    period?: {
      start: string;
      end: string;
      inferred: boolean;
    };
  };
  dataNeedsidentified: string[]; // Tables/entités nécessaires
  reasoningSteps: string[]; // Étapes de raisonnement
  computedResult?: any; // Résultat calculé
  confidence: number; // 0.0 à 1.0
  inferenceRules: string[]; // Règles appliquées
}

/**
 * Entrée du moteur logique
 */
export interface LogicEngineInput {
  question: string;
  normalized: NormalizedQuestion;
  uiContext: UiContext;
  recentHistory?: Array<{ question: string; answer: string }>;
}

/**
 * Sortie du moteur logique
 */
export interface LogicEngineOutput {
  trace: ReasoningTrace;
  answer?: string; // Réponse finale si possible
  actionPlan?: any; // Plan d'actions si données manquantes
  needsData: boolean; // true si doit lire des données
}

/**
 * ÉTAPE 1 - Compréhension de la demande
 */
function comprehendRequest(input: LogicEngineInput): {
  intent: Intent;
  entities: string[];
  period?: { start: Date; end: Date; inferred: boolean };
} {
  const q = input.normalized.cleaned.toLowerCase();
  
  // Détection d'intent
  let intent: Intent;
  
  if (q.match(/pourquoi|comment|explique|raison/)) {
    intent = 'explication';
  } else if (q.match(/diagnostic|alertes?|urgences?|problèmes?|qu'est-ce qui cloche/)) {
    intent = 'diagnostic';
  } else if (q.match(/tendance|évolution|sur \d+ mois|historique/)) {
    intent = 'tendance';
  } else if (q.match(/entre.*et|vs|versus|compar|différence/)) {
    intent = 'comparaison';
  } else if (q.match(/si|projection|estimation|simuler|prévoir/)) {
    intent = 'projection';
  } else {
    intent = 'factuelle';
  }
  
  // Extraction d'entités (priorité aux entités liées aux données financières)
  const entities: string[] = [];
  
  // Priorité 1 : Transactions financières
  if (q.match(/encaiss|pay|reç|loyer|transaction|paiement|cashflow|solde/)) {
    entities.push('transaction');
  }
  
  // Priorité 2 : Entités métier
  if (q.match(/bail|contrat|location/) && !q.match(/loyer/)) entities.push('lease');
  if (q.match(/locataire|occupant/)) entities.push('tenant');
  if (q.match(/document|pdf|fichier/)) entities.push('document');
  if (q.match(/dépense|charge|entretien/)) entities.push('expense');
  if (q.match(/prêt|emprunt|crédit|mensualité/)) entities.push('loan');
  
  // Priorité 3 : Biens (seulement si pas déjà transaction)
  if (q.match(/bien|propriété|maison|appartement/) && entities.length === 0) {
    entities.push('property');
  }
  
  // Période (depuis normalization ou inférée)
  let period = input.normalized.timeRange 
    ? { 
        start: input.normalized.timeRange.start, 
        end: input.normalized.timeRange.end, 
        inferred: false 
      }
    : undefined;
  
  return { intent, entities, period };
}

/**
 * ÉTAPE 2 - Définition du contexte (scope)
 */
function defineScope(input: LogicEngineInput, comprehension: any): ReasoningTrace['scope'] {
  // Priorité 1 : Contexte de page
  if (input.uiContext.entity) {
    return {
      type: 'scoped',
      entity: input.uiContext.entity.type,
      entityId: input.uiContext.entity.id,
      period: input.uiContext.period ? {
        start: input.uiContext.period.start.toISOString().split('T')[0],
        end: input.uiContext.period.end.toISOString().split('T')[0],
        inferred: false,
      } : undefined,
    };
  }
  
  // Priorité 2 : Scope global
  return {
    type: 'global',
    period: comprehension.period ? {
      start: comprehension.period.start.toISOString().split('T')[0],
      end: comprehension.period.end.toISOString().split('T')[0],
      inferred: comprehension.period.inferred,
    } : undefined,
  };
}

/**
 * ÉTAPE 3 - Identification des données nécessaires
 */
function identifyDataNeeds(intent: Intent, entities: string[], scope: any): string[] {
  const needs: string[] = [];
  
  switch (intent) {
    case 'factuelle':
      // Besoin des entités mentionnées
      needs.push(...entities);
      break;
      
    case 'tendance':
      // Besoin de transactions sur une période
      needs.push('transactions');
      if (entities.includes('expense')) needs.push('expenses');
      break;
      
    case 'comparaison':
      // Besoin de données sur 2 périodes
      needs.push('transactions');
      break;
      
    case 'diagnostic':
      // Besoin de baux, documents, échéances
      needs.push('leases', 'documents', 'echeances');
      break;
      
    case 'projection':
      // Besoin du bail courant pour calcul
      if (entities.includes('lease')) needs.push('leases');
      break;
      
    case 'explication':
      // Besoin de la base de connaissances
      needs.push('kb');
      break;
  }
  
  return [...new Set(needs)]; // Dédupliquer
}

/**
 * ÉTAPE 4 - Construction de la stratégie
 */
function buildStrategy(trace: ReasoningTrace): string[] {
  const steps: string[] = [];
  
  switch (trace.intent) {
    case 'factuelle':
      steps.push(`Identifier ${trace.dataNeedsidentified.join(', ')}`);
      steps.push(`Filtrer par scope: ${trace.scope.type}`);
      steps.push(`Agréger les valeurs`);
      steps.push(`Formater le résultat`);
      break;
      
    case 'tendance':
      steps.push(`Récupérer transactions sur période`);
      steps.push(`Grouper par mois`);
      steps.push(`Calculer total, pic, creux`);
      steps.push(`Formater avec variation`);
      break;
      
    case 'comparaison':
      steps.push(`Récupérer données période A`);
      steps.push(`Récupérer données période B`);
      steps.push(`Calculer delta et %`);
      steps.push(`Formater A → B`);
      break;
      
    case 'diagnostic':
      steps.push(`Lire baux actifs`);
      steps.push(`Vérifier: expiration, dépôt, indexation`);
      steps.push(`Générer alertes`);
      steps.push(`Prioriser par urgence`);
      break;
      
    case 'projection':
      steps.push(`Récupérer loyer actuel`);
      steps.push(`Appliquer formule de calcul`);
      steps.push(`Calculer écart`);
      steps.push(`Ajouter avertissement`);
      break;
      
    case 'explication':
      steps.push(`Chercher dans KB`);
      steps.push(`Extraire contexte pertinent`);
      steps.push(`Synthétiser explication`);
      break;
  }
  
  return steps;
}

/**
 * MOTEUR LOGIQUE PRINCIPAL
 * Exécute les 5 étapes du raisonnement
 */
export async function executeLogicEngine(
  input: LogicEngineInput
): Promise<LogicEngineOutput> {
  console.log('[LogicEngine] 🧠 Démarrage du raisonnement...');
  
  // ÉTAPE 1 : Compréhension
  const comprehension = comprehendRequest(input);
  console.log(`[LogicEngine] Intent: ${comprehension.intent}`);
  console.log(`[LogicEngine] Entités: ${comprehension.entities.join(', ') || 'aucune'}`);
  
  // ÉTAPE 2 : Définition du scope
  const scope = defineScope(input, comprehension);
  console.log(`[LogicEngine] Scope: ${scope.type} (${scope.entity || 'global'})`);
  
  // ÉTAPE 3 : Identification des données nécessaires
  const dataNeedsidentified = identifyDataNeeds(
    comprehension.intent,
    comprehension.entities,
    scope
  );
  console.log(`[LogicEngine] Données nécessaires: ${dataNeedsidentified.join(', ')}`);
  
  // ÉTAPE 4 : Construction de la stratégie
  const inferenceRules: string[] = [];
  
  // Appliquer règles d'inférence de période
  if (!comprehension.period && comprehension.intent === 'tendance') {
    const end = new Date();
    const start = new Date(end);
    start.setMonth(start.getMonth() - 11);
    comprehension.period = { start, end, inferred: true };
    inferenceRules.push('Période tendance: 12 derniers mois');
  } else if (!comprehension.period && comprehension.intent === 'factuelle') {
    const start = new Date();
    start.setDate(1); // Début du mois
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0); // Fin du mois
    comprehension.period = { start, end, inferred: true };
    inferenceRules.push('Période factuelle: mois courant');
  }
  
  // Mettre à jour le scope avec la période inférée
  if (comprehension.period && !scope.period) {
    scope.period = {
      start: comprehension.period.start.toISOString().split('T')[0],
      end: comprehension.period.end.toISOString().split('T')[0],
      inferred: comprehension.period.inferred,
    };
  }
  
  const reasoningSteps = buildStrategy({
    intent: comprehension.intent,
    scope,
    dataNeedsidentified,
    reasoningSteps: [],
    confidence: 0.9,
    inferenceRules,
  });
  
  console.log(`[LogicEngine] Étapes: ${reasoningSteps.length}`);
  
  // ÉTAPE 5 : Construction de la trace
  const trace: ReasoningTrace = {
    intent: comprehension.intent,
    scope,
    dataNeedsidentified,
    reasoningSteps,
    confidence: 0.9, // Par défaut, à ajuster selon la qualité des données
    inferenceRules,
  };
  
  console.log(`[LogicEngine] Confiance: ${trace.confidence}`);
  console.log(`[LogicEngine] Règles inférence: ${inferenceRules.join(', ') || 'aucune'}`);
  
  // Déterminer si on a besoin de plus de données
  const needsData = dataNeedsidentified.length > 0 && 
    !dataNeedsidentified.includes('kb'); // KB = pas besoin de données BDD
  
  return {
    trace,
    needsData,
  };
}

/**
 * Génère un log de trace simplifié
 */
export function generateTraceLog(trace: ReasoningTrace): string {
  const scopeStr = trace.scope.type === 'scoped'
    ? `${trace.scope.entity}=${trace.scope.entityId}`
    : 'global';
  
  const periodStr = trace.scope.period
    ? `period=${trace.scope.period.start}/${trace.scope.period.end}`
    : 'no-period';
  
  return `[Intent: ${trace.intent}] [Scope: ${scopeStr}, ${periodStr}] [Steps: ${trace.reasoningSteps.length}] [Confidence: ${trace.confidence.toFixed(2)}]`;
}

/**
 * Applique les règles d'inférence par défaut
 */
export const INFERENCE_RULES = {
  // Période "tendance" → 12 derniers mois
  periodTendance: (date: Date = new Date()) => {
    const end = new Date(date);
    const start = new Date(date);
    start.setMonth(start.getMonth() - 11);
    return { start, end, inferred: true };
  },
  
  // Période "statut" → mois courant
  periodStatut: (date: Date = new Date()) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { start, end, inferred: true };
  },
  
  // Période "baux" → du jour à +90 jours
  periodBaux: (date: Date = new Date()) => {
    const start = new Date(date);
    const end = new Date(date);
    end.setDate(end.getDate() + 90);
    return { start, end, inferred: true };
  },
  
  // Bail ambigu → prendre actif ou dernier créé
  leaseAmbiguous: 'actif' as const,
  
  // Documents → prioriser non classés
  documentsPriority: 'pending' as const,
};

/**
 * Vérifications automatiques avant réponse
 */
export interface VerificationChecks {
  scopeCoherent: boolean;
  methodMentioned: boolean;
  noConfusion: boolean;
  actionPlanMinimal: boolean;
  tonConforme: boolean;
}

export function performVerification(
  trace: ReasoningTrace,
  answer: string,
  actionPlan?: any
): VerificationChecks {
  return {
    scopeCoherent: trace.scope.type === 'global' || !!trace.scope.entityId,
    methodMentioned: answer.includes('Méthode') || answer.includes('📐'),
    noConfusion: true, // À implémenter avec regex spécifiques
    actionPlanMinimal: !actionPlan || actionPlan.actions.length <= 3,
    tonConforme: answer.length > 0 && !answer.includes('désolé'),
  };
}

