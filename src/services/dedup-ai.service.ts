/**
 * DedupAI - Agent d'évaluation des doublons
 * 
 * Mission : Évaluer si un fichier nouvellement uploadé est un doublon
 * d'un document déjà présent dans la base de données.
 */

interface TempFile {
  id: string;
  name: string;
  bytes: number;
  size_kb: number;
  pages: number;
  ocr_text: string;
  ocr_quality: number;
  detected_type: string;
  period?: string;
  context?: any;
  checksum?: string;
}

interface ExistingCandidate {
  id: string;
  name: string;
  uploadedAt: string;
  size_kb: number;
  pages: number;
  ocr_text: string;
  ocr_quality: number;
  type: string;
  period?: string;
  context?: any;
  checksum: string;
}

interface DedupAIResult {
  duplicateType: "exact_duplicate" | "near_duplicate" | "potential_duplicate" | "none";
  suggestedAction: "cancel" | "replace" | "keep_both" | "ask_user" | "proceed";
  matchedDocument: {
    id: string | null;
    name: string | null;
    uploadedAt: string | null;
    type: string | null;
  };
  TypeSignal: {
    checksum_match: boolean;
    text_similarity: number;
    pages_new: number;
    pages_existing: number;
    size_kb_new: number;
    size_kb_existing: number;
    ocr_quality_new: number;
    ocr_quality_existing: number;
    period_match: boolean;
    context_match: boolean;
    filename_hint: boolean;
  };
  ui: {
    title: string;
    subtitle: string;
    badges: string[];
    recommendation: string;
  };
}

export class DedupAIService {
  
  /**
   * Analyse un fichier temporaire contre des candidats existants
   */
  analyze(tempFile: TempFile, existingCandidates: ExistingCandidate[]): DedupAIResult {
    if (!existingCandidates || existingCandidates.length === 0) {
      return this.createNoneResult(tempFile);
    }

    // 1) Normaliser les textes
    const normalizedTempText = this.normalizeText(tempFile.ocr_text);
    
    let bestMatch: ExistingCandidate | null = null;
    let bestSimilarity = 0;
    let bestSignals: any = null;

    // 2) Analyser chaque candidat
    for (const candidate of existingCandidates) {
      const normalizedCandidateText = this.normalizeText(candidate.ocr_text);
      const similarity = this.calculateTextSimilarity(normalizedTempText, normalizedCandidateText);
      
      console.log('[DedupAI] Analyse candidat:', {
        candidateName: candidate.name,
        tempTextLength: normalizedTempText.length,
        candidateTextLength: normalizedCandidateText.length,
        tempTextPreview: normalizedTempText.slice(0, 100),
        candidateTextPreview: normalizedCandidateText.slice(0, 100),
        similarity: similarity
      });
      
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = candidate;
        bestSignals = this.calculateSignals(tempFile, candidate, similarity);
      }
    }

    // Si on a un match par checksum exact, on l'utilise même avec une faible similarité textuelle
    const exactChecksumMatch = existingCandidates.find(candidate => 
      tempFile.checksum && candidate.checksum && tempFile.checksum === candidate.checksum
    );
    
    if (exactChecksumMatch && (!bestMatch || bestSimilarity < 0.75)) {
      // Utiliser le match par checksum exact
      bestMatch = exactChecksumMatch;
      const normalizedCandidateText = this.normalizeText(exactChecksumMatch.ocr_text);
      const similarity = this.calculateTextSimilarity(normalizedTempText, normalizedCandidateText);
      bestSignals = this.calculateSignals(tempFile, exactChecksumMatch, similarity);
      console.log('[DedupAI] Utilisation du match par checksum exact');
    }
    
    if (!bestMatch || (bestSimilarity < 0.95 && !exactChecksumMatch)) {
      return this.createNoneResult(tempFile);
    }

    // 3) Déterminer le type de doublon
    const duplicateType = this.determineDuplicateType(tempFile, bestMatch, bestSignals);
    
    // 4) Choisir l'action suggérée
    const suggestedAction = this.determineSuggestedAction(duplicateType, tempFile, bestMatch, bestSignals);
    
    // 5) Générer l'interface utilisateur
    const ui = this.generateUI(duplicateType, tempFile, bestMatch, bestSignals);

