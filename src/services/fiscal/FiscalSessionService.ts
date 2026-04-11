/**
 * FiscalSessionService - Gestion de la session fiscale (déclaration / barème) par organisation
 */

import { prisma } from '@/lib/prisma';
import { TaxParamsService } from '@/services/tax/TaxParamsService';

export interface FiscalSessionDto {
  id: string;
  organizationId: string;
  declarationYear: number;
  incomeYear: number;
  baremeCode: string;
  updatedAt: string;
}

const currentYear = () => new Date().getFullYear();

/**
 * Détermine l'année de déclaration par défaut (ex: en 2025 → 2026)
 */
function defaultDeclarationYear(): number {
  return currentYear() + 1;
}

type FiscalSessionRow = { id: string; organizationId: string; declarationYear: number; incomeYear: number; baremeCode: string; updatedAt: Date };

/** Accès au modèle FiscalSession (vérifie que le client Prisma a été régénéré) */
function getFiscalSessionClient() {
  const client = (prisma as { fiscalSession?: { findUnique: unknown; create: unknown; update: unknown } }).fiscalSession;
  if (!client) {
    throw new Error(
      'FiscalSession non disponible. Exécutez: npx prisma generate puis redémarrez le serveur.'
    );
  }
  return client;
}

/**
 * Récupère ou crée la session fiscale pour l'organisation
 */
export async function getOrCreateFiscalSession(organizationId: string): Promise<FiscalSessionDto> {
  const fiscalSession = getFiscalSessionClient();
  let session = await fiscalSession.findUnique({
    where: { organizationId },
  });

  if (session) {
    return toDto(session);
  }

  const declarationYear = defaultDeclarationYear();
  const incomeYear = declarationYear - 1;
  const baremeCode = await pickDefaultBaremeForDeclarationYear(declarationYear);

  session = await fiscalSession.create({
    data: {
      organizationId,
      declarationYear,
      incomeYear,
      baremeCode,
    },
  });
  return toDto(session);
}

/**
 * Met à jour la session (declarationYear et/ou baremeCode)
 */
export async function updateFiscalSession(
  organizationId: string,
  payload: { declarationYear?: number; baremeCode?: string }
): Promise<FiscalSessionDto> {
  const fiscalSession = getFiscalSessionClient();
  const existing = await fiscalSession.findUnique({
    where: { organizationId },
  });

  if (!existing) {
    const session = await getOrCreateFiscalSession(organizationId);
    return updateFiscalSession(organizationId, payload);
  }

  let declarationYear = existing.declarationYear;
  let incomeYear = existing.incomeYear;
  let baremeCode = existing.baremeCode;

  if (payload.declarationYear !== undefined) {
    declarationYear = payload.declarationYear;
    incomeYear = declarationYear - 1;
    if (payload.baremeCode === undefined) {
      baremeCode = await pickDefaultBaremeForDeclarationYear(declarationYear);
    }
  }
  if (payload.baremeCode !== undefined) {
    baremeCode = payload.baremeCode;
  }

  const session = await fiscalSession.update({
    where: { organizationId },
    data: { declarationYear, incomeYear, baremeCode },
  });
  return toDto(session);
}

/**
 * Barème par défaut pour une campagne de déclaration : `FiscalVersion.year` = année de déclaration
 * (ex. déclaration 2026 → revenus 2025, barème publié avec year=2026 type « tranches IR 2026 »).
 */
async function pickDefaultBaremeForDeclarationYear(declarationYear: number): Promise<string> {
  const list = await TaxParamsService.listPublishedByYear(declarationYear);
  if (list.length > 0) {
    return list[0].code;
  }
  try {
    const params = await TaxParamsService.get(declarationYear);
    return params.version;
  } catch {
    for (const y of [2026, 2025, 2024] as const) {
      try {
        const params = await TaxParamsService.get(y);
        return params.version;
      } catch {
        /* essai année suivante */
      }
    }
    return '2026.1';
  }
}

function toDto(row: { id: string; organizationId: string; declarationYear: number; incomeYear: number; baremeCode: string; updatedAt: Date }): FiscalSessionDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    declarationYear: row.declarationYear,
    incomeYear: row.incomeYear,
    baremeCode: row.baremeCode,
    updatedAt: row.updatedAt.toISOString(),
  };
}
