import type { EcheanceRecurrente } from '@/types/echeance';
import { getNextUncoveredOccurrenceInfo } from '@/lib/echeances/echeanceOccurrences';

export type EcheanceExecutionStatusKey = 'a_jour' | 'a_generer' | 'en_retard' | 'ignore';

export interface EcheanceExecutionStatus {
  key: EcheanceExecutionStatusKey;
  label: string;
  className: string;
}

export interface EcheanceExecutionStatusOptions {
  /**
   * Transaction locale identifiée comme correspondance forte (même logique que le CTA « Lier » du tableau).
   * Ajuste le libellé pour éviter la contradiction avec « Non couvert ».
   */
  strongUnlinkedMatch?: boolean;
}

const STYLES: Record<EcheanceExecutionStatusKey, string> = {
  a_jour: 'bg-emerald-100 text-emerald-950 border-emerald-400 ring-1 ring-emerald-300/60',
  a_generer: 'bg-amber-100 text-amber-950 border-amber-400 ring-1 ring-amber-300/60',
  en_retard: 'bg-red-100 text-red-950 border-red-400 ring-1 ring-red-300/60',
  ignore: 'bg-gray-100 text-gray-600 border-gray-300',
};

const LABELS: Record<EcheanceExecutionStatusKey, string> = {
  a_jour: 'À jour',
  a_generer: 'Non couvert',
  en_retard: 'En retard',
  ignore: 'Ignoré',
};

/**
 * Statut d'exécution pour le pilotage : compare occurrences théoriques et transactions liées (covered).
 */
export function getEcheanceExecutionStatus(
  e: EcheanceRecurrente,
  coveredDates: Set<string>,
  refDate: Date = new Date(),
  options?: EcheanceExecutionStatusOptions
): EcheanceExecutionStatus {
  if (!e.isActive) {
    return { key: 'ignore', label: LABELS.ignore, className: STYLES.ignore };
  }

  const info = getNextUncoveredOccurrenceInfo(e, coveredDates, refDate);

  if (!info) {
    return { key: 'a_jour', label: LABELS.a_jour, className: STYLES.a_jour };
  }

  if (info.temporalStatus === 'desactive') {
    return { key: 'ignore', label: LABELS.ignore, className: STYLES.ignore };
  }

  if (info.isCovered || info.message === 'Occurrence couverte') {
    return { key: 'a_jour', label: LABELS.a_jour, className: STYLES.a_jour };
  }

  if (
    !info.nextDate &&
    (info.message === 'Aucune occurrence à venir dans la fenêtre' || info.message === 'Aucune occurrence')
  ) {
    return { key: 'a_jour', label: LABELS.a_jour, className: STYLES.a_jour };
  }

  if (info.temporalStatus === 'echue') {
    if (options?.strongUnlinkedMatch) {
      return {
        key: 'en_retard',
        label: 'En retard · à lier',
        className: STYLES.en_retard,
      };
    }
    return { key: 'en_retard', label: LABELS.en_retard, className: STYLES.en_retard };
  }

  if (options?.strongUnlinkedMatch) {
    return {
      key: 'a_generer',
      label: 'Correspondance à valider',
      className: STYLES.a_generer,
    };
  }

  return { key: 'a_generer', label: LABELS.a_generer, className: STYLES.a_generer };
}
