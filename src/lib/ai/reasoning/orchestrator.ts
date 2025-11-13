/**
 * ORCHESTRATEUR - Intègre les Compétences A, B, C
 * Point d'entrée unique qui coordonne le raisonnement complet
 */

import { type UiContext } from '../context/getUiContext';
import { type NormalizedQuestion } from '../nlp/normalizeFr';
import { 
  executeLogicEngine, 
  type LogicEngineInput, 
  type LogicEngineOutput,
  generateTraceLog,
  performVerification,
} from './logicEngine';
import { 
  reasonContextually, 
  type ReasoningInput,
} from './contextualReasoner';
import { 
  generateSystemPromptCompetenceB,
  generateUserPromptWithContext,
  extractActionPlan,
} from './contextualPrompts';

/**
 * Orchestrateur principal
 * Coordonne Compétence A (Prompt Global) + C (Logique) + B (Contexte)
 */
export async function orchestrateReasoning(
  question: string,
  normalized: NormalizedQuestion,
  uiContext: UiContext,
  sqlData?: any[],
  docData?: any[]
): Promise<{
  answer: string;
  trace: any;
  actionPlan?: any;
  metadata: {
    intent: string;
    scope: string;
    confidence: number;
    steps: number;
  };
}> {
  console.log('\n🧠 [Orchestrator] Démarrage du raisonnement complet (A + C + B)...\n');
  
  // ═══════════════════════════════════════════════════════════
  // COMPÉTENCE C - Moteur Logique Interne
  // ═══════════════════════════════════════════════════════════
  
  const logicInput: LogicEngineInput = {
    question,
    normalized,
    uiContext,
  };
  
  const logicOutput: LogicEngineOutput = await executeLogicEngine(logicInput);
  const trace = logicOutput.trace;
  
  // Logger la trace
  const traceLog = generateTraceLog(trace);
  console.log(`[Orchestrator] Trace: ${traceLog}`);
  
  // ═══════════════════════════════════════════════════════════
  // COMPÉTENCE B - Réponses Contextuelles
  // ═══════════════════════════════════════════════════════════
  
  let answer = '';
  let actionPlan = undefined;
  
  if (logicOutput.answer) {
    // Réponse déjà calculée par la logique
    answer = logicOutput.answer;
  } else {
    // Déléguer à la Compétence B pour générer la réponse
    console.log('[Orchestrator] Délégation à Compétence B...');
    
    const reasoningInput: ReasoningInput = {
      question,
      normalized,
      uiContext,
    };
    
    // Note: reasonContextually retourne une structure, pas encore une réponse texte
    // Pour l'instant, on utilise une réponse placeholder
    answer = `Raisonnement en cours pour: ${question}`;
  }
  
  // ═══════════════════════════════════════════════════════════
  // VÉRIFICATIONS AUTOMATIQUES
  // ═══════════════════════════════════════════════════════════
  
  const checks = performVerification(trace, answer, actionPlan);
  console.log('[Orchestrator] Vérifications:', checks);
  
  // Warnings si vérifications échouent
  if (!checks.scopeCoherent) {
    console.warn('[Orchestrator] ⚠️  Scope incohérent détecté');
  }
  if (!checks.methodMentioned && trace.intent !== 'explication') {
    console.warn('[Orchestrator] ⚠️  Méthode non mentionnée');
  }
  
  // ═══════════════════════════════════════════════════════════
  // RETOUR FINAL
  // ═══════════════════════════════════════════════════════════
  
  return {
    answer,
    trace,
    actionPlan: logicOutput.actionPlan,
    metadata: {
      intent: trace.intent,
      scope: trace.scope.type,
      confidence: trace.confidence,
      steps: trace.reasoningSteps.length,
    },
  };
}

/**
 * Version simplifiée pour intégration rapide
 */
export async function executeWithLogic(
  question: string,
  normalized: NormalizedQuestion,
  uiContext: UiContext
): Promise<{
  intent: string;
  scope: string;
  reasoningSteps: string[];
  confidence: number;
}> {
  const logicInput: LogicEngineInput = {
    question,
    normalized,
    uiContext,
  };
  
  const result = await executeLogicEngine(logicInput);
  
  return {
    intent: result.trace.intent,
    scope: result.trace.scope.type,
    reasoningSteps: result.trace.reasoningSteps,
    confidence: result.trace.confidence,
  };
}

