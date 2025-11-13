/**
 * API Routes - Admin - Publier une version fiscale
 * POST /api/admin/tax/versions/:id/publish
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateSection } from '@/services/tax/sources/utils';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';

/**
 * POST /api/admin/tax/versions/:id/publish
 * Publier une version fiscale (passer de "draft" à "published")
 * 
 * Body: {
 *   validatedBy: string  // Nom de l'admin qui valide
 * }
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: { id: string } }
) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const { id } = context.params;
    const body = await req.json();
    const { validatedBy } = body;

    if (!validatedBy) {
      return NextResponse.json(
        { error: 'Le champ "validatedBy" est requis' },
        { status: 400 }
      );
    }

    // Vérifier que la version existe et est en draft
    const version = await prisma.fiscalVersion.findUnique({
      where: { id },
      include: { params: true },
    });

    if (!version) {
      return NextResponse.json(
        { error: 'Version fiscale non trouvée' },
        { status: 404 }
      );
    }

    if (version.status !== 'draft') {
      return NextResponse.json(
        { error: 'Seules les versions en brouillon peuvent être publiées' },
        { status: 403 }
      );
    }

    if (!version.params) {
      return NextResponse.json(
        { error: 'La version ne contient pas de paramètres fiscaux' },
        { status: 400 }
      );
    }

    // SÉCURITÉ : Vérifier que les sections critiques sont présentes, valides ET avec confiance suffisante
    const params = JSON.parse(version.params.jsonData);
    const criticalSections = {
      IR: params.irBrackets,
      PS: params.psRate
    };
    
    // Seuils de confiance minimaux pour publication
    const MIN_CONFIDENCE_IR = 0.8;
    const MIN_CONFIDENCE_PS = 0.8;
    
    const missingSections: string[] = [];
    const invalidSections: string[] = [];
    const lowConfidenceSections: string[] = [];
    
    // Tenter d'extraire les scores de confiance depuis les notes
    const confidence = extractConfidenceFromNotes(version.notes);
    
    for (const [section, value] of Object.entries(criticalSections)) {
      if (value === undefined || value === null) {
        missingSections.push(section);
      } else {
        const validation = validateSection(section as any, value);
        if (validation !== 'ok') {
          invalidSections.push(section);
        }
        
        // Vérifier la confiance si disponible
        if (confidence && confidence[section] !== undefined) {
          const minConf = section === 'IR' ? MIN_CONFIDENCE_IR : MIN_CONFIDENCE_PS;
          if (confidence[section] < minConf) {
            lowConfidenceSections.push(`${section} (${(confidence[section] * 100).toFixed(0)}% < ${(minConf * 100).toFixed(0)}%)`);
          }
        }
      }
    }
    
    if (missingSections.length > 0 || invalidSections.length > 0 || lowConfidenceSections.length > 0) {
      const errors: string[] = [];
      if (missingSections.length > 0) {
        errors.push(`Sections critiques manquantes: ${missingSections.join(', ')}`);
      }
      if (invalidSections.length > 0) {
        errors.push(`Sections critiques invalides: ${invalidSections.join(', ')}`);
      }
      if (lowConfidenceSections.length > 0) {
        errors.push(`Sections critiques avec confiance insuffisante: ${lowConfidenceSections.join(', ')}`);
      }
      
      return NextResponse.json(
        { 
          error: 'Publication bloquée : sections critiques manquantes, invalides ou confiance insuffisante',
          details: errors,
          message: 'Les sections IR et PS doivent être présentes, valides et avoir une confiance ≥80% (OpenFisca + concordance web) pour publier.'
        },
        { status: 400 }
      );
    }

    // Archiver les anciennes versions publiées de la même année
    await prisma.fiscalVersion.updateMany({
      where: {
        year: version.year,
        status: 'published',
      },
      data: {
        status: 'archived',
      },
    });

    // Publier la nouvelle version
    const publishedVersion = await prisma.fiscalVersion.update({
      where: { id },
      data: {
        status: 'published',
        validatedBy,
      },
      include: {
        params: true,
      },
    });

    return NextResponse.json(publishedVersion);
  } catch (error: any) {
    console.error('Error publishing fiscal version:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la publication de la version fiscale', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Extrait les scores de confiance depuis les notes de version
 */
function extractConfidenceFromNotes(notes: string | null): Record<string, number> | null {
  if (!notes) return null;
  
  const confidence: Record<string, number> = {};
  
  // Parser les lignes du type "IR: OK (OpenFisca, confiance: 100%)"
  const regex = /([A-Z_]+):\s*OK\s*\([^,]+,\s*confiance:\s*(\d+)%\)/g;
  let match;
  
  while ((match = regex.exec(notes)) !== null) {
    const section = match[1];
    const conf = parseInt(match[2], 10) / 100;
    confidence[section] = conf;
  }
  
  return Object.keys(confidence).length > 0 ? confidence : null;
}

