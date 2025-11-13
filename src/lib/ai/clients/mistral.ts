/**
 * Client Mistral via Ollama
 * Gère les appels API vers Ollama local (streaming + timeout)
 */

import type {
  MistralGenerateOptions,
  MistralGenerateRequest,
  MistralGenerateResponse,
} from '../types';

// Configuration depuis ENV
const MISTRAL_BASE_URL = process.env.MISTRAL_BASE_URL || 'http://localhost:11434';
const MISTRAL_MODEL = process.env.MISTRAL_MODEL || 'mistral';
const AI_MAX_TOKENS = parseInt(process.env.AI_MAX_TOKENS || '1024', 10);
const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || '30000', 10);

/**
 * Génère une réponse via Ollama (mode streaming)
 * @param prompt Le prompt complet à envoyer
 * @param options Options de génération
 * @returns AsyncGenerator qui yield les chunks de texte
 */
export async function* generateStream(
  prompt: string,
  options?: MistralGenerateOptions
): AsyncGenerator<string, void, unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const requestBody: MistralGenerateRequest = {
      model: options?.model || MISTRAL_MODEL,
      prompt,
      options: {
        temperature: options?.temperature ?? 0.7,
        top_p: options?.top_p ?? 0.9,
        num_predict: options?.max_tokens || AI_MAX_TOKENS,
      },
      stream: true,
    };

    const response = await fetch(`${MISTRAL_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Ollama API error: ${response.status} ${response.statusText}`
      );
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter((line) => line.trim() !== '');

      for (const line of lines) {
        try {
          const data: MistralGenerateResponse = JSON.parse(line);
          if (data.response) {
            yield data.response;
          }
          if (data.done) {
            return;
          }
        } catch (e) {
          console.error('Error parsing Ollama stream chunk:', e);
          // Continue to next line
        }
      }
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Timeout: la requête a dépassé ${AI_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Génère une réponse via Ollama (mode non-streaming, pour tests)
 * @param prompt Le prompt complet
 * @param options Options de génération
 * @returns La réponse complète
 */
export async function generate(
  prompt: string,
  options?: MistralGenerateOptions
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const requestBody: MistralGenerateRequest = {
      model: options?.model || MISTRAL_MODEL,
      prompt,
      options: {
        temperature: options?.temperature ?? 0.7,
        top_p: options?.top_p ?? 0.9,
        num_predict: options?.max_tokens || AI_MAX_TOKENS,
      },
      stream: false,
    };

    const response = await fetch(`${MISTRAL_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Ollama API error: ${response.status} ${response.statusText}`
      );
    }

    const data: MistralGenerateResponse = await response.json();
    return data.response;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Timeout: la requête a dépassé ${AI_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Alias pour generate() (rétrocompatibilité)
 */
export const generateCompletion = generate;

/**
 * Vérifie que Ollama est accessible
 * @returns true si Ollama répond
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${MISTRAL_BASE_URL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

