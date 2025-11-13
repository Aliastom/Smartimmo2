/**
 * Implémentations des outils pour l'agent IA
 * Chaque outil est une fonction async qui retourne un ToolResult
 */

import { z } from 'zod';
import { Tool, ToolResult, ToolContext, Citation } from './registry';
import { executeSafeSql, maskPii, formatSqlResults, getSqlCatalog, getSqlExamples } from '../sql/executor';
import { retrieveContext } from '../rag/retrieve';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// OUTIL 1: sql.query - Exécution SQL sécurisée
// ============================================

export const sqlQueryTool: Tool = {
  id: 'sql.query',
  name: 'Requête SQL',
  description: 'Exécute une requête SQL SELECT en lecture seule sur la base de données. Utilise les vues analytiques (vw_*) pour les questions fréquentes. Tables disponibles: Property, Lease, Tenant, Transaction, Loan, Document, Payment.',
  category: 'data',
  safety: 'read-only',
  inputSchema: z.object({
    sql: z.string().describe('La requête SQL SELECT à exécuter'),
    maskPii: z.boolean().optional().default(true).describe('Masquer les données personnelles (emails, téléphones)'),
  }),
  examples: [
    'Combien de baux actifs ?',
    'Loyers encaissés ce mois ?',
    'Liste des locataires en retard de paiement',
    'Total des prêts en cours',
  ],
  fn: async (args, context) => {
    const { sql, maskPii: shouldMask } = args;

    // Exécuter la requête SQL de manière sécurisée
    const result = await executeSafeSql(sql);

    if (!result.ok) {
      return {
        ok: false,
        error: result.error,
      };
    }

    // Masquer les PII si demandé
    let data = result.data || [];
    if (shouldMask && data.length > 0) {
      data = maskPii(data);
    }

    // Créer les citations
    const citations: Citation[] = [
      {
        type: 'sql',
        source: result.executedSql || sql,
        snippet: `${data.length} résultat(s)`,
      },
    ];

    return {
      ok: true,
      data: {
        rows: data,
        rowCount: data.length,
        formatted: formatSqlResults(data, 20),
        executedSql: result.executedSql,
      },
      citations,
      warning: result.warning,
      metadata: {
        durationMs: result.durationMs,
      },
    };
  },
};

// ============================================
// OUTIL 2: kb.search - Recherche sémantique
// ============================================

export const kbSearchTool: Tool = {
  id: 'kb.search',
  name: 'Recherche dans la base de connaissances',
  description: 'Recherche sémantique dans la documentation, le code source, et les guides métier de Smartimmo. Utile pour les questions "Comment...", "Où...", "Qu\'est-ce que...".',
  category: 'search',
  safety: 'safe',
  inputSchema: z.object({
    query: z.string().describe('La question ou recherche à effectuer'),
    topK: z.number().optional().default(5).describe('Nombre de résultats à retourner'),
    tags: z.array(z.string()).optional().describe('Filtres par tags (ex: ["baux", "fiscal"])'),
  }),
  examples: [
    'Comment créer un bail ?',
    'Où sont stockés les documents ?',
    'Qu\'est-ce que l\'indexation IRL ?',
    'Fonctionnement du système de transactions',
  ],
  fn: async (args, context) => {
    const { query, topK, tags } = args;

    try {
      // Rechercher dans Qdrant
      const chunks = await retrieveContext(query, topK, tags);

      if (chunks.length === 0) {
        return {
          ok: true,
          data: {
            results: [],
            message: 'Aucun résultat trouvé dans la base de connaissances.',
          },
          citations: [],
        };
      }

      // Créer les citations
      const citations: Citation[] = chunks.map((chunk) => ({
        type: 'kb',
        source: chunk.source || 'knowledge-base',
        snippet: chunk.text.substring(0, 200) + '...',
        confidence: chunk.score,
      }));

      // Formater les résultats
      const formatted = chunks
        .map(
          (c, i) =>
            `${i + 1}. [Score: ${c.score.toFixed(3)}] ${c.text.substring(0, 300)}...\n   Source: ${c.source}`
        )
        .join('\n\n');

      return {
        ok: true,
        data: {
          results: chunks,
          formatted,
          count: chunks.length,
        },
        citations,
      };
    } catch (error: any) {
      return {
        ok: false,
        error: `Erreur lors de la recherche: ${error.message}`,
      };
    }
  },
};

