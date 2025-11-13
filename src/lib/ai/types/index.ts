/**
 * Types TypeScript pour le système IA / RAG
 * Smartimmo - Compagnon IA
 */

// ============================================
// Types de base
// ============================================

/**
 * Chunk de texte avec métadonnées (issu du RAG)
 */
export interface ChunkData {
  id: string;
  text: string;
  score: number;
  tags?: string[];
  source?: string;
  metadata?: Record<string, any>;
}

/**
 * Point Qdrant (pour l'ingestion)
 */
export interface QdrantPoint {
  id: string;
  vector: number[];
  payload: {
    text: string;
    source: string;
    tags?: string[];
    [key: string]: any;
  };
}

// ============================================
// API /ai/search
// ============================================

export interface SearchRequest {
  query: string;
  topK?: number;
  tags?: string[];
}

export interface SearchResponse {
  chunks: ChunkData[];
  query: string;
  count: number;
}

// ============================================
// API /ai/chat
// ============================================

export type ChatMode = 'normal' | 'strict';

export interface ChatRequest {
  query: string;
  context?: Array<{ text: string }>;
  mode?: ChatMode;
}

export interface ChatResponse {
  answer: string;
  usedChunks: ChunkData[];
  query: string;
}

export interface ChatStreamChunk {
  type: 'chunk' | 'done' | 'error';
  content: string;
  done?: boolean;
  usedChunks?: ChunkData[];
}

// ============================================
// Client Mistral (Ollama)
// ============================================

export interface MistralGenerateOptions {
  model?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface MistralGenerateRequest {
  model: string;
  prompt: string;
  options?: {
    temperature?: number;
    top_p?: number;
    num_predict?: number;
  };
  stream?: boolean;
}

export interface MistralGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

// ============================================
// Client Qdrant
// ============================================

export interface QdrantSearchRequest {
  query: string;
  topK?: number;
  filter?: Record<string, any>;
}

export interface QdrantSearchResult {
  id: string;
  score: number;
  payload: {
    text: string;
    source?: string;
    tags?: string[];
    [key: string]: any;
  };
}

// ============================================
// Prompt Builder
// ============================================

export interface PromptTemplate {
  system: string;
  context: string;
  user: string;
}

export interface BuildPromptOptions {
  chunks: ChunkData[];
  query: string;
  mode?: ChatMode;
}

// ============================================
// Rate Limiting
// ============================================

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

