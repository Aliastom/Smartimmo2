/**
 * API Route - Export des paramètres fiscaux
 * GET /api/admin/tax/export?version=CODE&includeRefs=true
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { FiscalExportBundleSchema, type FiscalExportBundle } from '@/types/fiscal-export';
import crypto from 'crypto';

/**
 * Normalise les valeurs calcProfile de la BDD vers le format attendu
 * BDD: micro_bic, reel_foncier, is_normal, etc.
 * Export: BIC_MICRO, FONCIER_REEL, IS, etc.
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

function normalizeCalcProfile(profile: string): string {
  const mapping: Record<string, string> = {
    'micro_foncier': 'FONCIER_MICRO',
    'reel_foncier': 'FONCIER_REEL',
    'micro_bic': 'BIC_MICRO',
    'reel_bic': 'BIC_REEL',
    'is_normal': 'IS',
    'is': 'IS',
    // Déjà au bon format
    'FONCIER_MICRO': 'FONCIER_MICRO',
    'FONCIER_REEL': 'FONCIER_REEL',
    'BIC_MICRO': 'BIC_MICRO',
    'BIC_REEL': 'BIC_REEL',
    'IS': 'IS',
  };

  return mapping[profile] || profile.toUpperCase();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const versionCode = searchParams.get('version');
    const includeRefs = searchParams.get('includeRefs') === 'true';

    if (!versionCode) {
      return NextResponse.json(
        { error: 'Le paramètre "version" est requis' },
        { status: 400 }
      );
    }

    // Récupérer la version fiscale
    const version = await prisma.fiscalVersion.findUnique({
      where: { code: versionCode },
      include: { params: true },
    });

    if (!version) {
      return NextResponse.json(
        { error: 'Version fiscale non trouvée' },
        { status: 404 }
      );
    }

    if (!version.params) {
      return NextResponse.json(
        { error: 'Cette version ne contient pas de paramètres' },
        { status: 400 }
      );
    }

    // Construire le bundle d'export
    const bundle: FiscalExportBundle = {
      meta: {
        exportedAt: new Date().toISOString(),
        app: 'SmartImmo',
        version: '1.0',
        checksum: '', // Calculé après
        exportedBy: 'admin', // TODO: Récupérer l'utilisateur connecté
      },
      data: {
        version: {
          code: version.code,
          year: version.year,
          source: version.source,
          status: version.status as 'draft' | 'published' | 'archived',
          notes: version.notes,
        },
        params: {
          jsonData: JSON.parse(version.params.jsonData),
          overrides: version.params.overrides ? JSON.parse(version.params.overrides) : null,
        },
      },
    };

    // Inclure les référentiels si demandé
    if (includeRefs) {
      // Types fiscaux
      const types = await prisma.fiscalType.findMany({
        orderBy: { category: 'asc' },
      });
      bundle.data.types = types.map((t) => ({
        id: t.id,
        label: t.label,
        category: t.category as 'FONCIER' | 'BIC' | 'IS',
        description: t.description,
        isActive: t.isActive,
      }));

      // Régimes fiscaux
      const regimes = await prisma.fiscalRegime.findMany({
        orderBy: { label: 'asc' },
      });
      bundle.data.regimes = regimes.map((r) => ({
        id: r.id,
        label: r.label,
        appliesToIds: JSON.parse(r.appliesToIds),
        engagementYears: r.engagementYears,
        eligibility: r.eligibility ? JSON.parse(r.eligibility) : null,
        calcProfile: normalizeCalcProfile(r.calcProfile),
        description: r.description,
        isActive: r.isActive,
      }));

      // Compatibilités
      const compat = await prisma.fiscalCompatibility.findMany({
        orderBy: [{ scope: 'asc' }, { left: 'asc' }],
      });
      bundle.data.compat = compat.map((c) => ({
        id: c.id,
        scope: c.scope as 'category' | 'type',
        left: c.left,
        right: c.right,
        rule: c.rule as 'CAN_MIX' | 'GLOBAL_SINGLE_CHOICE' | 'MUTUALLY_EXCLUSIVE',
        note: c.note,
      }));
    }

    // Calculer le checksum
    const bundleStr = JSON.stringify(bundle.data);
    bundle.meta.checksum = crypto.createHash('sha256').update(bundleStr).digest('hex');

    // Valider le schéma
    const validated = FiscalExportBundleSchema.parse(bundle);

    // Journaliser l'export
    console.log(`✅ Export de la version ${versionCode} (${bundleStr.length} bytes, checksum: ${bundle.meta.checksum.substring(0, 8)}...)`);

    // Retourner le bundle
    const filename = `smartimmo-tax-${versionCode}-${new Date().toISOString().split('T')[0]}.json`;
    
    return new NextResponse(JSON.stringify(validated, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting fiscal data:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'export', details: error.message },
      { status: 500 }
    );
  }
}

