'use client';

/**
 * CompanionChat - Interface de chat avec le compagnon IA (V3+)
 * Gère l'input utilisateur, l'affichage des messages, le streaming SSE,
 * les citations, et l'affichage des requêtes SQL exécutées
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Database, FileText, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';
import { useCompanion } from './CompanionProvider';
import type { ChatMessage, StreamChunk } from './types';

export function CompanionChat() {
  const { selectedEntity, filters, route } = useCompanion();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll vers le bas
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      status: 'sent',
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Préparer le contexte enrichi avec l'entité sélectionnée
      const enrichedContext: any = {
        route,
        filters,
      };

      if (selectedEntity) {
        // Ajouter l'ID de l'entité sélectionnée au contexte
        switch (selectedEntity.type) {
          case 'property':
            enrichedContext.propertyId = selectedEntity.id;
            break;
          case 'lease':
            enrichedContext.leaseId = selectedEntity.id;
            break;
          case 'transaction':
            enrichedContext.transactionId = selectedEntity.id;
            break;
          case 'tenant':
            enrichedContext.tenantId = selectedEntity.id;
            break;
          case 'loan':
            enrichedContext.loanId = selectedEntity.id;
            break;
        }
      }

      // Appel API /ai/query (nouvel endpoint V3+)
      const response = await fetch('/api/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userMessage.content,
          context: enrichedContext,
          maxIterations: 5,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erreur API: ${response.status}`);
      }

      const data = await response.json();

      // Créer le message assistant avec la réponse
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer,
        timestamp: new Date(),
        status: 'sent',
        // Ajouter les citations (avec SQL si disponible)
        sources: data.citations?.map((citation: any) => ({
          id: citation.source,
          source: citation.source,
          type: citation.type,
          snippet: citation.snippet,
          sqlQuery: citation.type === 'sql' ? citation.source : undefined,
        })),
        // Ajouter les métadonnées
        metadata: {
          tokensUsed: data.metadata?.tokensUsed,
          durationMs: data.metadata?.durationMs,
          iterations: data.metadata?.iterations,
        },
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('[Chat] Erreur:', error);
      toast.error('Erreur lors de la communication avec l\'agent IA');

      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Désolé, une erreur est survenue: ${error.message}`,
        timestamp: new Date(),
        status: 'error',
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto min-h-0" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <p className="text-sm">Bonjour ! Comment puis-je vous aider ?</p>
            <p className="text-xs mt-2">
              Posez-moi des questions sur Smartimmo, les baux, les transactions, etc.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : message.status === 'error'
                      ? 'bg-destructive/10 border border-destructive/50'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                  {/* Citations et sources */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Sources:</p>
                      {message.sources.map((source, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 text-xs bg-background/50 rounded p-2"
                        >
                          {source.type === 'sql' ? (
                            <Database className="h-3 w-3 mt-0.5 flex-shrink-0 text-blue-500" />
                          ) : source.type === 'document' ? (
                            <FileText className="h-3 w-3 mt-0.5 flex-shrink-0 text-green-500" />
                          ) : (
                            <ExternalLink className="h-3 w-3 mt-0.5 flex-shrink-0 text-purple-500" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{source.source}</p>
                            {source.snippet && (
                              <p className="text-muted-foreground mt-0.5">{source.snippet}</p>
                            )}
                            {source.sqlQuery && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium">
                                  Voir la requête SQL
                                </summary>
                                <pre className="mt-2 p-2 bg-slate-900 text-slate-100 rounded text-xs overflow-x-auto">
                                  {source.sqlQuery}
                                </pre>
                              </details>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Métadonnées (optionnel, peut être masqué par défaut) */}
                  {message.metadata && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {message.metadata.durationMs && (
                        <span>⏱ {message.metadata.durationMs}ms</span>
                      )}
                      {message.metadata.iterations && (
                        <span className="ml-2">🔄 {message.metadata.iterations} itération(s)</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t flex-shrink-0">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Posez votre question..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input.trim()} size="icon">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

