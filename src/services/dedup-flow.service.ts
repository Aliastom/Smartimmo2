/**
 * Service DedupFlow - Orchestration du flux de déduplication
 * 
 * Mission : Déterminer le comportement du front et le texte de la modale
 * selon le choix de l'utilisateur lors de la détection d'un doublon.
 */

import { 
  DedupFlowInput, 
  DedupFlowOutput, 
  DedupFlowContext, 
  DedupFlowResult 
} from '@/types/dedup-flow';

export class DedupFlowService {
  
  /**
   * Orchestre le flux de déduplication selon la décision de l'utilisateur
   */
  async orchestrateFlow(
    input: DedupFlowInput, 
    context?: DedupFlowContext
  ): Promise<DedupFlowResult> {
    try {
      console.log('[DedupFlow] Orchestration du flux:', {
        duplicateType: input.duplicateType,
        userDecision: input.userDecision,
        existingFile: input.existingFile?.name
      });

      // Validation des données d'entrée
      if (!input.tempFile || !input.userDecision) {
        return {
          success: false,
          error: 'Données d\'entrée manquantes',
          nextStep: 'close'
        };
      }

      // Orchestration selon le type de doublon et la décision
      let output: DedupFlowOutput;

      switch (input.duplicateType) {
        case 'exact_duplicate':
          output = await this.handleExactDuplicate(input, context);
          break;
        case 'probable_duplicate':
          output = await this.handleProbableDuplicate(input, context);
          break;
        default:
          output = await this.handleNoDuplicate(input, context);
      }

      return {
        success: true,
        data: output,
        nextStep: this.determineNextStep(output)
      };

    } catch (error) {
      console.error('[DedupFlow] Erreur lors de l\'orchestration:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        nextStep: 'close'
      };
    }
  }

  /**
   * Gère le cas d'un doublon exact
   */
  private async handleExactDuplicate(
    input: DedupFlowInput, 
    context?: DedupFlowContext
  ): Promise<DedupFlowOutput> {
    const { userDecision, existingFile, tempFile } = input;

    switch (userDecision) {
      case 'pending':
        // Afficher la modale de détection avec les 3 options
        return {
          flow: 'duplicate_detection',
          duplicateStatus: 'exact_duplicate',
          userDecision: 'pending',
          flags: {
            skipDuplicateCheck: false,
            userForcesDuplicate: false,
            replaceExisting: false,
            deleteTempFile: false
          },
          ui: {
            title: 'Document en doublon détecté',
            banner: {
              type: 'warning',
              text: `Ce fichier est identique à ${existingFile?.name} (uploadé le ${existingFile?.uploadedAt ? new Date(existingFile.uploadedAt).toLocaleDateString('fr-FR') : 'date inconnue'}).`,
              icon: '⚠️'
            },
            primaryAction: {
              label: 'Annuler',
              action: 'cancel'
            },
            secondaryAction: {
              label: 'Conserver les deux',
              action: 'keep_both'
            }
          },
          // Ajouter les données nécessaires pour la 2ème modale
          tempFile: tempFile,
          existingFile: existingFile
        };

      case 'cancel':
        return {
          flow: 'cancel_upload',
          duplicateStatus: 'exact_duplicate',
          userDecision: 'cancel',
          flags: {
            skipDuplicateCheck: false,
            userForcesDuplicate: false,
            replaceExisting: false,
            deleteTempFile: true
          },
          ui: {
            title: 'Upload annulé',
            banner: {
              type: 'info',
              text: 'L\'upload a été annulé. Le fichier temporaire sera supprimé.',
              icon: 'ℹ️'
            },
            primaryAction: {
              label: 'Fermer',
              action: 'cancel'
            }
          },
          api: {
            endpoint: `/api/uploads/${tempFile.tempId}`,
            method: 'DELETE'
          }
        };

      case 'keep_both':
        return {
          flow: 'upload_review',
          duplicateStatus: 'user_forced',
          userDecision: 'keep_both',
          flags: {
            skipDuplicateCheck: true,
            userForcesDuplicate: true,
            replaceExisting: false,
            deleteTempFile: false
          },
          ui: {
            title: 'Revue de l\'upload – Copie volontaire d\'un doublon',
            banner: {
              type: 'info',
              text: 'Vous avez choisi de conserver ce doublon. Il sera enregistré sous un autre nom.',
              icon: '🟢'
            },
            suggestedFilename: this.generateCopyFilename(tempFile.originalName),
            primaryAction: {
              label: 'Enregistrer quand même',
              action: 'confirm'
            },
            secondaryAction: {
              label: 'Annuler',
              action: 'cancel'
            }
          }
        };

      default:
        throw new Error(`Décision utilisateur non supportée: ${userDecision}`);
    }
  }