// ============================================
// OUTIL 3: doc.fetch - Récupération de document
// ============================================

export const docFetchTool: Tool = {
  id: 'doc.fetch',
  name: 'Récupération de document',
  description: 'Récupère le contenu textuel d\'un document par son ID, avec texte OCR si disponible. Utile pour lire le contenu d\'un document spécifique.',
  category: 'document',
  safety: 'read-only',
  inputSchema: z.object({
    documentId: z.string().describe('ID du document à récupérer'),
    includeOcr: z.boolean().optional().default(true).describe('Inclure le texte OCR extrait'),
  }),
  examples: [
    'Contenu du document X',
    'Résumer le document lié à la transaction Y',
    'Texte du bail signé',
  ],
  fn: async (args, context) => {
    const { documentId, includeOcr } = args;

    try {
      // Récupérer le document depuis la base
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
          DocumentType: true,
          Property: { select: { name: true } },
          Lease: { select: { id: true } },
        },
      });

      if (!document) {
        return {
          ok: false,
          error: `Document "${documentId}" introuvable`,
        };
      }

      if (document.deletedAt) {
        return {
          ok: false,
          error: 'Ce document a été supprimé',
        };
      }

      // Préparer les données
      const data: any = {
        id: document.id,
        fileName: document.fileName,
        type: document.DocumentType?.label,
        uploadedAt: document.uploadedAt,
        propertyName: document.Property?.name,
        leaseId: document.Lease?.id,
      };

      if (includeOcr && document.extractedText) {
        data.extractedText = document.extractedText;
        data.ocrStatus = document.ocrStatus;
        data.ocrConfidence = document.ocrConfidence;
      }

      // Citations
      const citations: Citation[] = [
        {
          type: 'document',
          source: `Document: ${document.fileName} (${documentId})`,
          snippet: document.extractedText?.substring(0, 200) || 'Pas de texte extrait',
        },
      ];

      return {
        ok: true,
        data,
        citations,
      };
    } catch (error: any) {
      return {
        ok: false,
        error: `Erreur lors de la récupération du document: ${error.message}`,
      };
    }
  },
};

// ============================================
// OUTIL 4: ocr.summarize - Résumé de texte OCR
// ============================================

export const ocrSummarizeTool: Tool = {
  id: 'ocr.summarize',
  name: 'Résumé de texte OCR',
  description: 'Résume et structure un texte brut OCR en JSON normalisé. Extrait les informations clés (dates, montants, entités).',
  category: 'document',
  safety: 'safe',
  inputSchema: z.object({
    text: z.string().describe('Le texte à résumer et structurer'),
    fields: z.array(z.string()).optional().describe('Champs spécifiques à extraire (ex: ["date", "montant", "locataire"])'),
  }),
  examples: [
    'Résumer ce relevé bancaire',
    'Extraire les informations de ce contrat',
  ],
  fn: async (args, context) => {
    const { text, fields } = args;

    try {
      // Analyse basique du texte (à améliorer avec un LLM plus tard)
      const summary: any = {
        length: text.length,
        wordCount: text.split(/\s+/).length,
      };

      // Extraire des dates
      const dateRegex = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/g;
      const dates = text.match(dateRegex) || [];
      if (dates.length > 0) {
        summary.dates = dates.slice(0, 5);
      }

      // Extraire des montants
      const amountRegex = /\b(\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{2})?)\s*(?:€|EUR|euros?)\b/gi;
      const amounts = text.match(amountRegex) || [];
      if (amounts.length > 0) {
        summary.amounts = amounts.slice(0, 5);
      }

      // Extraire des emails
      const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
      const emails = text.match(emailRegex) || [];
      if (emails.length > 0) {
        summary.emails = emails;
      }

      // Premiers mots (début du document)
      summary.preview = text.substring(0, 500);

      return {
        ok: true,
        data: summary,
        citations: [
          {
            type: 'document',
            source: 'Analyse OCR',
            snippet: text.substring(0, 100),
          },
        ],
      };
    } catch (error: any) {
      return {
        ok: false,
        error: `Erreur lors de l'analyse du texte: ${error.message}`,
      };
    }
  },
};

