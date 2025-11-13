/**
 * Tool Registry - Système de sélection dynamique d'outils pour l'agent
 * Chaque outil a: name, description, inputSchema, fn, safety
 */

import { z } from 'zod';

// Type pour un outil
export interface Tool {
  id: string;
  name: string;
  description: string;
  inputSchema: z.ZodType<any>;
  fn: (args: any, context?: ToolContext) => Promise<ToolResult>;
  safety: 'safe' | 'read-only' | 'restricted';
  examples?: string[]; // Exemples d'utilisation pour few-shot
  category?: 'data' | 'search' | 'document' | 'utility';
}

// Contexte d'exécution de l'outil
export interface ToolContext {
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  propertyId?: string;
  leaseId?: string;
  // Autres métadonnées de contexte
}

// Résultat de l'exécution d'un outil
export interface ToolResult {
  ok: boolean;
  data?: any;
  error?: string;
  warning?: string;
  citations?: Citation[]; // Sources des données
  metadata?: Record<string, any>;
}

// Citation / provenance des données
export interface Citation {
  type: 'sql' | 'document' | 'kb' | 'view';
  source: string;
  snippet?: string;
  confidence?: number;
}

/**
 * Registre global des outils
 */
class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  /**
   * Enregistre un nouvel outil
   */
  register(tool: Tool) {
    if (this.tools.has(tool.id)) {
      console.warn(`[ToolRegistry] L'outil "${tool.id}" existe déjà, écrasement.`);
    }
    this.tools.set(tool.id, tool);
  }

  /**
   * Récupère un outil par son ID
   */
  get(toolId: string): Tool | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Liste tous les outils disponibles
   */
  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Sélectionne les outils pertinents pour une question donnée
   * Utilise la description + exemples pour scorer chaque outil
   * @param question La question de l'utilisateur
   * @param topK Nombre d'outils à retourner
   * @returns Liste d'outils triés par pertinence
   */
  async selectTools(question: string, topK = 3): Promise<Tool[]> {
    const questionLower = question.toLowerCase();
    
    // Scorer chaque outil
    const scored = this.list().map((tool) => {
      let score = 0;

      // Score basé sur les mots-clés dans la description
      const descLower = tool.description.toLowerCase();
      const keywords = this.extractKeywords(questionLower);

      for (const keyword of keywords) {
        if (descLower.includes(keyword)) {
          score += 2;
        }
      }

      // Score basé sur les exemples
      if (tool.examples) {
        for (const example of tool.examples) {
          const exampleLower = example.toLowerCase();
          for (const keyword of keywords) {
            if (exampleLower.includes(keyword)) {
              score += 1;
            }
          }
        }
      }

      // Bonus pour catégories pertinentes
      if (questionLower.includes('combien') || questionLower.includes('total') || questionLower.includes('nombre')) {
        if (tool.category === 'data') score += 3;
      }

      if (questionLower.includes('document') || questionLower.includes('fichier') || questionLower.includes('pdf')) {
        if (tool.category === 'document') score += 3;
      }

      if (questionLower.includes('comment') || questionLower.includes('où') || questionLower.includes('quoi')) {
        if (tool.category === 'search') score += 2;
      }

      return { tool, score };
    });

    // Trier par score décroissant et prendre le top K
    scored.sort((a, b) => b.score - a.score);
    
    const selected = scored.slice(0, topK).map((s) => s.tool);

    console.log(
      `[ToolRegistry] Outils sélectionnés pour "${question.substring(0, 50)}...":`,
      selected.map((t) => t.id)
    );

    return selected;
  }

  /**
   * Extrait les mots-clés d'une question
   */
  private extractKeywords(text: string): string[] {
    // Mots vides à ignorer
    const stopWords = new Set([
      'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'à', 'au', 'aux',
      'et', 'ou', 'mais', 'donc', 'or', 'ni', 'car',
      'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles',
      'ce', 'cette', 'ces', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes',
      'est', 'sont', 'a', 'ai', 'ont', 'as', 'avons', 'avez',
      'que', 'qui', 'quoi', 'dont', 'où',
    ]);

    // Tokeniser et filtrer
    const words = text
      .split(/\s+/)
      .map((w) => w.replace(/[^\w]/g, ''))
      .filter((w) => w.length > 2 && !stopWords.has(w));

    return words;
  }

  /**
   * Génère la description de tous les outils pour le prompt de l'agent
   */
  getToolsDescription(): string {
    const tools = this.list();
    
    let description = '## OUTILS DISPONIBLES\n\n';
    description += 'Tu peux utiliser les outils suivants pour répondre aux questions :\n\n';

    for (const tool of tools) {
      description += `### ${tool.id} - ${tool.name}\n`;
      description += `**Description**: ${tool.description}\n`;
      description += `**Sécurité**: ${tool.safety}\n`;
      
      if (tool.examples && tool.examples.length > 0) {
        description += `**Exemples d'utilisation**:\n`;
        for (const example of tool.examples) {
          description += `- ${example}\n`;
        }
      }
      
      description += '\n';
    }

    return description;
  }

  /**
   * Réinitialise tous les outils (utile pour les tests)
   */
  clear() {
    this.tools.clear();
  }
}

// Instance globale singleton
export const toolRegistry = new ToolRegistry();

/**
 * Helper pour exécuter un outil de manière sûre
 */
export async function executeTool(
  toolId: string,
  args: any,
  context?: ToolContext
): Promise<ToolResult> {
  const tool = toolRegistry.get(toolId);

  if (!tool) {
    return {
      ok: false,
      error: `Outil "${toolId}" introuvable`,
    };
  }

  try {
    // Valider les arguments avec Zod
    const validatedArgs = tool.inputSchema.parse(args);

    // Exécuter l'outil
    const startTime = Date.now();
    const result = await tool.fn(validatedArgs, context);
    const durationMs = Date.now() - startTime;

    console.log(`[Tool:${toolId}] Exécution réussie (${durationMs}ms)`);

    return result;
  } catch (error: any) {
    console.error(`[Tool:${toolId}] Erreur:`, error.message);

    return {
      ok: false,
      error: `Erreur lors de l'exécution de l'outil "${toolId}": ${error.message}`,
    };
  }
}

/**
 * Helper pour logger l'exécution d'un outil (observabilité)
 */
export async function executeAndLogTool(
  toolId: string,
  args: any,
  context?: ToolContext,
  logFn?: (log: ToolLog) => Promise<void>
): Promise<ToolResult> {
  const startTime = Date.now();
  const result = await executeTool(toolId, args, context);
  const durationMs = Date.now() - startTime;

  // Logger si fonction fournie
  if (logFn) {
    const log: ToolLog = {
      toolName: toolId,
      argsJson: JSON.stringify(args),
      resultJson: result.ok ? JSON.stringify(result.data) : undefined,
      durationMs,
      ok: result.ok,
      errorMessage: result.error,
      correlationId: context?.correlationId,
    };

    await logFn(log);
  }

  return result;
}

// Type pour les logs d'outils
export interface ToolLog {
  toolName: string;
  argsJson: string;
  resultJson?: string;
  durationMs: number;
  ok: boolean;
  errorMessage?: string;
  correlationId?: string;
}

