/**
 * Types TypeScript pour le Compagnon IA (UI)
 */

// ============================================
// Context & Provider
// ============================================

export interface CompanionContext {
  /** Route courante */
  route: string;
  /** Entité sélectionnée (bien, bail, transaction, etc.) */
  selectedEntity?: {
    type: 'property' | 'lease' | 'transaction' | 'tenant' | 'loan';
    id: string;
    label?: string;
  };
  /** Filtres actifs */
  filters?: Record<string, any>;
  /** État d'ouverture du panneau */
  isOpen: boolean;
  /** Ouvrir le panneau */
  open: () => void;
  /** Fermer le panneau */
  close: () => void;
  /** Toggle le panneau */
  toggle: () => void;
}

// ============================================
// Messages du chat
// ============================================

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  /** Sources utilisées (pour les réponses IA) */
  sources?: Array<{
    id: string;
    source: string;
    type?: 'sql' | 'document' | 'kb' | 'view';
    score?: number;
    snippet?: string;
    sqlQuery?: string; // Requête SQL exécutée (pour type='sql')
  }>;
  /** Statut du message */
  status?: 'sending' | 'sent' | 'error';
  /** Métadonnées additionnelles */
  metadata?: {
    tokensUsed?: number;
    durationMs?: number;
    iterations?: number;
  };
}

// ============================================
// Actions contextuelles
// ============================================

export type ActionType = 
  | 'navigate'
  | 'openModal'
  | 'filter'
  | 'export'
  | 'help'
  | 'custom';

export interface CompanionAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  type: ActionType;
  /** Fonction à exécuter */
  execute: () => void | Promise<void>;
  /** Si l'action est disponible */
  available?: boolean;
  /** Tooltip descriptif */
  description?: string;
}

// ============================================
// Streaming
// ============================================

export interface StreamChunk {
  type: 'chunk' | 'done' | 'error';
  content: string;
  done?: boolean;
  usedChunks?: Array<{
    id: string;
    source: string;
    score: number;
    tags?: string[];
  }>;
}

// ============================================
// État du compagnon
// ============================================

export interface CompanionState {
  /** Historique des messages */
  messages: ChatMessage[];
  /** En cours d'envoi */
  isLoading: boolean;
  /** Erreur éventuelle */
  error?: string;
}

