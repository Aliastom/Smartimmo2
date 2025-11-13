import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/admin/signals - Récupérer tous les signaux du catalogue

// Force dynamic rendering for Vercel deployment
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // TODO: Ajouter protection authentification admin
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    const signals = await prisma.signal.findMany({
      where: {
        deletedAt: null,
        OR: search ? [
          { code: { contains: search } },
          { label: { contains: search } },
          { description: { contains: search } }
        ] : undefined
      },
      include: {
        TypeSignal: {
          include: {
            DocumentType: {
              select: {
                code: true,
                label: true
              }
            }
          }
        }
      },
      orderBy: {
        code: 'asc'
      }
    });

    // Calculer les utilisations
    const signalsWithUsage = signals.map(signal => ({
      id: signal.id,
      code: signal.code,
      label: signal.label,
      regex: signal.regex,
      flags: signal.flags,
      description: signal.description,
      protected: signal.protected || false,
      usages: signal.TypeSignal.length,
      documentTypes: signal.TypeSignal.map(ts => `${ts.DocumentType.label} (${ts.DocumentType.code})`),
      createdAt: signal.createdAt,
      updatedAt: signal.updatedAt
    }));

    return NextResponse.json({
      success: true,
      data: signalsWithUsage,
    });
  } catch (error) {
    console.error('Error fetching signals:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la récupération des signaux' },
      { status: 500 }
    );
  }
}

// POST /api/admin/signals - Créer un nouveau signal
export async function POST(request: NextRequest) {
  const guard = await requireAdmin(request as any);
  if (guard) return guard;
  try {
    const body = await request.json();
    const { code, label, regex, flags = 'iu', description } = body;

    // Validation
    if (!code || !label || !regex) {
      return NextResponse.json(
        { success: false, error: 'Code, label et regex sont requis' },
        { status: 400 }
      );
    }

    // Vérifier l'unicité du code
    const existing = await prisma.signal.findUnique({
      where: { code }
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Un signal avec le code "${code}" existe déjà` },
        { status: 400 }
      );
    }

    // Valider le regex
    try {
      new RegExp(regex, flags);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: `Pattern regex invalide: ${error instanceof Error ? error.message : 'Erreur inconnue'}` },
        { status: 400 }
      );
    }

    // Créer le signal
    const signal = await prisma.signal.create({
      data: {
        code,
        label,
        regex,
        flags,
        description
      }
    });

    // Invalider le cache
    await prisma.appConfig.upsert({
      where: { key: 'document_config_version' },
      update: { 
        value: JSON.stringify({ version: Date.now() }),
        updatedAt: new Date(),
      },
      create: { 
        key: 'document_config_version',
        value: JSON.stringify({ version: Date.now() }),
        description: 'Version de la configuration des documents pour invalidation du cache',
      },
    });

    return NextResponse.json({
      success: true,
      data: signal,
    });
  } catch (error) {
    console.error('Error creating signal:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la création du signal' },
      { status: 500 }
    );
  }
}
