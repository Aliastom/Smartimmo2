'use client';

import { useMemo } from 'react';
import type { EcheanceRecurrente } from '@/types/echeance';
import { sumProjected12Months } from '@/lib/echeances/echeanceCashflowHelpers';
import { getNextUncoveredOccurrenceInfo } from '@/lib/echeances/echeanceOccurrences';

export interface PilotageTodoItem {
  echeance: EcheanceRecurrente;
  propertyName: string;
  nextDate: string;
  message: string;
  daysFromToday: number;
  priority: 'high' | 'medium';
  urgencyScore: number;
  urgencyLevel: 'critique' | 'important' | 'normal';
  delayLabel: string;
  recommendedAction: 'create_transaction' | 'link_transaction';
  bestMatchTransactionId: string | null;
  bulkEligible: boolean;
}

export interface PilotageComingItem {
  echeance: EcheanceRecurrente;
  propertyName: string;
  nextDate: string;
  daysFromToday: number;
}

export interface PilotageAnomaly {
  kind: 'ecart_recurrent' | 'regle_obsolete' | 'doublon_probable';
  severity: 'elevee' | 'moyenne' | 'faible';
  title: string;
  description: string;
  recommendedAction: string;
  echeanceIds?: string[];
}

interface UseEcheancesPilotageGlobalOptions {
  echeances: EcheanceRecurrente[];
  properties: Array<{ id: string; name: string }>;
  coveredByEcheanceId: Map<string, Set<string>>;
}

