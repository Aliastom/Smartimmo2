import { prisma } from '@/lib/prisma';

/**
 * Zone de texte mise en évidence dans le document
 */
export interface HighlightZone {
  fieldName: string;
  text: string;
  position?: {
    page: number;
    start: number;
    end: number;
  };
}

/**
 * Payload de suggestion de transaction
 */
export interface TransactionSuggestionPayload {
  confidence: number;
  suggestions: {
    propertyId?: string;
    leaseId?: string;
    nature?: string;
    categoryId?: string;
    amount?: number;
    date?: string;
    periodMonth?: string;
    periodYear?: number;
    label?: string;
    reference?: string;
    notes?: string;
    // Détail du loyer (gestion déléguée)
    montantLoyer?: number;
    chargesRecup?: number;
    chargesNonRecup?: number;
  };
  meta: {
    documentId: string;
    documentTypeCode: string;
    extractionVersion: string;
    fieldsConfidence: Record<string, number>;
    highlights?: HighlightZone[];
    rawExtractedData?: Record<string, any>;
  };
  locks?: {
    field: string;
    reason: string;
  }[];
}

/**
 * Configuration avancée d'un type de document
 */
interface DocumentTypeConfig {
  defaultContexts?: {
    autoCreateAboveConfidence?: number;
    natureCategorieMap?: Record<string, string>;
    codeSystemMap?: Record<string, string>;
    monthMap?: Record<string, string>;
  };
  suggestionsConfig?: {
    regex?: Record<string, string>;
    mapping?: Record<string, any>; // Support mapping avec groupes
    postprocess?: Record<string, any>; // Support calculs et transformations
    libelleTemplate?: string;
    extractors?: Record<string, any>;
    confidenceWeights?: Record<string, number>;
  };
  flowLocks?: Array<{
    if: string;
    lock: string[];
    reason: string;
  }>;
  metaSchema?: {
    fields?: string[];
    confidenceThreshold?: number;
    version?: string;
  };
}

/**
 * Service de suggestion de transactions depuis documents OCR
 */
