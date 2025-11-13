/**
 * API Routes - Admin - Diff entre deux versions fiscales
 * GET /api/admin/tax/diff?from=X&to=Y
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';

/**
 * GET /api/admin/tax/diff
 * Compare deux versions fiscales et retourne les différences
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const fromId = searchParams.get('from');
    const toId = searchParams.get('to');

    if (!fromId || !toId) {
      return NextResponse.json(
        { error: 'Les paramètres "from" et "to" sont requis' },
        { status: 400 }
      );
    }

    // Récupérer les deux versions
    const [versionFrom, versionTo] = await Promise.all([
      prisma.fiscalVersion.findUnique({
        where: { id: fromId },
        include: { params: true },
      }),
      prisma.fiscalVersion.findUnique({
        where: { id: toId },
        include: { params: true },
      }),
    ]);

    if (!versionFrom || !versionTo) {
      return NextResponse.json(
        { error: 'Une ou plusieurs versions non trouvées' },
        { status: 404 }
      );
    }

    // Parser les JSON
    const fromData = versionFrom.params?.jsonData ? JSON.parse(versionFrom.params.jsonData) : {};
    const toData = versionTo.params?.jsonData ? JSON.parse(versionTo.params.jsonData) : {};
    
    // EXCLURE 'year' et 'version' du diff (stockés dans FiscalVersion, pas dans jsonData)
    const { year: _fromYear, version: _fromVersion, ...fromWithoutMeta } = fromData;
    const { year: _toYear, version: _toVersion, ...toWithoutMeta } = toData;
    
    // Calculer les différences
    const diff = calculateDiff(fromWithoutMeta, toWithoutMeta);
    
    // Extraire le completeness report des notes de la version TO (si version scrapée)
    let completeness: any = null;
    if (versionTo.notes && versionTo.notes.includes('Sections scrapées')) {
      // Tenter d'extraire le rapport de complétude
      // Pour l'instant, on le laisse null, il sera ajouté plus tard
    }

    return NextResponse.json({
      from: {
        code: versionFrom.code,
        year: versionFrom.year,
        source: versionFrom.source,
      },
      to: {
        code: versionTo.code,
        year: versionTo.year,
        source: versionTo.source,
        notes: versionTo.notes,
      },
      changes: diff,
      completeness,
    });
  } catch (error: any) {
    console.error('Error calculating diff:', error);
    return NextResponse.json(
      { error: 'Erreur lors du calcul des différences', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Calcule les différences entre deux objets JSON
 */
function calculateDiff(from: any, to: any, path: string = ''): any[] {
  const changes: any[] = [];

  // Parcourir toutes les clés de "to"
  for (const key in to) {
    const currentPath = path ? `${path}.${key}` : key;
    const fromValue = from[key];
    const toValue = to[key];

    if (typeof toValue === 'object' && toValue !== null && !Array.isArray(toValue)) {
      // Récursion pour les objets
      changes.push(...calculateDiff(fromValue || {}, toValue, currentPath));
    } else if (JSON.stringify(fromValue) !== JSON.stringify(toValue)) {
      // Changement détecté
      changes.push({
        field: currentPath,
        oldValue: fromValue,
        newValue: toValue,
        type: fromValue === undefined ? 'added' : 'modified',
      });
    }
  }

  // Vérifier les clés supprimées
  for (const key in from) {
    if (!(key in to)) {
      const currentPath = path ? `${path}.${key}` : key;
      changes.push({
        field: currentPath,
        oldValue: from[key],
        newValue: undefined,
        type: 'removed',
      });
    }
  }

  return changes;
}

