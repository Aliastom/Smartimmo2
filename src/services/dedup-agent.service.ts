/**
 * Agent Dedup de Smartimmo
 * Service de détection et résolution des doublons de documents
 */

import {
  DedupInput,
  DedupOutput,
  DedupConfig,
  DEFAULT_DEDUP_CONFIG,
  DuplicateStatus,
  SuggestedAction,
  QualityComparison,
  ModalLevel,
  CandidateDocument,
  NewFileInput,
  DuplicateSignals,
} from '@/types/dedup';
import { TextSimilarityService } from './text-similarity.service';

export class DedupAgentService {
  private config: DedupConfig;

  constructor(config?: Partial<DedupConfig>) {
    this.config = { ...DEFAULT_DEDUP_CONFIG, ...config };
  }

  /**
   * Point d'entrée principal : analyse un nouveau fichier et décide quoi faire
   */
  async analyze(input: DedupInput): Promise<DedupOutput> {
    const startTime = Date.now();

    this.log('🔍 Démarrage analyse de doublon', {
      newFile: input.newFile.name,
      candidatesCount: input.candidates.length,
    });

    // Si aucun candidat, pas de doublon
    if (input.candidates.length === 0) {
      return this.buildNoDuplicateResponse(startTime);
    }

    // Analyser chaque candidat et trouver le meilleur match
    let bestMatch: CandidateDocument | null = null;
    let bestSignals: DuplicateSignals | null = null;
    let bestStatus: DuplicateStatus = 'not_duplicate';

    for (const candidate of input.candidates) {
      const signals = this.analyzeCandidate(input.newFile, candidate);
      const status = this.determineStatus(signals);

      this.log('📊 Analyse candidat', {
        candidate: candidate.name,
        status,
        checksumMatch: signals.checksumMatch,
        textSimilarity: signals.textSimilarity.toFixed(3),
      });

      // Prioriser : exact_duplicate > probable_duplicate
      if (status === 'exact_duplicate') {
        bestMatch = candidate;
        bestSignals = signals;
        bestStatus = status;
        break; // Doublon exact trouvé, pas besoin de continuer
      }

      if (status === 'probable_duplicate' && bestStatus !== 'exact_duplicate') {
        bestMatch = candidate;
        bestSignals = signals;
        bestStatus = status;
      }
    }

    // Si aucun match trouvé
    if (!bestMatch || !bestSignals) {
      return this.buildNoDuplicateResponse(startTime);
    }

    // Déterminer l'action suggérée
    const suggestedAction = this.determineSuggestedAction(
      bestStatus,
      bestSignals,
      input.newFile,
      bestMatch
    );

    // Construire le contenu de la modale
    const modal = this.buildModalContent(
      bestStatus,
      suggestedAction,
      bestMatch,
      bestSignals
    );

    const processingTime = Date.now() - startTime;

    this.log('✅ Analyse terminée', {
      status: bestStatus,
      suggestedAction,
      processingTimeMs: processingTime,
    });

    return {
      status: bestStatus,
      matchedDocument: {
        id: bestMatch.id,
        name: bestMatch.name,
        url: bestMatch.url,
      },
      signals: bestSignals,
      suggestedAction,
      modal,
      metadata: {
        decisionReason: this.buildDecisionReason(bestStatus, bestSignals),
        timestamp: new Date().toISOString(),
        processingTimeMs: processingTime,
      },
    };
  }

  /**
   * Analyse un candidat et calcule les signaux de doublon
   */
  private analyzeCandidate(
    newFile: NewFileInput,
    candidate: CandidateDocument
  ): DuplicateSignals {
    // 1. Vérifier le checksum
    const checksumMatch = newFile.checksum === candidate.checksum;

    // 2. Calculer la similarité textuelle
    const textSimilarity = checksumMatch
      ? 1.0 // Si checksum identique, similarité = 100%
      : TextSimilarityService.calculateSimilarity(
          newFile.ocr.text,
          candidate.ocr.textPreview
        );

    // 3. Vérifier si même période
    const samePeriod = this.comparePeriods(
      newFile.extracted.period,
      candidate.extracted.period
    );

    // 4. Vérifier si même contexte (propriété/locataire)
    const sameContext = this.compareContexts(newFile.context, candidate.context);

    // 5. Comparer la qualité
    const qualityComparison = this.compareQuality(newFile, candidate);

    // 6. Construire les différences
    const differences = this.buildDifferences(newFile, candidate);

    return {
      checksumMatch,
      textSimilarity,
      samePeriod,
      sameContext,
      qualityComparison,
      differences,
    };
  }