export function useEcheancesPilotageGlobal({
  echeances,
  properties,
  coveredByEcheanceId,
}: UseEcheancesPilotageGlobalOptions) {
  return useMemo(() => {
    const active = echeances.filter((e) => e.isActive);
    const propertyNameById = new Map(properties.map((p) => [p.id, p.name]));
    const today = new Date();

    const todo: PilotageTodoItem[] = [];
    const coming: PilotageComingItem[] = [];
    let overdueCount = 0;

    for (const echeance of active) {
      const covered = coveredByEcheanceId.get(echeance.id) ?? new Set<string>();
      const info = getNextUncoveredOccurrenceInfo(echeance, covered, today);
      if (!info?.nextDate) continue;

      const propertyName = echeance.propertyId
        ? propertyNameById.get(echeance.propertyId) || 'Bien non trouvé'
        : 'Sans bien';

      const delayDays = info.temporalStatus === 'echue' ? Math.abs(info.daysFromToday) : 0;
      const montantAbs = Math.abs(Number(echeance.montant || 0));
      const typeLower = (echeance.type || '').toLowerCase();
      const typeBonus =
        typeLower.includes('loyer') || typeLower.includes('credit') || typeLower.includes('assurance') ? 8 : 2;
      const anomalyBonus = delayDays >= 20 ? 12 : 0;
      const urgencyScore = Math.round((delayDays * 2) + (montantAbs / 100) + anomalyBonus + typeBonus);
      const urgencyLevel: 'critique' | 'important' | 'normal' =
        urgencyScore >= 45 ? 'critique' : urgencyScore >= 20 ? 'important' : 'normal';
      const delayLabel =
        delayDays > 0
          ? `En retard de ${delayDays} jour${delayDays > 1 ? 's' : ''}`
          : `Echeance dans ${Math.max(info.daysFromToday, 0)} jour${Math.max(info.daysFromToday, 0) > 1 ? 's' : ''}`;

      if (info.temporalStatus === 'echue') {
        overdueCount += 1;
        todo.push({
          echeance,
          propertyName,
          nextDate: info.nextDate,
          message: info.message,
          daysFromToday: Math.abs(info.daysFromToday),
          priority: 'high',
          urgencyScore,
          urgencyLevel,
          delayLabel,
          recommendedAction: echeance.sens === 'DEBIT' ? 'link_transaction' : 'create_transaction',
          bestMatchTransactionId: null,
          bulkEligible: true,
        });
        continue;
      }

      if (info.daysFromToday <= 7) {
        todo.push({
          echeance,
          propertyName,
          nextDate: info.nextDate,
          message: info.message,
          daysFromToday: info.daysFromToday,
          priority: 'medium',
          urgencyScore,
          urgencyLevel,
          delayLabel,
          recommendedAction: 'create_transaction',
          bestMatchTransactionId: null,
          bulkEligible: true,
        });
      } else if (info.daysFromToday <= 90) {
        coming.push({
          echeance,
          propertyName,
          nextDate: info.nextDate,
          daysFromToday: info.daysFromToday,
        });
      }
    }

    todo.sort((a, b) => b.urgencyScore - a.urgencyScore);
    coming.sort((a, b) => a.daysFromToday - b.daysFromToday);

    const projection = sumProjected12Months(active, today);
    const net = projection.revenusTotal - projection.chargesTotal;

    const coming7 = coming.filter((i) => i.daysFromToday <= 7).length;
    const coming30 = coming.filter((i) => i.daysFromToday > 7 && i.daysFromToday <= 30).length;
    const coming90 = coming.filter((i) => i.daysFromToday > 30 && i.daysFromToday <= 90).length;

    const anomalies: PilotageAnomaly[] = [];

    // 1) Ecart recurrent : une echeance reste en priorite >= 20 jours
    const recurringGapItems = todo.filter((t) => t.daysFromToday >= 20);
    if (recurringGapItems.length > 0) {
      anomalies.push({
        kind: 'ecart_recurrent',
        severity: recurringGapItems.length >= 3 ? 'elevee' : 'moyenne',
        title: recurringGapItems.length >= 3 ? 'Ecarts recurrents a traiter' : 'Ecart recurrent detecte',
        description:
          recurringGapItems.length >= 3
            ? `${recurringGapItems.length} echeances restent non couvertes depuis longtemps, ce qui degrade le suivi portefeuille.`
            : 'Une echeance revient regulierement dans les priorites sans traitement durable.',
        recommendedAction:
          recurringGapItems.length >= 3
            ? 'Prioriser une revue des regles et lier rapidement les transactions deja saisies.'
            : 'Verifier la regle et traiter la prochaine occurrence pour sortir du cycle de rattrapage.',
        echeanceIds: recurringGapItems.map((i) => i.echeance.id),
      });
    }

    // 2) Regle obsolete / a revoir : pas d occurrence actionnable dans la fenetre
    const obsoleteCandidates = active.filter((e) => {
      const covered = coveredByEcheanceId.get(e.id) ?? new Set<string>();
      const info = getNextUncoveredOccurrenceInfo(e, covered, today);
      return !info?.nextDate;
    });
    if (obsoleteCandidates.length > 0) {
      anomalies.push({
        kind: 'regle_obsolete',
        severity: obsoleteCandidates.length >= 5 ? 'moyenne' : 'faible',
        title: 'Regles potentiellement obsoletes',
        description: `${obsoleteCandidates.length} regle(s) active(s) ne generent plus d occurrence actionnable a court/moyen terme.`,
        recommendedAction: 'Passer ces regles en revue : desactiver, ajuster periodicite ou mettre une date de fin.',
        echeanceIds: obsoleteCandidates.map((e) => e.id),
      });
    }

    // 3) Doublon probable : meme bien + libelle proche + periodicite + montant proche
    const duplicateGroups = new Map<string, EcheanceRecurrente[]>();
    for (const e of active) {
      const key = `${e.propertyId || 'none'}|${(e.label || '').trim().toLowerCase()}|${e.periodicite}|${e.sens}|${Math.round(Number(e.montant || 0))}`;
      const arr = duplicateGroups.get(key) || [];
      arr.push(e);
      duplicateGroups.set(key, arr);
    }
    const probableDuplicates = [...duplicateGroups.values()].filter((group) => group.length >= 2);
    if (probableDuplicates.length > 0) {
      const duplicateCount = probableDuplicates.reduce((acc, g) => acc + g.length, 0);
      anomalies.push({
        kind: 'doublon_probable',
        severity: probableDuplicates.length >= 2 ? 'moyenne' : 'faible',
        title: 'Doublon probable a verifier',
        description: `${duplicateCount} regle(s) presentent des caracteristiques tres proches. Verification manuelle recommandee avant fusion.`,
        recommendedAction: 'Comparer les regles suspectes et conserver uniquement la version pertinente si le doublon est confirme.',
        echeanceIds: probableDuplicates.flatMap((g) => g.map((e) => e.id)),
      });
    }

    return {
      todoNow: todo.slice(0, 10),
      comingList: coming.slice(0, 10),
      comingBuckets: { coming7, coming30, coming90 },
      projection: {
        charges: projection.chargesTotal,
        revenus: projection.revenusTotal,
        net,
      },
      anomalies,
    };
  }, [echeances, properties, coveredByEcheanceId]);
}

