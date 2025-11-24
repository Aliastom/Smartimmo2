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
export interface Facture {
  date?: string;
  numero?: string;
  fournisseur?: string;
  dateService?: string;
  description?: string;
  montant: number;
}

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
    // Date de paiement
    paymentDate?: string;
    // Factures de la section DÉPENSES ET AUTRES RECETTES
    factures?: Facture[];
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
          allMatches: match.allMatches || [], // Stocker tous les matches pour traitement ultérieur
          confidence: match.confidence
        };
        const matchCount = match.allMatches?.length || 1;
        console.log(`[TransactionSuggestion] ✅ ${fieldName}:`, match.value, `(${match.allGroups?.length || 0} groupes, ${matchCount} match${matchCount > 1 ? 'es' : ''})`);
        // Log détaillé pour loyer_principal pour déboguer
        if (fieldName === 'loyer_principal' && match.allMatches && match.allMatches.length > 1) {
          match.allMatches.forEach((m: any, i) => {
            const matchText = m.fullText || m.value || 'N/A';
            const matchIndex = m.index !== undefined ? m.index : -1;
            const beforeMatch = matchIndex >= 0 ? text.substring(Math.max(0, matchIndex - 50), matchIndex) : '';
            const afterMatch = matchIndex >= 0 ? text.substring(matchIndex + (m.fullText?.length || 0), Math.min(text.length, matchIndex + (m.fullText?.length || 0) + 50)) : '';
            console.log(`[TransactionSuggestion] 🔍 Match ${i + 1} loyer_principal (index ${matchIndex}):`);
            console.log(`  Texte complet: "${matchText}"`);
            console.log(`  Avant (50 chars): "${beforeMatch}"`);
            console.log(`  Après (50 chars): "${afterMatch}"`);
            console.log(`  Groupes: [1]=${m.groups?.[0] || 'N/A'}, [2]=${m.groups?.[1] || 'N/A'}`);
          });
        }
        // Log détaillé pour regularisation_charges pour déboguer
        if (fieldName === 'regularisation_charges' && match.allMatches) {
          match.allMatches.forEach((m: any, i) => {
            const matchText = m.fullText || m.value || 'N/A';
            const matchIndex = m.index !== undefined ? m.index : -1;
            const beforeMatch = matchIndex >= 0 ? text.substring(Math.max(0, matchIndex - 50), matchIndex) : '';
            const afterMatch = matchIndex >= 0 ? text.substring(matchIndex + (m.fullText?.length || 0), Math.min(text.length, matchIndex + (m.fullText?.length || 0) + 50)) : '';
            console.log(`[TransactionSuggestion] 🔍 Match ${i + 1} regularisation_charges (index ${matchIndex}):`);
            console.log(`  Texte complet: "${matchText}"`);
            console.log(`  Avant (50 chars): "${beforeMatch}"`);
            console.log(`  Après (50 chars): "${afterMatch}"`);
            console.log(`  Groupes: [1]=${m.groups?.[0] || 'N/A'}, [2]=${m.groups?.[1] || 'N/A'}`);
          });
        }
      } else {
        // Log pour déboguer les regex qui ne matchent pas
        if (['loyer_principal', 'provisions_charges', 'regularisation_charges', 'entretien_chaudiere', 'ordures_menageres', 'facture'].includes(fieldName)) {
          console.log(`[TransactionSuggestion] ⚠️ ${fieldName}: Aucun match trouvé avec le pattern: ${pattern.substring(0, 50)}...`);
          // Afficher un extrait du texte pour déboguer
          const textLower = text.toLowerCase();
          const searchTerm = fieldName === 'loyer_principal' ? 'loyer principal' : 
                           fieldName === 'provisions_charges' ? 'provisions charges' :
                           fieldName === 'regularisation_charges' ? ['régularisation', 'regularisation', 'charges'] :
                           fieldName === 'entretien_chaudiere' ? 'entretien chaudiere' :
                           fieldName === 'ordures_menageres' ? ['ordures', 'menageres', 'taxe'] :
                           fieldName === 'facture' ? ['facture', 'dépenses', 'depenses'] : [];
          // Chercher toutes les occurrences
          if (Array.isArray(searchTerm)) {
            // Pour ordures_menageres, chercher plusieurs termes
            searchTerm.forEach(term => {
              const indices: number[] = [];
              let searchIndex = textLower.indexOf(term);
              while (searchIndex !== -1) {
                indices.push(searchIndex);
                searchIndex = textLower.indexOf(term, searchIndex + 1);
              }
              if (indices.length > 0) {
                console.log(`[TransactionSuggestion] 🔍 Trouvé "${term}" ${indices.length} fois aux positions: ${indices.join(', ')}`);
                indices.forEach((idx, i) => {
                  const excerpt = text.substring(Math.max(0, idx - 30), Math.min(text.length, idx + 150));
                  console.log(`[TransactionSuggestion] 🔍 Extrait ${i + 1}: "${excerpt}"`);
                });
              }
            });
          } else {
            const indices: number[] = [];
            let searchIndex = textLower.indexOf(searchTerm);
            while (searchIndex !== -1) {
              indices.push(searchIndex);
              searchIndex = textLower.indexOf(searchTerm, searchIndex + 1);
            }
            if (indices.length > 0) {
              console.log(`[TransactionSuggestion] 🔍 Trouvé "${searchTerm}" ${indices.length} fois aux positions: ${indices.join(', ')}`);
              indices.forEach((idx, i) => {
                const excerpt = text.substring(Math.max(0, idx - 30), Math.min(text.length, idx + 150));
                console.log(`[TransactionSuggestion] 🔍 Extrait ${i + 1}: "${excerpt}"`);
              });
            } else {
              console.log(`[TransactionSuggestion] 🔍 "${searchTerm}" non trouvé dans le texte`);
            }
          }
        }
      }
    }

    // PHASE 2 : Appliquer le mapping si défini
    if (Object.keys(mapping).length > 0) {
      console.log('[TransactionSuggestion] 🗺️ Application du mapping...');
      
      // Liste des champs qui doivent être additionnés (montants uniquement)
      const fieldsToSum = ['loyer_encaisse', 'charges_encaisse', 'regularisation_encaisse', 'chaudiere_encaisse', 'ordures_encaisse'];
      
      for (const [targetField, mapConfig] of Object.entries(mapping)) {
        if (typeof mapConfig === 'object' && mapConfig.from) {
          const sourceData = extracted[mapConfig.from];
          if (sourceData) {
            const groupIndex = mapConfig.group || 1;
            const isAmountField = fieldsToSum.includes(targetField);
            
            // Fonction pour filtrer les matches invalides (total, loyer principal)
            const filterInvalidMatches = (matches: any[], fieldName: string) => {
              return matches.filter((m: any) => {
                const fullText = m.fullText || m.value || '';
                // Exclure les matches qui contiennent "total" (insensible à la casse)
                // Utiliser /total/i au lieu de /\btotal\b/i car "total" peut être collé à un nombre (ex: "total180")
                const hasTotal = /total/i.test(fullText);
                // Pour regularisation_encaisse, ne pas exclure si "loyer principal" est présent
                // car les montants corrects peuvent être avant "loyer principal"
                // On extraira les montants corrects dans le code suivant
                if (fieldName === 'regularisation_encaisse') {
                  // Ne pas exclure, on gérera cela différemment
                  if (hasTotal) {
                    console.log(`[TransactionSuggestion] 🚫 Match exclu (contient "total"): "${fullText.substring(0, 100)}..."`);
                    return false;
                  }
                  return true;
                } else if (fieldName === 'loyer_encaisse') {
                  // Pour loyer_encaisse, c'est normal qu'il contienne "loyer principal"
                  // On exclut seulement les lignes de total
                  if (hasTotal) {
                    console.log(`[TransactionSuggestion] 🚫 Match exclu (contient "total"): "${fullText.substring(0, 100)}..."`);
                    return false;
                  }
                  return true;
                } else {
                  // Pour les autres champs, exclure "loyer principal" aussi
                  const hasLoyerPrincipal = /loyer\s+principal/i.test(fullText);
                  if (hasTotal || hasLoyerPrincipal) {
                    console.log(`[TransactionSuggestion] 🚫 Match exclu (contient "${hasTotal ? 'total' : 'loyer principal'}"): "${fullText.substring(0, 100)}..."`);
                  }
                  return !hasTotal && !hasLoyerPrincipal;
                }
              });
            };
            
            // Si plusieurs matches ET que c'est un champ de montant, additionner
            const shouldSum = sourceData.allMatches && sourceData.allMatches.length > 1 && isAmountField;
            
            // Pour regularisation_encaisse, extraire les montants avant "loyer principal"
            if (targetField === 'regularisation_encaisse' && sourceData.allMatches && sourceData.allMatches.length > 0) {
              const match = sourceData.allMatches[0];
              const fullText = match.fullText || match.value || '';
              
              // Si le match contient "loyer principal", extraire les montants avant
              if (/loyer\s+principal/i.test(fullText)) {
                // Chercher les montants qui apparaissent après "charges" et avant "loyer principal"
                // Format attendu: "...charges...173,2891,00...loyer principal..."
                const beforeLoyer = fullText.split(/loyer\s+principal/i)[0];
                // Chercher les deux derniers montants avant "loyer principal"
                const amountMatches = beforeLoyer.match(/(\d{1,3}(?:[\s,]\d{3})*,\d{2})/g);
                if (amountMatches && amountMatches.length >= 2) {
                  // Prendre les deux derniers montants (ceux de la régularisation)
                  const lastTwo = amountMatches.slice(-2);
                  const amount1 = this.parseAmount(this.fixCollidedAmount(lastTwo[0]));
                  const amount2 = this.parseAmount(this.fixCollidedAmount(lastTwo[1]));
                  // Utiliser le deuxième montant (colonne encaissement)
                  rawData[targetField] = amount2.toFixed(2).replace('.', ',');
                  console.log(`[TransactionSuggestion] 📍 ${targetField} = ${rawData[targetField]} (extrait avant "loyer principal" depuis ${mapConfig.from})`);
                } else {
                  console.log(`[TransactionSuggestion] ⚠️ Impossible d'extraire les montants avant "loyer principal" pour ${targetField}`);
                }
              } else {
                // Pas de "loyer principal", comportement normal
                let value = sourceData.groups[groupIndex - 1] || sourceData.value;
                value = this.fixCollidedAmount(value);
                rawData[targetField] = value;
                console.log(`[TransactionSuggestion] 📍 ${targetField} = ${rawData[targetField]} (depuis ${mapConfig.from} groupe ${groupIndex})`);
              }
            } else if (shouldSum) {
              // Filtrer les matches invalides puis additionner
              const validMatches = filterInvalidMatches(sourceData.allMatches, targetField);
              
              if (validMatches.length === 0) {
                console.log(`[TransactionSuggestion] ⚠️ Aucun match valide après filtrage pour ${targetField}, utilisation du premier match`);
                // Si tous les matches ont été exclus, prendre le premier quand même (fallback)
                let value = sourceData.groups[groupIndex - 1] || sourceData.value;
                value = this.fixCollidedAmount(value);
                rawData[targetField] = value;
              } else {
                const total = validMatches.reduce((sum, m) => {
                  let amountStr = m.groups[groupIndex - 1] || m.value;
                  // Corriger les montants collés aux dates (ex: "251 668,05" -> "1 668,05")
                  amountStr = this.fixCollidedAmount(amountStr);
                  const val = this.parseAmount(amountStr);
                  return sum + (val || 0);
                }, 0);
                rawData[targetField] = total.toFixed(2).replace('.', ',');
                console.log(`[TransactionSuggestion] 📍 ${targetField} = ${rawData[targetField]} (somme de ${validMatches.length} matches valides sur ${sourceData.allMatches.length} depuis ${mapConfig.from})`);
              }
            } else {
              // Un seul match ou champ non-montant : filtrer quand même si c'est un champ de montant
              if (isAmountField && sourceData.allMatches && sourceData.allMatches.length > 0) {
                const validMatches = filterInvalidMatches(sourceData.allMatches, targetField);
                if (validMatches.length > 0) {
                  // Prendre le premier match valide
                  let value = validMatches[0].groups[groupIndex - 1] || validMatches[0].value;
                  value = this.fixCollidedAmount(value);
                  rawData[targetField] = value;
                  console.log(`[TransactionSuggestion] 📍 ${targetField} = ${rawData[targetField]} (match valide filtré depuis ${mapConfig.from})`);
                } else {
                  // Tous les matches ont été exclus, ne pas définir la valeur (ou utiliser une valeur par défaut)
                  console.log(`[TransactionSuggestion] ⚠️ Aucun match valide pour ${targetField}, champ non défini`);
                  // Ne pas définir rawData[targetField] pour que le champ reste vide
                }
              } else {
                // Comportement normal (prendre le premier match)
                let value = sourceData.groups[groupIndex - 1] || sourceData.value;
                // Corriger les montants collés aux dates
                if (isAmountField) {
                  value = this.fixCollidedAmount(value);
                }
                rawData[targetField] = value;
                console.log(`[TransactionSuggestion] 📍 ${targetField} = ${value} (depuis ${mapConfig.from} groupe ${groupIndex})`);
              }
            }
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

    // Détail du loyer (breakdown) - défini avant postprocess pour les valeurs brutes
    if (rawData.loyer_hc || rawData.loyer_encaisse) {
      const parsed = this.parseAmount(rawData.loyer_hc || rawData.loyer_encaisse);
      suggestions.montantLoyer = parsed !== null ? Math.round(parsed * 100) / 100 : undefined;
      fieldsConfidence.montantLoyer = 0.9;
      console.log(`[TransactionSuggestion] 🏠 Loyer HC: ${suggestions.montantLoyer}`);
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
          const rounded = Math.round(value * 100) / 100;
          (suggestions as any)[targetField] = rounded;
          fieldsConfidence[targetField] = 0.9;
          console.log(`[TransactionSuggestion] 💰 ${targetField} = parseAmount(${sourceField}) = ${rounded}`);
        }
        continue;
      }
      
      // sum(field1, field2, ...) - supporte plusieurs arguments
      const sumMatch = expression.match(/sum\(([^)]+)\)/);
      if (sumMatch) {
        const fields = sumMatch[1].split(',').map(f => f.trim());
        const values = fields.map(field => this.parseAmount(rawData[field])).filter(v => v !== null) as number[];
        if (values.length > 0) {
          const total = values.reduce((sum, val) => sum + val, 0);
          // Arrondir à 2 décimales pour éviter les erreurs de précision flottante
          const roundedTotal = Math.round(total * 100) / 100;
          (suggestions as any)[targetField] = roundedTotal;
          fieldsConfidence[targetField] = 0.9;
          console.log(`[TransactionSuggestion] 💰 ${targetField} = sum(${fields.join(', ')}) = ${values.join(' + ')} = ${roundedTotal}`);
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
          const result = val1 - val2;
          (suggestions as any)[targetField] = Math.round(result * 100) / 100;
          fieldsConfidence[targetField] = 0.9;
          console.log(`[TransactionSuggestion] 💰 ${targetField} = subtract(${field1}, ${field2}) = ${val1} - ${val2} = ${val1 - val2}`);
        }
        continue;
      }
    }
    
    // Définir chargesRecup APRÈS le postprocess pour utiliser la valeur calculée
    // Utilise charges_encaisse du postprocess (somme calculée) si disponible, sinon rawData
    if ((suggestions as any).charges_encaisse !== undefined) {
      suggestions.chargesRecup = Math.round((suggestions as any).charges_encaisse * 100) / 100;
      fieldsConfidence.chargesRecup = 0.9;
      console.log(`[TransactionSuggestion] 📦 Charges récup (depuis postprocess): ${suggestions.chargesRecup}`);
    } else if (rawData.charges_hc || rawData.charges_encaisse) {
      const parsed = this.parseAmount(rawData.charges_hc || rawData.charges_encaisse);
      suggestions.chargesRecup = parsed !== null ? Math.round(parsed * 100) / 100 : undefined;
      fieldsConfidence.chargesRecup = 0.9;
      console.log(`[TransactionSuggestion] 📦 Charges récup (depuis rawData): ${suggestions.chargesRecup}`);
    }

    // Construire le tableau de factures à partir des matches de la regex facture
    console.log('[TransactionSuggestion] 🔍 Vérification factures - extracted.facture:', extracted.facture ? 'présent' : 'absent');
    if (extracted.facture) {
      console.log('[TransactionSuggestion] 🔍 extracted.facture.allMatches:', extracted.facture.allMatches?.length || 0, 'matches');
      if (extracted.facture.allMatches && extracted.facture.allMatches.length > 0) {
        console.log('[TransactionSuggestion] 🔍 Détails des matches facture:', JSON.stringify(extracted.facture.allMatches, null, 2));
        const factures: Facture[] = [];
        for (const match of extracted.facture.allMatches) {
          console.log('[TransactionSuggestion] 🔍 Traitement match facture:', match);
          // La regex facture capture : date (groupe 1), tout entre Facture et du (groupe 2), dateService (groupe 3), description (groupe 4/5), montant (groupe 6)
          // Note: match.groups[0] est le premier groupe capturé (date), pas le match complet
          if (match.groups && match.groups.length >= 6) {
            console.log('[TransactionSuggestion] 🔍 Match facture a', match.groups.length, 'groupes:', match.groups);
            const date = match.groups[0]?.trim(); // Groupe 1 = index 0
            const entreFactureEtDu = match.groups[1]?.trim() || ''; // Groupe 2 = index 1
            const dateService = match.groups[2]?.trim(); // Groupe 3 = index 2
            const description = (match.groups[3] || match.groups[4] || '').trim(); // Groupe 4 ou 5 = index 3 ou 4
            const montantStr = match.groups[5]; // Groupe 6 = index 5
            const montant = this.parseAmount(montantStr);
            console.log('[TransactionSuggestion] 🔍 Montant parsé:', montant);
            
            // Extraire numéro et fournisseur depuis "entreFactureEtDu"
            // Format 1: "2025-140598 mr henninot" -> numéro avec tiret en premier
            // Format 2: "TUTIN Thierry 1364" -> nom puis numéro simple
            let numero, fournisseur;
            
            // Détecter si c'est Format 1 (numéro avec tiret ou format long en premier)
            const matchFormat1 = entreFactureEtDu.match(/^([A-Z0-9\-]+)\s+(.+)$/);
            if (matchFormat1 && (matchFormat1[1].includes('-') || matchFormat1[1].length > 5)) {
              // Format 1: numéro puis fournisseur
              numero = matchFormat1[1];
              fournisseur = matchFormat1[2];
            } else {
              // Format 2: fournisseur puis numéro
              const matchFormat2 = entreFactureEtDu.match(/^(.+?)\s+(\d+)$/);
              if (matchFormat2) {
                fournisseur = matchFormat2[1];
                numero = matchFormat2[2];
              } else {
                // Fallback: essayer de trouver un numéro à la fin
                const matchNumero = entreFactureEtDu.match(/(\d+)$/);
                if (matchNumero) {
                  numero = matchNumero[1];
                  fournisseur = entreFactureEtDu.replace(/\s+\d+$/, '').trim();
                } else {
                  numero = '';
                  fournisseur = entreFactureEtDu;
                }
              }
            }
            
            if (montant !== null && montant > 0) {
              const facture = {
                date: date,
                numero: numero,
                fournisseur: fournisseur,
                dateService: dateService,
                description: description,
                montant: Math.round(montant * 100) / 100
              };
              factures.push(facture);
              console.log('[TransactionSuggestion] ✅ Facture ajoutée:', facture);
            } else {
              console.log('[TransactionSuggestion] ⚠️ Montant invalide ou nul pour facture');
            }
          } else {
            console.log('[TransactionSuggestion] ⚠️ Match facture n\'a pas assez de groupes:', match.groups?.length || 0);
          }
        }
        if (factures.length > 0) {
          (suggestions as any).factures = factures;
          fieldsConfidence.factures = 0.85;
          console.log(`[TransactionSuggestion] 📄 Factures extraites: ${factures.length} facture(s)`, factures);
        } else {
          console.log('[TransactionSuggestion] ⚠️ Aucune facture valide construite');
        }
      } else {
        console.log('[TransactionSuggestion] ⚠️ Aucun match trouvé pour facture');
      }
    } else {
      console.log('[TransactionSuggestion] ⚠️ Regex facture non trouvée dans extracted');
    }

    // Fallback si amount n'est pas calculé par postprocess
    if (!suggestions.amount) {
      if (suggestions.montantLoyer && suggestions.chargesRecup) {
        // Utiliser les valeurs du breakdown si disponibles
        suggestions.amount = Math.round((suggestions.montantLoyer + suggestions.chargesRecup) * 100) / 100;
        fieldsConfidence.amount = 0.9;
        console.log(`[TransactionSuggestion] 💰 Montant depuis breakdown: ${suggestions.amount}`);
      } else if (rawData.montant) {
        const parsed = this.parseAmount(rawData.montant);
        suggestions.amount = parsed !== null ? Math.round(parsed * 100) / 100 : undefined;
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

    // Date de paiement : convertir DD/MM/YYYY vers YYYY-MM-DD
    if (rawData.date_paiement) {
      const dateMatch = rawData.date_paiement.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (dateMatch) {
        const [, day, month, year] = dateMatch;
        const paymentDate = `${year}-${month}-${day}`;
        (suggestions as any).paymentDate = paymentDate;
        fieldsConfidence.paymentDate = 0.9;
        console.log(`[TransactionSuggestion] 💳 Date de paiement: ${rawData.date_paiement} -> ${paymentDate}`);
      }
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
   * Extrait une valeur avec une regex (support groupes multiples et plusieurs matches)
   */
  private extractWithRegex(text: string, pattern: string, groupIndex: number = 1): {
    value: string;
    allGroups?: string[];
    allMatches?: Array<{value: string; groups: string[]}>;
    confidence: number;
    position?: { page: number; start: number; end: number };
  } | null {
    try {
      const regex = new RegExp(pattern, 'gi'); // 'g' pour global, 'i' pour insensible à la casse
      const matches = [...text.matchAll(regex)];
      
      if (matches.length === 0) {
        return null;
      }
      
      // Pour compatibilité : retourner le premier match comme avant
      const firstMatch = matches[0];
      if (!firstMatch[groupIndex]) {
        return null;
      }
      
      // Stocker tous les matches pour traitement ultérieur
      const allMatches = matches.map(m => ({
        value: m[groupIndex]?.trim() || '',
        groups: m.slice(1).map(g => g?.trim() || ''),
        index: m.index,
        fullText: m[0] // Texte complet du match
      }));
      
      return {
        value: firstMatch[groupIndex].trim(),
        allGroups: firstMatch.slice(1).map(g => g?.trim() || ''), // Tous les groupes du premier match
        allMatches: allMatches, // Tous les matches (pour additionner les montants)
        confidence: 0.85,
        position: {
          page: 1,
          start: firstMatch.index || 0,
          end: (firstMatch.index || 0) + firstMatch[0].length
        }
      };
    } catch (error) {
      console.warn('[TransactionSuggestion] Erreur regex:', pattern, error);
    }
    
    return null;
  }

  /**
   * Corrige les montants collés aux dates (ex: "251 668,05" -> "1 668,05")
   * Si le montant commence par 2 chiffres suivis d'un espace et d'un nombre avec espace dans milliers,
   * c'est probablement une date collée (ex: "25" de "31.05.25" + "1 668,05")
   */
  private fixCollidedAmount(amountText: string): string {
    if (!amountText) return amountText;
    // Pattern : 2 chiffres + espace + nombre avec espace dans milliers (ex: "251 668,05")
    const collidedPattern = /^(\d{2})\s(\d{1,3}[\s,]\d{3},\d{2})$/;
    const match = amountText.match(collidedPattern);
    if (match) {
      // Probablement une date collée, garder seulement le deuxième groupe
      console.log(`[TransactionSuggestion] 🔧 Montant collé détecté: "${amountText}" -> "${match[2]}"`);
      return match[2];
    }
    return amountText;
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

