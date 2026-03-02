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
  const baremeCode = await pickDefaultBaremeForYear(incomeYear);

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
      baremeCode = await pickDefaultBaremeForYear(incomeYear);
    }
  }
  if (payload.baremeCode !== undefined) {
    baremeCode = payload.baremeCode;
    incomeYear = existing.incomeYear;
  }

  const session = await fiscalSession.update({
    where: { organizationId },
    data: { declarationYear, incomeYear, baremeCode },
  });
  return toDto(session);
}

/**
 * Choisit le barème publié le plus récent pour l'année (ou fallback)
 */
async function pickDefaultBaremeForYear(incomeYear: number): Promise<string> {
  const list = await TaxParamsService.listPublishedByYear(incomeYear);
  if (list.length > 0) {
    return list[0].code;
  }
  try {
    const params = await TaxParamsService.get(incomeYear);
    return params.version;
  } catch {
    const latestYear = Math.max(...[2024, 2025]); // années en fallback hardcodé
    const params = await TaxParamsService.get(latestYear);
    return params.version;
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
