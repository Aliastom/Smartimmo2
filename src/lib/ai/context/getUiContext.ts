/**
 * Extraction automatique du contexte depuis l'UI
 * Détecte scope, période, entité sélectionnée depuis l'URL et les paramètres
 */

export interface UiContext {
  // Scope d'entité
  scope: {
    propertyId?: string;
    tenantId?: string;
    leaseId?: string;
    loanId?: string;
    transactionId?: string;
    documentId?: string;
  };
  
  // Période active
  period?: {
    start: Date;
    end: Date;
    label?: string;
  };
  
  // Route courante
  route: string;
  
  // Locale
  locale: string;
  
  // Filtres actifs
  filters?: Record<string, any>;
  
  // Entité détectée
  entity?: {
    type: 'property' | 'tenant' | 'lease' | 'loan' | 'transaction' | 'document';
    id: string;
    label?: string;
  };
}

/**
 * Extrait le contexte UI depuis pathname et searchParams
 */
export function getUiContextFromUrl(pathname: string, searchParams?: URLSearchParams): UiContext {
  const context: UiContext = {
    scope: {},
    route: pathname,
    locale: 'fr-FR',
  };

  // Détecter l'entité depuis l'URL
  const entityPatterns = [
    { regex: /\/biens\/([^\/\?]+)/, type: 'property' as const, scopeKey: 'propertyId' },
    { regex: /\/baux\/([^\/\?]+)/, type: 'lease' as const, scopeKey: 'leaseId' },
    { regex: /\/locataires\/([^\/\?]+)/, type: 'tenant' as const, scopeKey: 'tenantId' },
    { regex: /\/loans\/([^\/\?]+)/, type: 'loan' as const, scopeKey: 'loanId' },
    { regex: /\/transactions\/([^\/\?]+)/, type: 'transaction' as const, scopeKey: 'transactionId' },
    { regex: /\/documents\/([^\/\?]+)/, type: 'document' as const, scopeKey: 'documentId' },
  ];

  for (const pattern of entityPatterns) {
    const match = pathname.match(pattern.regex);
    if (match && match[1]) {
      const id = match[1];
      context.scope[pattern.scopeKey] = id;
      context.entity = {
        type: pattern.type,
        id,
      };
      break;
    }
  }

  // Extraire les filtres depuis searchParams
  if (searchParams) {
    const filters: Record<string, any> = {};

    searchParams.forEach((value, key) => {
      filters[key] = value;

      // Détecter période depuis les filtres
      if (key === 'month' && value) {
        const [year, month] = value.split('-').map(Number);
        if (year && month) {
          const startDate = new Date(year, month - 1, 1);
          context.period = {
            start: startDate,
            end: new Date(year, month, 0), // Dernier jour du mois
            label: `${month}/${year}`,
          };
        }
      }

      if (key === 'year' && value) {
        const year = parseInt(value, 10);
        context.period = {
          start: new Date(year, 0, 1),
          end: new Date(year, 11, 31),
          label: year.toString(),
        };
      }

      // Détecter des scopes additionnels depuis les filtres
      if (key === 'propertyId') context.scope.propertyId = value;
      if (key === 'leaseId') context.scope.leaseId = value;
      if (key === 'tenantId') context.scope.tenantId = value;
    });

    if (Object.keys(filters).length > 0) {
      context.filters = filters;
    }
  }

  return context;
}

/**
 * Fusionne le contexte UI avec le contexte de la question normalisée
 */
export function mergeContexts(uiContext: UiContext, questionContext: { timeRange?: any }): UiContext {
  const merged = { ...uiContext };

  // Priorité au timeRange de la question si spécifié
  if (questionContext.timeRange && !merged.period) {
    merged.period = questionContext.timeRange;
  }

  return merged;
}

/**
 * Convertit le contexte en clauses SQL WHERE
 */
export function contextToSqlWhere(context: UiContext): string[] {
  const clauses: string[] = [];

  // Scope d'entité
  if (context.scope.propertyId) {
    clauses.push(`"propertyId" = '${context.scope.propertyId}'`);
  }

  if (context.scope.leaseId) {
    clauses.push(`"leaseId" = '${context.scope.leaseId}'`);
  }

  if (context.scope.tenantId) {
    clauses.push(`"tenantId" = '${context.scope.tenantId}'`);
  }

  // Période
  if (context.period) {
    const start = context.period.start.toISOString().split('T')[0];
    const end = context.period.end.toISOString().split('T')[0];
    clauses.push(`date BETWEEN '${start}' AND '${end}'`);
  }

  return clauses;
}

/**
 * Génère un résumé textuel du contexte pour le prompt
 */
export function contextToPrompt(context: UiContext): string {
  const parts: string[] = [];

  if (context.entity) {
    parts.push(`Contexte: ${context.entity.type} "${context.entity.id}"`);
  }

  if (context.period) {
    parts.push(`Période: ${context.period.label || 'filtrée'}`);
  }

  if (context.scope.propertyId) {
    parts.push(`Bien: ${context.scope.propertyId}`);
  }

  if (parts.length === 0) {
    return 'Contexte: Vue globale (toutes données)';
  }

  return parts.join(' | ');
}

