import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { protectAdminRoute } from '@/lib/auth/protectAdminRoute';

/**
 * POST /api/admin/signals/import - Importer des signaux depuis un JSON
 * 
 * Format attendu:
 * {
 *   "signals": [
 *     {
 *       "code": "HAS_IBAN",
 *       "label": "Contient un IBAN",
 *       "regex": "FR\\d{2}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{4}\\s?\\d{3}",
 *       "flags": "iu",
 *       "description": "DÃ©tecte un IBAN franÃ§ais",
 *       "protected": false
 *     }
 *   ]
 * }
 */

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Protection ADMIN
  const authError = await protectAdminRoute();
  if (authError) return authError;

  try {
    const body = await request.json();
    
    if (!body.signals || !Array.isArray(body.signals)) {
      return NextResponse.json(
        { success: false, error: 'Format invalide. Attendu: { signals: [...] }' },
        { status: 400 }
      );
    }

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const signalData of body.signals) {
      try {
        // Validation
        if (!signalData.code || !signalData.label || !signalData.regex) {
          results.errors.push(`Signal invalide (code: ${signalData.code}): code, label et regex requis`);
          results.skipped++;
          continue;
        }

        // Valider le regex
        try {
          new RegExp(signalData.regex, signalData.flags || 'iu');
        } catch (error) {
          results.errors.push(`Signal ${signalData.code}: regex invalide`);
          results.skipped++;
          continue;
        }

        // VÃ©rifier si le signal existe dÃ©jÃ 
        const existing = await prisma.signal.findUnique({
          where: { code: signalData.code },
        });

        if (existing) {
          // Mettre Ã  jour seulement si pas protÃ©gÃ©
          if (existing.protected) {
            results.errors.push(`Signal ${signalData.code}: protÃ©gÃ©, non modifiable`);
            results.skipped++;
            continue;
          }

          await prisma.signal.update({
            where: { code: signalData.code },
            data: {
              label: signalData.label,
              regex: signalData.regex,
              flags: signalData.flags || 'iu',
              description: signalData.description || null,
            },
          });
          results.updated++;
        } else {
          // CrÃ©er le signal
          await prisma.signal.create({
            data: {
              code: signalData.code,
              label: signalData.label,
              regex: signalData.regex,
              flags: signalData.flags || 'iu',
              description: signalData.description || null,
              protected: signalData.protected || false,
            },
          });
          results.created++;
        }
      } catch (error: any) {
        results.errors.push(`Signal ${signalData.code}: ${error.message}`);
        results.skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      results,
      message: `Import terminÃ©: ${results.created} crÃ©Ã©s, ${results.updated} mis Ã  jour, ${results.skipped} ignorÃ©s`,
    });
  } catch (error: any) {
    console.error('Error importing signals:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erreur lors de l\'import' },
      { status: 500 }
    );
  }
}