class TransactionSuggestionService {
  /**
   * Extrait une suggestion de transaction depuis un document OCR
   */
  async fromDocument(documentId: string): Promise<TransactionSuggestionPayload | null> {
    try {
      console.log('[TransactionSuggestion] 📄 Analyse du document:', documentId);

      // 1. Récupérer le document et son type
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          extractedText: true,
          documentTypeId: true,
          organizationId: true,
          DocumentType: {
            select: {
              id: true,
              code: true,
              label: true,
              openTransaction: true,
              suggestionsConfig: true,
              defaultContexts: true,
              flowLocks: true,
              metaSchema: true
            }
          },
          DocumentLink: {
            where: { linkedType: 'PROPERTY' },
            select: { linkedId: true },
            take: 1
          }
        }
      });

      console.log('[TransactionSuggestion] 🔍 Document récupéré:', {
        existe: !!document,
        hasType: !!document?.DocumentType,
        textLength: document?.extractedText?.length || 0
      });

      if (!document) {
        console.error('[TransactionSuggestion] ❌ Document non trouvé:', documentId);
        return null;
      }

      if (!document.DocumentType) {
        console.log('[TransactionSuggestion] ⚠️ Pas de type de document défini');
        return null;
      }

      console.log('[TransactionSuggestion] 📋 Type de document:', document.DocumentType.code);

      // 2. Vérifier si le déclencheur est activé
      if (!document.DocumentType.openTransaction) {
        console.log('[TransactionSuggestion] ⚠️ Déclencheur transaction désactivé pour ce type (openTransaction=false)');
        return null;
      }

      console.log('[TransactionSuggestion] ✅ Déclencheur activé (openTransaction=true)');

      // 3. Charger la configuration avancée
      const config = this.parseConfig(document.DocumentType);
      
      console.log('[TransactionSuggestion] ⚙️ Configuration chargée:', {
        hasSuggestionsConfig: !!config.suggestionsConfig,
        hasDefaultContexts: !!config.defaultContexts,
        hasMetaSchema: !!config.metaSchema
      });
      
      if (!config.suggestionsConfig) {
        console.log('[TransactionSuggestion] ⚠️ Pas de configuration de suggestions pour ce type');
        return null;
      }

      // 3. Extraire le texte OCR
      const textContent = document.extractedText || '';
      if (!textContent) {
        console.log('[TransactionSuggestion] ⚠️ Pas de texte extrait disponible');
        return null;
      }

      console.log('[TransactionSuggestion] ✅ Texte disponible:', textContent.length, 'caractères');

      // 4. Extraire les champs métier
      const extractedData = await this.extractFields(textContent, config, document, document.organizationId);
      
      // 4.5. Utiliser le lien du document si disponible (priorité sur matching par nom)
      if (!extractedData.suggestions.propertyId && document.DocumentLink && document.DocumentLink.length > 0) {
        // Vérifier que le bien appartient à l'organisation
        const property = await prisma.property.findFirst({
          where: { 
            id: document.DocumentLink[0].linkedId,
            organizationId: document.organizationId
          },
          select: { id: true }
        });
        if (property) {
          extractedData.suggestions.propertyId = property.id;
          extractedData.fieldsConfidence.propertyId = 0.95;
          console.log(`[TransactionSuggestion] 🏠 Bien depuis lien du document: ${property.id}`);
        }
      }
      
      // 5. Calculer la confiance globale
      const confidence = this.calculateOverallConfidence(extractedData.fieldsConfidence);

      // 6. Appliquer les verrouillages (flowLocks)
      const locks = this.applyFlowLocks(config, extractedData.suggestions);

      console.log('[TransactionSuggestion] Extraction terminée:', {
        confidence,
        fields: Object.keys(extractedData.suggestions),
        locks: locks.length
      });

      return {
        confidence,
        suggestions: extractedData.suggestions,
        meta: {
          documentId: document.id,
          documentTypeCode: document.DocumentType.code,
          extractionVersion: config.metaSchema?.version || 'v1.0',
          fieldsConfidence: extractedData.fieldsConfidence,
          highlights: extractedData.highlights,
          rawExtractedData: extractedData.rawData
        },
        locks
      };

    } catch (error) {
      console.error('[TransactionSuggestion] ❌ Erreur lors de l\'extraction:', error);
      console.error('[TransactionSuggestion] ❌ Message:', error instanceof Error ? error.message : String(error));
      console.error('[TransactionSuggestion] ❌ Stack:', error instanceof Error ? error.stack : 'N/A');
      return null;
    }
  }

  /**
   * Parse la configuration JSON des colonnes de DocumentType
   */
  private parseConfig(documentType: any): DocumentTypeConfig {
    const config: DocumentTypeConfig = {};

    try {
      if (documentType.defaultContexts) {
        config.defaultContexts = typeof documentType.defaultContexts === 'string'
          ? JSON.parse(documentType.defaultContexts)
          : documentType.defaultContexts;
      }
    } catch (e) {
      console.warn('[TransactionSuggestion] Erreur parsing defaultContexts:', e);
    }

    try {
      if (documentType.suggestionsConfig) {
        config.suggestionsConfig = typeof documentType.suggestionsConfig === 'string'
          ? JSON.parse(documentType.suggestionsConfig)
          : documentType.suggestionsConfig;
      }
    } catch (e) {
      console.warn('[TransactionSuggestion] Erreur parsing suggestionsConfig:', e);
    }

    try {
      if (documentType.flowLocks) {
        config.flowLocks = typeof documentType.flowLocks === 'string'
          ? JSON.parse(documentType.flowLocks)
          : documentType.flowLocks;
      }
    } catch (e) {
      console.warn('[TransactionSuggestion] Erreur parsing flowLocks:', e);
    }

    try {
      if (documentType.metaSchema) {
        config.metaSchema = typeof documentType.metaSchema === 'string'
          ? JSON.parse(documentType.metaSchema)
          : documentType.metaSchema;
      }
    } catch (e) {
      console.warn('[TransactionSuggestion] Erreur parsing metaSchema:', e);
    }

    return config;
  }

  /**
   * Extrait les champs métier depuis le texte OCR (VERSION AVANCÉE avec mapping)
   */
  private async extractFields(
    text: string,
    config: DocumentTypeConfig,
    document: any,
    organizationId?: string
  ): Promise<{
    suggestions: any;
    fieldsConfidence: Record<string, number>;
    highlights: HighlightZone[];
    rawData: Record<string, any>;
  }> {
    const suggestions: any = {};
    const fieldsConfidence: Record<string, number> = {};
    const highlights: HighlightZone[] = [];
    const rawData: Record<string, any> = {};
    const extracted: Record<string, any> = {}; // Stockage intermédiaire des extractions

    const regex = config.suggestionsConfig?.regex || {};
    const mapping = config.suggestionsConfig?.mapping || {};
    const postprocess = config.suggestionsConfig?.postprocess || {};

    console.log('[TransactionSuggestion] 🔍 Extraction avec', Object.keys(regex).length, 'regex');

    // PHASE 1 : Extraire toutes les regex et stocker les groupes
    for (const [fieldName, pattern] of Object.entries(regex)) {
      const match = this.extractWithRegex(text, pattern);
      if (match) {
        extracted[fieldName] = {
          value: match.value,
          groups: match.allGroups || [],
          confidence: match.confidence
        };
        console.log(`[TransactionSuggestion] ✅ ${fieldName}:`, match.value, `(${match.allGroups?.length || 0} groupes)`);
      }
    }

    // PHASE 2 : Appliquer le mapping si défini
    if (Object.keys(mapping).length > 0) {
      console.log('[TransactionSuggestion] 🗺️ Application du mapping...');
      for (const [targetField, mapConfig] of Object.entries(mapping)) {
        if (typeof mapConfig === 'object' && mapConfig.from) {
          const sourceData = extracted[mapConfig.from];
          if (sourceData) {
            const groupIndex = mapConfig.group || 1;
            const value = sourceData.groups[groupIndex - 1] || sourceData.value;
            rawData[targetField] = value;
            console.log(`[TransactionSuggestion] 📍 ${targetField} = ${value} (depuis ${mapConfig.from} groupe ${groupIndex})`);
          }
        }
      }
    } else {
      // Pas de mapping : utiliser les valeurs directement
      for (const [fieldName, data] of Object.entries(extracted)) {
        rawData[fieldName] = data.value;
      }
    }
    
    // IMPORTANT : Ajouter aussi les champs non mappés dans rawData pour le template
    // (nécessaire pour les champs comme "locataire" utilisés dans libelleTemplate mais non mappés)
    for (const [fieldName, data] of Object.entries(extracted)) {
      if (!(fieldName in rawData)) {
        rawData[fieldName] = typeof data === 'object' ? data.value : data;
      }
    }

    console.log('[TransactionSuggestion] 📊 Données extraites:', rawData);

    // PHASE 3 : Appliquer le postprocess et mapper vers suggestions
    console.log('[TransactionSuggestion] 🔄 Postprocess et mapping vers suggestions...');

    // Détail du loyer (breakdown)
    if (rawData.loyer_hc || rawData.loyer_encaisse) {
      suggestions.montantLoyer = this.parseAmount(rawData.loyer_hc || rawData.loyer_encaisse);
      fieldsConfidence.montantLoyer = 0.9;
      console.log(`[TransactionSuggestion] 🏠 Loyer HC: ${suggestions.montantLoyer}`);
    }
    if (rawData.charges_hc || rawData.charges_encaisse) {
      suggestions.chargesRecup = this.parseAmount(rawData.charges_hc || rawData.charges_encaisse);
      fieldsConfidence.chargesRecup = 0.9;
      console.log(`[TransactionSuggestion] 📦 Charges récup: ${suggestions.chargesRecup}`);
    }
    if (rawData.charges_non_recup) {
      suggestions.chargesNonRecup = this.parseAmount(rawData.charges_non_recup);
      fieldsConfidence.chargesNonRecup = 0.9;
    }

    // 🔄 Traiter tous les postprocess avec fonctions (parseAmount, sum, subtract)
    for (const [targetField, expression] of Object.entries(postprocess)) {
      if (typeof expression !== 'string') continue;
      
      // parseAmount(field)
      const parseAmountMatch = expression.match(/parseAmount\(([^)]+)\)/);
      if (parseAmountMatch) {
        const sourceField = parseAmountMatch[1];
        const value = this.parseAmount(rawData[sourceField]);
        if (value !== null) {
          (suggestions as any)[targetField] = value;
          fieldsConfidence[targetField] = 0.9;
          console.log(`[TransactionSuggestion] 💰 ${targetField} = parseAmount(${sourceField}) = ${value}`);
        }
        continue;
      }
      
      // sum(field1, field2)
      const sumMatch = expression.match(/sum\(([^,]+),\s*([^)]+)\)/);
      if (sumMatch) {
        const val1 = this.parseAmount(rawData[sumMatch[1]]);
        const val2 = this.parseAmount(rawData[sumMatch[2]]);
        if (val1 !== null && val2 !== null) {
          (suggestions as any)[targetField] = val1 + val2;
          fieldsConfidence[targetField] = 0.9;
          console.log(`[TransactionSuggestion] 💰 ${targetField} = sum(${sumMatch[1]}, ${sumMatch[2]}) = ${val1} + ${val2} = ${val1 + val2}`);
        }
        continue;
      }
      
      // subtract(field1, field2)
      const subtractMatch = expression.match(/subtract\(([^,]+),\s*([^)]+)\)/);
      if (subtractMatch) {
        const field1 = subtractMatch[1];
        const field2 = subtractMatch[2];
        // Les champs peuvent être des résultats de postprocess déjà calculés
        const val1 = (suggestions as any)[field1] ?? this.parseAmount(rawData[field1]);
        const val2 = (suggestions as any)[field2] ?? this.parseAmount(rawData[field2]);
        if (val1 !== null && val2 !== null) {
          (suggestions as any)[targetField] = val1 - val2;
          fieldsConfidence[targetField] = 0.9;
          console.log(`[TransactionSuggestion] 💰 ${targetField} = subtract(${field1}, ${field2}) = ${val1} - ${val2} = ${val1 - val2}`);
        }
        continue;
      }
    }
    
    // Fallback si amount n'est pas calculé par postprocess
    if (!suggestions.amount) {
      if (suggestions.montantLoyer && suggestions.chargesRecup) {
        // Utiliser les valeurs du breakdown si disponibles
        suggestions.amount = suggestions.montantLoyer + suggestions.chargesRecup;
        fieldsConfidence.amount = 0.9;
        console.log(`[TransactionSuggestion] 💰 Montant depuis breakdown: ${suggestions.amount}`);
      } else if (rawData.montant) {
        suggestions.amount = this.parseAmount(rawData.montant);
        fieldsConfidence.amount = 0.8;
      }
    }

    // Période : depuis periode_mois + periode_annee, ou parser depuis periode/periode_bandeau
    if (rawData.periode_mois && rawData.periode_annee) {
      // Cas 1 : mapping direct mois + année
      const month = rawData.periode_mois.toString().padStart(2, '0');
      const year = parseInt(rawData.periode_annee);
      suggestions.periodMonth = month;
      suggestions.periodYear = year;
      suggestions.date = `${year}-${month}-01`;
      fieldsConfidence.period = 0.95;
      console.log(`[TransactionSuggestion] 📅 Période depuis mapping: ${month}/${year}`);
    } else if (rawData.periode || extracted.periode_bandeau) {
      // Cas 2 : parser depuis texte
      const periodeText = rawData.periode || extracted.periode_bandeau?.groups[3] + '/' + extracted.periode_bandeau?.groups[4];
      const parsedPeriod = this.parsePeriodFromDate(periodeText);
      if (parsedPeriod) {
        suggestions.periodMonth = parsedPeriod.month;
        suggestions.periodYear = parsedPeriod.year;
        suggestions.date = `${parsedPeriod.year}-${parsedPeriod.month}-01`;
        fieldsConfidence.period = 0.9;
        console.log(`[TransactionSuggestion] 📅 Période parsée: ${parsedPeriod.month}/${parsedPeriod.year}`);
      }
    }

    // Bien : matcher en base (via adresse ou locataire)
    if (rawData.bien || rawData.adresse_bien) {
      const bienText = rawData.bien || rawData.adresse_bien;
      const propertyId = await this.matchProperty(bienText, organizationId);
      if (propertyId) {
        suggestions.propertyId = propertyId;
        fieldsConfidence.propertyId = 0.85;
        console.log(`[TransactionSuggestion] 🏠 Bien matché par adresse: ${propertyId}`);
      }
      rawData.bien = bienText;
    }

    // Fallback : chercher via le locataire si le bien n'est pas trouvé
    if (!suggestions.propertyId && extracted.locataire) {
      const locataireNom = extracted.locataire.value;
      console.log('[TransactionSuggestion] 🔍 Tentative matching par locataire:', locataireNom);
      const match = await this.matchPropertyAndLeaseByTenant(locataireNom, organizationId);
      if (match.propertyId) {
        suggestions.propertyId = match.propertyId;
        suggestions.leaseId = match.leaseId;
        fieldsConfidence.propertyId = 0.9;
        fieldsConfidence.leaseId = 0.9;
        console.log(`[TransactionSuggestion] 🏠 Bien matché par locataire: ${match.propertyId}, bail: ${match.leaseId}`);
      }
    }

    // Référence
    if (rawData.reference) {
      suggestions.reference = rawData.reference;
      fieldsConfidence.reference = 0.8;
    }

    // Nature : depuis postprocess ou détection
    if (postprocess.nature) {
      suggestions.nature = postprocess.nature;
      fieldsConfidence.nature = 0.9;
    } else {
      const natureFromText = this.detectNature(text);
      if (natureFromText) {
        suggestions.nature = natureFromText;
        fieldsConfidence.nature = 0.7;
      }
    }

    // Catégorie : depuis postprocess ou mapping
    if (postprocess.categorie) {
      const category = await this.findCategoryByLabel(postprocess.categorie);
      if (category) {
        suggestions.categoryId = category.id;
        fieldsConfidence.categoryId = 0.9;
      }
    } else if (suggestions.nature && config.defaultContexts?.natureCategorieMap) {
      const categoryLabel = config.defaultContexts.natureCategorieMap[suggestions.nature];
      if (categoryLabel) {
        const category = await this.findCategoryByLabel(categoryLabel);
        if (category) {
          suggestions.categoryId = category.id;
          fieldsConfidence.categoryId = 0.8;
        }
      }
    }

    // Libellé : depuis template avec les données extraites
    if (config.suggestionsConfig?.libelleTemplate || postprocess.libelleTemplate) {
      const template = postprocess.libelleTemplate || config.suggestionsConfig.libelleTemplate;
      // rawData contient maintenant tous les champs (mappés + non mappés) grâce au code ci-dessus
      const label = this.generateLabel(template, rawData);
      if (label) {
        suggestions.label = label;
        fieldsConfidence.label = 0.9;
        console.log(`[TransactionSuggestion] 📝 Libellé généré: ${label}`);
      }
    }

    // Date : si pas définie, utiliser la période
    if (!suggestions.date && suggestions.periodMonth && suggestions.periodYear) {
      const month = suggestions.periodMonth.padStart(2, '0');
      suggestions.date = `${suggestions.periodYear}-${month}-01`;
      fieldsConfidence.date = fieldsConfidence.period || 0.7;
    }

    console.log('[TransactionSuggestion] ✅ Suggestions finales:', suggestions);
    console.log('[TransactionSuggestion] 📊 Confiances:', fieldsConfidence);

    return {
      suggestions,
      fieldsConfidence,
      highlights,
      rawData
    };
  }

  /**
   * Extrait une valeur avec une regex (support groupes multiples)
   */
  private extractWithRegex(text: string, pattern: string, groupIndex: number = 1): {
    value: string;
    allGroups?: string[];
    confidence: number;
    position?: { page: number; start: number; end: number };
  } | null {
    try {
      const regex = new RegExp(pattern, 'i');
      const match = text.match(regex);
      
      if (match && match[groupIndex]) {
        return {
          value: match[groupIndex].trim(),
          allGroups: match.slice(1), // Tous les groupes capturés (sans le match[0])
          confidence: 0.85,
          position: {
            page: 1,
            start: match.index || 0,
            end: (match.index || 0) + match[0].length
          }
        };
      }
    } catch (error) {
      console.warn('[TransactionSuggestion] Erreur regex:', pattern, error);
    }
    
    return null;
  }

  /**
   * Parse un montant texte vers nombre
   */
  private parseAmount(amountText: string | undefined): number | null {
    if (!amountText) return null;
    const cleaned = amountText
      .replace(/[€\s]/g, '')
      .replace(',', '.')
      .replace(/[^\d.]/g, '');
    const amount = parseFloat(cleaned);
    return isNaN(amount) ? null : amount;
  }

  /**
   * Parse une date au format DD/MM/YYYY vers mois/année
   */
  private parsePeriodFromDate(dateText: string): { month: string; year: number } | null {
    if (!dateText) return null;
    // Format "MM/YYYY" ou "DD/MM/YYYY"
    const match = dateText.match(/(\d{1,2})\/(\d{4})|(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) {
      if (match[1] && match[2]) {
        // Format MM/YYYY
        return { month: match[1].padStart(2, '0'), year: parseInt(match[2]) };
      } else if (match[3] && match[4] && match[5]) {
        // Format DD/MM/YYYY
        return { month: match[4].padStart(2, '0'), year: parseInt(match[5]) };
      }
    }
    return null;
  }

  /**
   * Parse une période texte vers mois/année
   */
  private parsePeriod(periodText: string): { month: string; year: number } | null {
    const months: Record<string, string> = {
      'janvier': '01', 'jan': '01',
      'février': '02', 'fev': '02', 'fevrier': '02',
      'mars': '03', 'mar': '03',
      'avril': '04', 'avr': '04',
      'mai': '05',
      'juin': '06',
      'juillet': '07', 'juil': '07',
      'août': '08', 'aout': '08',
      'septembre': '09', 'sep': '09', 'sept': '09',
      'octobre': '10', 'oct': '10',
      'novembre': '11', 'nov': '11',
      'décembre': '12', 'dec': '12', 'decembre': '12'
    };

    const lower = periodText.toLowerCase();

    // Format "janvier 2024" ou "jan 2024"
    for (const [monthName, monthNum] of Object.entries(months)) {
      if (lower.includes(monthName)) {
        const yearMatch = periodText.match(/20\d{2}/);
        if (yearMatch) {
          return {
            month: monthNum,
            year: parseInt(yearMatch[0])
          };
        }
        // Année courante par défaut
        return {
          month: monthNum,
          year: new Date().getFullYear()
        };
      }
    }

    // Format "02/2024" ou "02-2024"
    const numericMatch = periodText.match(/(\d{1,2})[\/\-](\d{4})/);
    if (numericMatch) {
      return {
        month: numericMatch[1].padStart(2, '0'),
        year: parseInt(numericMatch[2])
      };
    }

    return null;
  }

  /**
   * Parse une date texte vers format ISO
   */
  private parseDate(dateText: string): string | null {
    // Format "01/02/2024" ou "01-02-2024"
    const match = dateText.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (match) {
      const day = match[1].padStart(2, '0');
      const month = match[2].padStart(2, '0');
      const year = match[3];
      return `${year}-${month}-${day}`;
    }

    return null;
  }

  /**
   * Détecte la nature depuis le texte (heuristique simple)
   */
  private detectNature(text: string): string | null {
    const lower = text.toLowerCase();

    if (lower.includes('loyer') || lower.includes('location')) {
      return 'RECETTE_LOYER';
    }
    if (lower.includes('commission') || lower.includes('honoraires')) {
      return 'DEPENSE_GESTION';
    }
    if (lower.includes('assurance')) {
      return 'DEPENSE_ASSURANCE';
    }
    if (lower.includes('taxe') || lower.includes('foncier')) {
      return 'DEPENSE_TAXE';
    }
    if (lower.includes('entretien') || lower.includes('réparation') || lower.includes('reparation')) {
      return 'DEPENSE_ENTRETIEN';
    }
    if (lower.includes('banque') || lower.includes('frais bancaire')) {
      return 'DEPENSE_BANQUE';
    }

    return null;
  }

  /**
   * Trouve une catégorie par son libellé
   */
  private async findCategoryByLabel(label: string): Promise<{ id: string } | null> {
    try {
      const category = await prisma.category.findFirst({
        where: {
          label: {
            contains: label,
            mode: 'insensitive'
          },
          actif: true
        },
        select: { id: true }
      });

      return category;
    } catch (error) {
      console.warn('[TransactionSuggestion] Erreur recherche catégorie:', error);
      return null;
    }
  }

  /**
   * Tente de matcher un texte de bien avec un bien existant
   */
  private async matchProperty(propertyText: string, organizationId?: string): Promise<string | null> {
    try {
      // Recherche par nom ou adresse
      const properties = await prisma.property.findMany({
        where: {
          ...(organizationId ? { organizationId } : {}),
          OR: [
            { name: { contains: propertyText, mode: 'insensitive' } },
            { address: { contains: propertyText, mode: 'insensitive' } }
          ],
          isArchived: false
        },
        select: { id: true, name: true },
        take: 1
      });

      if (properties.length > 0) {
        console.log('[TransactionSuggestion] Bien matché:', properties[0].name);
        return properties[0].id;
      }
    } catch (error) {
      console.warn('[TransactionSuggestion] Erreur matching propriété:', error);
    }

    return null;
  }

  /**
   * Tente de trouver un bien et un bail via le nom du locataire
   */
  private async matchPropertyAndLeaseByTenant(tenantName: string, organizationId?: string): Promise<{
    propertyId: string | null;
    leaseId: string | null;
  }> {
    try {
      if (!tenantName || tenantName.length < 3) {
        return { propertyId: null, leaseId: null };
      }

      console.log('[TransactionSuggestion] 🔍 Recherche bail pour locataire:', tenantName);

      // Nettoyer le nom (enlever M., Mme, etc.)
      const cleanName = tenantName
        .replace(/^(M\.|Mme|Mlle|Mr)\.?\s*/i, '')
        .trim()
        .toLowerCase();

      // Rechercher un bail actif pour ce locataire
      // Gérer les deux ordres possibles : "Prénom Nom" ou "Nom Prénom"
      const nameParts = cleanName.split(' ').filter(p => p.length > 0);
      
      if (nameParts.length < 2) {
        console.log('[TransactionSuggestion] ⚠️ Nom incomplet pour recherche:', tenantName);
        return { propertyId: null, leaseId: null };
      }

      const part1 = nameParts[0];
      const part2 = nameParts[nameParts.length - 1];

      const lease = await prisma.lease.findFirst({
        where: {
          ...(organizationId ? { organizationId } : {}),
          Tenant: {
            ...(organizationId ? { organizationId } : {}),
            OR: [
              // Cas 1 : "Prénom Nom" (ex: Alain Tosetto)
              {
                AND: [
                  { firstName: { contains: part1, mode: 'insensitive' } },
                  { lastName: { contains: part2, mode: 'insensitive' } }
                ]
              },
              // Cas 2 : "Nom Prénom" (ex: tosetto alain)
              {
                AND: [
                  { firstName: { contains: part2, mode: 'insensitive' } },
                  { lastName: { contains: part1, mode: 'insensitive' } }
                ]
              }
            ]
          },
          status: { in: ['ACTIVE', 'PENDING', 'ACTIF', 'EN_ATTENTE'] }
        },
        select: {
          id: true,
          propertyId: true,
          Tenant: { select: { firstName: true, lastName: true } },
          Property: { select: { name: true } }
        },
        orderBy: { startDate: 'desc' },
        take: 1
      });

      if (lease) {
        const fullName = `${lease.Tenant.firstName} ${lease.Tenant.lastName}`;
        console.log('[TransactionSuggestion] ✅ Bail trouvé:', fullName, '→', lease.Property.name);
        return {
          propertyId: lease.propertyId,
          leaseId: lease.id
        };
      } else {
        console.log('[TransactionSuggestion] ⚠️ Aucun bail actif trouvé pour:', tenantName);
      }
    } catch (error) {
      console.warn('[TransactionSuggestion] Erreur matching locataire:', error);
    }

    return { propertyId: null, leaseId: null };
  }

  /**
   * Génère un libellé depuis un template
   */
  private generateLabel(template: string, data: Record<string, string>): string {
    let label = template;
    
    for (const [key, value] of Object.entries(data)) {
      label = label.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    
    // Nettoyer les placeholders non remplacés
    label = label.replace(/\{[^}]+\}/g, '').trim();
    
    return label || '';
  }

  /**
   * Calcule la confiance globale
   */
  private calculateOverallConfidence(fieldsConfidence: Record<string, number>): number {
    const confidences = Object.values(fieldsConfidence);
    if (confidences.length === 0) return 0;
    
    // Moyenne pondérée (montant et date sont plus importants)
    const weights: Record<string, number> = {
      amount: 1.5,
      date: 1.3,
      propertyId: 1.2,
      nature: 1.0,
      categoryId: 1.0,
      period: 0.8,
      label: 0.5
    };

    let totalWeight = 0;
    let weightedSum = 0;

    for (const [field, confidence] of Object.entries(fieldsConfidence)) {
      const weight = weights[field] || 1.0;
      weightedSum += confidence * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Applique les règles de verrouillage (flowLocks)
   */
  private applyFlowLocks(
    config: DocumentTypeConfig,
    suggestions: any
  ): { field: string; reason: string }[] {
    const locks: { field: string; reason: string }[] = [];

    if (!config.flowLocks || !Array.isArray(config.flowLocks)) {
      console.log('[TransactionSuggestion] ⚠️ flowLocks non valide ou absent');
      return locks;
    }

    for (const lockRule of config.flowLocks) {
      // Pour simplifier, on évalue des conditions basiques
      // Une implémentation complète nécessiterait un parser de conditions
      let shouldLock = false;

      // Exemple: "nature == 'Commission'"
      if (lockRule.if.includes("nature == 'Commission'") && suggestions.nature === 'DEPENSE_GESTION') {
        shouldLock = true;
      }

      if (shouldLock) {
        for (const field of lockRule.lock) {
          locks.push({
            field,
            reason: lockRule.reason
          });
        }
      }
    }

    return locks;
  }
}

// Instance singleton
export const transactionSuggestionService = new TransactionSuggestionService();

