/**
 * Prompt Builder - Construction de prompts structurés
 * Gère les templates system/context/user pour Mistral
 */

import type { ChunkData, BuildPromptOptions, ChatMode } from '../types';

/**
 * Construit le prompt système (identité de l'assistant)
 * @param mode Mode du chat (normal ou strict)
 * @returns Le prompt système
 */
export function buildSystemPrompt(mode: ChatMode = 'normal'): string {
  const basePrompt = `Tu es l'assistant IA de Smartimmo, une application de gestion immobilière.

## Ton rôle :
- Aider les utilisateurs avec des questions sur la gestion immobilière (baux, transactions, prêts, documents)
- Fournir des réponses précises, concises et en français
- Toujours citer tes sources (références aux documents de la base de connaissances)

## Règles importantes :
1. **Ne jamais inventer** de montants, dates ou informations précises si tu ne les trouves pas dans le contexte
2. **Proposer des sources** : si tu cites un guide ou un glossaire, mentionne-le
3. **Être concis** : privilégie les réponses courtes (3-5 phrases max), sauf si on te demande plus de détails
4. **Ton neutre et professionnel** : tu t'adresses à des gestionnaires immobiliers
5. **Liens utiles** : si tu connais un lien officiel pertinent (service-public.fr, ANIL, etc.), mentionne-le`;

  if (mode === 'strict') {
    return (
      basePrompt +
      `

## Mode strict activé :
- **Réponds UNIQUEMENT** avec les informations présentes dans le contexte fourni ci-dessous
- Si l'information n'est pas dans le contexte, dis clairement "Je n'ai pas cette information dans ma base de connaissances"
- N'extrapolise pas, ne devine pas`
    );
  }

  return basePrompt;
}

/**
 * Formate le contexte (chunks RAG) en texte structuré
 * @param chunks Chunks de texte issus de la recherche sémantique
 * @returns Le contexte formaté
 */
export function formatContext(chunks: ChunkData[]): string {
  if (chunks.length === 0) {
    return 'Aucun contexte disponible.';
  }

  let context = '## Contexte (sources de la base de connaissances) :\n\n';

  chunks.forEach((chunk, index) => {
    const source = chunk.source || 'Source inconnue';
    const tags = chunk.tags?.length ? ` [${chunk.tags.join(', ')}]` : '';
    
    context += `### Source ${index + 1} : ${source}${tags}\n`;
    context += `${chunk.text}\n\n`;
    context += `---\n\n`;
  });

  context += `**Note** : Réponds en te basant sur ces sources. Cite-les dans ta réponse (ex: "D'après le guide des baux...").\n`;

  return context;
}

/**
 * Construit le prompt complet (system + context + user)
 * @param options Options avec chunks et query
 * @returns Le prompt final à envoyer à Mistral
 */
export function buildFullPrompt(options: BuildPromptOptions): string {
  const { chunks, query, mode = 'normal' } = options;

  const systemPrompt = buildSystemPrompt(mode);
  const contextPrompt = formatContext(chunks);

  const fullPrompt = `${systemPrompt}

${contextPrompt}

## Question de l'utilisateur :
${query}

## Ta réponse :`;

  return fullPrompt;
}

/**
 * Extrait les sources citées dans une réponse (utile pour le debugging)
 * @param answer La réponse générée
 * @param chunks Les chunks utilisés
 * @returns Les chunks effectivement cités
 */
export function extractCitedSources(
  answer: string,
  chunks: ChunkData[]
): ChunkData[] {
  // Heuristique simple : chercher les mentions de sources
  const cited: ChunkData[] = [];

  for (const chunk of chunks) {
    const source = chunk.source?.toLowerCase() || '';
    const answerLower = answer.toLowerCase();

    // Vérifier si la source est mentionnée
    if (
      source &&
      (answerLower.includes(source) ||
        answerLower.includes(source.replace('_', ' ')))
    ) {
      cited.push(chunk);
    }
  }

  // Si aucune source explicite, on considère que toutes sont utilisées
  return cited.length > 0 ? cited : chunks;
}