    return {
      duplicateType,
      suggestedAction,
      matchedDocument: {
        id: bestMatch.id,
        name: bestMatch.name,
        uploadedAt: bestMatch.uploadedAt,
        type: bestMatch.type
      },
      signals: bestSignals,
      ui
    };
  }

  /**
   * Normalise le texte OCR
   */
  private normalizeText(text: string): string {
    if (!text) return '';
    
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Normaliser les espaces
      .replace(/[^\w\s]/g, '') // Supprimer la ponctuation
      .replace(/\b(quittance|facture|avis|taxe|foncière|habitation|de)\b/g, '') // Supprimer mots récurrents (mais garder "loyer")
      .trim();
  }

  /**
   * Calcule la similarité textuelle (cosine similarity)
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;
    
    const words1 = text1.split(' ').filter(w => w.length > 2);
    const words2 = text2.split(' ').filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const allWords = [...new Set([...words1, ...words2])];
    const vector1 = allWords.map(word => words1.filter(w => w === word).length);
    const vector2 = allWords.map(word => words2.filter(w => w === word).length);
    
    const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
    const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    
    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Calcule tous les signaux de comparaison
   */
  private calculateSignals(tempFile: TempFile, candidate: ExistingCandidate, textSimilarity: number) {
    console.log('[DedupAI] Comparaison checksums:', {
      tempChecksum: tempFile.checksum,
      candidateChecksum: candidate.checksum,
      areEqual: tempFile.checksum === candidate.checksum,
      tempLength: tempFile.checksum?.length,
      candidateLength: candidate.checksum?.length
    });
    const checksumMatch = tempFile.checksum && candidate.checksum && tempFile.checksum === candidate.checksum;
    const periodMatch = this.comparePeriods(tempFile.period, candidate.period);
    const contextMatch = this.compareContexts(tempFile.context, candidate.context);
    const filenameHint = this.compareFilenames(tempFile.name, candidate.name);
    
    return {
      checksum_match: checksumMatch,
      text_similarity: textSimilarity,
      pages_new: tempFile.pages,
      pages_existing: candidate.pages,
      size_kb_new: tempFile.size_kb,
      size_kb_existing: candidate.size_kb,
      ocr_quality_new: tempFile.ocr_quality,
      ocr_quality_existing: candidate.ocr_quality,
      period_match: periodMatch,
      context_match: contextMatch,
      filename_hint: filenameHint
    };
  }

  /**
   * Compare les périodes
   */
  private comparePeriods(period1?: string, period2?: string): boolean {
    if (!period1 || !period2) return false;
    
    // Normaliser les formats de date
    const date1 = new Date(period1);
    const date2 = new Date(period2);
    
    if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return false;
    
    // Même année et mois
    return date1.getFullYear() === date2.getFullYear() && 
           date1.getMonth() === date2.getMonth();
  }

  /**
   * Compare les contextes
   */
  private compareContexts(context1?: any, context2?: any): boolean {
    if (!context1 || !context2) return false;
    
    // Comparer les IDs de propriété, locataire, etc.
    return Boolean(
      (context1.propertyId && context1.propertyId === context2.propertyId) ||
      (context1.tenantId && context1.tenantId === context2.tenantId) ||
      (context1.leaseId && context1.leaseId === context2.leaseId)
    );
  }

  /**
   * Compare les noms de fichiers
   */
  private compareFilenames(name1: string, name2: string): boolean {
    if (!name1 || !name2) return false;
    
    const clean1 = name1.toLowerCase().replace(/\(copie\)|\(copy\)|_copy/g, '').replace(/\s+/g, '').trim();
    const clean2 = name2.toLowerCase().replace(/\(copie\)|\(copy\)|_copy/g, '').replace(/\s+/g, '').trim();
    
    return clean1 === clean2;
  }

  /**
   * Détermine le type de doublon
   */
  private determineDuplicateType(tempFile: TempFile, candidate: ExistingCandidate, signals: any): "exact_duplicate" | "near_duplicate" | "potential_duplicate" | "none" {
    console.log('[DedupAI] Détermination du type:', {
      checksumMatch: signals.checksum_match,
      pagesNew: signals.pages_new,
      pagesExisting: signals.pages_existing,
      textSimilarity: signals.text_similarity,
      condition1: signals.checksum_match,
      condition2: signals.pages_new === signals.pages_existing && signals.text_similarity >= 0.995
    });
    
    // Exact duplicate
    if (signals.checksum_match || 
        (signals.pages_new === signals.pages_existing && signals.text_similarity >= 0.995)) {
      console.log('[DedupAI] → exact_duplicate');
      return "exact_duplicate";
    }
    
    // Near duplicate
    if (signals.text_similarity >= 0.98) {
      return "near_duplicate";
    }
    
    // Potential duplicate (seuil plus élevé pour éviter les faux positifs)
    if (signals.text_similarity >= 0.99 || 
        (signals.period_match && signals.context_match && 
         signals.ocr_quality_new < signals.ocr_quality_existing - 0.1)) {
      return "potential_duplicate";
    }
    
    return "none";
  }

  /**
   * Détermine l'action suggérée
   */
  private determineSuggestedAction(
    duplicateType: string, 
    tempFile: TempFile, 
    candidate: ExistingCandidate, 
    signals: any
  ): "cancel" | "replace" | "keep_both" | "ask_user" | "proceed" {
    
    switch (duplicateType) {
      case "exact_duplicate":
        return "cancel";
        
      case "near_duplicate":
        // Remplacer si le nouveau est de meilleure qualité
        if (this.isNewFileBetter(tempFile, candidate, signals)) {
          return "replace";
        }
        return "cancel";
        
      case "potential_duplicate":
        // Si pages différentes pour un document 1 page, demander à l'utilisateur
        if (this.isSinglePageDocument(tempFile.detected_type) && 
            signals.pages_new !== signals.pages_existing) {
          return "ask_user";
        }
        return "ask_user";
        
      default:
        return "proceed";
    }
  }

  /**
   * Détermine si le nouveau fichier est de meilleure qualité
   */
  private isNewFileBetter(tempFile: TempFile, candidate: ExistingCandidate, signals: any): boolean {
    // Préfère le fichier avec la meilleure qualité OCR
    if (Math.abs(signals.ocr_quality_new - signals.ocr_quality_existing) > 0.03) {
      return signals.ocr_quality_new > signals.ocr_quality_existing;
    }
    
    // À qualité égale, préfère le plus léger si tailles très proches
    const sizeDiff = Math.abs(signals.size_kb_new - signals.size_kb_existing);
    const sizeRatio = sizeDiff / Math.max(signals.size_kb_new, signals.size_kb_existing);
    
    if (sizeRatio < 0.05) {
      return signals.size_kb_new < signals.size_kb_existing;
    }
    
    // Si les tailles ne sont pas très proches, on considère que c'est équivalent
    return false;
  }

  /**
   * Détermine si c'est un document d'une page
   */
  private isSinglePageDocument(detectedType: string): boolean {
    const singlePageTypes = ['quittance', 'facture', 'avis', 'reçu'];
    return singlePageTypes.some(type => detectedType.toLowerCase().includes(type));
  }

  /**
   * Génère l'interface utilisateur
   */
  private generateUI(duplicateType: string, tempFile: TempFile, candidate: ExistingCandidate, signals: any) {
    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString('fr-FR');
    };

    switch (duplicateType) {
      case "exact_duplicate":
        return {
          title: "Doublon exact détecté",
          subtitle: `Identique à « ${candidate.name} » (uploadé le ${formatDate(candidate.uploadedAt)})`,
          badges: [
            `Checksum identique: ${signals.checksum_match ? 'Oui' : 'Non'}`,
            `Similarité textuelle: ${Math.round(signals.text_similarity * 100)}%`,
            `Pages: ${signals.pages_new} vs ${signals.pages_existing}`,
            `Période: ${signals.period_match ? 'Oui' : 'Non'}`,
            `Contexte: ${signals.context_match ? 'Oui' : 'Non'}`
          ],
          recommendation: "Ce fichier est identique au fichier existant. Il est inutile de le conserver."
        };

      case "near_duplicate":
        return {
          title: "Doublon probable détecté",
          subtitle: `Très similaire à « ${candidate.name} » (uploadé le ${formatDate(candidate.uploadedAt)})`,
          badges: [
            `Checksum identique: ${signals.checksum_match ? 'Oui' : 'Non'}`,
            `Similarité textuelle: ${Math.round(signals.text_similarity * 100)}%`,
            `Pages: ${signals.pages_new} vs ${signals.pages_existing}`,
            `Période: ${signals.period_match ? 'Oui' : 'Non'}`,
            `Contexte: ${signals.context_match ? 'Oui' : 'Non'}`
          ],
          recommendation: signals.ocr_quality_new > signals.ocr_quality_existing 
            ? "Le nouveau fichier semble de meilleure qualité. Il est recommandé de remplacer le fichier existant."
            : "Le fichier existant semble de meilleure qualité. Il est recommandé d'annuler l'upload."
        };

      case "potential_duplicate":
        return {
          title: "Doublon potentiel détecté",
          subtitle: `Possiblement similaire à « ${candidate.name} » (uploadé le ${formatDate(candidate.uploadedAt)})`,
          badges: [
            `Checksum identique: ${signals.checksum_match ? 'Oui' : 'Non'}`,
            `Similarité textuelle: ${Math.round(signals.text_similarity * 100)}%`,
            `Pages: ${signals.pages_new} vs ${signals.pages_existing}`,
            `Période: ${signals.period_match ? 'Oui' : 'Non'}`,
            `Contexte: ${signals.context_match ? 'Oui' : 'Non'}`
          ],
          recommendation: "Ce fichier pourrait être un doublon. Veuillez vérifier et choisir l'action appropriée."
        };

      default:
        return {
          title: "Aucun doublon détecté",
          subtitle: "Ce fichier semble être nouveau.",
          badges: [],
          recommendation: "Vous pouvez continuer l'upload normalement."
        };
    }
  }

  /**
   * Crée un résultat "none"
   */
  private createNoneResult(tempFile: TempFile): DedupAIResult {
    return {
      duplicateType: "none",
      suggestedAction: "proceed",
      matchedDocument: {
        id: null,
        name: null,
        uploadedAt: null,
        type: null
      },
      TypeSignal: {
        checksum_match: false,
        text_similarity: 0,
        pages_new: tempFile.pages,
        pages_existing: 0,
        size_kb_new: tempFile.size_kb,
        size_kb_existing: 0,
        ocr_quality_new: tempFile.ocr_quality,
        ocr_quality_existing: 0,
        period_match: false,
        context_match: false,
        filename_hint: false
      },
      ui: {
        title: "Aucun doublon détecté",
        subtitle: "Ce fichier semble être nouveau.",
        badges: [],
        recommendation: "Vous pouvez continuer l'upload normalement."
      }
    };
  }
}

// Instance singleton
export const dedupAI = new DedupAIService();