// ============================================
// OUTIL 5: time.now - Date/heure actuelle
// ============================================

export const timeNowTool: Tool = {
  id: 'time.now',
  name: 'Date et heure actuelles',
  description: 'Retourne la date et l\'heure actuelles, utile pour les questions relatives aux périodes (ce mois, mois dernier, etc.).',
  category: 'utility',
  safety: 'safe',
  inputSchema: z.object({}),
  examples: ['Quelle est la date actuelle ?', 'Quel mois sommes-nous ?'],
  fn: async (args, context) => {
    const now = new Date();

    return {
      ok: true,
      data: {
        timestamp: now.toISOString(),
        date: now.toLocaleDateString('fr-FR'),
        time: now.toLocaleTimeString('fr-FR'),
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
        dayOfWeek: now.toLocaleDateString('fr-FR', { weekday: 'long' }),
      },
      citations: [],
    };
  },
};

// ============================================
// OUTIL 6: user.profile - Profil utilisateur (mock)
// ============================================

export const userProfileTool: Tool = {
  id: 'user.profile',
  name: 'Profil utilisateur',
  description: 'Récupère les informations de profil de l\'utilisateur courant.',
  category: 'utility',
  safety: 'safe',
  inputSchema: z.object({}),
  examples: ['Qui suis-je ?', 'Mon profil'],
  fn: async (args, context) => {
    // Mock pour l'instant - à implémenter avec vraie auth
    return {
      ok: true,
      data: {
        userId: context?.userId || 'default',
        name: 'Utilisateur par défaut',
        role: 'admin',
      },
      citations: [],
    };
  },
};

// ============================================
// OUTIL 7: util.math - Calculs simples
// ============================================

export const utilMathTool: Tool = {
  id: 'util.math',
  name: 'Calculatrice',
  description: 'Effectue des calculs mathématiques simples (addition, soustraction, multiplication, division, pourcentages).',
  category: 'utility',
  safety: 'safe',
  inputSchema: z.object({
    expression: z.string().describe('L\'expression mathématique à évaluer (ex: "100 + 200 * 1.5")'),
  }),
  examples: ['Calculer 800 * 12', 'Pourcentage de 1500 sur 200000'],
  fn: async (args, context) => {
    const { expression } = args;

    try {
      // Sécurité: n'autoriser que des chiffres et opérateurs basiques
      const sanitized = expression.replace(/[^0-9+\-*\/().\s]/g, '');

      if (sanitized !== expression) {
        return {
          ok: false,
          error: 'Expression mathématique invalide',
        };
      }

      // Évaluer (attention: eval est dangereux, ici c'est OK car sanitized)
      const result = eval(sanitized);

      return {
        ok: true,
        data: {
          expression: sanitized,
          result,
        },
        citations: [],
      };
    } catch (error: any) {
      return {
        ok: false,
        error: `Erreur de calcul: ${error.message}`,
      };
    }
  },
};

// ============================================
// OUTIL 8: sql.catalog - Catalogue SQL
// ============================================

export const sqlCatalogTool: Tool = {
  id: 'sql.catalog',
  name: 'Catalogue SQL',
  description: 'Retourne le catalogue SQL complet (tables, vues, champs, relations) pour aider à construire des requêtes.',
  category: 'utility',
  safety: 'safe',
  inputSchema: z.object({}),
  examples: ['Quelles tables sont disponibles ?', 'Structure de la table Lease'],
  fn: async (args, context) => {
    const catalog = getSqlCatalog();
    const examples = getSqlExamples();

    return {
      ok: true,
      data: {
        catalog,
        examples,
      },
      citations: [],
    };
  },
};

// ============================================
// EXPORT DE TOUS LES OUTILS
// ============================================

export const allTools: Tool[] = [
  sqlQueryTool,
  kbSearchTool,
  docFetchTool,
  ocrSummarizeTool,
  timeNowTool,
  userProfileTool,
  utilMathTool,
  sqlCatalogTool,
];