  /**
   * Détermine le statut de doublon basé sur les signaux
   */
  private determineStatus(signals: DuplicateSignals): DuplicateStatus {
    // Règle 1 : Doublon exact si checksum identique
    if (signals.checksumMatch) {
      return 'exact_duplicate';
    }

    // Règle 2 : Quasi-doublon si similarité textuelle élevée OU période identique
    if (
      signals.textSimilarity >= this.config.textSimilarityThreshold ||
      signals.samePeriod
    ) {
      return 'probable_duplicate';
    }

    return 'not_duplicate';
  }

  /**
   * Détermine l'action suggérée
   */
  private determineSuggestedAction(
    status: DuplicateStatus,
    signals: DuplicateSignals,
    newFile: NewFileInput,
    candidate: CandidateDocument
  ): SuggestedAction {
    // Doublon exact : annuler par défaut (aucune utilité de remplacer)
    if (status === 'exact_duplicate') {
      return 'cancel';
    }

    // Quasi-doublon : comparer la qualité
    if (status === 'probable_duplicate') {
      // Si contextes différents, suggérer de garder les deux
      if (!signals.sameContext) {
        return 'keep_both';
      }

      // Sinon, basé sur la qualité
      if (signals.qualityComparison === 'new_better') {
        return 'replace';
      } else {
        return 'cancel';
      }
    }

    // Pas de doublon : pas d'action (ne devrait pas arriver ici)
    return 'cancel';
  }

  /**
   * Construit le contenu de la modale
   */
  private buildModalContent(
    status: DuplicateStatus,
    suggestedAction: SuggestedAction,
    candidate: CandidateDocument,
    signals: DuplicateSignals
  ): DedupOutput['modal'] {
    const locale = this.config.locale;

    // Niveau d'alerte
    const level: ModalLevel =
      status === 'exact_duplicate'
        ? 'danger'
        : status === 'probable_duplicate'
        ? 'warning'
        : 'info';

    // Titre
    const title =
      locale === 'fr'
        ? status === 'exact_duplicate'
          ? 'Doublon exact détecté'
          : 'Doublon probable détecté'
        : status === 'exact_duplicate'
        ? 'Exact duplicate detected'
        : 'Probable duplicate detected';

    // Message
    const uploadDate = new Date(candidate.uploadedAt).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const message =
      locale === 'fr'
        ? status === 'exact_duplicate'
          ? `Ce fichier est identique à « ${candidate.name} » (uploadé le ${uploadDate}).`
          : `Ce fichier semble très similaire à « ${candidate.name} » (uploadé le ${uploadDate}).`
        : status === 'exact_duplicate'
        ? `This file is identical to "${candidate.name}" (uploaded on ${uploadDate}).`
        : `This file appears very similar to "${candidate.name}" (uploaded on ${uploadDate}).`;

    // CTAs
    const primaryCta =
      suggestedAction === 'replace'
        ? {
            action: 'replace' as SuggestedAction,
            label: locale === 'fr' ? 'Remplacer le fichier existant' : 'Replace existing file',
          }
        : {
            action: 'cancel' as SuggestedAction,
            label: locale === 'fr' ? 'Annuler' : 'Cancel',
          };

    const secondaryCta =
      suggestedAction === 'replace'
        ? {
            action: 'cancel' as SuggestedAction,
            label: locale === 'fr' ? 'Annuler' : 'Cancel',
          }
        : {
            action: 'keep_both' as SuggestedAction,
            label: locale === 'fr' ? 'Conserver les deux (avancé)' : 'Keep both (advanced)',
          };

    return {
      level,
      title,
      message,
      primaryCta,
      secondaryCta,
      showComparison: true,
    };
  }

  /**
   * Compare les périodes de deux documents
   */
  private comparePeriods(
    period1?: { from: string; to: string },
    period2?: { from: string; to: string }
  ): boolean {
    if (!period1 || !period2) return false;
    return period1.from === period2.from && period1.to === period2.to;
  }

  /**
   * Compare les contextes de deux documents
   */
  private compareContexts(
    context1: NewFileInput['context'],
    context2: CandidateDocument['context']
  ): boolean {
    return (
      context1.propertyId === context2.propertyId &&
      context1.Tenant === context2.Tenant &&
      context1.leaseId === context2.leaseId &&
      context1.transactionId === context2.transactionId
    );
  }

