/**
 * Point d'entrée du système d'outils
 * Initialise et exporte le registre d'outils
 */

import { toolRegistry } from './registry';
import { allTools } from './implementations';

// Enregistrer tous les outils au démarrage
export function initializeTools() {
  console.log('[Tools] Initialisation du registre d\'outils...');

  for (const tool of allTools) {
    toolRegistry.register(tool);
  }

  console.log(`[Tools] ${allTools.length} outils enregistrés:`, allTools.map((t) => t.id).join(', '));
}

// Auto-initialisation au chargement du module
initializeTools();

// Ré-exporter les éléments utiles
export { toolRegistry, executeTool, executeAndLogTool } from './registry';
export type { Tool, ToolResult, ToolContext, Citation, ToolLog } from './registry';
export { allTools } from './implementations';