  /**
   * Gère le cas d'un doublon probable
   */
  private async handleProbableDuplicate(
    input: DedupFlowInput, 
    context?: DedupFlowContext
  ): Promise<DedupFlowOutput> {
    // Pour les doublons probables, on peut avoir des options supplémentaires
    // comme la comparaison de qualité, etc.
    return this.handleExactDuplicate(input, context);
  }

  /**
   * Gère le cas sans doublon
   */
  private async handleNoDuplicate(
    input: DedupFlowInput, 
    context?: DedupFlowContext
  ): Promise<DedupFlowOutput> {
    return {
      flow: 'upload_review',
      duplicateStatus: 'not_duplicate',
      userDecision: input.userDecision,
      flags: {
        skipDuplicateCheck: false,
        userForcesDuplicate: false,
        replaceExisting: false,
        deleteTempFile: false
      },
      ui: {
        title: 'Revue de l\'upload',
        primaryAction: {
          label: 'Enregistrer',
          action: 'confirm'
        }
      }
    };
  }

  /**
   * Génère un nom de fichier pour la copie
   */
  private generateCopyFilename(originalName: string): string {
    const lastDotIndex = originalName.lastIndexOf('.');
    
    if (lastDotIndex === -1) {
      return `${originalName} (copie)`;
    }
    
    const name = originalName.substring(0, lastDotIndex);
    const extension = originalName.substring(lastDotIndex);
    
    return `${name} (copie)${extension}`;
  }

  /**
   * Détermine la prochaine étape selon la sortie
   */
  private determineNextStep(output: DedupFlowOutput): 'show_modal' | 'call_api' | 'redirect' | 'close' {
    switch (output.flow) {
      case 'upload_review':
        return 'show_modal';
      case 'replace_document':
        return 'call_api';
      case 'cancel_upload':
        return 'call_api';
      default:
        return 'close';
    }
  }

  /**
   * Traite le résultat d'une action API
   */
  async processApiResult(
    output: DedupFlowOutput,
    apiResult: { success: boolean; data?: any; error?: string }
  ): Promise<DedupFlowResult> {
    if (!apiResult.success) {
      return {
        success: false,
        error: apiResult.error || 'Erreur lors de l\'appel API',
        nextStep: 'close'
      };
    }

    // Mise à jour de l'UI selon le résultat
    const updatedOutput: DedupFlowOutput = {
      ...output,
      ui: {
        ...output.ui,
        banner: {
          type: 'success',
          text: this.getSuccessMessage(output.flow),
          icon: '✅'
        }
      }
    };

    return {
      success: true,
      data: updatedOutput,
      nextStep: 'close'
    };
  }

  /**
   * Génère le message de succès selon le type d'action
   */
  private getSuccessMessage(flow: string): string {
    switch (flow) {
      case 'replace_document':
        return 'Le document existant a été remplacé avec succès.';
      case 'cancel_upload':
        return 'Le fichier temporaire a été supprimé.';
      default:
        return 'Action effectuée avec succès.';
    }
  }
}

// Instance singleton
export const dedupFlowService = new DedupFlowService();