  /**
   * Compare la qualité de deux documents
   * Critères (par ordre de priorité) : pages > qualité OCR > taille
   */
  private compareQuality(
    newFile: NewFileInput,
    candidate: CandidateDocument
  ): QualityComparison {
    // 1. Comparer le nombre de pages (plus = meilleur)
    if (newFile.pages !== candidate.pages) {
      return newFile.pages > candidate.pages ? 'new_better' : 'existing_better';
    }

    // 2. Comparer la qualité OCR
    if (Math.abs(newFile.ocr.quality - candidate.ocr.quality) > 0.05) {
      return newFile.ocr.quality > candidate.ocr.quality
        ? 'new_better'
        : 'existing_better';
    }

    // 3. Comparer la taille (plus grand = meilleur, souvent meilleure résolution)
    if (Math.abs(newFile.size - candidate.size) > 1024) {
      // Différence > 1KB
      return newFile.size > candidate.size ? 'new_better' : 'existing_better';
    }

    return 'equal';
  }

  /**
   * Construit la liste des différences pour affichage
   */
  private buildDifferences(
    newFile: NewFileInput,
    candidate: CandidateDocument
  ): string[] {
    const differences: string[] = [];

    // Pages
    differences.push(
      `Pages: ${newFile.pages} vs ${candidate.pages}${
        newFile.pages !== candidate.pages
          ? ` (${newFile.pages > candidate.pages ? 'nouveau meilleur' : 'existant meilleur'})`
          : ''
      }`
    );

    // Qualité OCR
    differences.push(
      `Qualité OCR: ${newFile.ocr.quality.toFixed(2)} vs ${candidate.ocr.quality.toFixed(
        2
      )}${
        Math.abs(newFile.ocr.quality - candidate.ocr.quality) > 0.05
          ? ` (${
              newFile.ocr.quality > candidate.ocr.quality
                ? 'nouveau meilleur'
                : 'existant meilleur'
            })`
          : ''
      }`
    );

    // Taille
    const newSizeKB = (newFile.size / 1024).toFixed(1);
    const candidateSizeKB = (candidate.size / 1024).toFixed(1);
    differences.push(
      `Taille: ${newSizeKB} KB vs ${candidateSizeKB} KB${
        Math.abs(newFile.size - candidate.size) > 1024
          ? ` (${newFile.size > candidate.size ? 'nouveau meilleur' : 'existant meilleur'})`
          : ''
      }`
    );

    // Similarité textuelle
    const textSim = TextSimilarityService.calculateSimilarity(
      newFile.ocr.text,
      candidate.ocr.textPreview
    );
    differences.push(`Similarité textuelle: ${(textSim * 100).toFixed(1)}%`);

    return differences;
  }

  /**
   * Construit une raison de décision lisible
   */
  private buildDecisionReason(status: DuplicateStatus, signals: DuplicateSignals): string {
    if (status === 'exact_duplicate') {
      return 'Checksum identique - fichier exactement identique';
    }

    if (status === 'probable_duplicate') {
      const reasons: string[] = [];

      if (signals.textSimilarity >= this.config.textSimilarityThreshold) {
        reasons.push(`similarité textuelle élevée (${(signals.textSimilarity * 100).toFixed(1)}%)`);
      }

      if (signals.samePeriod) {
        reasons.push('même période');
      }

      return `Quasi-doublon détecté : ${reasons.join(', ')}`;
    }

    return 'Pas de doublon détecté';
  }

  /**
   * Construit une réponse "pas de doublon"
   */
  private buildNoDuplicateResponse(startTime: number): DedupOutput {
    return {
      status: 'not_duplicate',
      TypeSignal: {
        checksumMatch: false,
        textSimilarity: 0,
        samePeriod: false,
        sameContext: false,
        qualityComparison: 'equal',
        differences: [],
      },
      suggestedAction: 'keep_both',
      modal: {
        level: 'info',
        title: this.config.locale === 'fr' ? 'Aucun doublon détecté' : 'No duplicate detected',
        message:
          this.config.locale === 'fr'
            ? 'Ce document ne semble pas être un doublon.'
            : 'This document does not appear to be a duplicate.',
        primaryCta: {
          action: 'keep_both',
          label: this.config.locale === 'fr' ? 'Continuer' : 'Continue',
        },
        secondaryCta: {
          action: 'cancel',
          label: this.config.locale === 'fr' ? 'Annuler' : 'Cancel',
        },
        showComparison: false,
      },
      metadata: {
        decisionReason: 'Aucun candidat ou aucun match trouvé',
        timestamp: new Date().toISOString(),
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Logger interne (seulement si debug activé)
   */
  private log(message: string, data?: any) {
    if (this.config.enableDebugLogs) {
      console.log(`[DedupAgent] ${message}`, data || '');
    }
  }
}

// Export d'une instance singleton
let dedupAgentInstance: DedupAgentService | null = null;

export function getDedupAgent(config?: Partial<DedupConfig>): DedupAgentService {
  if (!dedupAgentInstance || config) {
    dedupAgentInstance = new DedupAgentService(config);
  }
  return dedupAgentInstance;
}

